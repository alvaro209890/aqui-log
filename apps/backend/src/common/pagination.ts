export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PageResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function parsePagination(
  page?: string | number,
  limit?: string | number,
  defaults: { page: number; limit: number; maxLimit: number } = {
    page: 1,
    limit: 20,
    maxLimit: 100,
  },
): { page: number; limit: number; skip: number } {
  const p = Math.max(1, Number(page) || defaults.page);
  const l = Math.min(
    defaults.maxLimit,
    Math.max(1, Number(limit) || defaults.limit),
  );
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function toPageResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PageResult<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
