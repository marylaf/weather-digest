'use strict';

const TRIGGER_NAME = 'request_status_history_forbid_mutation';

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 */
async function disableHistoryGuard(queryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE request_status_history DISABLE TRIGGER ${TRIGGER_NAME}`,
  );
}

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 */
async function enableHistoryGuard(queryInterface) {
  await queryInterface.sequelize.query(
    `ALTER TABLE request_status_history ENABLE TRIGGER ${TRIGGER_NAME}`,
  );
}

module.exports = {
  TRIGGER_NAME,
  disableHistoryGuard,
  enableHistoryGuard,
};
