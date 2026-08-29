/**
 * UI kit — the React Native port of apps/web/src/components/ui.jsx.
 *
 * Same component names and same props as the web kit, so a ported screen reads
 * almost identically to its web counterpart. The CSS classes become StyleSheet
 * objects; the design intent is unchanged and documented in ../theme.js.
 *
 * Three components have no DOM equivalent and are genuinely rebuilt:
 *   Select   — Android has no <select>; this opens a sheet of options.
 *   Sheet    — a real Modal with a slide-up animation and back-button handling.
 *   Toggle   — an animated track/knob rather than a styled checkbox.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, BackHandler, Easing, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icons from '../icons';
import { colors as c, radius, PAD, type } from '../theme';
import { initials } from '../lib/format';

/* ------------------------------------------------------------------ text -- */
/* Thin wrappers so screens write <H2>…</H2> instead of repeating style objects,
   mirroring the .h1/.h2/.muted/.tiny classes. */
export const H1 = ({ style, ...p }) => <Text {...p} style={[type.h1, style]} />;
export const H2 = ({ style, ...p }) => <Text {...p} style={[type.h2, style]} />;
export const H3 = ({ style, ...p }) => <Text {...p} style={[type.h3, style]} />;
export const H4 = ({ style, ...p }) => <Text {...p} style={[type.h4, style]} />;
export const Num = ({ style, ...p }) => <Text {...p} style={[type.num, style]} />;
export const Muted = ({ style, ...p }) => <Text {...p} style={[type.muted, style]} />;
export const Tiny = ({ style, ...p }) => <Text {...p} style={[type.tiny, style]} />;
export const Mono = ({ style, ...p }) => <Text {...p} style={[type.mono, style]} />;

/* --------------------------------------------------------------- buttons -- */
const BTN_VARIANT = {
  '':        { bg: c.accent,      fg: c.onAccent, border: 'transparent' },
  primary:   { bg: c.accent,      fg: c.onAccent, border: 'transparent' },
  outline:   { bg: c.surface,     fg: c.ink,      border: c.lineStrong },
  ghost:     { bg: c.n100,        fg: c.ink2,     border: 'transparent' },
  danger:    { bg: c.bad,         fg: '#fff',     border: 'transparent' },
  warn:      { bg: c.warn,        fg: '#fff',     border: 'transparent' },
  white:     { bg: '#fff',        fg: c.ink,      border: 'transparent' },
};

/**
 * Whether these children contain a bare string React Native must not render loose.
 *
 * `typeof children === 'string'` was not enough: `<Btn>Admit {name}</Btn>` arrives
 * as the array ['Admit ', 'Ramesh Plumber'], which fell through to being rendered
 * directly. React Native then throws "Text strings must be rendered within a
 * <Text> component" and the button loses its label entirely — a red error and a
 * blank button, from a call site that looks perfectly ordinary.
 *
 * Checking the array too means call sites can interpolate without knowing this.
 */
const hasBareText = (children) => {
  const bare = (x) => typeof x === 'string' || typeof x === 'number';
  return bare(children) || (Array.isArray(children) && children.some(bare));
};

export const Btn = ({ variant = '', size, block, icon: I, children, onPress, onClick, disabled, loading, style }) => {
  const v = BTN_VARIANT[variant] || BTN_VARIANT[''];
  const sm = size === 'sm';
  const lg = size === 'lg';
  const press = onPress || onClick;
  const off = disabled || loading;

  return (
    <Pressable
      onPress={press}
      disabled={off}
      android_ripple={{ color: 'rgba(255,255,255,0.16)' }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: v.bg, borderColor: v.border },
        sm && s.btnSm,
        lg && s.btnLg,
        block && s.btnBlock,
        off && s.btnOff,
        pressed && !off && s.btnPressed,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color={v.fg} />
        : I ? <I size={sm ? 15 : 17} color={v.fg} /> : null}
      {hasBareText(children)
        ? <Text style={[s.btnTxt, { color: v.fg }, sm && s.btnTxtSm, lg && s.btnTxtLg]}>{children}</Text>
        : children}
    </Pressable>
  );
};

