/** Residents & approvals — the register of who lives here, and who wants to. */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ROLES } from '@gvs/shared';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Alert, Avatar, Badge, Btn, Card, Confirm, Empty, H3, H4, ListGroup, Muted,
  SearchBar, Section, Segmented, Select, Sheet, SkeletonList, Tiny, Input, useForm,
} from '../../components/ui';
import { useUsers, useRegistrations } from '../../data/society';
import { fmtDate } from '../../lib/format';
import { colors as c, PAD } from '../../theme';

export default function Residents() {
  const nav = useNavigation();
  const [tab, setTab] = useState('approvals');
  const users = useUsers();
  const regs = useRegistrations();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const pending = regs.registrations.filter((r) => r.status === 'pending');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users.users;
    return users.users.filter((u) => (
      u.name?.toLowerCase().includes(needle) || u.flat?.toLowerCase().includes(needle)
    ));
  }, [users.users, q]);

  return (
    <Screen
      title="Residents & Flats"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={() => Promise.all([users.refetch(), regs.refetch()])}
    >
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'approvals', label: `Approvals${pending.length ? ` (${pending.length})` : ''}` },
          { value: 'members', label: 'Members' },
        ]}
      />

      {tab === 'approvals' ? (
        <View style={{ marginTop: 12 }}>
          {pending.length ? (
            <>
              <Alert kind="info">
                Verify each applicant against the society's flat register before approving.
                Owners are asked for the sale deed; tenants for a rent agreement.
              </Alert>
              {pending.map((r) => (
                <Card key={r.id}>
                  <View style={s.head}>
                    <Avatar name={r.name} />
                    <View style={s.grow}>
                      <H3>{r.name}</H3>
                      <Tiny style={{ marginTop: 3 }}>
                        {[`Flat ${r.flatCode}`, r.relation, r.phone].filter(Boolean).join(' · ')}
                      </Tiny>
                      <Tiny style={{ marginTop: 2 }}>{r.email}</Tiny>
                      <Tiny style={{ marginTop: 2 }}>Applied {fmtDate(r.at)}</Tiny>
                    </View>
                  </View>
                  <View style={s.actions}>
                    <Btn size="sm" variant="outline" icon={Icons.X} onPress={() => setRejecting(r)}>Reject</Btn>
                    <Btn size="sm" icon={Icons.Check} onPress={() => setApproving(r)}>Approve</Btn>
                  </View>
                </Card>
              ))}
            </>
          ) : (
            <Empty
              icon={Icons.UserPlus}
              title="No pending approvals"
              note="New resident registrations appear here for the committee to verify."
            />
          )}
        </View>
      ) : null}

      {tab === 'members' ? (
        <View style={{ marginTop: 12 }}>
          <SearchBar value={q} onChange={setQ} placeholder="Search a name or flat…" />
          {users.loading && !users.users.length ? <SkeletonList rows={6} /> : list.length ? (
            <ListGroup>
              {list.map((u) => (
                <View key={u.id} style={s.li}>
                  <Avatar name={u.name} />
                  <View style={s.grow}>
                    <H4 numberOfLines={1}>{u.name}</H4>
                    <Tiny style={{ marginTop: 2 }}>
                      {[u.flat ? `Flat ${u.flat}` : u.designation, u.relation, u.phone].filter(Boolean).join(' · ')}
                    </Tiny>
                    <View style={s.wrap}>
                      <Badge color="brand">{u.role}</Badge>
                      {u.status !== 'active' ? <Badge color="red">{u.status}</Badge> : null}
                    </View>
                  </View>
                  <Btn size="sm" variant="ghost" onPress={() => setOpen(u)}>Manage</Btn>
                </View>
              ))}
            </ListGroup>
          ) : (
            <Empty icon={Icons.Users} title={q ? `Nobody matches "${q}"` : 'No members yet'} />
          )}
        </View>
      ) : null}

      {approving ? (
        <ApproveSheet r={approving} onClose={() => setApproving(null)} onApprove={regs.approve} />
      ) : null}
      {rejecting ? (
        <Confirm
          title="Reject registration?"
          body={`${rejecting.name} will be told their application for flat ${rejecting.flatCode} was not approved.`}
          confirmLabel="Reject"
          danger
          onConfirm={() => regs.reject(rejecting.id, 'Could not be verified against the flat register')}
          onClose={() => setRejecting(null)}
        />
      ) : null}
      {open ? <MemberSheet u={open} onClose={() => setOpen(null)} users={users} /> : null}
    </Screen>
  );
}

function ApproveSheet({ r, onClose, onApprove }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ role: 'resident' });

  const submit = async () => {
    setBusy(true);
    const res = await onApprove(r.id, { role: f.f.role });
    setBusy(false);
    if (res.ok) onClose();
  };

  return (
    <Sheet title={`Approve ${r.name}`} onClose={onClose}>
      <Muted style={{ marginBottom: 14 }}>
        They will be able to sign in immediately and will appear in the resident directory
        for flat {r.flatCode}.
      </Muted>
      <Select
        label="Role" value={f.f.role} onChange={(v) => f.set('role', v)}
        options={ROLES.map((x) => ({ value: x, label: x }))}
      />
      <Btn block icon={Icons.Check} onPress={submit} loading={busy}>Approve</Btn>
    </Sheet>
  );
}

function MemberSheet({ u, onClose, users }) {
  const [confirm, setConfirm] = useState(null);

  return (
    <Sheet title={u.name} onClose={onClose}>
      <Tiny style={{ marginBottom: 14 }}>
        {[u.flat ? `Flat ${u.flat}` : u.designation, u.email, u.phone].filter(Boolean).join(' · ')}
      </Tiny>

      <Select
        label="Role"
        value={u.role}
        onChange={(v) => users.setRole(u.id, v)}
        options={ROLES.map((x) => ({ value: x, label: x }))}
      />

      {u.status === 'active' ? (
        <Btn block variant="danger" icon={Icons.Lock} onPress={() => setConfirm('suspend')}>
          Suspend member
        </Btn>
      ) : (
        <Btn block icon={Icons.Check} onPress={() => users.reinstate(u.id)}>Reinstate member</Btn>
      )}

      {confirm === 'suspend' ? (
        <Confirm
          title="Suspend member?"
          body={`${u.name} will be signed out and unable to sign back in until reinstated.`}
          confirmLabel="Suspend"
          danger
          onConfirm={() => { users.suspend(u.id, 'Suspended by the committee'); onClose(); }}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 12 },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
});
