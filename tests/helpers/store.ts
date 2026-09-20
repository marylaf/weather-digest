import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../src/config/appConfig.js';

export async function resetStore(): Promise<void> {
  const { equipmentFile, requestsFile } = loadConfig();
  await mkdir(path.dirname(equipmentFile), { recursive: true });
  await mkdir(path.dirname(requestsFile), { recursive: true });
  await writeFile(equipmentFile, '[]\n', 'utf8');
  await writeFile(requestsFile, '[]\n', 'utf8');
}
