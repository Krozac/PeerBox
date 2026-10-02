import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["packages/peerbox", "packages/peerbox-signaling"];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const dryRun = process.argv.includes("--dry-run");

function run(args, cwd) {
  const result = spawnSync(npm, args, { cwd: path.join(root, cwd), stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["run", "build"], packages[0]);

for (const packagePath of packages) {
  console.log(`\nReviewing ${packagePath}`);
  run(["pack", "--dry-run"], packagePath);
}

if (dryRun) {
  console.log("\nDry run complete. No packages were published.");
} else {
  for (const packagePath of packages) {
    console.log(`\nPublishing ${packagePath}`);
    run(["publish", "--access", "public"], packagePath);
  }
}
