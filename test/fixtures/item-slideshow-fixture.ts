import {
  createDefaultItemVisualSlot,
  type ImageAsset,
  type ItemVisualSlot,
  type PlaylistItem,
  type SlotTransitionSettings,
} from '../../src/renderer/domain/media-library'

export function createSlideshowItemFixture(overrides: Partial<PlaylistItem> = {}) {
  const slots = overrides.visual?.slots ?? [
    createSlot('image-1', 0, { isActive: true, intervalMs: 3000 }),
    createSlot('image-2', 1, { isActive: true, intervalMs: 4000 }),
    createSlot('image-3', 2, { isActive: true, intervalMs: 5000 }),
  ]

  return {
    id: 'item:slideshow',
    playlistId: 'playlist:main',
    title: 'Opening headlines',
    orderIndex: 0,
    visual: {
      slots,
    },
    tags: [],
    createdAt: '2026-03-26T10:00:00.000Z',
    updatedAt: '2026-03-26T10:00:00.000Z',
    ...overrides,
  } satisfies PlaylistItem
}

export function createSlot(
  imageId: string,
  slotIndex: number,
  options: {
    isActive?: boolean
    intervalMs?: number
    transition?: SlotTransitionSettings
  } = {},
): ItemVisualSlot {
  const slot = createDefaultItemVisualSlot(createImageAsset(imageId), slotIndex)
  return {
    ...slot,
    isActive: options.isActive ?? true,
    slideshow: {
      enabled: true,
      intervalMs: options.intervalMs ?? 3000,
    },
    transition: options.transition ?? slot.transition,
  }
}

function createImageAsset(id: string): ImageAsset {
  return {
    id,
    path: `/library/${id}.png`,
    originalPath: `/library/originals/${id}.png`,
    processedPath: `/library/processed/${id}.png`,
    previewPath: `/library/previews/${id}.png`,
    mimeType: 'image/png',
    width: 1920,
    height: 1080,
    createdAt: '2026-03-26T10:00:00.000Z',
  }
}
