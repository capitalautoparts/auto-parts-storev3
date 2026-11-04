import { useEffect, useState } from 'react';
import { catalogFetch } from './model';

type Result<T> = { key: string; data?: T; error?: string; loading: boolean };
const cache = new Map<string, { data: unknown; expires: number }>();

export function useCatalog<T>(resource: string, params: URLSearchParams | null) {
  const encoded = params?.toString() ?? null;
  const key = `${resource}?${encoded}`;
  const [result, setResult] = useState<Result<T>>({ key, loading: encoded !== null });
  useEffect(() => {
    if (encoded === null) { setResult({ key, loading: false }); return; }
    const saved = cache.get(key);
    if (saved && saved.expires > Date.now()) {
      setResult({ key, data: saved.data as T, loading: false }); return;
    }
    const controller = new AbortController();
    setResult({ key, loading: true });
    catalogFetch<T>(resource, new URLSearchParams(encoded), controller.signal).then(data => {
      if (controller.signal.aborted) return;
      // Vehicle/taxonomy references are reusable; stock and price always refetch.
      if (resource !== 'search') {
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, { data, expires: Date.now() + 300_000 });
      }
      setResult({ key, data, loading: false });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: String(error.message), loading: false });
    });
    return () => controller.abort();
  }, [resource, encoded, key]);
  return result.key === key ? result : { key, loading: encoded !== null };
}
