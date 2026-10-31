/** Só as funções puras: nada aqui toca em React Native nem na rede. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  coverageThreshold: {
    './src/protocol/': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
};
