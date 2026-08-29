import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Linking, Pressable, StyleSheet, Text, View,
} from 'react-native';
import Icons from '../icons';
import { Btn, Muted, Tiny } from './ui';
import { colors as c, radius, type } from '../theme';

/**
 * QR scanner for gate passes and staff cards.
 *
 * VisionCamera's code scanner is native — MLKit on Android — so this needs
 * neither worklets nor reanimated, both of which are optional peers. The model
 * is bundled rather than downloaded on demand; see the note in gradle.properties.
 *
 * Every failure here has a way forward, because the alternative is a guard stuck
 * at a gate with somebody waiting. No permission, no camera, a lens that will
 * not focus in the dark — each of those ends with the caller's typed-code
 * fallback still on screen, never with a dead end.
 */

/* Required lazily and guarded: the library is native, and a JS-only context —
   a bundle built before it was installed, or a future platform — would
   otherwise throw at import time and take the whole screen with it. */
let VisionCamera;
function camera() {
  if (VisionCamera !== undefined) return VisionCamera;
  try {
    // eslint-disable-next-line global-require
    VisionCamera = require('react-native-vision-camera');
  } catch {
    VisionCamera = null;
  }
  return VisionCamera;
}

export const scannerAvailable = () => !!camera();

export default function QrScanner({ onScan, hint, height = 260 }) {
  const lib = camera();
  const [permission, setPermission] = useState('checking'); // checking | granted | denied | blocked
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);

  /* One code, once. MLKit reports the same symbol on every frame it can still
     see it — perhaps thirty times a second — and without this a single pass
     would fire thirty verify calls and admit the visitor thirty times. */
  const handled = useRef(false);

  const device = lib?.useCameraDevice?.('back');

  const ask = useCallback(async () => {
    if (!lib) return;
    const current = lib.Camera.getCameraPermissionStatus();
    if (current === 'granted') { setPermission('granted'); return; }

    const asked = await lib.Camera.requestCameraPermission();
    /* "denied" from this call means the user has refused in a way Android will
       not prompt for again — the only route left is Settings. */
    setPermission(asked === 'granted' ? 'granted' : (current === 'denied' ? 'blocked' : 'denied'));
  }, [lib]);

  useEffect(() => { ask(); }, [ask]);

  const codeScanner = lib?.useCodeScanner?.({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (handled.current) return;
      const value = codes?.[0]?.value?.trim();
      if (!value) return;
      handled.current = true;
      onScan(value);
    },
  });

  /* Re-arm when the caller comes back for another scan. */
  useEffect(() => () => { handled.current = false; }, []);

  if (!lib) {
    return <Fallback icon={Icons.Camera} text="Scanning is not available in this build." />;
  }

  if (permission === 'checking') {
    return (
      <View style={[s.frame, { height }]}>
        <ActivityIndicator color={c.ink4} />
      </View>
    );
  }

  if (permission !== 'granted') {
    return (
      <View style={[s.frame, { height, paddingHorizontal: 22 }]}>
        <Icons.Camera size={30} color={c.ink4} />
        <Muted style={s.centered}>
          {permission === 'blocked'
            ? 'Camera access is turned off for Prangan. Turn it on in Settings to scan passes.'
            : 'Prangan needs the camera to scan a gate pass.'}
        </Muted>
        <Btn
          size="sm"
          variant="outline"
          icon={Icons.Camera}
          style={{ marginTop: 14 }}
          onPress={() => (permission === 'blocked' ? Linking.openSettings() : ask())}
        >
          {permission === 'blocked' ? 'Open settings' : 'Allow camera'}
        </Btn>
      </View>
    );
  }

  if (!device) {
    return <Fallback icon={Icons.Camera} text="No camera on this device." />;
  }

  return (
    <View style={[s.frame, { height, overflow: 'hidden' }]}>
      <lib.Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        torch={torch ? 'on' : 'off'}
        codeScanner={codeScanner}
        onInitialized={() => setReady(true)}
        /* A camera that dies mid-scan must not blank the sheet — the typed code
           below it still works. */
        onError={() => setReady(false)}
      />

      <Reticle />

      <Pressable
        onPress={() => setTorch((t) => !t)}
        style={[s.torch, torch && s.torchOn]}
        hitSlop={8}
        accessibilityLabel={torch ? 'Turn off torch' : 'Turn on torch'}
      >
        <Icons.Zap size={17} color={torch ? c.n900 : '#fff'} />
      </Pressable>

      {hint ? (
        <View style={s.hintBar}>
          <Tiny style={s.hintTxt}>{ready ? hint : 'Starting the camera…'}</Tiny>
        </View>
      ) : null}
    </View>
  );
}

/** A sweeping line, so it is obvious the camera is live and not a frozen frame. */
function Reticle() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);

  return (
    <View pointerEvents="none" style={s.reticleWrap}>
      <View style={s.reticle}>
        <View style={[s.corner, s.tl]} />
        <View style={[s.corner, s.tr]} />
        <View style={[s.corner, s.bl]} />
        <View style={[s.corner, s.br]} />
        <Animated.View
          style={[s.sweep, {
            transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [6, 154] }) }],
          }]}
        />
      </View>
    </View>
  );
}

const Fallback = ({ icon: I, text }) => (
  <View style={[s.frame, { height: 120 }]}>
    <I size={26} color={c.ink4} />
    <Muted style={s.centered}>{text}</Muted>
  </View>
);

const s = StyleSheet.create({
  frame: {
    backgroundColor: c.n900,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  centered: { textAlign: 'center', marginTop: 10, color: c.n300 },

  reticleWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: 170, height: 170 },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  sweep: { position: 'absolute', left: 8, right: 8, height: 2, backgroundColor: c.accent, opacity: 0.9 },

  torch: {
    position: 'absolute', top: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  torchOn: { backgroundColor: '#fff' },

  hintBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(20,23,28,0.55)',
  },
  hintTxt: { ...type.tiny, color: '#fff', textAlign: 'center' },
});