export const LinkBtn = ({ children, onPress, icon: I }) => (
  <Pressable onPress={onPress} hitSlop={8} style={s.linkBtn}>
    {I && <I size={13} color={c.accent} />}
    <Text style={s.linkBtnTxt}>{children}</Text>
  </Pressable>
);

/** The dashed "add another" affordance from .dashed. */
export const DashedBtn = ({ children, onPress, icon: I = Icons.Plus }) => (
  <Pressable onPress={onPress} style={s.dashed}>
    <I size={15} color={c.ink3} />
    <Text style={s.dashedTxt}>{children}</Text>
  </Pressable>
);

/* --------------------------------------------------------------- status --- */
const BADGE_COLOR = {
  green: c.ok, red: c.bad, amber: c.warn, blue: c.info,
  purple: c.alt, brand: c.accent,
};

/**
 * A quiet word with a leading dot. `solid` is the one exception — a state that
 * has to be seen at a glance — and `bare` drops the dot for counts, which are
 * values rather than statuses.
 */
export const Badge = ({ color, children, bare, solid, style }) => {
  if (solid) {
    return (
      <View style={[s.badgeSolid, style]}>
        <Text style={s.badgeSolidTxt}>{children}</Text>
      </View>
    );
  }
  const fg = BADGE_COLOR[color] || c.ink3;
  return (
    <View style={[s.badge, style]}>
      {!bare && <View style={[s.badgeDot, { backgroundColor: BADGE_COLOR[color] || c.n300 }]} />}
      <Text style={[s.badgeTxt, { color: fg }]}>{children}</Text>
    </View>
  );
};

/** Pulsing dot for live states — the .blink class. */
export const Blink = ({ color = 'amber' }) => {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  const bg = { amber: c.warn, red: c.bad, green: c.ok }[color] || c.warn;
  return <Animated.View style={[s.blink, { backgroundColor: bg, opacity: a }]} />;
};

/* -------------------------------------------------------------- surfaces -- */
export const Card = ({ children, style, flat, tight, onPress }) => {
  const body = (
    <View style={[s.card, flat && s.cardFlat, tight && s.cardTight, style]}>{children}</View>
  );
  return onPress
    ? <Pressable onPress={onPress} android_ripple={{ color: c.n100 }}>{body}</Pressable>
    : body;
};

/** The one dark surface in the app: a single figure that leads a screen. */
export const Panel = ({ children, style }) => <View style={[s.panel, style]}>{children}</View>;

export const Section = ({ title, action, children }) => (
  <>
    <View style={s.sect}>
      <Text style={type.h2}>{title}</Text>
      {action}
    </View>
    {children}
  </>
);

export const Hairline = ({ style }) => <View style={[s.hairline, style]} />;

/** A ruled group of records — the .list class. Bleeds to the screen edge. */
export const ListGroup = ({ children, style }) => <View style={[s.list, style]}>{children}</View>;

/* ----------------------------------------------------------------- forms -- */
export const Field = ({ label, hint, error, children }) => (
  <View style={s.field}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    {children}
    {hint && !error ? <Text style={s.hint}>{hint}</Text> : null}
    {error ? <Text style={s.err}>{error}</Text> : null}
  </View>
);

export const Input = ({ label, hint, error, value, onChangeText, onChange, style, ...p }) => {
  const [focus, setFocus] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      <TextInput
        value={value == null ? '' : String(value)}
        onChangeText={onChangeText || onChange}
        placeholderTextColor={c.ink4}
        style={[s.inp, focus && s.inpFocus, error && s.inpErr, style]}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...p}
      />
    </Field>
  );
};

export const TextArea = ({ label, hint, error, style, ...p }) => (
  <Input
    label={label}
    hint={hint}
    error={error}
    multiline
    textAlignVertical="top"
    style={[s.textarea, style]}
    {...p}
  />
);

/**
 * Android has no <select>. Tapping opens a sheet listing the options, which is
 * also what a 150-flat picker needs — a native spinner is unusable at that
 * length.
 */
