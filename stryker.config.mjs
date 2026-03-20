/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.cjs',
  },
  testRunnerNodeArgs: ['--experimental-vm-modules'],
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/core/**/*.ts',
    '!src/core/**/*.test.ts',
    '!src/core/**/__tests__/**',
    '!src/core/**/types.ts',
  ],
  reporters: ['html', 'json', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  coverageAnalysis: 'perTest',
  timeoutMS: 60000,
  timeoutFactor: 1.5,
  logLevel: 'info',
  thresholds: { high: 80, low: 60, break: null },
};
