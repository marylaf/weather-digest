'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE equipment_type AS ENUM ('turbine', 'inverter', 'sensor', 'substation');
    `);
    await queryInterface.sequelize.query(`
      CREATE TYPE equipment_status AS ENUM ('operational', 'maintenance', 'fault', 'decommissioned');
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        type equipment_type NOT NULL,
        serial_number VARCHAR(128) NOT NULL,
        status equipment_status NOT NULL,
        installation_date DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT equipment_serial_number_unique UNIQUE (serial_number),
        CONSTRAINT equipment_site_id_fkey
          FOREIGN KEY (site_id) REFERENCES sites (id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX equipment_site_id_idx ON equipment (site_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('equipment');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS equipment_status;');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS equipment_type;');
  },
};
