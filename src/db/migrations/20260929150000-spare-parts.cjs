'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE spare_parts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        sku VARCHAR(64) NOT NULL,
        stock_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ,
        CONSTRAINT spare_parts_stock_nonnegative CHECK (stock_quantity >= 0)
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX spare_parts_sku_active_idx
        ON spare_parts (sku)
        WHERE deleted_at IS NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE request_spare_parts (
        request_id UUID NOT NULL,
        spare_part_id UUID NOT NULL,
        quantity NUMERIC(12, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT request_spare_parts_pkey PRIMARY KEY (request_id, spare_part_id),
        CONSTRAINT request_spare_parts_quantity_positive CHECK (quantity > 0),
        CONSTRAINT request_spare_parts_request_id_fkey
          FOREIGN KEY (request_id) REFERENCES maintenance_requests (id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT request_spare_parts_spare_part_id_fkey
          FOREIGN KEY (spare_part_id) REFERENCES spare_parts (id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX request_spare_parts_spare_part_id_idx
        ON request_spare_parts (spare_part_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('request_spare_parts');
    await queryInterface.dropTable('spare_parts');
  },
};
