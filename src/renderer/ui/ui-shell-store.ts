import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type { ExternalControlStatusDto, PlayoutStatusDto, PlaylistSummaryDto } from '@shared/plasma-api'
import { MAX_ITEM_IMAGES } from '@domain/media-library'
import type { ImportedPlaylist } from '@domain/playlist-import'

export type UiShellTransitionType = 'fade' | 'cut' | 'slide-left' | 'slide-right' | 'zoom-soft'

export interface UiShellAutoPlayConfig {
  enabled: boolean
  loopMode: 'loop' | 'stop-at-end'
}

export interface UiShellSlot {
  id: string
  title: string
  imageLabel: string
  thumbnailUrl?: string
  sourceType?: 'local' | 'web' | 'generated'
  slotIndex: number
  durationMs: number
  isActive: boolean
  transitionType: UiShellTransitionType
  transitionDurationMs: number
  autoPlayEnabled: boolean
}

export interface UiShellItem {
  id: string
  playlistId: string
  title: string
  slug: string
  intro: string
  autoPlay: UiShellAutoPlayConfig
  slots: UiShellSlot[]
}

export interface UiShellState {
  playlists: PlaylistSummaryDto[]
  itemsByPlaylistId: Record<string, UiShellItem[]>
  selectedPlaylistId: string | null
  selectedItemId: string | null
  selectedSlotId: string | null
  openModal: 'import-playlist' | 'external-control' | null
  playoutStatus: PlayoutStatusDto
  externalControlStatus: ExternalControlStatusDto
}

export interface UiShellActions {
  selectPlaylist(playlistId: string): void
  selectItem(itemId: string): void
  removeItem(itemId: string): void
  selectSlot(slotId: string): void
  openModalDialog(modal: NonNullable<UiShellState['openModal']>): void
  closeModal(): void
  addSlot(): void
  replaceSelectedSlot(): void
  removeSelectedSlot(): void
  moveSelectedSlotLeft(): void
  moveSelectedSlotRight(): void
  updateSelectedSlot(patch: Partial<Pick<UiShellSlot, 'durationMs' | 'isActive' | 'transitionType' | 'transitionDurationMs' | 'autoPlayEnabled' | 'imageLabel' | 'thumbnailUrl' | 'sourceType'>>): void
  updateSelectedItemAutoPlay(patch: Partial<UiShellAutoPlayConfig>): void
  importParsedPlaylist(payload: { fileName: string; imported: ImportedPlaylist }): void
  syncPlayoutStatus(status: PlayoutStatusDto): void
  syncExternalControlStatus(status: ExternalControlStatusDto): void
}

