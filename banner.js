// banner.js

const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";

const version = process.env.VERSION || "unknown";
const frameworkName = "Peerbox Framework";

const banner = `
 ____  ____  ____  ____  ____   __  _  _       
(  _ \\(  __)(  __)(  _ \\(  _ \\ /  \\( \\/ )      
 ) __/ ) _)  ) _)  )   / ) _ ((  O ))  (       
(__)  (____)(____)(__\\_)(____/ \\__/(_/\\_)     
`;

console.log(CYAN + banner + RESET);
console.log(YELLOW + BOLD + `${frameworkName} ${version}` + RESET);
console.log(GREEN + "Welcome! Starting your development servers now...\n" + RESET);
