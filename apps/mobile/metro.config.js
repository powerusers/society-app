const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration — monorepo aware.
 *
 * The app lives in apps/mobile but imports @gvs/shared from packages/shared, and
 * npm workspaces hoists most dependencies to the repo root. Metro follows
 * neither by default, so it has to be told to watch the whole repo and to look
 * in both node_modules folders.
 *
 * The important part is the resolveRequest hook below. The web app pins React 18 and is
 * hoisted to the repo root; React Native needs 19, so npm keeps a second copy
 * under apps/mobile. Packages that also got hoisted — @react-navigation among
 * them — resolve `react` from the root and get React 18, while the app itself
 * runs React 19. Two Reacts means two hook dispatchers, and the second one is
 * null: NavigationContainer dies with "Cannot read property 'useContext' of
 * null" the moment a signed-in user reaches the navigator.
 *
 * extraNodeModules does not fix this. It is only a fallback for names that fail
 * to resolve, and `react` resolves perfectly well from the root — to the wrong
 * copy. Redirecting the request itself is what actually forces one React.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/* Exactly one copy of each of these may exist in the bundle, whoever asks. */
const SINGLETONS = ['react', 'react-native'];

const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    /* packages/shared declares an "exports" map; without this Metro ignores it
       and falls back to "main", which happens to agree today but would not
       survive the shared package growing a subpath export. */
    unstable_enablePackageExports: true,

    resolveRequest: (context, moduleName, platform) => {
      const singleton = SINGLETONS.find(
        (name) => moduleName === name || moduleName.startsWith(`${name}/`),
      );
      if (singleton) {
        const rest = moduleName.slice(singleton.length);
        return context.resolveRequest(
          context,
          path.resolve(projectRoot, 'node_modules', singleton) + rest,
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
