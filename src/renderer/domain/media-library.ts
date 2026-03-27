export const LOCAL_DATABASE_VERSION = 3 as const
export const MAX_ITEM_IMAGES = 5 as const

export interface Tag {
  id: string
  label: string
}

export interface ImageAsset {
  id: string
  path: string
  originalPath: string
  processedPath: string
  previewPath: string
  mimeType: string
  width?: number
  height?: number
  createdAt: string
}

export interface SlotSlideshowSettings {
  enabled: boolean
  intervalMs: number | null
}

export interface SlotTransitionSettings {
  type: 'none' | 'cut' | 'fade' | 'slide' | 'slide-left' | 'slide-right' | 'zoom-soft'
  durationMs: number
}

export interface ItemVisualSlot {
  slotIndex: number
  isActive: boolean
  slideshow: SlotSlideshowSettings
  transition: SlotTransitionSettings
  image: ImageAsset
}

export interface ItemVisual {
  slots: ItemVisualSlot[]
}

export interface Playlist {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface PlaylistItem {
  id: string
  playlistId: string
  title: string
  orderIndex: number
  visual: ItemVisual
  tags: Tag[]
  createdAt: string
  updatedAt: string
}

export interface PlaybackSessionState {
  playlistId: string | null
  itemId: string | null
  status: 'idle' | 'playing' | 'paused'
  positionMs: number
  updatedAt: string
}

export interface LocalDatabaseSchema {
  version: typeof LOCAL_DATABASE_VERSION
  playlists: Playlist[]
  playlistItems: PlaylistItem[]
  playbackSession: PlaybackSessionState
}

export interface PlaylistDetails {
  playlist: Playlist
  items: PlaylistItem[]
}

export function createEmptyLocalDatabase(now: string): LocalDatabaseSchema {
  return {
    version: LOCAL_DATABASE_VERSION,
    playlists: [],
    playlistItems: [],
    playbackSession: {
      playlistId: null,
      itemId: null,
      status: 'idle',
      positionMs: 0,
      updatedAt: now,
    },
  }
}

export function sortPlaylistItems(items: PlaylistItem[]) {
  return [...items].sort((left, right) => left.orderIndex - right.orderIndex)
}

export function assertImageLimit(images: ImageAsset[]) {
  if (images.length > MAX_ITEM_IMAGES) {
    throw new Error(`Item visuals support a maximum of ${MAX_ITEM_IMAGES} images.`)
  }
}

export function createDefaultItemVisualSlot(image: ImageAsset, slotIndex: number): ItemVisualSlot {
  return {
    slotIndex,
    isActive: true,
    slideshow: {
      enabled: false,
      intervalMs: null,
    },
    transition: {
      type: 'fade',
      durationMs: 300,
    },
    image,
  }
}

export function assertVisualSlots(slots: ItemVisualSlot[]) {
  if (slots.length > MAX_ITEM_IMAGES) {
    throw new Error(`Item visuals support a maximum of ${MAX_ITEM_IMAGES} images.`)
  }

  slots.forEach((slot, index) => {
    if (slot.slotIndex !== index) {
      throw new Error('Visual slots must keep a stable, sequential order.')
    }

    if (slot.slideshow.enabled && (!slot.slideshow.intervalMs || slot.slideshow.intervalMs <= 0)) {
      throw new Error('Enabled slideshow slots require a positive interval.')
    }

    if (slot.transition.durationMs < 0) {
      throw new Error('Transition duration must be zero or greater.')
    }
  })
}

export function reorderVisualSlots(slots: ItemVisualSlot[], orderedImageIds: string[]) {
  if (slots.length !== orderedImageIds.length) {
    throw new Error('Image reorder payload must include every image exactly once.')
  }

  const slotMap = new Map(slots.map((slot) => [slot.image.id, slot]))
  const reordered = orderedImageIds.map((imageId, slotIndex) => {
    const slot = slotMap.get(imageId)

    if (!slot) {
      throw new Error(`Unknown image id: ${imageId}`)
    }

    return {
      ...slot,
      slotIndex,
    }
  })

  if (new Set(orderedImageIds).size !== slots.length) {
    throw new Error('Image reorder payload must not contain duplicates.')
  }

  assertVisualSlots(reordered)
  return reordered
}
