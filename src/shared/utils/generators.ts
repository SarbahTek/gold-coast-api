import { customAlphabet } from 'nanoid'

const numericId = customAlphabet('0123456789', 6)

export function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  return `GCH-${year}-${numericId()}`
}
