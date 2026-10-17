import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = API_URL.replace(/\/api$/, '');

let socket = null;

/**
 * Returns a single shared Socket.IO connection for the whole app.
 *
 * The connection is authenticated with the current JWT so the server can join
 * the correct restaurant / waiter / admin rooms automatically. This is what
 * makes realtime updates reliable for customers, waiters, restaurant admins and
 * system admins alike.
 */
export function getSocket() {
  const token = localStorage.getItem('token');

  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
    });
    return socket;
  }

  // Keep the handshake token in sync if the user logged in/out in this tab.
  if (token && socket.auth?.token !== token) {
    socket.auth = { token };
    socket.disconnect().connect();
  }

  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribe to one or more Socket.IO events for the lifetime of a component.
 *
 * @param {Record<string, (payload: any) => void>} eventMap
 * @param {any[]} deps Optional dependency array controlling re-subscription.
 */
export function useSocketEvents(eventMap, deps = []) {
  const handlersRef = useRef(eventMap);
  handlersRef.current = eventMap;

  useEffect(() => {
    const s = getSocket();
    const events = Object.keys(handlersRef.current || {});
    const listeners = {};

    events.forEach((event) => {
      listeners[event] = (payload) => {
        const handler = handlersRef.current[event];
        if (typeof handler === 'function') handler(payload);
      };
      s.on(event, listeners[event]);
    });

    return () => {
      events.forEach((event) => s.off(event, listeners[event]));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
