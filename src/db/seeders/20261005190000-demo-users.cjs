'use strict';

const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'password123';
const LEAD_TECHNICIAN_ID = 'd0000000-0000-4000-8000-000000000001';

const users = [
  {
    id: 'a0000000-0000-4000-8000-0000000000a1',
    email: 'admin@example.com',
    role: 'admin',
    technician_id: null,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000000a2',
    email: 'tech@example.com',
    role: 'technician',
    technician_id: LEAD_TECHNICIAN_ID,
  },
  {
    id: 'a0000000-0000-4000-8000-0000000000a3',
    email: 'viewer@example.com',
    role: 'viewer',
    technician_id: null,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 12);

    await queryInterface.bulkInsert(
      'users',
      users.map((user) => ({
        ...user,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      id: users.map((user) => user.id),
    });
  },
};
