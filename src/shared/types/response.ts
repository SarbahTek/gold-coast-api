export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: PaginationMeta
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export function success<T>(data: T, message?: string, meta?: PaginationMeta): ApiResponse<T> {
  return { success: true, data, message, meta }
}

export function failure(
  code: string,
  message: string,
  details?: unknown,
): ApiResponse<never> {
  return { success: false, error: { code, message, details } }
}

export function paginate(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit)
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

export function getPaginationParams(
  rawPage?: number,
  rawLimit?: number,
): { page: number; limit: number; skip: number; take: number } {
  const page = Math.max(1, rawPage ?? 1)
  const limit = Math.min(100, Math.max(1, rawLimit ?? 20))
  const skip = (page - 1) * limit
  return { page, limit, skip, take: limit }
}
