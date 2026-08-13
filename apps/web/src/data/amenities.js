import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/**
 * Amenities, the diary of bookings, and the classes that run in them.
 *
 * Whether a booking needs the committee's approval is the amenity's property
 * and the server's decision — the browser version inferred it from the amount,
 * which meant the answer was whatever the client sent. Clashes are decided by a
 * unique index rather than by a scan of local storage, so `book` can come back
 * with "that slot has just been taken" and mean it.
 */
export function useAmenities() {
  const { live, me, db, say, sel } = useApp();
  const local = useActions();

  const list = useQuery(
    () => api.get("/api/amenities").then((r) => r.amenities),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );
  const diary = useQuery(
    () => api.get("/api/amenities/bookings").then((r) => r.bookings),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );
  const classQ = useQuery(
    () => api.get("/api/amenities/classes").then((r) => r.classes),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  /* The seed keeps amenity ids on bookings and resolves names through a
     selector; the API sends the name and the flat already. Normalising here
     lets the screen read one shape in both modes. */
  const localBookings = useMemo(() => db.bookings.map((b) => {
    const a = sel.amenity(b.amenityId);
    return {
      ...b,
      amenityName: a?.name || "",
      amenityEmoji: a?.emoji || "",
      userName: sel.userName(b.userId),
      mine: b.userId === me?.id,
    };
  }), [db.bookings, me?.id, sel]);

  const localClasses = useMemo(() => db.classes.map((c) => ({
    ...c,
    amenityName: sel.amenity(c.amenityId)?.name || null,
    waiting: 0,
    mine: null,
  })), [db.classes, sel]);

  const amenities = live ? (list.data || []) : db.amenities;
  const bookings = live ? (diary.data || []) : localBookings;
  const classes = live ? (classQ.data || []) : localClasses;

  const mine = useMemo(() => bookings.filter((b) => b.mine), [bookings]);
  const pending = useMemo(() => bookings.filter((b) => b.status === "pending"), [bookings]);

  /** Slots already spoken for on a given day — cancelled ones are free again. */
  const takenSlots = useCallback((amenityId, date) => bookings
    .filter((b) => b.amenityId === amenityId && b.date === date && b.status !== "cancelled")
    .map((b) => b.slot), [bookings]);

  const book = useCallback(async (payload) => {
    if (!live) return { ok: !!local.book(payload), booking: null };
    try {
      const { booking } = await api.post("/api/amenities/bookings", payload);
      await diary.refetch();
      say(booking.status === "pending" ? "Requested — the committee will confirm" : "Booked ✓");
      return { ok: true, booking };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, diary, say]);

  const decide = useCallback(async (booking, decision, reason = "") => {
    if (!live) { local.decideBooking(booking.id, decision); return { ok: true }; }
    try {
      await api.post(`/api/amenities/bookings/${booking.id}/decide`, { decision, reason });
      await diary.refetch();
      say(decision === "confirmed" ? "Booking approved ✓" : "Booking rejected", decision === "confirmed" ? "ok" : "bad");
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, diary, say]);

  const cancel = useCallback(async (booking) => {
    if (!live) { local.decideBooking(booking.id, "cancelled"); return { ok: true }; }
    try {
      await api.del(`/api/amenities/bookings/${booking.id}`);
      await diary.refetch();
      say("Booking cancelled");
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, diary, say]);

  const addAmenity = useCallback(async (payload) => {
    if (!live) return { ok: true, amenity: local.addAmenity(payload) };
    try {
      const { amenity } = await api.post("/api/amenities", payload);
      await list.refetch();
      say(`${amenity.name} added`);
      return { ok: true, amenity };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, list, say]);

  const retireAmenity = useCallback(async (amenity) => {
    if (!live) return { ok: true };
    try { await api.del(`/api/amenities/${amenity.id}`); await list.refetch(); say(`${amenity.name} retired`); return { ok: true }; }
    catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, list, say]);

  const addClass = useCallback(async (payload) => {
    if (!live) return { ok: true, class: local.addClass(payload) };
    try {
      const { class: created } = await api.post("/api/amenities/classes", payload);
      await classQ.refetch();
      say(`${created.name} added`);
      return { ok: true, class: created };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, classQ, say]);

  /** Enrol or leave — the same button, because the class knows which you are. */
  const toggleEnrol = useCallback(async (klass) => {
    if (!live) { local.enrol(klass.id); return { ok: true, joined: true }; }
    try {
      const joining = !klass.mine;
      const { class: updated } = joining
        ? await api.post(`/api/amenities/classes/${klass.id}/enrol`, {})
        : await api.del(`/api/amenities/classes/${klass.id}/enrol`);
      await classQ.refetch();
      if (joining) say(updated.mine === "waitlisted" ? "Added to the waitlist" : "Enrolled ✓");
      else say("You have left the class");
      return { ok: true, joined: joining, class: updated };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, classQ, say]);

  return {
    amenities, bookings, classes, mine, pending, takenSlots,
    loading: live ? (list.loading || diary.loading) : false,
    error: live ? (list.error || diary.error || classQ.error) : null,
    refetch: () => { list.refetch(); diary.refetch(); classQ.refetch(); },
    book, decide, cancel, addAmenity, retireAmenity, addClass, toggleEnrol,
  };
}
