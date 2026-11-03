import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { 
      tsconfig: 'tsconfig.spec.json',
      useESM: true,
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@noble/curves|@noble/hashes|@noble/ciphers|@sosmesh/contracts|@meta-sam/parser|\\.pnpm/@meta-sam\\+parser@[^/]+/node_modules/@meta-sam/parser)/)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/test/setup-env.ts'],
};

export default config;