export const Select = ({ label, hint, error, options = [], value, onChange, placeholder = 'Select…' }) => {
  const [open, setOpen] = useState(false);
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = opts.find((o) => o.value === value);

  return (
    <>
      <Field label={label} hint={hint} error={error}>
        <Pressable onPress={() => setOpen(true)} style={[s.inp, s.selectRow, error && s.inpErr]}>
          <Text style={[s.selectTxt, !current && { color: c.ink4 }]} numberOfLines={1}>
            {current ? current.label : placeholder}
          </Text>
          <Icons.Down size={14} color={c.ink4} />
        </Pressable>
      </Field>

      {open && (
        <Sheet title={label || 'Select'} onClose={() => setOpen(false)}>
          <ListGroup>
            {opts.map((o) => (
              <Pressable
                key={String(o.value)}
                onPress={() => { onChange?.(o.value); setOpen(false); }}
                android_ripple={{ color: c.n100 }}
                style={[s.li, o.value === value && s.liOn]}
              >
                <Text style={[type.h4, s.grow]}>{o.label}</Text>
                {o.value === value && <Icons.Check size={16} color={c.accent} />}
              </Pressable>
            ))}
          </ListGroup>
        </Sheet>
      )}
    </>
  );
};

export const Toggle = ({ on, onChange, label, desc }) => {
  const a = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: on ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [on, a]);

  return (
    <View style={[s.row, { paddingVertical: 9 }]}>
      <View style={s.grow}>
        <Text style={type.h4}>{label}</Text>
        {desc ? <Text style={[type.tiny, { marginTop: 2 }]}>{desc}</Text> : null}
      </View>
      <Pressable onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityState={{ checked: !!on }}>
        <Animated.View style={[s.switch, {
          backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: [c.n300, c.accent] }),
        }]}>
          <Animated.View style={[s.switchKnob, {
            left: a.interpolate({ inputRange: [0, 1], outputRange: [2, 18] }),
          }]} />
        </Animated.View>
      </Pressable>
    </View>
  );
};

/** Underlined tab strip — the .seg class. */
export const Segmented = ({ value, onChange, options }) => (
  <View style={s.seg}>
    {options.map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      const on = value === v;
      return (
        <Pressable key={String(v)} onPress={() => onChange(v)} style={s.segBtn}>
          <Text style={[s.segTxt, on && s.segTxtOn]}>{l}</Text>
          {on && <View style={s.segUnderline} />}
        </Pressable>
      );
    })}
  </View>
);

/** Horizontally scrolling pill filters — the .chiprow class. */
export const Chips = ({ value, onChange, options }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={s.chiprow}
    contentContainerStyle={s.chiprowInner}
  >
    {options.map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      const on = value === v;
      return (
        <Pressable key={String(v)} onPress={() => onChange(v)} style={[s.chip, on && s.chipOn]}>
          <Text style={[s.chipTxt, on && s.chipTxtOn]}>{l}</Text>
        </Pressable>
      );
    })}
  </ScrollView>
);

export const SearchBar = ({ value, onChange, placeholder = 'Search…' }) => (
  <View style={s.searchWrap}>
    <Icons.Search size={16} color={c.ink3} style={s.searchIcon} />
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.ink4}
      style={[s.inp, { paddingLeft: 36 }]}
    />
  </View>
);

/* ------------------------------------------------------------------ data -- */
/* People get neutral initials. Assigning everyone a different bright colour is
   decoration pretending to be information. */
export const Avatar = ({ name, size }) => (
  <View style={[s.avatar, size === 'lg' && s.avatarLg]}>
    <Text style={[s.avatarTxt, size === 'lg' && s.avatarTxtLg]}>{initials(name)}</Text>
  </View>
);

/** Emoji belongs to illustrative content (an amenity, a service), never to structure. */
export const EmojiTile = ({ children, size }) => (
  <View style={s.icoTile}><Text style={{ fontSize: size === 'lg' ? 20 : 17 }}>{children}</Text></View>
);

export const IconTile = ({ icon: I, color = c.ink4 }) => (
  <View style={s.icoTile}><I size={18} color={color} /></View>
);

/* `color` is accepted for call-site compatibility but ignored: a row of metrics
   in five different colours is noise. Emphasis comes from size and order. */
export const Stat = ({ value, label, onPress, divided }) => {
  const body = (
    <View style={[s.stat, divided && s.statDivided]}>
      <Text style={s.statNum}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} style={s.grow}>{body}</Pressable> : body;
};

