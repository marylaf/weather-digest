'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await queryInterface.sequelize.query(`
      CREATE INDEX equipment_status_type_active_idx
        ON equipment (status, type)
        WHERE deleted_at IS NULL
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX equipment_name_trgm_idx
        ON equipment USING gin (name gin_trgm_ops)
        WHERE deleted_at IS NULL
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX maintenance_requests_status_created_at_idx
        ON maintenance_requests (status, created_at DESC)
        WHERE deleted_at IS NULL
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX maintenance_requests_title_trgm_idx
        ON maintenance_requests USING gin (title gin_trgm_ops)
        WHERE deleted_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS maintenance_requests_title_trgm_idx',
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS maintenance_requests_status_created_at_idx',
    );
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS equipment_name_trgm_idx');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS equipment_status_type_active_idx');
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS pg_trgm');
  },
};
