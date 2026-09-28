'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE sites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        code VARCHAR(64) NOT NULL,
        region VARCHAR(120) NOT NULL,
        latitude NUMERIC(9, 6) NOT NULL,
        longitude NUMERIC(9, 6) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT sites_code_unique UNIQUE (code),
        CONSTRAINT sites_latitude_range CHECK (latitude >= -90 AND latitude <= 90),
        CONSTRAINT sites_longitude_range CHECK (longitude >= -180 AND longitude <= 180)
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sites');
  },
};
