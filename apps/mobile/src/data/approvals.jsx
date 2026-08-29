import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import { useApp } from '../store';
import { api } from '../lib/api';
import { onPushMessage, registerDevice, startPushListeners, unregisterDevice } from '../lib/push';

/**
 * Gate approvals waiting on this household, and the prompt that raises them.
 *
 * The rule this is built on: **the server is the source of truth, and push is
 * only a wake-up.** A notification makes the prompt appear now rather than on
 * the next poll, but the prompt's contents always come from a fetch. That means
 * a push that is dropped, delayed, duplicated or arrives after the visitor was
 * already admitted cannot show the resident something untrue — and FCM offers no
 * guarantee against any of those.
 *
 * It also means the prompt works with no Firebase project at all, which is how
 * this can ship before somebody creates one.
 */

/* Polling is the floor, not the mechanism. Push normally beats it to the punch;
   this is what catches a missed message, a revoked notification permission, or a
   build with no Firebase. Foreground only — a backgrounded app has push, and if
   it does not, a poll it cannot run would not help. */
const POLL_MS = 20000;

const Ctx = createContext(null);
export const useApprovals = () => useContext(Ctx);

export function ApprovalProvider({ children }) {
  const { authed, me, say } = useApp();
  const flat = me?.flat || null;

  const [pending, setPending] = useState([]);
  /* Dismissing is per-session and per-visitor. Someone who swipes the prompt
     away has decided not to decide yet; re-raising it twenty seconds later would
     make the app something they fight rather than use. It still shows in the
     Gate tab, and a fresh visitor raises a fresh prompt. */
  const [dismissed, setDismissed] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);

  /* Bumped after every decision so the rest of the app refetches. Without it a
     resident approves from the prompt and the Gate screen behind it still reads
     "pending" until they pull to refresh. */
  const [revision, setRevision] = useState(0);

  const active = authed && !!flat;
  const activeRef = useRef(active);
  activeRef.current = active;

  const refresh = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      /* flatCode matters for a committee member who also lives here: they hold
         gate.view, so an unscoped read would return the whole society's pending
         visitors and prompt them about their neighbours'. The server ignores it
         for a plain resident, who is force-scoped to their own flat anyway. */
      const { visitors } = await api.get(
        `/api/visitors?status=pending&limit=20&flatCode=${encodeURIComponent(flat)}`,
      );

      /* Filtered again on the way in, even though the request already asked for
         one flat and the API scopes residents to their own regardless.
         
         This prompt interrupts whatever the resident was doing to ask them to
         let a stranger into the building, so it should refuse to raise on
         anything it cannot positively identify as theirs. Trusting the query
         string means a server that ignores the parameter — a proxy that strips
         it, a future endpoint change, a stubbed API in development — turns into
         a resident approving their neighbour's visitor. Cheap to check, and the
         failure it prevents is the whole point of the feature. */
      setPending((visitors || []).filter((v) => v.flatCode === flat));
    } catch {
      /* Offline, or the session is going. Leave whatever is on screen alone —
         clearing it would dismiss a live request because the network blipped. */
    }
  }, [flat]);

  /* Poll, but only while the app is in front. */
  useEffect(() => {
    if (!active) { setPending([]); return undefined; }

    refresh();
    let timer = setInterval(refresh, POLL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      clearInterval(timer);
      if (state === 'active') {
        /* Coming back to the front is exactly when the app is most likely to be
           stale — a notification may have arrived and been tapped. */
        refresh();
        timer = setInterval(refresh, POLL_MS);
      }
    });

    return () => { clearInterval(timer); sub.remove(); };
  }, [active, refresh]);

  /* Register this device, and tear the registration down on sign-out so the next
     person to hold the phone does not get this flat's gate requests. */
  useEffect(() => {
    if (!authed) return undefined;
    let stopRefresh = () => {};
    let cancelled = false;

    registerDevice().then((off) => {
      if (cancelled) off?.(); else stopRefresh = off || (() => {});
    });
    const stopListeners = startPushListeners();

    return () => {
      cancelled = true;
      stopRefresh();
      stopListeners();
      unregisterDevice();
    };
  }, [authed]);

  /* A push is a hint that the server has something new — so go and ask it. */
  useEffect(() => onPushMessage((msg) => {
    const type = msg?.data?.type;
    if (type === 'visitor.approval') {
      /* Tapping the notification is an explicit "show me this one", so it
         overrides an earlier dismissal of that same visitor. */
      if (msg.opened && msg.data.visitorId) {
        setDismissed((prev) => {
          if (!prev.has(msg.data.visitorId)) return prev;
          const next = new Set(prev);
          next.delete(msg.data.visitorId);
          return next;
        });
      }
      refresh();
    } else if (type === 'visitor.decision') {
      setRevision((n) => n + 1);
    }
  }), [refresh]);

  const queue = useMemo(
    () => pending.filter((v) => v.status === 'pending' && !dismissed.has(v.id)),
    [pending, dismissed],
  );

  const decide = useCallback(async (visitor, approved) => {
    setBusyId(visitor.id);
    try {
      await api.patch(`/api/visitors/${visitor.id}/status`, {
        status: approved ? 'approved' : 'denied',
      });
      setPending((list) => list.filter((v) => v.id !== visitor.id));
      setRevision((n) => n + 1);
      say(
        approved ? 'Approved — the guard has been notified.' : 'Entry denied.',
        approved ? 'ok' : 'bad',
      );
      return { ok: true };
    } catch (error) {
      /* The usual cause is that the guard or another member of the flat already
         answered, which the server reports as a 409. That is not a failure the
         resident should have to think about — drop it from the queue and move
         on. */
      if (error.status === 409) {
        setPending((list) => list.filter((v) => v.id !== visitor.id));
        say('That visitor was already dealt with.');
      } else {
        say(error.message, 'bad');
      }
      return { ok: false, error };
    } finally {
      setBusyId(null);
    }
  }, [say]);

  const dismiss = useCallback((visitor) => {
    setDismissed((prev) => new Set(prev).add(visitor.id));
  }, []);

  const value = useMemo(() => ({
    queue, current: queue[0] || null, busyId, decide, dismiss, refresh, revision,
  }), [queue, busyId, decide, dismiss, refresh, revision]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
