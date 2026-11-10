import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.clebersanches.pianoestudio',
  appName: 'Piano Estúdio',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
  },
};

export default config;
