import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fileLocks = new Map<string, Promise<void>>();

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const previous = fileLocks.get(filePath) ?? Promise.resolve();
  const current = previous.then(fn, fn);
  fileLocks.set(
    filePath,
    current.then(
      () => undefined,
      () => undefined,
    ),
  );
  return current;
}

export async function readJsonArray(filePath: string): Promise<unknown[]> {
  try {
    const contents = await readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(contents);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}

export async function writeJsonArray(filePath: string, items: unknown[]): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
