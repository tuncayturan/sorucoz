import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sorucoz.app',
  appName: 'SoruÇöz',
  webDir: 'public',
  server: {
    androidScheme: 'https', // Default is http, but https is safer. Deep link uses com.sorucoz.app
    url: 'https://sorucoz-production-8e36.up.railway.app',
    cleartext: true
  },
  plugins: {
  },
  overrideUserAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"
};

export default config;
