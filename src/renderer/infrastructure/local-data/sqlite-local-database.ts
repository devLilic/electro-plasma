import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import {
  assertVisualSlots,
  createDefaultItemVisualSlot,
  createEmptyLocalDatabase,
  LOCAL_DATABASE_VERSION,
  type ImageAsset,
  type ItemVisualSlot,
  type LocalDatabaseSchema,
  type PlaybackSessionState,
  type Playlist,
  type PlaylistItem,
  type Tag,
} from '../../domain/media-library'
import { INITIAL_MIGRATION, INITIAL_SEED } from './migrations'

interface PlaylistRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface PlaylistItemRow {
  id: string
  playlist_id: string
  title: string
  order_index: number
  created_at: string
  updated_at: string
}

interface ImageAssetRow {
  id: string
  item_id: string
  path: string
  original_path: string
  processed_path: string
  preview_path: string
  mime_type: string
  width: number | null
  height: number | null
  created_at: string
  position: number
  is_active: number
  slideshow_enabled: number
  slideshow_interval_ms: number | null
  transition_type: 'none' | 'fade' | 'slide'
  transition_duration_ms: number
}

interface PlaylistTagRow {
  item_id: string
  tag_id: string
  label: string
}

interface PlaybackSessionRow {
  playlist_id: string | null
  item_id: string | null
  status: PlaybackSessionState['status']
  position_ms: number
  updated_at: string
}

export class SqliteLocalDatabase {
  private readonly database: Database.Database