/** A row of metrics divided by hairlines rather than boxed — the .grid3 rule. */
export const StatRow = ({ children }) => <View style={s.statRow}>{children}</View>;

export const Bar = ({ value, max, color = c.ink }) => (
  <View style={s.bar}>
    <View style={[s.barFill, {
      width: `${Math.min(100, max ? (value / max) * 100 : 0)}%`,
      backgroundColor: color,
    }]} />
  </View>
);

const ALERT_KIND = {
  info: { bg: c.n50, fg: c.ink2, border: c.line },
  warn: { bg: c.warnBg, fg: c.warn, border: c.warnLine },
  err: { bg: c.badBg, fg: c.bad, border: c.badLine },
  ok: { bg: c.okBg, fg: c.ok, border: c.okLine },
};

export const Alert = ({ kind = 'info', icon: I = Icons.Info, children }) => {
  const k = ALERT_KIND[kind] || ALERT_KIND.info;
  return (
    <View style={[s.alert, { backgroundColor: k.bg, borderColor: k.border }]}>
      <I size={17} color={k.fg} style={{ marginTop: 1 }} />
      <Text style={[s.alertTxt, { color: k.fg }]}>{children}</Text>
    </View>
  );
};

export const Empty = ({ icon: I = Icons.Box, title, note, action }) => (
  <View style={s.empty}>
    <I size={20} color={c.n300} style={{ marginBottom: 10 }} />
    <Text style={s.emptyTitle}>{title}</Text>
    {note ? <Text style={s.emptyNote}>{note}</Text> : null}
    {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
  </View>
);

/* Placeholder rows for a list that is still loading from the API. The web uses a
   shimmer keyframe; a gentle opacity pulse is the native-driver equivalent and
   costs nothing on the JS thread. */
const Shimmer = ({ style }) => {
  const a = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.5, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ backgroundColor: c.n100, borderRadius: 3, opacity: a }, style]} />;
};

export const SkeletonList = ({ rows = 4 }) => (
  <ListGroup>
    {Array.from({ length: rows }, (_, i) => (
      <View style={s.skelRow} key={i}>
        <Shimmer style={{ width: 36, height: 36, borderRadius: radius.sm }} />
        <View style={s.grow}>
          <Shimmer style={{ width: `${55 + ((i * 13) % 30)}%`, height: 10, marginBottom: 8 }} />
          <Shimmer style={{ width: '35%', height: 9 }} />
        </View>
      </View>
    ))}
  </ListGroup>
);

export const SkeletonCard = () => (
  <Card>
    <Shimmer style={{ width: '45%', height: 13, marginBottom: 8 }} />
    <Shimmer style={{ width: '85%', height: 10, marginBottom: 8 }} />
    <Shimmer style={{ width: '70%', height: 10 }} />
  </Card>
);

/** One record in a ruled list — the .li class. */
export const Row = ({ icon: I, emoji, avatar, title, sub, meta, right, onPress, onClick, badge, selected }) => {
  const press = onPress || onClick;
  const body = (
    <View style={[s.li, selected && s.liOn]}>
      {avatar ? <Avatar name={avatar} />
        : I ? <IconTile icon={I} />
        : emoji ? <EmojiTile>{emoji}</EmojiTile> : null}
      <View style={s.grow}>
        <Text style={type.h4} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[type.tiny, { marginTop: 2 }]} numberOfLines={2}>{sub}</Text> : null}
        {meta}
      </View>
      {badge}
      {right}
      {press && <Icons.Fwd size={15} color={c.ink3} />}
    </View>
  );
  return press
    ? <Pressable onPress={press} android_ripple={{ color: c.n100 }}>{body}</Pressable>
    : body;
};

/* -------------------------------------------------------------- overlays -- */
/**
 * Bottom sheet. Unlike the web version this is a real Modal, so it sits above
 * the tab bar and the Android back button closes it — which users will press,
 * and which would otherwise pop the whole screen off the navigator.
 */
