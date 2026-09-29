import { closeDatabase } from '../src/db/database.js';

afterAll(async () => {
  await closeDatabase();
});
