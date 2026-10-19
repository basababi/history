import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // react-native-ийг татахаас сэргийлнэ (Flow синтакс задлагдахгүй)
      'expo-constants': path.resolve(__dirname, 'tests/stubs/expo-constants.ts'),
      'react-native': path.resolve(__dirname, 'tests/stubs/react-native.ts'),
    },
  },
});
