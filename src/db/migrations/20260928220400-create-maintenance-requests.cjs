'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE request_priority AS ENUM ('low', 'medium', 'high', 'critical');
    `);
    await queryInterface.sequelize.query(`
      CREATE TYPE request_status AS ENUM ('new', 'in_progress', 'done', 'rejected');
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE maintenance_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id UUID NOT NULL,
        title VARCHAR(120) NOT NULL,
        description VARCHAR(2000) NOT NULL,
        priority request_priority NOT NULL,
        status request_status NOT NULL,
        planned_at TIMESTAMPTZ,
        author VARCHAR(120) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT maintenance_requests_equipment_id_fkey
          FOREIGN KEY (equipment_id) REFERENCES equipment (id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX maintenance_requests_equipment_id_idx ON maintenance_requests (equipment_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('maintenance_requests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS request_status;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS request_priority;');
  },
};
