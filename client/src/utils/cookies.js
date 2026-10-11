/**
 * Cookie utility helper for client-side storage
 */

/**
 * Set a cookie with an expiration in days
 * @param {string} name
 * @param {any} value - will be JSON stringified
 * @param {number} days - expiration in days (default 30)
 */
export function setCookie(name, value, days = 30) {
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    const serialized = encodeURIComponent(typeof value === 'string' ? value : JSON.stringify(value));
    document.cookie = `${encodeURIComponent(name)}=${serialized};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  } catch (err) {
    console.error('Failed to set cookie', err);
  }
}

/**
 * Get a cookie by name
 * @param {string} name
 * @returns {any|null} parsed JSON or string, or null if not found
 */
export function getCookie(name) {
  try {
    const encodedName = encodeURIComponent(name) + '=';
    const cookies = document.cookie.split(';');
    for (let c of cookies) {
      c = c.trim();
      if (c.indexOf(encodedName) === 0) {
        const raw = decodeURIComponent(c.substring(encodedName.length));
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
    }
  } catch (err) {
    console.error('Failed to read cookie', err);
  }
  return null;
}

/**
 * Delete a cookie
 * @param {string} name
 */
export function deleteCookie(name) {
  document.cookie = `${encodeURIComponent(name)}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
}
