import { BookOpen, FileText, Folder, GraduationCap, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'

/**
 * Visual mapping — folder slug → lucide icon + XD-aligned tint color.
 * Virtual sub-folders (ExpiryCode-backed) fall through to the category of
 * their parent root folder, so e.g. "CRM Training" uses the amber folder
 * icon that's shared with Training Documents.
 */
export interface FolderVisual {
  icon: LucideIcon
  /** Base hex — combined with rgba() at 10–20% opacity for tinted backgrounds. */
  tint: string
}

export const FOLDER_VISUALS: Record<string, FolderVisual> = {
  CrewPhotos: { icon: UserRound, tint: '#0063F7' }, // XD info blue
  Passports: { icon: BookOpen, tint: '#06C270' }, // XD success green
  MedicalCertificates: { icon: ShieldCheck, tint: '#E63535' }, // XD error red
  TrainingDocuments: { icon: GraduationCap, tint: '#FF8800' }, // XD warning amber
}

export const VIRTUAL_SUBFOLDER_DEFAULT: FolderVisual = {
  icon: Folder,
  tint: '#FF8800', // falls under TrainingDocuments visually
}

export const DOC_ROW_ICON: LucideIcon = FileText

/** Look up a folder's visual, defaulting to the virtual-subfolder tint when
 *  the slug is unknown (user sub-folder or expiry-code slug). */
export function folderVisual(slug: string): FolderVisual {
  return FOLDER_VISUALS[slug] ?? VIRTUAL_SUBFOLDER_DEFAULT
}

/** Convert a hex (#RRGGBB) → rgba(a,b,c, alpha) string. */
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
