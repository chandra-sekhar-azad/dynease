/**
 * Client API utility helper providing authentication headers and centralized fetch
 */

export function getAuthHeaders(customHeaders = {}) {
  const token = localStorage.getItem('token');
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

  return fetch(url, {
    ...options,
    headers
  });
}
