import { useEffect, useState } from 'react';

export const CLIENT_PAGE_SIZE = 20;

/** Pages an in-memory list; returns to page 1 whenever `resetKey` changes (filters, sort, tab). */
export function useClientPage<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const lastPage = Math.max(1, Math.ceil(items.length / CLIENT_PAGE_SIZE));
  const current = Math.min(page, lastPage);
  return {
    page: current,
    setPage,
    pageItems: items.slice((current - 1) * CLIENT_PAGE_SIZE, current * CLIENT_PAGE_SIZE),
  };
}
