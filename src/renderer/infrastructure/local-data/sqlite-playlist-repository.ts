import {
  assertVisualSlots,
  createDefaultItemVisualSlot,
  reorderVisualSlots,
  sortPlaylistItems,
  type PlaylistItem,
} from '../../domain/media-library'
import type {
  AttachImageToItemInput,
  CreatePlaylistInput,
  CreatePlaylistItemInput,
  PlaylistRepository,
  UpdateItemVisualSlotInput,
} from '../../domain/playlist-repository'
import { SqliteLocalDatabase } from './sqlite-local-database'

export class SqlitePlaylistRepository implements PlaylistRepository {
  constructor(
    private readonly localDatabase: SqliteLocalDatabase,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async createPlaylist(input: CreatePlaylistInput) {
    const duplicate = this.localDatabase
      .getConnection()
      .prepare(`SELECT id FROM playlists WHERE id = ?`)
      .get(input.id)

    if (duplicate) {
      throw new Error(`Playlist already exists: ${input.id}`)
    }

    const timestamp = this.clock()
    this.localDatabase.getConnection().prepare(`
      INSERT INTO playlists (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(input.id, input.name, timestamp, timestamp)

    return {
      id: input.id,
      name: input.name,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  }

  async createPlaylistItem(input: CreatePlaylistItemInput) {
    const connection = this.localDatabase.getConnection()
    const playlist = connection.prepare(`SELECT id FROM playlists WHERE id = ?`).get(input.playlistId)

    if (!playlist) {
      throw new Error(`Playlist not found: ${input.playlistId}`)
    }

    const duplicate = connection.prepare(`SELECT id FROM playlist_items WHERE id = ?`).get(input.id)
    if (duplicate) {
      throw new Error(`Playlist item already exists: ${input.id}`)
    }

    const timestamp = this.clock()
    connection.prepare(`
      INSERT INTO playlist_items (id, playlist_id, title, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(input.id, input.playlistId, input.title, input.orderIndex, timestamp, timestamp)

    return {
      id: input.id,
      playlistId: input.playlistId,
      title: input.title,
      orderIndex: input.orderIndex,
      visual: { slots: [] },
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  }

  async attachImageToItem(input: AttachImageToItemInput) {
    const item = await this.requireItem(input.itemId)
    const currentCount = this.localDatabase.getConnection().prepare(`
      SELECT COUNT(*) AS count
      FROM image_assets
      WHERE item_id = ?
    `).get(input.itemId) as { count: number }

    const nextSlot = createDefaultItemVisualSlot(input.image, currentCount.count)
    assertVisualSlots([...item.visual.slots, nextSlot])

    this.localDatabase.getConnection().prepare(`
        INSERT INTO image_assets (
        id, item_id, path, original_path, processed_path, preview_path, mime_type, width, height, created_at, position,
        is_active, slideshow_enabled, slideshow_interval_ms, transition_type, transition_duration_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.image.id,
      input.itemId,
      input.image.path,
      input.image.originalPath,
      input.image.processedPath,
      input.image.previewPath,
      input.image.mimeType,
      input.image.width ?? null,
      input.image.height ?? null,
      input.image.createdAt,
      currentCount.count,
      1,
      0,
      null,
      'fade',
      300,
    )

    this.touchItem(input.itemId)
    return this.requireItem(item.id)
  }

  async reorderItemImages(itemId: string, orderedImageIds: string[]) {
    const item = await this.requireItem(itemId)
    const nextSlots = reorderVisualSlots(item.visual.slots, orderedImageIds)
    const connection = this.localDatabase.getConnection()

    const transaction = connection.transaction((slots: typeof nextSlots) => {
      connection.prepare(`DELETE FROM image_assets WHERE item_id = ?`).run(itemId)
      const insertImage = connection.prepare(`
        INSERT INTO image_assets (
          id, item_id, path, original_path, processed_path, preview_path, mime_type, width, height, created_at, position,
          is_active, slideshow_enabled, slideshow_interval_ms, transition_type, transition_duration_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      slots.forEach((slot, position) => {
        insertImage.run(
          slot.image.id,
          itemId,
          slot.image.path,
          slot.image.originalPath,
          slot.image.processedPath,
          slot.image.previewPath,
          slot.image.mimeType,
          slot.image.width ?? null,
          slot.image.height ?? null,
          slot.image.createdAt,
          position,
          slot.isActive ? 1 : 0,
          slot.slideshow.enabled ? 1 : 0,
          slot.slideshow.intervalMs,
          slot.transition.type,
          slot.transition.durationMs,
        )
      })
    })

    transaction(nextSlots)
    this.touchItem(itemId)
    return this.requireItem(itemId)
  }

  async updateItemVisualSlot(input: UpdateItemVisualSlotInput) {
    const item = await this.requireItem(input.itemId)
    const slot = item.visual.slots.find((entry) => entry.image.id === input.imageId)

    if (!slot) {
      throw new Error(`Visual slot not found for image: ${input.imageId}`)
    }

    const nextSlots = item.visual.slots.map((entry) => (
      entry.image.id === input.imageId
        ? {
            ...entry,
            isActive: input.isActive,
            slideshow: input.slideshow,
            transition: input.transition,
          }
        : entry
    ))

    assertVisualSlots(nextSlots)

    this.localDatabase.getConnection().prepare(`
      UPDATE image_assets
      SET is_active = ?,
          slideshow_enabled = ?,
          slideshow_interval_ms = ?,
          transition_type = ?,
          transition_duration_ms = ?
      WHERE item_id = ? AND id = ?
    `).run(
      input.isActive ? 1 : 0,
      input.slideshow.enabled ? 1 : 0,
      input.slideshow.intervalMs,
      input.transition.type,
      input.transition.durationMs,
      input.itemId,
      input.imageId,
    )

    this.touchItem(input.itemId)
    return this.requireItem(input.itemId)
  }

  async getPlaylist(playlistId: string) {
    const snapshot = await this.localDatabase.read()
    const playlist = snapshot.playlists.find((entry) => entry.id === playlistId)

    if (!playlist) {
      return null
    }

    return {
      playlist,
      items: sortPlaylistItems(
        snapshot.playlistItems.filter((item) => item.playlistId === playlistId),
      ),
    }
  }

  private async requireItem(itemId: string) {
    const item = await this.readItem(itemId)

    if (!item) {
      throw new Error(`Playlist item not found: ${itemId}`)
    }

    return item
  }

  private async readItem(itemId: string): Promise<PlaylistItem | null> {
    const snapshot = await this.localDatabase.read()
    return snapshot.playlistItems.find((entry) => entry.id === itemId) ?? null
  }

  private touchItem(itemId: string) {
    this.localDatabase.getConnection().prepare(`
      UPDATE playlist_items
      SET updated_at = ?
      WHERE id = ?
    `).run(this.clock(), itemId)
  }
}
