import { getSequelize } from '../../src/db/database.js';
import { resetStore } from '../helpers/store.js';

describe('роль приложения', () => {
  beforeAll(async () => {
    await resetStore();
  });

  it('не может удалять строки журнала статусов', async () => {
    await expect(getSequelize().query('DELETE FROM request_status_history')).rejects.toThrow(
      /permission denied/i,
    );
  });
});
