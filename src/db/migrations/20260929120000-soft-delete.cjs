'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE equipment
        ADD COLUMN deleted_at TIMESTAMPTZ;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE maintenance_requests
        ADD COLUMN deleted_at TIMESTAMPTZ;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE equipment DROP CONSTRAINT equipment_serial_number_unique;
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX equipment_serial_number_active_idx
        ON equipment (serial_number)
        WHERE deleted_at IS NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX equipment_deleted_at_idx ON equipment (deleted_at);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX maintenance_requests_deleted_at_idx ON maintenance_requests (deleted_at);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE request_status_history
        DISABLE TRIGGER request_status_history_forbid_mutation;
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM request_status_history
      WHERE request_id IN (
        SELECT id FROM maintenance_requests
        WHERE deleted_at IS NOT NULL
           OR equipment_id IN (SELECT id FROM equipment WHERE deleted_at IS NOT NULL)
      );
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE request_status_history
        ENABLE TRIGGER request_status_history_forbid_mutation;
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM request_assignees
      WHERE request_id IN (
        SELECT id FROM maintenance_requests
        WHERE deleted_at IS NOT NULL
           OR equipment_id IN (SELECT id FROM equipment WHERE deleted_at IS NOT NULL)
      );
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM maintenance_requests
      WHERE deleted_at IS NOT NULL
         OR equipment_id IN (SELECT id FROM equipment WHERE deleted_at IS NOT NULL);
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM equipment WHERE deleted_at IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS maintenance_requests_deleted_at_idx;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS equipment_deleted_at_idx;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS equipment_serial_number_active_idx;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE equipment
        ADD CONSTRAINT equipment_serial_number_unique UNIQUE (serial_number);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE maintenance_requests DROP COLUMN deleted_at;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE equipment DROP COLUMN deleted_at;
    `);
  },
};
