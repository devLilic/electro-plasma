import { describe, expect, test } from 'vitest'
import { createUiShellStore } from '../../src/renderer/ui/ui-shell-store'

describe('ui shell store', () => {
  test('selects a playlist', () => {
    const store = createUiShellStore()
    store.getState().selectPlaylist('playlist:noon')

    expect(store.getState()).toMatchObject({
      selectedPlaylistId: 'playlist:noon',
      selectedItemId: 'item:politics',
      selectedSlotId: 'politics:slot-1',
    })
  })

  test('selects an item', () => {
    const store = createUiShellStore()
    store.getState().selectItem('item:economy')

    expect(store.getState()).toMatchObject({
      selectedPlaylistId: 'playlist:morning',
      selectedItemId: 'item:economy',
      selectedSlotId: 'economy:slot-1',
    })
  })

  test('removes an item from the current playlist and updates selection', () => {
    const store = createUiShellStore()
    store.getState().selectItem('item:economy')
    store.getState().removeItem('item:economy')

    const state = store.getState()
    expect(state.itemsByPlaylistId['playlist:morning'].map((item) => item.id)).toEqual([
      'item:opening',
      'item:sports',
    ])
    expect(state.playlists.find((playlist) => playlist.id === 'playlist:morning')?.itemCount).toBe(2)
    expect(state.selectedItemId).toBe('item:opening')
    expect(state.selectedSlotId).toBe('opening:slot-1')
  })

  test('selects a slot', () => {
    const store = createUiShellStore()
    store.getState().selectSlot('opening:slot-4')
    expect(store.getState().selectedSlotId).toBe('opening:slot-4')
  })

  test('opens and closes modals', () => {
    const store = createUiShellStore()
    store.getState().openModalDialog('external-control')
    expect(store.getState().openModal).toBe('external-control')
    store.getState().closeModal()
    expect(store.getState().openModal).toBeNull()
  })

  test('reflects playout state', () => {
    const store = createUiShellStore()
    store.getState().syncPlayoutStatus({
      playlistId: 'playlist:morning',
      itemId: 'item:opening',
      state: 'playing',
      lastCommand: 'play',
      updatedAt: '2026-03-26T12:05:00.000Z',
    })
    expect(store.getState().playoutStatus.state).toBe('playing')
    expect(store.getState().playoutStatus.lastCommand).toBe('play')
  })

  test('reflects external control status', () => {
    const store = createUiShellStore()
    store.getState().syncExternalControlStatus({
      enabled: true,
      provider: 'local-http',
      activityState: 'connected',
      connectionState: 'connected',
      endpointUrl: 'http://127.0.0.1:45870',
      port: 45870,
      allowedCommands: ['play', 'next', 'stop'],
      lastCommand: 'next',
      recentCommands: [{ command: 'next', receivedAt: '2026-03-26T12:06:00.000Z', source: 'local-http' }],
      updatedAt: '2026-03-26T12:06:00.000Z',
    })

    expect(store.getState().externalControlStatus).toMatchObject({
      activityState: 'connected',
      port: 45870,
      lastCommand: 'next',
    })
  })

  test('adds and configures a slot for the selected item', () => {
    const store = createUiShellStore()
    store.getState().selectItem('item:politics')

    store.getState().removeSelectedSlot()
    store.getState().removeSelectedSlot()
    store.getState().addSlot()

    const selectedItem = store.getState().itemsByPlaylistId['playlist:noon'][0]
    const selectedSlot = selectedItem.slots.at(-1)

    expect(selectedItem.slots).toHaveLength(4)
    expect(selectedSlot).toMatchObject({
      title: 'Slot 4',
      slotIndex: 3,
      imageLabel: '',
      autoPlayEnabled: true,
      transitionType: 'fade',
    })

    store.getState().selectSlot(selectedSlot?.id ?? '')
    store.getState().updateSelectedSlot({
      durationMs: 6500,
      isActive: false,
      transitionType: 'zoom-soft',
      transitionDurationMs: 900,
      autoPlayEnabled: false,
    })

    expect(store.getState().itemsByPlaylistId['playlist:noon'][0].slots[3]).toMatchObject({
      durationMs: 6500,
      isActive: false,
      transitionType: 'zoom-soft',
      transitionDurationMs: 900,
      autoPlayEnabled: false,
    })
  })

  test('replaces and reorders the selected slot', () => {
    const store = createUiShellStore()
    store.getState().selectItem('item:economy')
    store.getState().selectSlot('economy:slot-2')

    store.getState().replaceSelectedSlot()
    store.getState().moveSelectedSlotRight()

    const slots = store.getState().itemsByPlaylistId['playlist:morning'][1].slots
    expect(slots[2]).toMatchObject({
      id: 'economy:slot-2',
      title: 'Slot 3',
    })
    expect(slots[2]?.imageLabel.endsWith('(updated)')).toBe(true)
  })

  test('updates item autoplay config and keeps slot selection stable after removal', () => {
    const store = createUiShellStore()
    store.getState().selectItem('item:opening')
    store.getState().selectSlot('opening:slot-3')
    store.getState().updateSelectedItemAutoPlay({
      enabled: false,
      loopMode: 'stop-at-end',
    })
    store.getState().removeSelectedSlot()

    const state = store.getState()
    expect(state.itemsByPlaylistId['playlist:morning'][0]?.autoPlay).toMatchObject({
      enabled: false,
      loopMode: 'stop-at-end',
    })
    expect(state.selectedSlotId).toBe('opening:slot-4')
    expect(state.itemsByPlaylistId['playlist:morning'][0]?.slots).toHaveLength(4)
  })
})
