/**
 * Log an error including the underlying cause chain.
 *
 * Drizzle wraps every failed query in a generic `DrizzleQueryError`
 * ("Failed query: ...") and attaches the real pg error as `err.cause`.
 * Logging only `err.message` hides the true cause (missing table/column,
 * auth failure, connection timeout, etc.), so always log through this helper.
 */
function logError(context, err) {
  const parts = [];
  let current = err;
  let depth = 0;
  while (current && depth < 3) {
    parts.push(`${current.name || 'Error'}: ${current.message}`);
    current = current.cause;
    depth += 1;
  }
  console.error(`[${context}] ${parts.join(' <- Caused by: ')}`);
  if (err && err.stack) {
    console.error(err.stack);
  }
}

module.exports = { logError };
