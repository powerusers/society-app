/**
 * More — everything that is not a tab.
 *
 * The entries are filtered by capability, not by role string. Adding a role is a
 * one-line change in packages/shared/src/capabilities.js and this list follows.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import { Avatar, Badge, Confirm, H4, ListGroup, Section, Tiny } from '../components/ui';
import { useApp } from '../store';
import { APP_NAME } from '../lib/brand';
import { colors as c, PAD } from '../theme';

export default function More() {
  const nav = useNavigation();
  const { me, role, can, settings, logout } = useApp();
  const [confirm, setConfirm] = React.useState(false);

  /* `cap: null` means everyone; otherwise the capability the API will also
     check. Nothing here is gated on a role name. */
  const GROUPS = [
    {
      title: 'Your society',
      items: [
        { icon: Icons.Calendar, label: 'Amenities & classes', to: 'AmenitiesScreen', cap: null },
        { icon: Icons.Ticket, label: 'Helpdesk', to: 'HelpdeskScreen', cap: null },
        { icon: Icons.Users, label: 'Resident directory', to: 'DirectoryScreen', cap: null },
        { icon: Icons.Folder, label: 'Documents', to: 'DocumentsScreen', cap: null },
        { icon: Icons.Broom, label: 'Daily help & staff', to: 'DailyHelpScreen', cap: null },
        { icon: Icons.Car, label: 'Vehicles & parking', to: 'VehiclesScreen', cap: null },
        { icon: Icons.Phone, label: 'Emergency contacts', to: 'EmergencyScreen', cap: null, tone: 'red' },
      ],
    },
    {
      title: 'Gate & security',
      items: [
        { icon: Icons.Gate, label: 'Gate console', to: 'GuardGateScreen', cap: 'gate.operate' },
        { icon: Icons.Finger, label: 'Staff check-in', to: 'GuardCheckinScreen', cap: 'gate.operate' },
        { icon: Icons.Clock, label: 'Gate log', to: 'GuardLogScreen', cap: 'gate.view' },
        { icon: Icons.AlertTri, label: 'Incidents', to: 'IncidentsScreen', cap: 'gate.view' },
      ],
    },
    {
      title: 'Committee',
      items: [
        { icon: Icons.Chart, label: 'Committee dashboard', to: 'AdminDashboardScreen', cap: 'accounts.view' },
        { icon: Icons.Bank, label: 'Billing', to: 'BillingScreen', cap: 'billing.make' },
        { icon: Icons.Users, label: 'Residents & approvals', to: 'ResidentsScreen', cap: 'resident.approve' },
        { icon: Icons.Building, label: 'Flat register', to: 'FlatRegisterScreen', cap: 'resident.approve' },
        { icon: Icons.Tools, label: 'Society staff', to: 'StaffMgmtScreen', cap: 'staff.manage' },
        { icon: Icons.Settings, label: 'Society settings', to: 'SocietySettingsScreen', cap: 'settings.view' },
        { icon: Icons.Book, label: 'Audit trail', to: 'AuditScreen', cap: 'settings.view' },
      ],
    },
  ];

  return (
    <Screen title="More">
      <Pressable style={s.profile} onPress={() => nav.navigate('ProfileScreen')} android_ripple={{ color: c.n100 }}>
        <Avatar name={me?.name} size="lg" />
        <View style={s.grow}>
          <H4 style={{ fontSize: 16 }}>{me?.name}</H4>
          <Tiny style={{ marginTop: 3 }}>
            {[me?.flat ? `Flat ${me.flat}` : me?.designation, settings.societyName].filter(Boolean).join(' · ')}
          </Tiny>
          <View style={{ marginTop: 6, flexDirection: 'row' }}>
            <Badge color="brand">{role}</Badge>
          </View>
        </View>
        <Icons.Fwd size={16} color={c.ink3} />
      </Pressable>

      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.cap || can(i.cap));
        if (!items.length) return null;
        return (
          <React.Fragment key={g.title}>
            <Section title={g.title} />
            <ListGroup>
              {items.map((i) => (
                <Pressable
                  key={i.label}
                  style={s.li}
                  android_ripple={{ color: c.n100 }}
                  onPress={() => nav.navigate(i.to)}
                >
                  <View style={s.icoTile}>
                    <i.icon size={18} color={i.tone === 'red' ? c.bad : c.ink4} />
                  </View>
                  <H4 style={s.grow}>{i.label}</H4>
                  <Icons.Fwd size={15} color={c.ink3} />
                </Pressable>
              ))}
            </ListGroup>
          </React.Fragment>
        );
      })}

      <Section title="Account" />
      <ListGroup>
        <Pressable style={s.li} android_ripple={{ color: c.n100 }} onPress={() => setConfirm(true)}>
          <View style={s.icoTile}><Icons.LogOut size={18} color={c.bad} /></View>
          <H4 style={[s.grow, { color: c.bad }]}>Sign out</H4>
        </Pressable>
      </ListGroup>

      <Tiny style={s.version}>{APP_NAME} for Android</Tiny>

      {confirm ? (
        <Confirm
          title="Sign out?"
          body="You will need your email and password to sign back in."
          confirmLabel="Sign out"
          danger
          onConfirm={logout}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 15, marginTop: 8,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12,
  },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },
  version: { textAlign: 'center', marginTop: 22 },
});
