'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const role = appRole();
    await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await queryInterface.sequelize.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
        sites,
        equipment,
        equipment_passports,
        technicians,
        maintenance_requests,
        request_assignees
      TO "${role}"
    `);
    await queryInterface.sequelize.query(`
      GRANT SELECT, INSERT ON TABLE request_status_history TO "${role}"
    `);
    await queryInterface.sequelize.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${role}"
    `);
  },

  async down(queryInterface) {
    const role = appRole();
    await queryInterface.sequelize.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM "${role}"
    `);
    await queryInterface.sequelize.query(`
      REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${role}"
    `);
    await queryInterface.sequelize.query(`REVOKE USAGE ON SCHEMA public FROM "${role}"`);
  },
};

function appRole() {
  const role = process.env.DB_APP_USER?.trim();

  if (!role || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(role)) {
    throw new Error('DB_APP_USER must be a PostgreSQL identifier');
  }

  return role;
}
