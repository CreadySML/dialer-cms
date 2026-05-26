"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "./api";

/**
 * Module-level cache + subscriber registry.
 * Cache lifetime is infinite — entries only get purged via:
 *   - invalidateCache(prefix)  (after mutations)
 *   - clearCache()             (on logout)
 *
 * Each entry has a timestamp; useCachedQuery treats data older than
 * `staleTime` as "stale" → it shows it instantly but refetches in background
 * (stale-while-revalidate, same pattern as SWR / React Query).
 */
const cache = new Map(); // key → { data, ts }
const subscribers = new Map(); // key → Set<(data) => void>

function notify(key, data) {
  const subs = subscribers.get(key);
  if (subs) subs.forEach((fn) => fn(data));
}

export function invalidateCache(predicate) {
  const match =
    typeof predicate === "function"
      ? predicate
      : (k) => k === predicate || k.startsWith(predicate + "?") || k.startsWith(predicate + "/");
  for (const key of [...cache.keys()]) {
    if (match(key)) cache.delete(key);
  }
}

export function mutateCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  notify(key, data);
}

export function clearCache() {
  cache.clear();
}

/**
 * Returns cached data immediately if present, then revalidates in background
 * when entry is older than `staleTime`. On error, keeps showing previous data.
 */
export function useCachedQuery(path, { staleTime = 5 * 60 * 1000, enabled = true } = {}) {
  const key = path;
  const initial = key ? cache.get(key) : null;

  const [data, setData] = useState(initial?.data);
  const [loading, setLoading] = useState(!initial && enabled && !!key);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetcher = useCallback(async () => {
    if (!key) return;
    try {
      const result = await api.get(key);
      if (!mountedRef.current) return;
      cache.set(key, { data: result, ts: Date.now() });
      setData(result);
      setError(null);
      notify(key, result);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [key]);

  // Subscribe to external mutations of this exact key
  useEffect(() => {
    if (!key) return;
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    const updater = (newData) => mountedRef.current && setData(newData);
    subscribers.get(key).add(updater);
    return () => {
      subscribers.get(key)?.delete(updater);
    };
  }, [key]);

  // Decide: serve cached / fetch fresh / stale-revalidate
  useEffect(() => {
    if (!key || !enabled) return;
    const cached = cache.get(key);
    if (!cached) {
      setLoading(true);
      fetcher();
    } else {
      setData(cached.data);
      setLoading(false);
      if (Date.now() - cached.ts > staleTime) {
        fetcher();
      }
    }
  }, [key, enabled, staleTime, fetcher]);

  return { data, loading, error, refetch: fetcher };
}
