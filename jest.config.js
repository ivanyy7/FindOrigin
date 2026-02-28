/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  preset: "ts-jest",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
};

module.exports = config;
