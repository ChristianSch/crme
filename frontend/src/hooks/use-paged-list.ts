import { useCallback, useEffect, useRef, useState } from "react";

export const PAGE_SIZE = 50;

type PagedLoadResult<T, TExtra> = T[] | { items: T[]; extra: TExtra };

export function usePagedResource<T, TExtra = never>({
  enabled,
  loadPage,
  errorMessage,
  debounceMs = 200,
  onLoaded,
}: {
  enabled: boolean;
  loadPage: (page: number) => Promise<PagedLoadResult<T, TExtra>>;
  errorMessage: string;
  debounceMs?: number;
  onLoaded?: (result: { items: T[]; extra?: TExtra }) => void;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const requestIdRef = useRef(0);

  const load = useCallback(async (nextPage = 0) => {
    if (!enabled) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setLoadError("");
    try {
      const result = await loadPage(nextPage);
      if (requestId !== requestIdRef.current) return;
      const normalized = Array.isArray(result) ? { items: result } : result;
      setItems(normalized.items ?? []);
      setPage(nextPage);
      setHasNext((normalized.items ?? []).length === PAGE_SIZE);
      onLoaded?.(normalized);
    } catch (error) {
      if (requestId === requestIdRef.current) setLoadError(error instanceof Error ? error.message : errorMessage);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [enabled, errorMessage, loadPage, onLoaded]);

  useEffect(() => {
    if (!enabled) return;
    const timeout = window.setTimeout(() => void load(0), debounceMs);
    return () => window.clearTimeout(timeout);
  }, [debounceMs, enabled, load]);

  return { items, setItems, page, hasNext, loading, loadError, load };
}
