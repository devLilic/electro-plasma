import { describe, expect, test } from 'vitest'
import { DeterministicTransitionEngine } from '../../src/renderer/domain/transition-engine'
import { createTransitionVisualRef } from '../fixtures/transition-engine-fixture'

describe('transition engine', () => {
  test('resolves a cut transition payload for an immediate visual switch', () => {
    const engine = new DeterministicTransitionEngine()

    const payload = engine.resolve({
      from: createTransitionVisualRef('image-1', 0),
      to: createTransitionVisualRef('image-2', 1),
      transition: {
        kind: 'cut',
        durationMs: 0,
      },
      changedAtMs: 1_000,
    })

    expect(payload).toEqual({
      key: 'image-1->image-2:cut:1000',
      kind: 'cut',
      durationMs: 0,
      fromImageId: 'image-1',
      toImageId: 'image-2',
      fromPath: '/library/processed/image-1.png',
      toPath: '/library/processed/image-2.png',
      startedAtMs: 1_000,
    })
  })

  test('resolves fade, slide-left, slide-right and zoom-soft as renderer payloads', () => {
    const engine = new DeterministicTransitionEngine()
    const from = createTransitionVisualRef('image-1', 0)
    const to = createTransitionVisualRef('image-2', 1)

    expect(engine.resolve({
      from,
      to,
      transition: { kind: 'fade', durationMs: 300 },
      changedAtMs: 2_000,
    })).toMatchObject({ kind: 'fade', durationMs: 300 })

    expect(engine.resolve({
      from,
      to,
      transition: { kind: 'slide-left', durationMs: 450 },
      changedAtMs: 2_100,
    })).toMatchObject({ kind: 'slide-left', durationMs: 450 })

    expect(engine.resolve({
      from,
      to,
      transition: { kind: 'slide-right', durationMs: 450 },
      changedAtMs: 2_200,
    })).toMatchObject({ kind: 'slide-right', durationMs: 450 })

    expect(engine.resolve({
      from,
      to,
      transition: { kind: 'zoom-soft', durationMs: 600 },
      changedAtMs: 2_300,
    })).toMatchObject({ kind: 'zoom-soft', durationMs: 600 })
  })

  test('uses a deterministic payload key for the same image change', () => {
    const engine = new DeterministicTransitionEngine()

    const firstPayload = engine.resolve({
      from: createTransitionVisualRef('image-1', 0),
      to: createTransitionVisualRef('image-2', 1),
      transition: {
        kind: 'fade',
        durationMs: 300,
      },
      changedAtMs: 5_000,
    })

    const secondPayload = engine.resolve({
      from: createTransitionVisualRef('image-1', 0),
      to: createTransitionVisualRef('image-2', 1),
      transition: {
        kind: 'fade',
        durationMs: 300,
      },
      changedAtMs: 5_000,
    })

    expect(firstPayload).toEqual(secondPayload)
  })

  test('treats the first image activation as a transition from empty state', () => {
    const engine = new DeterministicTransitionEngine()

    const payload = engine.resolve({
      from: null,
      to: createTransitionVisualRef('image-1', 0),
      transition: {
        kind: 'fade',
        durationMs: 250,
      },
      changedAtMs: 750,
    })

    expect(payload.fromImageId).toBe(null)
    expect(payload.fromPath).toBe(null)
    expect(payload.toImageId).toBe('image-1')
  })
})
