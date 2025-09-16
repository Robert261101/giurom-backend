module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  modulePaths: ['<rootDir>/src'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      isolatedModules: true,
    },
  },
};


