import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * Three-tier test pyramid per docs/TESTING.md — one config, three projects.
 * (Vitest 3.2+ `test.projects` replaces the deprecated `workspace` field.)
 *
 *   vitest run                       → all 3 projects + architecture
 *   vitest run --project unit        → unit + architecture only (no emulator)
 *   vitest run --project integration → handlers vs Firestore emulator
 *   vitest run --project component   → HTTP vs Firestore emulator
 *
 * Integration + component projects set `FIRESTORE_EMULATOR_HOST` /
 * `FIREBASE_AUTH_EMULATOR_HOST` via `test.env` so Firebase Admin connects to
 * the emulator the moment `infrastructure/config/firebase-admin.ts` is imported
 * (module-scope initialization — setting env from a `setupFiles` hook is too
 * late).
 */

const emulatorEnv = {
  FIRESTORE_EMULATOR_HOST: 'localhost:8080',
  FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
  FIREBASE_STORAGE_EMULATOR_HOST: 'localhost:9199',
  FIREBASE_PROJECT_ID: 'demo-internbot',
  FIREBASE_STORAGE_BUCKET: 'demo-internbot-storage',
  GCLOUD_PROJECT: 'demo-internbot',
  USE_EMULATOR: 'true',
}

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  test: {
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts', // Cloud Functions entry — wrapped, not unit-testable
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'tests/architecture/**/*.test.ts'],
          setupFiles: ['./tests/setup.unit.ts'],
          environment: 'node',
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          env: emulatorEnv,
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          // Bumped — when the whole pyramid runs in parallel, integration +
          // component both hit the same Firestore+Auth emulator and first
          // tests in a file bear emulator-connection setup cost under load.
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          include: ['tests/component/**/*.test.ts'],
          environment: 'node',
          env: emulatorEnv,
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
