import type { LocalDatabaseSchema } from '@domain/media-library'

export interface LocalLibraryStore {
  read(): Promise<LocalDatabaseSchema>
  write(data: LocalDatabaseSchema): Promise<void>
}
