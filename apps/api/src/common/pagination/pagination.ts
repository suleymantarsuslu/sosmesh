export type PaginationQuery = {
  cursor?: string;
  limit?: number;
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
  limit: number;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query: PaginationQuery): {
  cursor?: string;
  limit: number;
} {
  const rawLimit = query.limit ?? DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, Number(rawLimit) || DEFAULT_LIMIT), MAX_LIMIT);
  const cursor =
    typeof query.cursor === 'string' && query.cursor.length > 0
      ? query.cursor
      : undefined;
  return { cursor, limit };
}

export function buildPaginated<T extends { id: string }>(
  items: T[],
  limit: number
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const slice = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
  return {
    items: slice,
    nextCursor,
    limit,
  };
}
