import { useState, useEffect, useCallback, useRef } from "react";
import type { DependencyList } from "react";

export interface UseQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useQuery<T>(
  queryFn: () => Promise<T>,
  options?: { enabled?: boolean; deps?: DependencyList }
): UseQueryResult<T> {
  const enabled = options?.enabled !== false;
  const key = JSON.stringify([enabled, ...(options?.deps ?? [])]);
  const latest = useRef(queryFn);
  latest.current = queryFn;
  const request = useRef(0);
  const [state, setState] = useState<{ key: string; data?: T; isLoading: boolean; error: Error | null }>({ key, isLoading: enabled, error: null });
  const refetch = useCallback(async () => {
    const id = ++request.current;
    if (!enabled) { setState({ key, isLoading: false, error: null }); return; }
    setState({ key, isLoading: true, error: null });
    try {
      const data = await latest.current();
      if (id === request.current) setState({ key, data, isLoading: false, error: null });
    } catch (err) {
      if (id === request.current) setState({ key, isLoading: false, error: err instanceof Error ? err : new Error('The catalog request failed.') });
    }
  }, [key, enabled]);
  useEffect(() => { void refetch(); return () => { request.current++; }; }, [refetch]);
  return { data: state.key === key ? state.data : undefined, isLoading: state.key === key ? state.isLoading : enabled, error: state.key === key ? state.error : null, refetch };
}

export interface UseMutationResult<TVariables> {
  mutate: (variables: TVariables) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
  }
): UseMutationResult<TVariables> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (variables: TVariables) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await mutationFn(variables);
      options?.onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      setError(error);
      options?.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    mutate,
    isLoading,
    error,
  };
}
