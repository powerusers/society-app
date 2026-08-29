/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import GateApproval from './src/screens/GateApproval';
import { name as appName } from './app.json';

/**
 * The background message handler has to be registered here, at module scope.
 *
 * When a data message arrives and the app is not running, Android starts a
 * headless JS context with no React tree — a handler registered inside a
 * component would not exist yet, and Firebase warns about it on every delivery.
 *
 * There is deliberately nothing to do in it. The gate notification carries a
 * `notification` block, so Android has already drawn it; the app re-reads the
 * server when it next comes to the front, which is the only thing that could
 * safely be done from here anyway. It exists so Firebase has the handler it
 * insists on.
 */
try {
  // eslint-disable-next-line global-require
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async () => {});
} catch {
  /* No google-services.json in this build — see src/lib/push.js. */
}

AppRegistry.registerComponent(appName, () => App);

/**
 * The lock-screen gate approval, rendered by GateApprovalActivity.
 *
 * A second root, not a route: it has to draw when the app was not running a
 * moment ago, so it takes everything it needs from the notification payload as
 * initial props and never touches the navigator or the session provider.
 */
AppRegistry.registerComponent('PranganGateApproval', () => GateApproval);
