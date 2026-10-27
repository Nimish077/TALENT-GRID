// Query-string pagination helpers.

export function parsePagination(
  query,
  { defaultLimit = 20, maxLimit = 100 } = {}
) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit)
  );
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginationMeta(total, page, limit) {
  return {
    page,
    limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function paginatedData(items, total, page, limit) {
  return { items, pagination: paginationMeta(total, page, limit) };
}
