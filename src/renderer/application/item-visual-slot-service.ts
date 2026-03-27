import type { ImageAssetImporter } from '@domain/image-asset-importer'
import type { LocalLibraryStore } from '@domain/local-library-store'
import {
  MAX_ITEM_IMAGES,
  assertVisualSlots,
  createDefaultItemVisualSlot,
  type ItemVisualSlot,
  type SlotSlideshowSettings,
  type SlotTransitionSettings,
} from '@domain/media-library'

interface SlotAddressInput {
  itemId: string
  imageId: string
}

interface AddItemVisualSlotInput {
  itemId: string
  sourceFilePath: string
}

interface ReplaceItemVisualSlotInput extends SlotAddressInput {
  sourceFilePath: string
}

interface UpdateItemVisualSlotSettingsInput extends SlotAddressInput {
  isActive: boolean
  slideshow: SlotSlideshowSettings
  transition: SlotTransitionSettings
}

export class ItemVisualSlotService {
  constructor(
    private readonly store: LocalLibraryStore,
    private readonly imageAssetImporter: ImageAssetImporter,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async createSlot(input: AddItemVisualSlotInput) {
    const snapshot = await this.store.read()
    const item = requireItem(snapshot, input.itemId)

    if (item.visual.slots.length >= MAX_ITEM_IMAGES) {
      throw new Error(`Item visuals support a maximum of ${MAX_ITEM_IMAGES} images.`)
    }

    const imageAsset = await this.imageAssetImporter.importImage({ sourceFilePath: input.sourceFilePath })
    const nextSlots = [
      ...item.visual.slots,
      createDefaultItemVisualSlot(imageAsset, item.visual.slots.length),
    ]

    return this.persistSlots(snapshot, item.id, nextSlots)
  }

  async replaceSlot(input: ReplaceItemVisualSlotInput) {
    const snapshot = await this.store.read()
    const item = requireItem(snapshot, input.itemId)
    const slot = requireSlot(item.visual.slots, input.imageId)
    const imageAsset = await this.imageAssetImporter.importImage({ sourceFilePath: input.sourceFilePath })

    const nextSlots = item.visual.slots.map((entry) => (
      entry.image.id === input.imageId
        ? {
            ...entry,
            image: imageAsset,
          }
        : entry
    ))

    return this.persistSlots(snapshot, item.id, normalizeSlotIndexes(nextSlots, slot.slotIndex))
  }

  async deleteSlot(input: SlotAddressInput) {
    const snapshot = await this.store.read()
    const item = requireItem(snapshot, input.itemId)
    requireSlot(item.visual.slots, input.imageId)

    const nextSlots = item.visual.slots.filter((entry) => entry.image.id !== input.imageId)
    return this.persistSlots(snapshot, item.id, normalizeSlotIndexes(nextSlots))
  }

  async moveSlotLeft(input: SlotAddressInput) {
    const snapshot = await this.store.read()
    const item = requireItem(snapshot, input.itemId)
    const slot = requireSlot(item.visual.slots, input.imageId)

    if (slot.slotIndex === 0) {
      return item
    }

    const nextSlots = [...item.visual.slots]
    const leftIndex = slot.slotIndex - 1
    ;[nextSlots[leftIndex], nextSlots[slot.slotIndex]] = [nextSlots[slot.slotIndex], nextSlots[leftIndex]]

    return this.persistSlots(snapshot, item.id, normalizeSlotIndexes(nextSlots))
  }

  async moveSlotRight(input: SlotAddressInput) {
    const snapshot = await this.store.read()
    const item = requireItem(snapshot, input.itemId)
    const slot = requireSlot(item.visual.slots, input.imageId)

    if (slot.slotIndex === item.visual.slots.length - 1) {
      return item
    }

    const nextSlots = [...item.visual.slots]
    const rightIndex = slot.slotIndex + 1
    ;[nextSlots[slot.slotIndex], nextSlots[rightIndex]] = [nextSlots[rightIndex], nextSlots[slot.slotIndex]]

    return this.persistSlots(snapshot, item.id, normalizeSlotIndexes(nextSlots))
  }

  async updateSlotSettings(input: UpdateItemVisualSlotSettingsInput) {
    const snapshot = await this.store.read()
    const item = requireItem(snapshot, input.itemId)
    requireSlot(item.visual.slots, input.imageId)

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

    return this.persistSlots(snapshot, item.id, normalizeSlotIndexes(nextSlots))
  }

  private async persistSlots(
    snapshot: Awaited<ReturnType<LocalLibraryStore['read']>>,
    itemId: string,
    slots: ItemVisualSlot[],
  ) {
    const nextItems = snapshot.playlistItems.map((item) => (
      item.id === itemId
        ? {
            ...item,
            visual: {
              slots,
            },
            updatedAt: this.clock(),
          }
        : item
    ))

    await this.store.write({
      ...snapshot,
      playlistItems: nextItems,
    })

    return requireItem(
      {
        ...snapshot,
        playlistItems: nextItems,
      },
      itemId,
    )
  }
}

function requireItem(snapshot: Awaited<ReturnType<LocalLibraryStore['read']>>, itemId: string) {
  const item = snapshot.playlistItems.find((entry) => entry.id === itemId)
  if (!item) {
    throw new Error(`Playlist item not found: ${itemId}`)
  }

  return item
}

function requireSlot(slots: ItemVisualSlot[], imageId: string) {
  const slot = slots.find((entry) => entry.image.id === imageId)
  if (!slot) {
    throw new Error(`Visual slot not found for image: ${imageId}`)
  }

  return slot
}

function normalizeSlotIndexes(slots: ItemVisualSlot[], preferredIndex?: number) {
  const normalized = slots.map((slot, index) => ({
    ...slot,
    slotIndex: index,
  }))

  if (preferredIndex !== undefined && preferredIndex >= 0 && preferredIndex < normalized.length) {
    normalized.sort((left, right) => left.slotIndex - right.slotIndex)
  }

  assertVisualSlots(normalized)
  return normalized
}
