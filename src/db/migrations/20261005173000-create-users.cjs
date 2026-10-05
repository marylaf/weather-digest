'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE user_role AS ENUM ('viewer', 'technician', 'admin');
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(254) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'viewer',
        technician_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_email_unique UNIQUE (email),
        CONSTRAINT users_technician_id_fkey
          FOREIGN KEY (technician_id) REFERENCES technicians (id)
          ON UPDATE CASCADE ON DELETE SET NULL
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX users_technician_id_unique
        ON users (technician_id)
        WHERE technician_id IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT refresh_tokens_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users (id)
          ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
    `);

    const role = appRole();
    await queryInterface.sequelize.query(`GRANT USAGE ON TYPE user_role TO "${role}"`);
    await queryInterface.sequelize.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users, refresh_tokens TO "${role}"
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE user_role');
  },
};

function appRole() {
  const role = process.env.DB_APP_USER?.trim();

  if (!role || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(role)) {
    throw new Error('DB_APP_USER must be a PostgreSQL identifier');
  }

  return role;
}
