import fs from "fs";
import path from "path";

const tmpEsm = path.resolve("dist/tmp/esm");
const tmpCjs = path.resolve("dist/tmp/cjs");
const outDir = path.resolve("dist");
const tmpFolder = path.resolve("dist/tmp");

const logo = path.resolve("assets/peerbox.svg")
// ensure dist exists
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// copy esm files
for (const file of fs.readdirSync(tmpEsm)) {
  fs.copyFileSync(path.join(tmpEsm, file), path.join(outDir, file));
}

// copy cjs files
for (const file of fs.readdirSync(tmpCjs)) {
  fs.copyFileSync(path.join(tmpCjs, file), path.join(outDir, file));
}

const logoDest = path.join(outDir, path.basename(logo));
fs.copyFileSync(logo, logoDest);

fs.rmSync(tmpFolder, { recursive: true, force: true });

console.log("Merged ESM + CJS into flat dist/");
