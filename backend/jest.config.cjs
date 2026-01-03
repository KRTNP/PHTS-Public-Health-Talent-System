/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // บังคับใช้ CommonJS สำหรับการ Test เพื่อแก้ปัญหา "Cannot use import statement"
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Only pick files named *.test.* or *.spec.* (ignore helpers like utils.ts)
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  // Run sequentially to prevent DB clashes between suites
  maxWorkers: 1,
  // Force exit to avoid lingering open handles from Express/MySQL in integration runs
  forceExit: true,
};
