/**
 * Parses raw string query params (page, limit) into validated numbers.
 * Used in routes that receive query strings as Record<string, string> rather
 * than a Zod-parsed schema (primarily inline route handlers in shared.routes.ts
 * and admin.routes.ts).
 */
export function parsePaginationQuery(
  query: Record<string, string | undefined>,
  defaultLimit = 20,
): { page: number; limit: number } {
  const page = Math.max(1, parseInt(query['page'] ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query['limit'] ?? String(defaultLimit), 10) || defaultLimit))
  return { page, limit }
}

/**
 * Parses a route param string to a safe integer id.
 * Throws NaN (caught by the Prisma layer as P2025) if the param is not numeric.
 */
export function parseId(param: string): number {
  return parseInt(param, 10)
}
