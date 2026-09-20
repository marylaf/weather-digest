import 'dotenv/config';
import { loadConfig } from '../config/appConfig.js';
import { app } from './app.js';

const { port } = loadConfig();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
