/**
 * The screen shell: header, scrolling body, safe areas.
 *
 * The web app centralises this in App.jsx — one header, a screen stack beneath
 * it. React Navigation would happily draw the header instead, but its styling
 * knobs stop short of the exact hairline-and-17px-title treatment the design
 * asks for, so headers stay `headerShown: false` in the navigator and every
 * screen renders this. That also keeps the title next to the screen it belongs
 * to rather than in a route table three files away.
 *
 * Pull-to-refresh is native-only and has no counterpart on the web: on a phone
 * it is the gesture people actually reach for, and every screen here is backed
 * by a repository hook that already exposes refetch.
 */
import React, { useCallback, useState } from 'react';
import {
  Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icons from '../icons';
import { colors as c, PAD, radius, type } from '../theme';

export function Header({ title, sub, onBack, right, dense }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.hdr, { paddingTop: insets.top + (dense ? 8 : 13) }]}>
      <View style={s.hdrRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={s.iconBtnGhost} accessibilityLabel="Back">
            <Icons.Back size={20} color={c.ink3} />
          </Pressable>
        ) : null}
        <View style={s.grow}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export default function Screen({
  title, sub, onBack, right, children, onRefresh, scroll = true, contentStyle,
}) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh]);

  const body = (
    <>
      {children}
      {/* Clears the tab bar. The web app uses a 96px bottom pad for the same
          reason; here the inset is added because gesture-nav bars vary. */}
      <View style={{ height: 24 + insets.bottom }} />
    </>
  );

  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={c.surface} />
      {title ? <Header title={title} sub={sub} onBack={onBack} right={right} /> : null}
      {scroll ? (
        <ScrollView
          style={s.grow}
          contentContainerStyle={[s.body, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh
            ? <RefreshControl refreshing={refreshing} onRefresh={doRefresh} colors={[c.accent]} tintColor={c.accent} />
            : undefined}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[s.grow, s.body, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surface },
  grow: { flex: 1, minWidth: 0 },
  hdr: {
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    paddingHorizontal: PAD,
    paddingBottom: 12,
  },
  hdrRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontWeight: '600', letterSpacing: -0.34, color: c.ink, lineHeight: 21 },
  sub: { fontSize: 12, color: c.ink4, marginTop: 1, fontWeight: '400' },
  iconBtnGhost: {
    width: 28, height: 28, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', marginLeft: -6,
  },
  body: { paddingHorizontal: PAD, paddingTop: 4 },
});

export { s as screenStyles };
