/**
 * Tenant identifier helpers.
 *
 * The tenant is identified by the restaurant "slug" (subdomain label), e.g.
 * `chandrikafamilyrestaurant` for chandrikafamilyrestaurant.dynease.in.
 *
 * IMPORTANT: the slug is only an identifier. It is NEVER used as a database
 * name or connection target — all tenants share one PostgreSQL database and
 * schema. These helpers only normalise/validate the identifier before a
 * shared-schema lookup.
 *
 * Kept dependency-free so it can be unit tested without a database.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function baseDomain() {
  return (process.env.BASE_DOMAIN || 'dynease.in').trim().toLowerCase().replace(/^\.+/, '');
}

/**
 * Reduce any of these to the tenant slug:
 *   chandrikafamilyrestaurant
 *   chandrikafamilyrestaurant.dynease.in
 *   https://chandrikafamilyrestaurant.dynease.in/menu?x=1
 *   CHANDRIKAFAMILYRESTAURANT
 * Apex/`www`/`api`/`admin` hosts have no tenant slug and return ''.
 */
function normalizeSubdomain(input) {
  if (!input) return '';
  let s = String(input).trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // strip scheme
  s = s.split(/[/?#]/)[0];                        // strip path/query/hash
  s = s.split(':')[0];                            // strip port
  s = s.replace(/\.+$/, '');                      // strip trailing dot

  const base = baseDomain();
  if (s === base || s === `www.${base}` || s === `api.${base}` || s === `admin.${base}`) return '';
  if (s.endsWith(`.${base}`)) s = s.slice(0, -(base.length + 1));

  const slug = s.split('.')[0];
  if (!slug || ['www', 'api', 'admin', 'localhost', '127'].includes(slug)) return '';
  return slug;
}

function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}

module.exports = { normalizeSubdomain, baseDomain, isUuid, UUID_RE };
