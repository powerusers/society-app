/**
 * Navigation.
 *
 * The web app keeps a SCREENS map and a TABS map keyed by role, and swaps the
 * bottom bar when the role changes. This keeps both maps — the tab sets are
 * copied from apps/web/src/App.jsx so the two apps agree on what each role's
 * home is — but hands the screen stack to React Navigation, which gives real
 * back-stack behaviour and the hardware back button for free.
 *
 * Every role gets a different app: different tabs, different permissions. The
 * tabs decide what is one tap away; `can()` decides what exists at all, and the
 * API re-checks everything regardless.
 */
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icons from '../icons';
import { useApp } from '../store';
import { colors as c, radius } from '../theme';
import { useVisitors } from '../data/visitors';
import { useTickets } from '../data/tickets';

import Home from '../screens/Home';
import Community from '../screens/Community';
import Visitors from '../screens/Visitors';
import Payments from '../screens/Payments';
import More from '../screens/More';
import Amenities from '../screens/Amenities';
import Helpdesk from '../screens/Helpdesk';
import Directory from '../screens/Directory';
import Documents from '../screens/Documents';
import DailyHelp from '../screens/DailyHelp';
import Vehicles from '../screens/Vehicles';
import Emergency from '../screens/Emergency';
import Profile from '../screens/Profile';

import GuardGate from '../screens/guard/GuardGate';
import GuardCheckin from '../screens/guard/GuardCheckin';
import GuardLog from '../screens/guard/GuardLog';
import Incidents from '../screens/guard/Incidents';

import AdminDashboard from '../screens/admin/AdminDashboard';
import Billing from '../screens/admin/Billing';
import Residents from '../screens/admin/Residents';
import FlatRegister from '../screens/admin/FlatRegister';
import StaffMgmt from '../screens/admin/StaffMgmt';
import SocietySettings from '../screens/admin/SocietySettings';
import Audit from '../screens/admin/Audit';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* Tab sets, copied from apps/web/src/App.jsx. */
const TABS = {
  resident: [
    { name: 'Home', icon: Icons.Home, label: 'Home', comp: Home },
    { name: 'Community', icon: Icons.Board, label: 'Community', comp: Community },
    { name: 'Visitors', icon: Icons.Gate, label: 'Gate', comp: Visitors, badge: 'gate' },
    { name: 'Payments', icon: Icons.Rupee, label: 'Payments', comp: Payments },
    { name: 'More', icon: Icons.Grid, label: 'More', comp: More },
  ],
  committee: [
    { name: 'Home', icon: Icons.Home, label: 'Home', comp: Home },
    { name: 'Community', icon: Icons.Board, label: 'Community', comp: Community },
    { name: 'Visitors', icon: Icons.Gate, label: 'Gate', comp: Visitors, badge: 'gate' },
    { name: 'AdminDashboard', icon: Icons.Chart, label: 'Manage', comp: AdminDashboard },
    { name: 'More', icon: Icons.Grid, label: 'More', comp: More },
  ],
  staff: [
    { name: 'Helpdesk', icon: Icons.Ticket, label: 'Tickets', comp: Helpdesk, badge: 'tickets' },
    { name: 'DailyHelp', icon: Icons.Users, label: 'Staff', comp: DailyHelp },
    { name: 'GuardGate', icon: Icons.Gate, label: 'Gate', comp: GuardGate },
    { name: 'More', icon: Icons.Grid, label: 'More', comp: More },
  ],
  guard: [
    { name: 'GuardGate', icon: Icons.Gate, label: 'Gate', comp: GuardGate, badge: 'gate' },
    { name: 'GuardCheckin', icon: Icons.Finger, label: 'Check-in', comp: GuardCheckin },
    { name: 'GuardLog', icon: Icons.Clock, label: 'Log', comp: GuardLog },
    { name: 'Incidents', icon: Icons.AlertTri, label: 'Incidents', comp: Incidents },
    { name: 'More', icon: Icons.Grid, label: 'More', comp: More },
  ],
};
TABS.admin = TABS.committee;

/** Screens reachable by pushing, not by a tab. */
const PUSHED = [
  { name: 'Amenities', comp: Amenities },
  { name: 'Helpdesk', comp: Helpdesk },
  { name: 'Directory', comp: Directory },
  { name: 'Documents', comp: Documents },
  { name: 'DailyHelp', comp: DailyHelp },
  { name: 'Vehicles', comp: Vehicles },
  { name: 'Emergency', comp: Emergency },
  { name: 'Profile', comp: Profile },
  { name: 'Incidents', comp: Incidents },
  { name: 'GuardGate', comp: GuardGate },
  { name: 'GuardCheckin', comp: GuardCheckin },
  { name: 'GuardLog', comp: GuardLog },
  { name: 'AdminDashboard', comp: AdminDashboard },
  { name: 'Billing', comp: Billing },
  { name: 'Residents', comp: Residents },
  { name: 'FlatRegister', comp: FlatRegister },
  { name: 'StaffMgmt', comp: StaffMgmt },
  { name: 'SocietySettings', comp: SocietySettings },
  { name: 'Audit', comp: Audit },
];

/**
 * The shell owns the badge counts so they stay right on every tab, not only on
 * whichever screen happens to be open — the same reasoning as the web shell.
 */
function useBadges() {
  const { me, can } = useApp();
  const { visitors } = useVisitors();
  const { tickets } = useTickets();

  const gate = can('gate.view')
    ? visitors.filter((v) => v.status === 'pending' || v.status === 'waiting').length
    : visitors.filter((v) => v.status === 'pending' && v.flatCode === me?.flat).length;

  const open = tickets.filter((t) => t.status !== 'closed').length;

  return { gate, tickets: open };
}

const TabIcon = ({ icon: I, focused, count }) => (
  <View>
    <I size={21} color={focused ? c.accent : c.ink4} />
    {count > 0 && (
      <View style={s.pip}>
        <Text style={s.pipTxt}>{count > 99 ? '99+' : count}</Text>
      </View>
    )}
  </View>
);

function Tabs() {
  const { role } = useApp();
  const insets = useSafeAreaInsets();
  const badges = useBadges();
  const tabs = TABS[role] || TABS.resident;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.ink4,
        tabBarStyle: [s.tabBar, { height: 56 + insets.bottom, paddingBottom: 9 + insets.bottom }],
        tabBarLabelStyle: s.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      {tabs.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.comp}
          options={{
            tabBarLabel: t.label,
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={t.icon} focused={focused} count={t.badge ? badges[t.badge] : 0} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

/* A white app on a white background: the navigator's own theme would otherwise
   paint the default light grey behind screen transitions. */
const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: c.surface, card: c.surface, border: c.line, primary: c.accent, text: c.ink },
};

export default function Navigation() {
  const { role } = useApp();

  return (
    <NavigationContainer theme={theme}>
      {/* Keyed by role so switching accounts rebuilds the tab set rather than
          leaving a guard looking at a resident's tabs. */}
      <Stack.Navigator key={role} screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        {PUSHED.map((p) => (
          <Stack.Screen key={p.name} name={`${p.name}Screen`} component={p.comp} />
        ))}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  tabBar: {
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: 7,
    elevation: 0,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: -0.02,
    marginTop: Platform.OS === 'android' ? 2 : 0,
  },
  pip: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 15,
    height: 15,
    borderRadius: radius.pill,
    backgroundColor: c.bad,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  pipTxt: { color: '#fff', fontSize: 9, fontWeight: '600' },
});
