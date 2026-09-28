'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE assignee_role AS ENUM ('lead', 'member');
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE request_assignees (
        request_id UUID NOT NULL,
        technician_id UUID NOT NULL,
        role assignee_role NOT NULL,
        hours NUMERIC(6, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT request_assignees_pkey PRIMARY KEY (request_id, technician_id),
        CONSTRAINT request_assignees_hours_nonnegative CHECK (hours >= 0),
        CONSTRAINT request_assignees_request_id_fkey
          FOREIGN KEY (request_id) REFERENCES maintenance_requests (id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT request_assignees_technician_id_fkey
          FOREIGN KEY (technician_id) REFERENCES technicians (id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX request_assignees_one_lead_per_request
        ON request_assignees (request_id)
        WHERE role = 'lead';
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX request_assignees_technician_id_idx ON request_assignees (technician_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('request_assignees');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS assignee_role;');
  },
};
