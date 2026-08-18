import type { CapacitorConfig } from '@capacitor/cli';

/** Wraps the built web client (client/dist) in an Android shell. The game itself is
 * unchanged — it just talks to the server over the network instead of being served by it,
 * which is why the APK build needs VITE_SERVER_URL (see client/.env.example). */
const config: CapacitorConfig = {
  appId: 'fr.lecasse.app',
  appName: 'Le Casse',
  webDir: 'dist',
  android: {
    // The app's own pages are served to the WebView over https, so reaching a server on a
    // plain http address counts as mixed content and is blocked by default. Both of these
    // are only needed while the server has no certificate — with a domain and https, drop
    // them and the app goes back to refusing cleartext, which is the safer default.
    allowMixedContent: true,
  },
  server: {
    cleartext: true,
  },
};

export default config;
