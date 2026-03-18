import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 dakika - veri taze kabul edilir
      gcTime: 30 * 60 * 1000, // 30 dakika cache (eski cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
