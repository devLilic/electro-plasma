import { afterEach, describe, expect, test } from 'vitest'
import { ExternalPlayoutControlService } from '../../electron/main/external-playout-control-service'

const services: ExternalPlayoutControlService[] = []

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.stop()))
})

describe('external playout control service', () => {
  test('starts a local loopback service and exposes status for renderer/main consumers', async () => {
    const service = new ExternalPlayoutControlService({
      port: 0,
      clock: () => '2026-03-26T12:00:00.000Z',
    })
    services.push(service)

    await service.start()

    expect(service.getExternalControlStatus()).toMatchObject({
      enabled: true,
      provider: 'local-http',
      activityState: 'listening',
      connectionState: 'connected',
      endpointUrl: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/),
      port: expect.any(Number),
      allowedCommands: ['play', 'next', 'stop', 'pause', 'resume', 'prev', 'activateItem', 'getStatus'],
      lastCommand: null,
      recentCommands: [],
    })
    expect(service.getPlayoutStatus()).toMatchObject({
      state: 'idle',
      itemId: null,
      lastCommand: null,
    })
  })

  test('accepts external play, next and stop commands and updates playout state', async () => {
    const service = new ExternalPlayoutControlService({
      port: 0,
      clock: () => '2026-03-26T12:00:00.000Z',
    })
    services.push(service)

    await service.start()
    const endpointUrl = service.getExternalControlStatus().endpointUrl
    if (!endpointUrl) {
      throw new Error('Expected local external control endpoint.')
    }

    await postCommand(endpointUrl, { command: 'play' })
    expect(service.getPlayoutStatus()).toMatchObject({
      state: 'playing',
      lastCommand: 'play',
    })
    expect(service.getExternalControlStatus()).toMatchObject({
      activityState: 'connected',
      lastCommand: 'play',
      recentCommands: [
        expect.objectContaining({
          command: 'play',
          source: 'local-http',
        }),
      ],
    })

    await postCommand(endpointUrl, { command: 'next' })
    expect(service.getPlayoutStatus()).toMatchObject({
      state: 'playing',
      lastCommand: 'next',
    })

    await postCommand(endpointUrl, { command: 'stop' })
    expect(service.getPlayoutStatus()).toMatchObject({
      state: 'idle',
      itemId: null,
      lastCommand: 'stop',
    })
  })

  test('supports optional pause, resume, prev, activateItem and getStatus commands', async () => {
    const service = new ExternalPlayoutControlService({
      port: 0,
      clock: () => '2026-03-26T12:00:00.000Z',
    })
    services.push(service)

    await service.start()
    const endpointUrl = service.getExternalControlStatus().endpointUrl
    if (!endpointUrl) {
      throw new Error('Expected local external control endpoint.')
    }

    await postCommand(endpointUrl, { command: 'activateItem', itemId: 'item:hero' })
    expect(service.getPlayoutStatus()).toMatchObject({
      state: 'playing',
      itemId: 'item:hero',
      lastCommand: 'activateItem',
    })

    await postCommand(endpointUrl, { command: 'pause' })
    expect(service.getPlayoutStatus().state).toBe('paused')

    await postCommand(endpointUrl, { command: 'resume' })
    expect(service.getPlayoutStatus().state).toBe('playing')

    await postCommand(endpointUrl, { command: 'prev' })
    expect(service.getPlayoutStatus().lastCommand).toBe('prev')

    const statusResponse = await fetch(`${endpointUrl}/status`)
    const statusPayload = await statusResponse.json() as {
      playout: { itemId: string | null }
      externalControl: { enabled: boolean }
    }

    expect(statusPayload.externalControl.enabled).toBe(true)
    expect(statusPayload.playout.itemId).toBe('item:hero')
  })

  test('rejects unsupported commands and content-editing payloads', async () => {
    const service = new ExternalPlayoutControlService({
      port: 0,
      clock: () => '2026-03-26T12:00:00.000Z',
    })
    services.push(service)

    await service.start()
    const endpointUrl = service.getExternalControlStatus().endpointUrl
    if (!endpointUrl) {
      throw new Error('Expected local external control endpoint.')
    }

    const unsupportedResponse = await fetch(`${endpointUrl}/command`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ command: 'editTitle' }),
    })
    expect(unsupportedResponse.status).toBe(400)
    expect(await unsupportedResponse.json()).toEqual({
      error: 'Unsupported external control command.',
    })

    const contentEditingResponse = await fetch(`${endpointUrl}/command`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ command: 'play', title: 'Do not edit me' }),
    })
    expect(contentEditingResponse.status).toBe(400)
    expect(await contentEditingResponse.json()).toEqual({
      error: 'External control accepts only playout command payloads.',
    })
  })
})

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