export function createUiShellStore(initialState: Partial<UiShellState> = {}) {
  return createStore<UiShellState & UiShellActions>((set, get) => ({
    ...createDefaultUiShellState(),
    ...initialState,
    selectPlaylist(playlistId) {
      const items = get().itemsByPlaylistId[playlistId] ?? []
      const firstItem = items[0] ?? null
      set({
        selectedPlaylistId: playlistId,
        selectedItemId: firstItem?.id ?? null,
        selectedSlotId: firstItem?.slots[0]?.id ?? null,
      })
    },
    selectItem(itemId) {
      const item = Object.values(get().itemsByPlaylistId).flat().find((entry) => entry.id === itemId)
      set({
        selectedPlaylistId: item?.playlistId ?? get().selectedPlaylistId,
        selectedItemId: itemId,
        selectedSlotId: item?.slots[0]?.id ?? null,
      })
    },
    removeItem(itemId) {
      const state = get()
      const item = Object.values(state.itemsByPlaylistId).flat().find((entry) => entry.id === itemId)
      if (!item) {
        return
      }

      const playlistItems = state.itemsByPlaylistId[item.playlistId] ?? []
      const nextPlaylistItems = playlistItems.filter((entry) => entry.id !== itemId)
      const nextSelectedItem = state.selectedItemId === itemId
        ? nextPlaylistItems[0] ?? null
        : nextPlaylistItems.find((entry) => entry.id === state.selectedItemId) ?? nextPlaylistItems[0] ?? null

      set({
        playlists: state.playlists.map((playlist) => (
          playlist.id === item.playlistId
            ? {
                ...playlist,
                itemCount: nextPlaylistItems.length,
                updatedAt: new Date().toISOString(),
              }
            : playlist
        )),
        itemsByPlaylistId: {
          ...state.itemsByPlaylistId,
          [item.playlistId]: nextPlaylistItems,
        },
        selectedPlaylistId: item.playlistId,
        selectedItemId: nextSelectedItem?.id ?? null,
        selectedSlotId: nextSelectedItem?.slots[0]?.id ?? null,
      })
    },
    selectSlot(slotId) {
      set({ selectedSlotId: slotId })
    },
    openModalDialog(modal) {
      set({ openModal: modal })
    },
    closeModal() {
      set({ openModal: null })
    },
    addSlot() {
      const item = getSelectedItem(get())
      if (!item || item.slots.length >= MAX_ITEM_IMAGES) {
        return
      }

      const nextSlotNumber = item.slots.length + 1
      const nextSlot: UiShellSlot = {
        id: `${item.id}:slot:${Date.now()}:${nextSlotNumber}`,
        title: `Slot ${nextSlotNumber}`,
        imageLabel: '',
        thumbnailUrl: undefined,
        sourceType: 'generated',
        slotIndex: item.slots.length,
        durationMs: 4000,
        isActive: true,
        transitionType: 'fade',
        transitionDurationMs: 300,
        autoPlayEnabled: true,
      }

      set((state) => {
        const nextItems = updateItemInState(state, item.id, (entry) => ({
          ...entry,
          slots: normalizeSlots([...entry.slots, nextSlot]),
        }))

        return {
          itemsByPlaylistId: nextItems,
          selectedSlotId: nextSlot.id,
        }
      })
    },
    replaceSelectedSlot() {
      const selectedItem = getSelectedItem(get())
      const selectedSlot = getSelectedSlot(get())
      if (!selectedItem || !selectedSlot) {
        return
      }

      set((state) => ({
        itemsByPlaylistId: updateItemInState(state, selectedItem.id, (item) => ({
          ...item,
          slots: item.slots.map((slot) => (
            slot.id === selectedSlot.id
              ? {
                  ...slot,
                  imageLabel: `${slot.imageLabel} (updated)`,
                  sourceType: slot.sourceType ?? 'generated',
                }
              : slot
          )),
        })),
      }))
    },
    removeSelectedSlot() {
      const selectedItem = getSelectedItem(get())
      const selectedSlot = getSelectedSlot(get())
      if (!selectedItem || !selectedSlot) {
        return
      }

      const remainingSlots = selectedItem.slots.filter((slot) => slot.id !== selectedSlot.id)
      const nextSlots = normalizeSlots(remainingSlots)
      const nextSelectedSlot = nextSlots[Math.min(selectedSlot.slotIndex, nextSlots.length - 1)] ?? null

      set((state) => ({
        itemsByPlaylistId: updateItemInState(state, selectedItem.id, (item) => ({
          ...item,
          slots: nextSlots,
        })),
        selectedSlotId: nextSelectedSlot?.id ?? null,
      }))
    },
    moveSelectedSlotLeft() {
      const selectedItem = getSelectedItem(get())
      const selectedSlot = getSelectedSlot(get())
      if (!selectedItem || !selectedSlot || selectedSlot.slotIndex === 0) {
        return
      }

      const nextSlots = [...selectedItem.slots]
      const leftIndex = selectedSlot.slotIndex - 1
      ;[nextSlots[leftIndex], nextSlots[selectedSlot.slotIndex]] = [nextSlots[selectedSlot.slotIndex], nextSlots[leftIndex]]

      set((state) => ({
        itemsByPlaylistId: updateItemInState(state, selectedItem.id, (item) => ({
          ...item,
          slots: normalizeSlots(nextSlots),
        })),
      }))
    },
    moveSelectedSlotRight() {
      const selectedItem = getSelectedItem(get())
      const selectedSlot = getSelectedSlot(get())
      if (!selectedItem || !selectedSlot || selectedSlot.slotIndex === selectedItem.slots.length - 1) {
        return
      }

      const nextSlots = [...selectedItem.slots]
      const rightIndex = selectedSlot.slotIndex + 1
      ;[nextSlots[selectedSlot.slotIndex], nextSlots[rightIndex]] = [nextSlots[rightIndex], nextSlots[selectedSlot.slotIndex]]

      set((state) => ({
        itemsByPlaylistId: updateItemInState(state, selectedItem.id, (item) => ({
          ...item,
          slots: normalizeSlots(nextSlots),
        })),
      }))
    },
    updateSelectedSlot(patch) {
      const selectedItem = getSelectedItem(get())
      const selectedSlot = getSelectedSlot(get())
      if (!selectedItem || !selectedSlot) {
        return
      }

      set((state) => ({
        itemsByPlaylistId: updateItemInState(state, selectedItem.id, (item) => ({
          ...item,
          slots: item.slots.map((slot) => (
            slot.id === selectedSlot.id
              ? {
                  ...slot,
                  ...patch,
                }
              : slot
          )),
        })),
      }))
    },
    updateSelectedItemAutoPlay(patch) {
      const selectedItem = getSelectedItem(get())
      if (!selectedItem) {
        return
      }

      set((state) => ({
        itemsByPlaylistId: updateItemInState(state, selectedItem.id, (item) => ({
          ...item,
          autoPlay: {
            ...item.autoPlay,
            ...patch,
          },
        })),
      }))
    },
    importParsedPlaylist(payload) {
      const now = new Date().toISOString()
      const playlistId = createImportedUiPlaylistId(payload.fileName)
      const importedItems = payload.imported.items
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map<UiShellItem>((item, index) => ({
          id: `${playlistId}:item:${slugify(item.externalId || item.title || String(index + 1))}`,
          playlistId,
          title: item.title,
          slug: item.slug ?? slugify(item.title),
          intro: item.intro ?? 'Imported from ENPS HTM.',
          autoPlay: {
            enabled: true,
            loopMode: 'loop',
          },
          slots: [],
        }))

      const nextPlaylist: PlaylistSummaryDto = {
        id: playlistId,
        name: payload.imported.title,
        itemCount: importedItems.length,
        updatedAt: now,
      }

      set((state) => ({
        playlists: state.playlists.some((playlist) => playlist.id === playlistId)
          ? state.playlists.map((playlist) => playlist.id === playlistId ? nextPlaylist : playlist)
          : [nextPlaylist, ...state.playlists],
        itemsByPlaylistId: {
          ...state.itemsByPlaylistId,
          [playlistId]: importedItems,
        },
        selectedPlaylistId: playlistId,
        selectedItemId: importedItems[0]?.id ?? null,
        selectedSlotId: null,
        openModal: null,
      }))
    },
    syncPlayoutStatus(status) {
      set({ playoutStatus: status })
    },
    syncExternalControlStatus(status) {
      set({ externalControlStatus: status })
    },
  }))
}

