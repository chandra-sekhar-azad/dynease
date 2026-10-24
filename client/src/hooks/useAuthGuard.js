import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthHeaders, getStoredToken } from '../utils/api';

/**
 * Client-side authentication + role guard.
 *
 * Verifies the stored token against `/auth/me` and ensures the authenticated
 * user's role is allowed to view the current section. This is a UX/defense-in-depth
 * layer only — every protected API is still enforced server-side.
 *
 * @param {string[]} allowedRoles Roles permitted for this section.
 * @returns {'checking' | 'allowed' | 'denied'}
 */
export default function useAuthGuard(allowedRoles) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let mounted = true;

    const deny = () => {
      if (!mounted) return;
      setStatus('denied');
      navigate('/login', { replace: true });
    };

    const token = getStoredToken();
    if (!token) {
      deny();
      return () => { mounted = false; };
    }

    fetch(`${import.meta.env.VITE_API_URL}/auth/me`, { headers: getAuthHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) throw new Error(data?.message || 'unauthorized');
        return data.data?.user;
      })
      .then((user) => {
        if (!mounted) return;
        const role = user?.role;
        const permitted =
          Array.isArray(allowedRoles) && allowedRoles.length > 0
            ? allowedRoles.includes(role)
            : Boolean(role);
        if (permitted) {
          setStatus('allowed');
        } else {
          deny();
        }
      })
      .catch(() => {
        // Invalid/expired token — clear it and return to login.
        localStorage.removeItem('token');
        deny();
      });

    return () => { mounted = false; };
    // allowedRoles is expected to be a stable module-level constant.
  }, [navigate, allowedRoles]);

  return status;
}
