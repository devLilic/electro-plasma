import { afterEach, describe, expect, test } from 'vitest'
import { ExternalPlayoutControlService } from '../../electron/main/external-playout-control-service'
import type { ExternalPlayoutController } from '../../electron/main/external-playout-controller'
import { PlayoutService } from '../../src/renderer/application/playout-service'
import { InMemoryItemSlideshowPlayoutMachine } from '../../src/renderer/domain/item-slideshow-playout'
import { createSlideshowItemFixture } from '../fixtures/item-slideshow-fixture'

const services: ExternalPlayoutControlService[] = []

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.stop()))
})

describe('external control integration with playout engine', () => {
  test('external play starts the internal slideshow session', async () => {
    const harness = createIntegratedPlayoutHarness()
    services.push(harness.service)
    await harness.service.start()

    await postCommand(harness.endpointUrl, { command: 'play' })

    expect(harness.playoutService.getState()).toMatchObject({
      status: 'playing',
      itemId: 'item:slideshow',
      activeImageId: 'image-1',
    })
  })

  test('external next overrides the current slideshow position correctly', async () => {
    const harness = createIntegratedPlayoutHarness()
    services.push(harness.service)
    await harness.service.start()

    await postCommand(harness.endpointUrl, { command: 'play' })
    await postCommand(harness.endpointUrl, { command: 'next' })

    expect(harness.playoutService.getState()).toMatchObject({
      status: 'playing',
      activeImageId: 'image-2',
      activeSlotIndex: 1,
    })
  })

  test('external stop terminates the current internal session', async () => {
    const harness = createIntegratedPlayoutHarness()
    services.push(harness.service)
    await harness.service.start()

    await postCommand(harness.endpointUrl, { command: 'play' })
    await postCommand(harness.endpointUrl, { command: 'stop' })

    expect(harness.playoutService.getState()).toMatchObject({
      status: 'idle',
      itemId: null,
      activeImageId: null,
    })
  })

  test('internal and external commands share the same central state safely', async () => {
    const harness = createIntegratedPlayoutHarness()
    services.push(harness.service)
    await harness.service.start()

    await postCommand(harness.endpointUrl, { command: 'play' })
    harness.playoutService.next({ nowMs: 1_500 })
    expect(harness.playoutService.getState().activeImageId).toBe('image-2')

    await postCommand(harness.endpointUrl, { command: 'next' })
    expect(harness.playoutService.getState().activeImageId).toBe('image-3')

    harness.playoutService.stop({ nowMs: 2_000 })
    await postCommand(harness.endpointUrl, { command: 'getStatus' })
    expect(harness.service.getPlayoutStatus()).toMatchObject({
      state: 'idle',
      itemId: null,
    })
  })
})

function createIntegratedPlayoutHarness() {
  const item = createSlideshowItemFixture()
  const machine = new InMemoryItemSlideshowPlayoutMachine()
  const playoutService = new PlayoutService(machine)
  const controller: ExternalPlayoutController = {
    play(nowMs) {
      const state = playoutService.activateItem({
        item,
        loopMode: 'loop',
        nowMs,
      })
      return toPlayoutStatus(state, 'play')
    },
    next(nowMs) {
      const state = playoutService.next({ nowMs })
      return toPlayoutStatus(state, 'next')
    },
    stop(nowMs) {
      const state = playoutService.stop({ nowMs })
      return toPlayoutStatus(state, 'stop')
    },
    pause(nowMs) {
      const state = playoutService.pause({ nowMs })
      return toPlayoutStatus(state, 'pause')
    },
    resume(nowMs) {
      const state = playoutService.resume({ nowMs })
      return toPlayoutStatus(state, 'resume')
    },
    previous(nowMs) {
      const state = playoutService.previous({ nowMs })
      return toPlayoutStatus(state, 'prev')
    },
    activateItem(itemId, nowMs) {
      const state = playoutService.activateItem({
        item: {
          ...item,
          id: itemId,
        },
        loopMode: 'loop',
        nowMs,
      })
      return toPlayoutStatus(state, 'activateItem')
    },
    getStatus(nowMs) {
      const state = playoutService.tick({ nowMs })
      return toPlayoutStatus(state, 'getStatus')
    },
    subscribe() {
      return () => undefined
    },
  }

  const service = new ExternalPlayoutControlService({
    port: 0,
    clock: () => '2026-03-26T12:00:00.000Z',
    controller,
  })

  return {
    item,
    playoutService,
    service,
    get endpointUrl() {
      const endpointUrl = service.getExternalControlStatus().endpointUrl
      if (!endpointUrl) {
        throw new Error('Expected loopback endpoint to be available.')
      }

      return endpointUrl
    },
  }
}

function toPlayoutStatus(
  state: ReturnType<PlayoutService['getState']>,
  lastCommand: 'play' | 'next' | 'stop' | 'pause' | 'resume' | 'prev' | 'activateItem' | 'getStatus',
) {
  return {
    playlistId: null,
    itemId: state.itemId,
    state: state.status,
    lastCommand,
    updatedAt: '2026-03-26T12:00:00.000Z',
  } as const
}

async function postCommand(endpointUrl: string, payload: object) {
  const response = await fetch(`${endpointUrl}/command`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Expected OK response, received ${String(response.status)}.`)
  }

  return response.json()
}
