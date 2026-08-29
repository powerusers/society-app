/**
 * QR rendering for gate passes, staff cards and patrol checkpoints.
 *
 * The web version rasterises to a data URL with the `qrcode` package and shows
 * an <img>. Here react-native-qrcode-svg draws real vector nodes through
 * react-native-svg, so the code stays crisp at any size and there is no base64
 * string held in memory — which matters on the pass screen, where the code is
 * shown large enough for a guard to scan off the glass.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors as c, radius, type } from '../theme';

export default function QR({ value, size = 168, caption }) {
  return (
    <View style={s.wrap}>
      <View style={[s.frame, { width: size, height: size }]}>
        <QRCode
          value={String(value ?? '')}
          size={size - 16}
          color="#14171C"
          backgroundColor="#FFFFFF"
          ecl="M"
          quietZone={0}
        />
      </View>
      {caption ? <Text style={s.caption}>{caption}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  frame: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  caption: {
    ...type.mono,
    marginTop: 8,
    fontWeight: '700',
    color: c.brand,
    letterSpacing: 2,
    fontSize: 13,
  },
});
