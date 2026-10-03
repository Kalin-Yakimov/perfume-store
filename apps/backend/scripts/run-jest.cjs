const { spawnSync } = require("node:child_process")

const testType = process.argv[2] || "unit"
const allowedTypes = new Set([
  "unit",
  "integration:http",
  "integration:modules",
  "integration:orders",
  "integration:catalog",
  "integration:operations",
  "integration:e2e",
])

if (!allowedTypes.has(testType)) {
  console.error(`Unsupported test type: ${testType}`)
  process.exit(2)
}

const jestCli = require.resolve("jest/bin/jest")
const result = spawnSync(
  process.execPath,
  [jestCli, "--silent=false", "--runInBand", "--forceExit", ...(testType === "unit" ? ["--silent"] : []), ...process.argv.slice(3)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      TEST_TYPE: testType,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--experimental-vm-modules"]
        .filter(Boolean)
        .join(" "),
    },
  },
)

process.exit(result.status ?? 1)
