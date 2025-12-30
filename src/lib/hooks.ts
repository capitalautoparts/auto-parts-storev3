import { useState, useEffect } from "react";
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
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (options?.enabled === false) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await queryFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [options?.enabled, ...(options?.deps ?? [])]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
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
