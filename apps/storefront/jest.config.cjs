const nextJest = require("next/jest")

// Unit tests mock all API calls and must not require private local env files.
process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||= "pk_unit_tests_only"

module.exports = nextJest({ dir: "./" })({
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.unit.spec.[jt]s?(x)"],
  clearMocks: true,
  moduleNameMapper: {
    "^@lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@modules/(.*)$": "<rootDir>/src/modules/$1",
  },
})
