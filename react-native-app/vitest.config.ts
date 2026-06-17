import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

const mockReactNative = fileURLToPath(
  new URL('./__tests__/__mocks__/react-native.ts', import.meta.url),
);
const mockMmkv = fileURLToPath(
  new URL('./__tests__/__mocks__/react-native-mmkv.ts', import.meta.url),
);
const mockEnv = fileURLToPath(new URL('./__tests__/__mocks__/env.ts', import.meta.url));

export default defineConfig({
  // React Native code references the `__DEV__` global; define it for the node test env.
  define: {
    __DEV__: false,
  },
  resolve: {
    alias: [
      {find: /^@env$/, replacement: mockEnv},
      // Order/regex matters: match the more specific package before bare `react-native`.
      {find: /^react-native-mmkv$/, replacement: mockMmkv},
      {find: /^react-native$/, replacement: mockReactNative},
      {find: /^react-native\/.*/, replacement: mockReactNative},
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
  },
});
