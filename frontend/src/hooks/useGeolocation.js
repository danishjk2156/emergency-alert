import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Device location for the report form.
 * status: "idle" | "locating" | "ok" | "denied" | "unavailable" | "timeout"
 */
export default function useGeolocation() {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const secure = typeof window !== 'undefined' && window.isSecureContext;
  const [state, setState] = useState({
    status: supported && secure ? 'idle' : 'unavailable',
    coords: null,
    accuracy: null,
    reason: !supported ? 'unsupported' : !secure ? 'insecure' : null,
  });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const request = useCallback(() => {
    if (!supported || !secure) {
      setState((s) => ({ ...s, status: 'unavailable', reason: !supported ? 'unsupported' : 'insecure' }));
      return;
    }
    setState((s) => ({ ...s, status: 'locating' }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive.current) return;
        setState({
          status: 'ok',
          coords: { latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) },
          accuracy: pos.coords.accuracy ?? null,
          reason: null,
        });
      },
      (err) => {
        if (!alive.current) return;
        const status = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable';
        setState({ status, coords: null, accuracy: null, reason: status === 'unavailable' ? 'error' : null });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, [supported, secure]);

  const clear = useCallback(() => {
    setState((s) => ({ ...s, status: supported && secure ? 'idle' : 'unavailable', coords: null, accuracy: null }));
  }, [supported, secure]);

  return { ...state, request, clear };
}