  constructor(
    private readonly filePath: string,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {
    mkdirSync(path.dirname(filePath), { recursive: true })
    this.database = new Database(filePath)
    this.database.pragma('foreign_keys = ON')
    this.database.pragma('journal_mode = WAL')
    this.migrate()
  }

  close() {
    this.database.close()
  }

  read(): Promise<LocalDatabaseSchema> {
    return Promise.resolve(this.snapshot())
  }

  write(data: LocalDatabaseSchema) {
    this.assertSchema(data)

    const replaceSnapshot = this.database.transaction((nextData: LocalDatabaseSchema) => {
      this.database.exec(`
        DELETE FROM playlist_item_tags;
        DELETE FROM tags;
        DELETE FROM image_assets;
        DELETE FROM playlist_items;
        DELETE FROM playlists;
      `)

      const insertPlaylist = this.database.prepare(`
        INSERT INTO playlists (id, name, created_at, updated_at)
        VALUES (@id, @name, @createdAt, @updatedAt)
      `)
      const insertItem = this.database.prepare(`
        INSERT INTO playlist_items (id, playlist_id, title, order_index, created_at, updated_at)
        VALUES (@id, @playlistId, @title, @orderIndex, @createdAt, @updatedAt)
      `)
      const insertImage = this.database.prepare(`
        INSERT INTO image_assets (
          id, item_id, path, original_path, processed_path, preview_path, mime_type, width, height, created_at, position,
          is_active, slideshow_enabled, slideshow_interval_ms, transition_type, transition_duration_ms
        )
        VALUES (
          @id, @itemId, @path, @originalPath, @processedPath, @previewPath, @mimeType, @width, @height, @createdAt, @position,
          @isActive, @slideshowEnabled, @slideshowIntervalMs, @transitionType, @transitionDurationMs
        )
      `)
      const insertTag = this.database.prepare(`
        INSERT INTO tags (id, label)
        VALUES (@id, @label)
      `)
      const attachTag = this.database.prepare(`
        INSERT INTO playlist_item_tags (item_id, tag_id)
        VALUES (?, ?)
      `)
      const updatePlayback = this.database.prepare(`
        UPDATE playback_session
        SET playlist_id = @playlistId,
            item_id = @itemId,
            status = @status,
            position_ms = @positionMs,
            updated_at = @updatedAt
        WHERE id = 1
      `)

      for (const playlist of nextData.playlists) {
        insertPlaylist.run(playlist)
      }

      for (const item of nextData.playlistItems) {
        insertItem.run(item)

        item.visual.slots.forEach((slot, position) => {
          insertImage.run({
            id: slot.image.id,
            itemId: item.id,
            path: slot.image.path,
            originalPath: slot.image.originalPath,
            processedPath: slot.image.processedPath,
            previewPath: slot.image.previewPath,
            mimeType: slot.image.mimeType,
            width: slot.image.width ?? null,
            height: slot.image.height ?? null,
            createdAt: slot.image.createdAt,
            position,
            isActive: slot.isActive ? 1 : 0,
            slideshowEnabled: slot.slideshow.enabled ? 1 : 0,
            slideshowIntervalMs: slot.slideshow.intervalMs,
            transitionType: slot.transition.type,
            transitionDurationMs: slot.transition.durationMs,
          })
        })

        for (const tag of item.tags) {
          insertTag.run(tag)
          attachTag.run(item.id, tag.id)
        }
      }

      updatePlayback.run(nextData.playbackSession)
      this.database
        .prepare(`UPDATE schema_meta SET value = ? WHERE key = 'version'`)
        .run(String(nextData.version))
    })

    replaceSnapshot(data)
    return Promise.resolve()
  }

  getConnection() {
    return this.database
  }

  private migrate() {
    this.database.exec(INITIAL_MIGRATION)

    for (const seed of INITIAL_SEED) {
      if (seed.statement.includes('?')) {
        this.database.prepare(seed.statement).run(this.clock())
      } else {
        this.database.exec(seed.statement)
      }
    }
  }

  private snapshot(): LocalDatabaseSchema {
    const base = createEmptyLocalDatabase(this.clock())
    const playlists = this.database
      .prepare<[], PlaylistRow>(`
        SELECT id, name, created_at, updated_at
        FROM playlists
        ORDER BY created_at ASC
      `)
      .all()
      .map<Playlist>((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

    const itemRows = this.database
      .prepare<[], PlaylistItemRow>(`
        SELECT id, playlist_id, title, order_index, created_at, updated_at
        FROM playlist_items
        ORDER BY order_index ASC, created_at ASC
      `)
      .all()

    const imageRows = this.database
      .prepare<[], ImageAssetRow>(`
        SELECT id, item_id, path, original_path, processed_path, preview_path, mime_type, width, height, created_at, position
             , is_active, slideshow_enabled, slideshow_interval_ms, transition_type, transition_duration_ms
        FROM image_assets
        ORDER BY item_id ASC, position ASC
      `)
      .all()

    const tagRows = this.database
      .prepare<[], PlaylistTagRow>(`
        SELECT pit.item_id, t.id AS tag_id, t.label
        FROM playlist_item_tags pit
        INNER JOIN tags t ON t.id = pit.tag_id
        ORDER BY pit.item_id ASC, t.label ASC
      `)
      .all()

    const playbackSessionRow = this.database
      .prepare<[], PlaybackSessionRow>(`
        SELECT playlist_id, item_id, status, position_ms, updated_at
        FROM playback_session
        WHERE id = 1
      `)
      .get()

    const slotsByItemId = new Map<string, ItemVisualSlot[]>()
    for (const row of imageRows) {
      const image: ImageAsset = {
        id: row.id,
        path: row.path,
        originalPath: row.original_path,
        processedPath: row.processed_path,
        previewPath: row.preview_path,
        mimeType: row.mime_type,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        createdAt: row.created_at,
      }
      const bucket = slotsByItemId.get(row.item_id) ?? []
      bucket.push({
        ...createDefaultItemVisualSlot(image, row.position),
        slotIndex: row.position,
        isActive: row.is_active === 1,
        slideshow: {
          enabled: row.slideshow_enabled === 1,
          intervalMs: row.slideshow_interval_ms,
        },
        transition: {
          type: row.transition_type,
          durationMs: row.transition_duration_ms,
        },
      })
      slotsByItemId.set(row.item_id, bucket)
    }

    const tagsByItemId = new Map<string, Tag[]>()
    for (const row of tagRows) {
      const bucket = tagsByItemId.get(row.item_id) ?? []
      bucket.push({
        id: row.tag_id,
        label: row.label,
      })
      tagsByItemId.set(row.item_id, bucket)
    }

    const playlistItems = itemRows.map<PlaylistItem>((row) => {
      const slots = slotsByItemId.get(row.id) ?? []
      assertVisualSlots(slots)

      return {
        id: row.id,
        playlistId: row.playlist_id,
        title: row.title,
        orderIndex: row.order_index,
        visual: {
          slots,
        },
        tags: tagsByItemId.get(row.id) ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })

    return {
      version: this.readVersion(),
      playlists,
      playlistItems,
      playbackSession: playbackSessionRow
        ? {
            playlistId: playbackSessionRow.playlist_id,
            itemId: playbackSessionRow.item_id,
            status: playbackSessionRow.status,
            positionMs: playbackSessionRow.position_ms,
            updatedAt: playbackSessionRow.updated_at,
          }
        : base.playbackSession,
    }
  }

  private readVersion() {
    const row = this.database
      .prepare<[], { value: string }>(`SELECT value FROM schema_meta WHERE key = 'version'`)
      .get()

    const version = Number(row?.value ?? LOCAL_DATABASE_VERSION)
    if (version !== LOCAL_DATABASE_VERSION) {
      throw new Error(`Unsupported local database version: ${String(version)}`)
    }

    return LOCAL_DATABASE_VERSION
  }

  private assertSchema(data: LocalDatabaseSchema) {
    if (data.version !== LOCAL_DATABASE_VERSION) {
      throw new Error(`Unsupported local database version: ${String(data.version)}`)
    }
  }
}
