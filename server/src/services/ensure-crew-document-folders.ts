import crypto from 'node:crypto'
import { CrewDocumentFolder, SYSTEM_FOLDER_SLUGS, type SystemFolderSlug } from '../models/CrewDocumentFolder.js'

interface SystemFolderSpec {
  slug: SystemFolderSlug
  name: string
  sortOrder: number
}

const SYSTEM_FOLDERS: SystemFolderSpec[] = [
  { slug: SYSTEM_FOLDER_SLUGS.CREW_PHOTOS, name: 'Crew Photos', sortOrder: 1 },
  { slug: SYSTEM_FOLDER_SLUGS.PASSPORTS, name: 'Passports & Licenses', sortOrder: 2 },
  { slug: SYSTEM_FOLDER_SLUGS.MEDICAL_CERTIFICATES, name: 'Medical Certificates', sortOrder: 3 },
  { slug: SYSTEM_FOLDER_SLUGS.TRAINING_DOCUMENTS, name: 'Training Documents', sortOrder: 4 },
]

/**
 * Idempotently upsert the 4 system root folders for the given operator.
 * Cheap to call on every request or once at boot — each folder is a
 * `$setOnInsert` that's a no-op on subsequent calls.
 */
export async function ensureSystemFolders(operatorId: string): Promise<void> {
  const now = new Date().toISOString()
  await Promise.all(
    SYSTEM_FOLDERS.map((spec) =>
      CrewDocumentFolder.updateOne(
        { operatorId, slug: spec.slug, isSystem: true },
        {
          $setOnInsert: {
            _id: crypto.randomUUID(),
            operatorId,
            parentId: null,
            name: spec.name,
            slug: spec.slug,
            isSystem: true,
            sortOrder: spec.sortOrder,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      ),
    ),
  )
}
