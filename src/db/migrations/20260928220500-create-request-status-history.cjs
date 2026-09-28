'use strict';

const { TRIGGER_NAME } = require('../requestStatusHistory.cjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE request_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL,
        old_status request_status,
        new_status request_status NOT NULL,
        changed_by VARCHAR(120) NOT NULL,
        comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT request_status_history_status_changed
          CHECK (old_status IS DISTINCT FROM new_status),
        CONSTRAINT request_status_history_request_id_fkey
          FOREIGN KEY (request_id) REFERENCES maintenance_requests (id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX request_status_history_request_id_created_at_idx
        ON request_status_history (request_id, created_at);
    `);
    await queryInterface.sequelize.query(`
      CREATE FUNCTION ${TRIGGER_NAME}()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'request_status_history is append-only and cannot be updated or deleted';
      END;
      $$;
    `);
    await queryInterface.sequelize.query(`
      CREATE TRIGGER ${TRIGGER_NAME}
      BEFORE UPDATE OR DELETE ON request_status_history
      FOR EACH ROW
      EXECUTE FUNCTION ${TRIGGER_NAME}();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON request_status_history;`,
    );
    await queryInterface.dropTable('request_status_history');
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS ${TRIGGER_NAME}();`);
  },
};
