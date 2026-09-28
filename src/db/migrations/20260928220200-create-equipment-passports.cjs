'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE equipment_passports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id UUID NOT NULL,
        manufacturer VARCHAR(200) NOT NULL,
        model VARCHAR(200) NOT NULL,
        nominal_power NUMERIC(10, 2),
        last_verification_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT equipment_passports_equipment_id_unique UNIQUE (equipment_id),
        CONSTRAINT equipment_passports_nominal_power_nonnegative
          CHECK (nominal_power IS NULL OR nominal_power >= 0),
        CONSTRAINT equipment_passports_equipment_id_fkey
          FOREIGN KEY (equipment_id) REFERENCES equipment (id)
          ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('equipment_passports');
  },
};
