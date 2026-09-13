/**
 * usePolling — Generic polling hook
 *
 * Usage:
 *   const { data, error, loading } = usePolling(
 *     () => getIncidents(),
 *     3000   // interval ms
 *   );
 *
 * - Starts polling immediately on mount.
 * - Stops polling when the component unmounts (cleanup).
 * - Exposes `isActive` so the UI can show a "live" indicator.
 * - Set `enabled = false` to pause polling (e.g., after job completes).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePollingResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  isActive: boolean;
  /** Manually trigger one fetch immediately */
  refresh: () => void;
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setIsActive(false);
      return;
    }

    // Immediate first fetch
    doFetch();

    // Start interval
    timerRef.current = setInterval(doFetch, intervalMs);
    setIsActive(true);

    return () => {
      mountedRef.current = false;
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, intervalMs, doFetch]);

  return { data, error, loading, isActive, refresh: doFetch };
}
