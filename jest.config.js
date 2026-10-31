/** Só as funções puras: nada aqui toca em React Native nem na rede. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  coverageThreshold: {
    './src/protocol/stateMachine.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/protocol/schemas.ts': {
      branches: 75,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
};
