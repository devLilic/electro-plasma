import { describe, expect, test } from 'vitest'
import { InMemoryItemSlideshowPlayoutMachine } from '../../src/renderer/domain/item-slideshow-playout'
import { createSlideshowItemFixture, createSlot } from '../fixtures/item-slideshow-fixture'

describe('item slideshow playout machine', () => {
  test('activating an item starts automatically from the first active visual', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine()
    const item = createSlideshowItemFixture({
      visual: {
        slots: [
          createSlot('image-disabled', 0, { isActive: false, intervalMs: 3000 }),
          createSlot('image-active', 1, { isActive: true, intervalMs: 4000 }),
        ],
      },
    })

    const state = machine.activateItem({
      item,
      loopMode: 'loop',
      nowMs: 1_000,
    })

    expect(state.status).toBe('playing')
    expect(state.itemId).toBe(item.id)
    expect(state.activeSlotIndexes).toEqual([1])
    expect(state.activeSlotIndex).toBe(1)
    expect(state.activeImageId).toBe('image-active')
    expect(state.nextAdvanceAtMs).toBe(5_000)
    expect(state.transition).toMatchObject({
      fromImageId: null,
      toImageId: 'image-active',
      kind: 'fade',
      durationMs: 300,
    })
  })

  test('advances automatically after the active slot duration', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine()
    const item = createSlideshowItemFixture()

    machine.activateItem({
      item,
      loopMode: 'loop',
      nowMs: 1_000,
    })

    const state = machine.tick({ nowMs: 4_001 })

    expect(state.activeSlotIndex).toBe(1)
    expect(state.activeImageId).toBe('image-2')
    expect(state.nextAdvanceAtMs).toBe(8_001)
  })

  test('loops back to the first active slot when loop mode is enabled', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine()
    const item = createSlideshowItemFixture()

    machine.activateItem({
      item,
      loopMode: 'loop',
      nowMs: 1_000,
    })

    machine.tick({ nowMs: 4_001 })
    machine.tick({ nowMs: 8_002 })
    const state = machine.tick({ nowMs: 13_003 })

    expect(state.status).toBe('playing')
    expect(state.activeSlotIndex).toBe(0)
    expect(state.activeImageId).toBe('image-1')
  })

  test('stops at the end when loop mode is disabled', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine()
    const item = createSlideshowItemFixture()

    machine.activateItem({
      item,
      loopMode: 'stop-at-end',
      nowMs: 1_000,
    })

    machine.tick({ nowMs: 4_001 })
    machine.tick({ nowMs: 8_002 })
    const state = machine.tick({ nowMs: 13_003 })

    expect(state.status).toBe('idle')
    expect(state.activeSlotIndex).toBe(null)
    expect(state.activeImageId).toBe(null)
    expect(state.nextAdvanceAtMs).toBe(null)
  })

  test('supports stop, pause and resume', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine()
    const item = createSlideshowItemFixture()

    machine.activateItem({
      item,
      loopMode: 'loop',
      nowMs: 1_000,
    })

    const pausedState = machine.pause({ nowMs: 2_000 })
    expect(pausedState.status).toBe('paused')
    expect(pausedState.activeSlotIndex).toBe(0)
    expect(machine.tick({ nowMs: 10_000 }).activeSlotIndex).toBe(0)

    const resumedState = machine.resume({ nowMs: 11_000 })
    expect(resumedState.status).toBe('playing')
    expect(resumedState.nextAdvanceAtMs).toBe(14_000)

    const stoppedState = machine.stop({ nowMs: 12_000 })
    expect(stoppedState.status).toBe('idle')
    expect(stoppedState.itemId).toBe(null)
    expect(stoppedState.activeSlotIndex).toBe(null)
  })

  test('manual next and previous override the automatic position', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine()
    const item = createSlideshowItemFixture()

    machine.activateItem({
      item,
      loopMode: 'loop',
      nowMs: 1_000,
    })

    const nextState = machine.next({ nowMs: 1_500 })
    expect(nextState.activeSlotIndex).toBe(1)
    expect(nextState.nextAdvanceAtMs).toBe(5_500)
    expect(nextState.transition).toMatchObject({
      fromImageId: 'image-1',
      toImageId: 'image-2',
    })

    const previousState = machine.previous({ nowMs: 1_750 })
    expect(previousState.activeSlotIndex).toBe(0)
    expect(previousState.nextAdvanceAtMs).toBe(4_750)
  })

  test('uses per-slot transition config and global fallback in playout state', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine(undefined, {
      kind: 'zoom-soft',
      durationMs: 650,
    })
    const item = createSlideshowItemFixture({
      visual: {
        slots: [
          createSlot('image-1', 0, {
            isActive: true,
            intervalMs: 3000,
            transition: { type: 'none', durationMs: 0 },
          }),
          createSlot('image-2', 1, {
            isActive: true,
            intervalMs: 4000,
            transition: { type: 'slide-right', durationMs: 450 },
          }),
        ],
      },
    })

    const activatedState = machine.activateItem({
      item,
      loopMode: 'loop',
      nowMs: 100,
    })

    expect(activatedState.transition).toMatchObject({
      kind: 'zoom-soft',
      durationMs: 650,
      toImageId: 'image-1',
    })

    const advancedState = machine.next({ nowMs: 200 })
    expect(advancedState.transition).toMatchObject({
      kind: 'slide-right',
      durationMs: 450,
      fromImageId: 'image-1',
      toImageId: 'image-2',
    })
  })

  test('handles items with fewer active images without forcing a manual next', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine()
    const item = createSlideshowItemFixture({
      visual: {
        slots: [
          createSlot('image-only', 0, { isActive: true, intervalMs: 2000 }),
        ],
      },
    })

    const state = machine.activateItem({
      item,
      loopMode: 'loop',
      nowMs: 500,
    })

    expect(state.activeSlotIndexes).toEqual([0])
    expect(machine.tick({ nowMs: 2_501 }).activeImageId).toBe('image-only')
  })

  test('ignores disabled images and stops cleanly when no active visuals exist', () => {
    const machine = new InMemoryItemSlideshowPlayoutMachine()
    const item = createSlideshowItemFixture({
      visual: {
        slots: [
          createSlot('image-disabled-1', 0, { isActive: false, intervalMs: 2000 }),
          createSlot('image-disabled-2', 1, { isActive: false, intervalMs: 3000 }),
        ],
      },
    })

    const state = machine.activateItem({
      item,
      loopMode: 'loop',
      nowMs: 250,
    })

    expect(state.status).toBe('idle')
    expect(state.activeSlotIndexes).toEqual([])
    expect(state.activeSlotIndex).toBe(null)
    expect(state.activeImageId).toBe(null)
  })
})
