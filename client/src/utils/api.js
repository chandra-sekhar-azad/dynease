/**
 * Client API utility helper providing authentication headers and centralized fetch
 */

export function getStoredToken() {
  const token = localStorage.getItem('token');
  if (!token || token === 'undefined' || token === 'null' || !token.trim()) {
    if (token) {
      try { localStorage.removeItem('token'); } catch {}
    }
    return null;
  }
  return token;
}

export function getAuthHeaders(customHeaders = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const hostname = window.location.hostname;
  let subdomain = '';
  if (hostname.includes('dynease.in') && hostname !== 'dynease.in' && hostname !== 'www.dynease.in') {
    subdomain = hostname.split('.')[0];
  } else if (hostname.includes('localhost') && hostname !== 'localhost') {
    subdomain = hostname.split('.')[0];
  }

  if (subdomain) {
    headers['x-tenant-subdomain'] = subdomain;
  }

  return headers;
}

export async function authFetch(url, options = {}) {
  const headers = getAuthHeaders(options.headers || {});
  
  // If sending FormData (multipart/form-data), let the browser set boundary header
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  return fetchWithRetry(url, {
    ...options,
    headers
  });
}

/**
 * Resilient fetch helper that automatically retries on 503 (database/service unavailable)
 * or transient connection drops with exponential backoff before failing.
 */
export async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 1200) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if ((res.status === 503 || res.status === 504) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(1.5, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(1.5, attempt)));
        continue;
      }
      throw err;
    }
  }
}