export const Sheet = ({ title, onClose, children, footer }) => {
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(a, {
      toValue: 1, duration: 220, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true,
    }).start();
  }, [a]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose?.(); return true; });
    return () => sub.remove();
  }, [onClose]);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose}>
        {/* Stops a tap inside the sheet from reaching the scrim behind it. */}
        <Pressable style={s.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[s.sheet, {
              paddingBottom: 26 + insets.bottom,
              transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
            }]}
          >
            <View style={s.sheetHd}>
              <Text style={s.sheetTitle}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={10} style={s.x}>
                <Icons.X size={16} color={c.ink4} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
              {children}
            </ScrollView>
            {footer}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export const Confirm = ({ title, body, confirmLabel = 'Confirm', danger, onConfirm, onClose }) => (
  <Sheet title={title} onClose={onClose}>
    <Text style={[type.muted, { marginBottom: 18 }]}>{body}</Text>
    <View style={{ flexDirection: 'row', gap: 9 }}>
      <Btn variant="ghost" block onPress={onClose} style={s.grow}>Cancel</Btn>
      <Btn variant={danger ? 'danger' : ''} block onPress={() => { onConfirm(); onClose(); }} style={s.grow}>
        {confirmLabel}
      </Btn>
    </View>
  </Sheet>
);

export const Toast = ({ toast, onHide }) => {
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return undefined;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(onHide, 2600);
    return () => clearTimeout(t);
  }, [toast, onHide, a]);

  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.toast, {
        top: insets.top + 10,
        backgroundColor: toast.kind === 'bad' ? c.bad : c.n900,
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }]}
    >
      <Text style={s.toastTxt}>{toast.text}</Text>
    </Animated.View>
  );
};

/* ------------------------------------------------------------------ hooks -- */
/** Re-renders on a timer — used for delivery overstay and SLA clocks. */
export const useTick = (ms = 30000) => {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
};

/**
 * Same shape as the web useForm. `bind` returns RN props — onChangeText rather
 * than onChange with an event — because there is no event object to read
 * target.value from.
 */
export const useForm = (init) => {
  const [f, set] = useState(init);
  const ref = useRef(init);
  ref.current = f;
  const setK = useCallback((k, v) => set((p) => ({ ...p, [k]: v })), []);
  return {
    f,
    set: setK,
    bind: (k) => ({ value: f[k] ?? '', onChangeText: (v) => setK(k, v) }),
    reset: () => set(init),
    all: () => ref.current,
  };
};

