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

// Allowed local development ports (e.g. Vite, React CRA, Next.js, Expo web, API).
// You can also add custom ports via CORS_ALLOWED_PORTS="5176,8000" in .env
const DEFAULT_DEV_PORTS = [
  '5173', // Vite default
  '5174', // Vite fallback 1
  '5175', // Vite fallback 2
  '3000', // React CRA / Next.js
  '3001', // Secondary React
  '5000', // Express / Node server
  '8080', // Alternate dev server
  '8081', // Expo web
  '19006' // Expo web legacy
];

const DEV_PORTS = [
  ...new Set([...DEFAULT_DEV_PORTS, ...parseList(process.env.CORS_ALLOWED_PORTS)])
];

const DEV_PORT_PATTERN = DEV_PORTS.join('|');

// Matches localhost, 127.0.0.1, and all tenant subdomains (e.g. test.localhost, admin.localhost)
// on any configured dev port (or any local port in development).
const DEV_ORIGIN = new RegExp(
  `^https?:\\/\\/([a-z0-9-]+\\.)*(localhost|127\\.0\\.0\\.1)(:(?:${DEV_PORT_PATTERN}|\\d+))?$`
);

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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-Subdomain',
      'x-tenant-subdomain',
      'X-Requested-With',
      'x-requested-with',
      'Idempotency-Key',
      'idempotency-key',
      'X-Table-Session-Token',
      'x-table-session-token',
      'Accept',
      'Origin',
      'Cache-Control',
      'Pragma'
    ],
    exposedHeaders: [
      'Content-Range',
      'X-Content-Range',
      'Idempotency-Key',
      'idempotency-key',
      'X-Table-Session-Token',
      'x-table-session-token'
    ],
    optionsSuccessStatus: 204, // OPTIONS preflight -> 204 No Content
    maxAge: 86400              // cache the preflight result for 24h
  };
}

console.log(
  `[CORS] Allowed domains (and all subdomains): ${DOMAINS.join(', ') || '(none)'}` +
  (EXPLICIT_ORIGINS.size ? ` | extra origins: ${[...EXPLICIT_ORIGINS].join(', ')}` : '') +
  (process.env.NODE_ENV !== 'production' ? ` | dev ports: ${DEV_PORTS.join(', ')}` : '')
);

module.exports = {
  isAllowedOrigin,
  originCallback,
  corsOptions,
  DOMAINS,
  DOMAIN_PATTERNS,
  EXPLICIT_ORIGINS,
  DEFAULT_DEV_PORTS,
  DEV_PORTS,
  DEV_ORIGIN
};
