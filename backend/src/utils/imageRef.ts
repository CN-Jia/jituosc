import { z } from 'zod'

/** http(s) URL 或以 /uploads/ 开头的本地上传路径 */
export const imageRefString = z
  .string()
  .min(1)
  .refine((s) => s.startsWith('/uploads/') || /^https?:\/\//i.test(s), '须为 http(s) URL 或 /uploads/ 开头的路径')

export const optionalImageRef = z
  .union([z.literal(''), imageRefString])
  .optional()

export const optionalImageRefNullable = z.union([z.literal(''), imageRefString]).optional().nullable()
