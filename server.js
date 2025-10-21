import express from 'express';
import path from 'path';

const app = express();
const port = 8080;

const example = process.env.EXAMPLE || 'chat-game';
const __dirname = path.resolve();

app.use('/', express.static(path.join(__dirname, `examples/${example}/client`)));
app.use('/framework', express.static(path.join(__dirname, 'framework')));

app.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port} serving example: ${example}`);
});
