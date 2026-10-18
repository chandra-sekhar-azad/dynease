// Central CORS origin policy, shared by the Express HTTP app and Socket.IO.
//
// Multiple domains, each with all of its subdomains, can be allowed.
//
//   CORS_ALLOWED_DOMAINS  comma-separated base domains. Each entry allows BOTH
//                         the bare domain and any subdomain:
//                           dynease.in            -> https://dynease.in,
//                                                    https://shop.dynease.in,
//                                                    https://a.b.dynease.in, ...
//                         Scheme/wildcards are accepted and normalized, e.g.
//                           CORS_ALLOWED_DOMAINS="dynease.in, *.example.com, https://foo.com"
//                         Defaults to "dynease.in" when unset.
//
//   CORS_ALLOWED_ORIGINS  Optional comma-separated EXACT origins (with scheme
//                         and port) for one-off cases:
//                           CORS_ALLOWED_ORIGINS=http://localhost:5173,https://app.partner.io
//
// Requests with no Origin header (curl, server-to-server, mobile apps) are allowed.
// http://localhost:<port> and http://127.0.0.1:<port> are allowed in development only.
//
// Disallowed origins are refused with callback(null, false) so the response
// simply omits Access-Control-* headers (never a thrown Error that becomes 403/500).

// Add base domains here directly if you don't want to use the env var.
// Every entry automatically allows https://<domain> AND https://<anything>.<domain>.
const DEFAULT_DOMAINS = [
  'dynease.in',
];

function parseList(value) {
  return (value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeDomain(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // strip scheme (https://)
    .replace(/^\*\./, '')                   // strip leading wildcard (*.)
    .replace(/\/.*$/, '')                    // strip path
    .replace(/:\d+$/, '')                    // strip port
    .replace(/\.+$/, '');                    // strip trailing dot
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// In production only https is accepted for configured domains; in development
// http is accepted too so local subdomains keep working.
const DOMAIN_PROTOCOL = process.env.NODE_ENV === 'production' ? 'https' : 'https?';

const DOMAINS = [
  ...new Set(
    [...DEFAULT_DOMAINS, ...parseList(process.env.CORS_ALLOWED_DOMAINS)]
      .map(normalizeDomain)
      .filter(Boolean)
  )
];

// One pattern per base domain: matches the bare domain and any subdomain.
const DOMAIN_PATTERNS = DOMAINS.map(
  (domain) => new RegExp(`^${DOMAIN_PROTOCOL}:\\/\\/([a-z0-9-]+\\.)*${escapeRegex(domain)}$`)
);

// Explicit full origins (scheme + host + optional port) passed via env.
const EXPLICIT_ORIGINS = new Set(parseList(process.env.CORS_ALLOWED_ORIGINS));

const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin) {
  // No Origin => not a browser CORS request (curl, server-to-server).
  if (!origin) return true;

  if (EXPLICIT_ORIGINS.has(origin)) return true;

  if (DOMAIN_PATTERNS.some((re) => re.test(origin))) return true;

  if (process.env.NODE_ENV !== 'production' && DEV_ORIGIN.test(origin)) return true;

  return false;
}

function originCallback(origin, callback) {
  // callback(null, false) => request continues without Access-Control-* headers.
  callback(null, isAllowedOrigin(origin));
}

function corsOptions() {
  return {
    origin: originCallback,
    // Auth uses cookies/credentials in the client, so keep them enabled.
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Subdomain', 'X-Requested-With'],
    optionsSuccessStatus: 204, // OPTIONS preflight -> 204 No Content
    maxAge: 86400              // cache the preflight result for 24h
  };
}

console.log(
  `[CORS] Allowed domains (and all subdomains): ${DOMAINS.join(', ') || '(none)'}` +
  (EXPLICIT_ORIGINS.size ? ` | extra origins: ${[...EXPLICIT_ORIGINS].join(', ')}` : '')
);

module.exports = {
  isAllowedOrigin,
  originCallback,
  corsOptions,
  DOMAINS,
  DOMAIN_PATTERNS,
  EXPLICIT_ORIGINS,
  DEV_ORIGIN
};
