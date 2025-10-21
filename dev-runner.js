import { execSync } from 'node:child_process';
import path from 'node:path';

const target = process.argv[2];
const example = process.env.EXAMPLE || 'chat-game';

const commands = {
  client: `vite --config examples/${example}/vite.config.js`,
  host: `npm run start --prefix examples/${example}/host-app`,
  signal: `node signaling/signalingServer.js`
};

if (!commands[target]) {
  console.error(`Unknown target: ${target}`);
  process.exit(1);
}

execSync(commands[target], { stdio: 'inherit', env: process.env });
