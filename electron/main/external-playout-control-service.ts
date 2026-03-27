import { EventEmitter } from 'node:events'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import {
  assertSerializable,
  type ExternalControlCommand,
  type ExternalControlCommandLogEntryDto,
  type ExternalControlStatusDto,
  type PlayoutStatusDto,
} from '../../src/shared/plasma-api'
import {
  MainPlayoutCoordinator,
  dispatchExternalPlayoutCommand,
  type ExternalPlayoutController,
} from './external-playout-controller'

const ALLOWED_COMMANDS: ExternalControlCommand[] = [
  'play',
  'next',
  'stop',
  'pause',
  'resume',
  'prev',
  'activateItem',
  'getStatus',
]

interface ExternalPlayoutControlServiceOptions {
  port?: number
  host?: string
  clock?: () => string
  controller?: ExternalPlayoutController
}

interface ExternalCommandPayload {
  command: ExternalControlCommand
  itemId?: string
}

export class ExternalPlayoutControlService {
  private readonly events = new EventEmitter()
  private server: Server | null = null
  private readonly port: number
  private readonly host: string
  private readonly clock: () => string
  private readonly controller: ExternalPlayoutController
  private externalStatus: ExternalControlStatusDto
  private playoutStatus: PlayoutStatusDto

  constructor(options: ExternalPlayoutControlServiceOptions = {}) {
    this.port = options.port ?? 45870
    this.host = options.host ?? '127.0.0.1'
    this.clock = options.clock ?? (() => new Date().toISOString())
    this.controller = options.controller ?? new MainPlayoutCoordinator(this.clock)
    this.externalStatus = {
      enabled: false,
      provider: 'local-http',
      activityState: 'disconnected',
      connectionState: 'disconnected',
      endpointUrl: null,
      port: null,
      allowedCommands: ALLOWED_COMMANDS,
      lastCommand: null,
      recentCommands: [],
      updatedAt: this.clock(),
    }
    this.playoutStatus = {
      playlistId: null,
      itemId: null,
      state: 'idle',
      lastCommand: null,
      updatedAt: this.clock(),
    }
  }

  async start() {
    if (this.server) {
      return
    }

    this.externalStatus = {
      ...this.externalStatus,
      enabled: true,
      activityState: 'listening',
      connectionState: 'connecting',
      updatedAt: this.clock(),
    }

    this.server = createServer((request, response) => {
      void this.handleRequest(request, response)
    })

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject)
      this.server?.listen(this.port, this.host, () => resolve())
    })

    const address = this.server.address()
    const resolvedPort = typeof address === 'object' && address ? address.port : this.port
    this.externalStatus = {
      ...this.externalStatus,
      enabled: true,
      activityState: this.externalStatus.recentCommands.length > 0 ? 'connected' : 'listening',
      connectionState: 'connected',
      endpointUrl: `http://${this.host}:${String(resolvedPort)}`,
      port: resolvedPort,
      updatedAt: this.clock(),
    }
    this.events.emit('status', this.externalStatus)
  }

  async stop() {
    if (!this.server) {
      return
    }

    const activeServer = this.server
    this.server = null

    await new Promise<void>((resolve, reject) => {
      activeServer.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    this.externalStatus = {
      ...this.externalStatus,
      enabled: false,
      activityState: 'disconnected',
      connectionState: 'disconnected',
      endpointUrl: null,
      port: null,
      updatedAt: this.clock(),
    }
    this.events.emit('status', this.externalStatus)
  }

  getExternalControlStatus() {
    return this.externalStatus
  }

  getPlayoutStatus() {
    return this.playoutStatus
  }

  subscribe(listener: (status: ExternalControlStatusDto) => void) {
    this.events.on('status', listener)
    return () => {
      this.events.off('status', listener)
    }
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse) {
    const method = request.method ?? 'GET'
    const url = new URL(request.url ?? '/', this.externalStatus.endpointUrl ?? `http://${this.host}:${String(this.port)}`)

    if (method === 'GET' && url.pathname === '/status') {
      return this.respondJson(response, 200, {
        externalControl: this.getExternalControlStatus(),
        playout: this.getPlayoutStatus(),
      })
    }

    if (method === 'POST' && url.pathname === '/command') {
      try {
        const payload = parseExternalCommandPayload(await readBody(request))
        const result = this.applyCommand(payload)
        return this.respondJson(response, 200, result)
      } catch (error) {
        return this.respondJson(response, 400, {
          error: error instanceof Error ? error.message : 'Invalid external control request.',
        })
      }
    }

    return this.respondJson(response, 404, {
      error: 'External control endpoint not found.',
    })
  }

  private applyCommand(payload: ExternalCommandPayload) {
    const now = this.clock()
    const recentCommands = [
      createRecentCommandEntry(payload.command, now),
      ...this.externalStatus.recentCommands,
    ].slice(0, 8)
    this.playoutStatus = dispatchExternalPlayoutCommand(
      this.controller,
      payload.command,
      Date.parse(now),
      payload.itemId,
    )
    this.externalStatus = {
      ...this.externalStatus,
      activityState: 'connected',
      lastCommand: payload.command,
      recentCommands,
      updatedAt: now,
    }
    this.events.emit('status', this.externalStatus)

    return {
      acknowledged: true,
      command: payload.command,
      playout: this.getPlayoutStatus(),
    }
  }

  private respondJson(response: ServerResponse, statusCode: number, payload: unknown) {
    assertSerializable(payload)
    response.writeHead(statusCode, {
      'content-type': 'application/json; charset=utf-8',
    })
    response.end(JSON.stringify(payload))
  }
}

function createRecentCommandEntry(
  command: ExternalControlCommand,
  receivedAt: string,
): ExternalControlCommandLogEntryDto {
  return {
    command,
    receivedAt,
    source: 'local-http',
  }
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}

function parseExternalCommandPayload(body: string): ExternalCommandPayload {
  const parsed = JSON.parse(body || '{}') as Record<string, unknown>
  const keys = Object.keys(parsed)

  if (!keys.every((key) => key === 'command' || key === 'itemId')) {
    throw new Error('External control accepts only playout command payloads.')
  }

  if (!ALLOWED_COMMANDS.includes(parsed.command as ExternalControlCommand)) {
    throw new Error('Unsupported external control command.')
  }

  if (parsed.command === 'activateItem') {
    if (typeof parsed.itemId !== 'string' || !parsed.itemId.trim()) {
      throw new Error('activateItem requires a non-empty itemId.')
    }
  } else if (parsed.itemId !== undefined) {
    throw new Error('Only activateItem may include itemId.')
  }

  return {
    command: parsed.command as ExternalControlCommand,
    itemId: typeof parsed.itemId === 'string' ? parsed.itemId : undefined,
  }
}
