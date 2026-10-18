// Central CORS origin policy, shared by the Express HTTP app and Socket.IO.
//
// Allowed:
//   - https://dynease.in and any https://<subdomain>.dynease.in
//     (multi-tenant: chandrikafamilyrestaurant.dynease.in, admin.dynease.in, ...)
//   - http://localhost:<port> and http://127.0.0.1:<port> — development only
//   - requests with no Origin header (curl, server-to-server, mobile apps)
//
// Disallowed origins are refused by calling callback(null, false). We never
// pass an Error: an Error would fall through to the Express error handler and
// turn a preflight into a 403/500 instead of simply omitting the CORS headers.

const DYNEASE_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*dynease\.in$/;
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin) {
  // No Origin => not a browser CORS request (curl, server-to-server).
  if (!origin) return true;

  if (DYNEASE_ORIGIN.test(origin)) return true;

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

module.exports = { isAllowedOrigin, originCallback, corsOptions, DYNEASE_ORIGIN, DEV_ORIGIN };