/* ----------------------------------------------------------------- styles -- */
const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  /* buttons */
  btn: {
    paddingVertical: 9.5, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, overflow: 'hidden',
  },
  btnSm: { paddingVertical: 6, paddingHorizontal: 11, gap: 5 },
  btnLg: { paddingVertical: 12, paddingHorizontal: 20 },
  btnBlock: { alignSelf: 'stretch' },
  btnOff: { opacity: 0.4 },
  btnPressed: { opacity: 0.85 },
  btnTxt: { fontSize: 13.5, fontWeight: '500', letterSpacing: -0.11 },
  btnTxtSm: { fontSize: 12.5 },
  btnTxtLg: { fontSize: 15 },

  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkBtnTxt: { color: c.accent, fontWeight: '500', fontSize: 12.5 },

  dashed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: c.n300,
    borderRadius: radius.md,
  },
  dashedTxt: { color: c.ink3, fontWeight: '400', fontSize: 13 },

  /* status */
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgeDot: { width: 5, height: 5, borderRadius: 2.5 },
  badgeTxt: { fontSize: 12, fontWeight: '400', lineHeight: 17 },
  badgeSolid: { backgroundColor: c.bad, paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.sm },
  badgeSolidTxt: { color: '#fff', fontSize: 12, fontWeight: '500' },
  blink: { width: 6, height: 6, borderRadius: 3 },

  /* surfaces */
  card: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
    borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 15, marginBottom: 10,
  },
  cardFlat: { backgroundColor: c.n25 },
  cardTight: { paddingVertical: 11, paddingHorizontal: 13 },
  panel: {
    backgroundColor: c.n900, borderRadius: radius.lg,
    paddingVertical: 18, paddingHorizontal: 17, marginBottom: 12,
  },
  sect: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 10, marginTop: 26, marginBottom: 2,
  },
  hairline: { height: 1, backgroundColor: c.line, marginVertical: 12, marginHorizontal: -15 },
  list: {
    marginHorizontal: -PAD, marginBottom: 4,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line,
  },

  /* forms */
  field: { marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: '500', color: c.ink2, marginBottom: 6 },
  inp: {
    paddingVertical: 9.5, paddingHorizontal: 11, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.surface,
    fontSize: 14, color: c.ink,
  },
  inpFocus: { borderColor: c.accent },
  inpErr: { borderColor: c.bad },
  textarea: { minHeight: 88, lineHeight: 21, paddingTop: 9.5 },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectTxt: { fontSize: 14, color: c.ink, flex: 1 },
  hint: { fontSize: 12, color: c.ink4, marginTop: 5, lineHeight: 17 },
  err: { fontSize: 12, color: c.bad, marginTop: 5, fontWeight: '400' },

  switch: { width: 38, height: 22, borderRadius: radius.pill, justifyContent: 'center' },
  switchKnob: {
    position: 'absolute', top: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
    elevation: 2, shadowColor: '#14171C', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },

  seg: {
    flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderBottomColor: c.line,
    marginHorizontal: -PAD, paddingHorizontal: PAD, marginBottom: 4,
  },
  segBtn: { paddingTop: 9, paddingBottom: 10 },
  segTxt: { fontSize: 13.5, fontWeight: '400', color: c.ink3 },
  segTxtOn: { color: c.ink, fontWeight: '600' },
  segUnderline: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: c.ink },

  chiprow: { marginHorizontal: -PAD, marginBottom: 14 },
  chiprowInner: { gap: 7, paddingHorizontal: PAD, paddingVertical: 1 },
  chip: {
    borderWidth: 1, borderColor: c.lineStrong, borderRadius: radius.pill,
    paddingVertical: 5, paddingHorizontal: 12, backgroundColor: c.surface,
  },
  chipOn: { backgroundColor: c.ink, borderColor: c.ink },
  chipTxt: { fontSize: 12.5, fontWeight: '400', color: c.ink2 },
  chipTxtOn: { color: '#fff', fontWeight: '500' },

  searchWrap: { position: 'relative', marginBottom: 12, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },

  /* data */
  avatar: {
    width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.n100,
  },
  avatarLg: { width: 56, height: 56 },
  avatarTxt: { fontWeight: '600', fontSize: 12, color: c.ink2 },
  avatarTxtLg: { fontSize: 18 },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },

  statRow: { flexDirection: 'row' },
  stat: { paddingVertical: 2, paddingHorizontal: 12 },
  statDivided: { borderLeftWidth: 1, borderLeftColor: c.line },
  statNum: { fontSize: 19, fontWeight: '600', letterSpacing: -0.53, color: c.ink },
  statLbl: { fontSize: 11.5, color: c.ink4, fontWeight: '400', marginTop: 3 },

  bar: { height: 4, borderRadius: radius.pill, backgroundColor: c.n150, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },

  alert: {
    borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12,
    flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 10, borderWidth: 1,
  },
  alertTxt: { fontSize: 12.5, lineHeight: 19, flex: 1 },

  empty: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24 },
  emptyTitle: { color: c.ink2, fontSize: 14, fontWeight: '500', marginBottom: 4 },
  emptyNote: { color: c.ink4, fontSize: 12, lineHeight: 17, textAlign: 'center', maxWidth: 270, marginTop: 5 },

  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  liOn: { backgroundColor: c.accentSoft },
  skelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD, borderBottomWidth: 1, borderBottomColor: c.line,
  },

  /* overlays */
  scrim: { flex: 1, backgroundColor: 'rgba(20,23,28,0.4)', justifyContent: 'flex-end' },
  sheetWrap: { width: '100%' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingTop: 20, paddingHorizontal: PAD, maxHeight: '90%',
  },
  sheetHd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, gap: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: c.ink, letterSpacing: -0.34, flex: 1 },
  x: { width: 28, height: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },

  toast: {
    position: 'absolute', alignSelf: 'center', maxWidth: '88%',
    paddingVertical: 9, paddingHorizontal: 15, borderRadius: radius.md, zIndex: 300,
    elevation: 8, shadowColor: '#14171C', shadowOpacity: 0.16, shadowRadius: 12,
  },
  toastTxt: { color: '#fff', fontSize: 13, fontWeight: '400', textAlign: 'center', lineHeight: 18 },
});

export { s as uiStyles };
