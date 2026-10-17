const { db, schema } = require('../db/client');
const { audit_log } = schema;

/**
 * Log a security, system or business event in PostgreSQL audit_log
 * @param {Object} options
 * @param {string} [options.restaurant_id]
 * @param {string} [options.user_id]
 * @param {string} options.action - e.g. 'RESTAURANT_ACTIVATED', 'USER_LOGIN', 'TABLE_CREATED'
 * @param {string} options.entity_type - e.g. 'RESTAURANT', 'USER', 'TABLE', 'ORDER'
 * @param {string} [options.entity_id]
 * @param {Object} [options.details] - JSON serializable object (sanitized of passwords/secrets)
 * @param {Object} [tx] - Optional Drizzle transaction client for atomic execution
 */
async function logAudit({ restaurant_id, user_id, action, entity_type, entity_id, details = {} }, tx = null) {
  try {
    // Sanitize sensitive fields from details
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.secret;
    delete sanitizedDetails.authorization;

    const runner = tx || db;

    await runner.insert(audit_log).values({
      restaurant_id: restaurant_id || null,
      user_id: user_id || null,
      action,
      entity_type,
      entity_id: entity_id || null,
      details: sanitizedDetails
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit record:', err.message);
  }
}

module.exports = { logAudit };