export const uiShellStore = createUiShellStore()

export function useUiShellStore<T>(selector: (state: UiShellState & UiShellActions) => T) {
  return useStore(uiShellStore, selector)
}

function createDefaultUiShellState(): UiShellState {
  const playlists: PlaylistSummaryDto[] = [
    { id: 'playlist:morning', name: 'Morning Rundown', itemCount: 3, updatedAt: '2026-03-26T09:15:00.000Z' },
    { id: 'playlist:noon', name: 'Noon Bulletin', itemCount: 2, updatedAt: '2026-03-26T11:30:00.000Z' },
  ]

  const itemsByPlaylistId: Record<string, UiShellItem[]> = {
    'playlist:morning': [
      createItem('item:opening', 'playlist:morning', 'Opening Headlines', 'opening-headlines', 'Top stories and intro sting for the first block.', 'opening', ['Studio wide', 'Anchor close', 'Weather wall', 'Parliament', 'City aerial']),
      createItem('item:economy', 'playlist:morning', 'Economy Update', 'economy-update', 'Market wrap, inflation chart and regional comparison.', 'economy', ['Chart wall', 'Reporter live', 'Graph package', 'Factory floor', 'Currency board']),
      createItem('item:sports', 'playlist:morning', 'Sports Brief', 'sports-brief', 'Quick recap with scoreboard and action stills.', 'sports', ['Scoreboard', 'Goal highlight', 'Bench reaction', 'Crowd wide', 'Locker room']),
    ],
    'playlist:noon': [
      createItem('item:politics', 'playlist:noon', 'Politics Special', 'politics-special', 'Parliament session, podium shots and vote recap.', 'politics', ['Speaker podium', 'Chamber wide', 'Interview split', 'Roll-call board', 'Opposition bench']),
      createItem('item:community', 'playlist:noon', 'Community Desk', 'community-desk', 'Local events and social response package.', 'community', ['Field package', 'Portrait still', 'Map graphic', 'Crowd scene', 'Event stage']),
    ],
  }

  return {
    playlists,
    itemsByPlaylistId,
    selectedPlaylistId: 'playlist:morning',
    selectedItemId: 'item:opening',
    selectedSlotId: 'opening:slot-1',
    openModal: null,
    playoutStatus: {
      playlistId: 'playlist:morning',
      itemId: 'item:opening',
      state: 'idle',
      lastCommand: null,
      updatedAt: '2026-03-26T12:00:00.000Z',
    },
    externalControlStatus: {
      enabled: true,
      provider: 'local-http',
      activityState: 'listening',
      connectionState: 'connected',
      endpointUrl: 'http://127.0.0.1:45870',
      port: 45870,
      allowedCommands: ['play', 'next', 'stop', 'pause', 'resume', 'prev', 'activateItem', 'getStatus'],
      lastCommand: null,
      recentCommands: [],
      updatedAt: '2026-03-26T12:00:00.000Z',
    },
  }
}

