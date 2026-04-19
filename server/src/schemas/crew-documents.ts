import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const uploadExtrasSchema = z
  .object({
    folderId: z.string().min(1, 'folderId required'),
    expiryCodeId: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    lastDone: isoDate.nullable().optional(),
    expiryDate: isoDate.nullable().optional(),
  })
  .strict()

export const documentStatusFilterSchema = z
  .object({
    base: z.string().optional(),
    position: z.string().optional(),
    status: z.string().optional(),
    groupId: z.string().optional(),
    documentStatus: z
      .enum(['missing_photo', 'missing_passport', 'missing_medical', 'missing_training', 'complete'])
      .optional(),
    search: z.string().optional(),
  })
  .strict()

export const listDocumentsQuerySchema = z
  .object({
    folderId: z.string().optional(),
    expiryCodeId: z.string().optional(),
  })
  .strict()

export const createSubfolderSchema = z
  .object({
    parentId: z.string().min(1),
    name: z.string().min(1).max(80),
  })
  .strict()