function createItem(
  id: string,
  playlistId: string,
  title: string,
  slug: string,
  intro: string,
  slotPrefix: string,
  slotLabels: string[],
): UiShellItem {
  return {
    id,
    playlistId,
    title,
    slug,
    intro,
    autoPlay: {
      enabled: true,
      loopMode: 'loop',
    },
    slots: slotLabels.map((label, index) => ({
      id: `${slotPrefix}:slot-${String(index + 1)}`,
      title: `Slot ${String(index + 1)}`,
      imageLabel: label,
      thumbnailUrl: undefined,
      sourceType: 'generated',
      slotIndex: index,
      durationMs: 3000 + (index * 1000),
      isActive: index < 4,
      transitionType: index % 2 === 0 ? 'fade' : 'slide-left',
      transitionDurationMs: 300 + (index * 50),
      autoPlayEnabled: index < 4,
    })),
  }
}

function updateItemInState(
  state: UiShellState,
  itemId: string,
  updater: (item: UiShellItem) => UiShellItem,
) {
  const nextEntries = Object.entries(state.itemsByPlaylistId).map(([playlistId, items]) => ([
    playlistId,
    items.map((item) => item.id === itemId ? updater(item) : item),
  ]))

  return Object.fromEntries(nextEntries)
}

function getSelectedItem(state: UiShellState) {
  return Object.values(state.itemsByPlaylistId).flat().find((item) => item.id === state.selectedItemId) ?? null
}

function getSelectedSlot(state: UiShellState) {
  const item = getSelectedItem(state)
  return item?.slots.find((slot) => slot.id === state.selectedSlotId) ?? null
}

function normalizeSlots(slots: UiShellSlot[]) {
  return slots.map((slot, index) => ({
    ...slot,
    slotIndex: index,
    title: `Slot ${index + 1}`,
  }))
}

function createImportedUiPlaylistId(fileName: string) {
  return `playlist:imported:${slugify(fileName.replace(/\.[^.]+$/, ''))}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
