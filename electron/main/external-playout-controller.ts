import { EventEmitter } from 'node:events'
import type { ExternalControlCommand, PlayoutStatusDto } from '../../src/shared/plasma-api'

export interface ExternalPlayoutController {
  play(nowMs: number): PlayoutStatusDto
  next(nowMs: number): PlayoutStatusDto
  stop(nowMs: number): PlayoutStatusDto
  pause(nowMs: number): PlayoutStatusDto
  resume(nowMs: number): PlayoutStatusDto
  previous(nowMs: number): PlayoutStatusDto
  activateItem(itemId: string, nowMs: number): PlayoutStatusDto
  getStatus(nowMs: number): PlayoutStatusDto
  subscribe(listener: (status: PlayoutStatusDto) => void): () => void
}

export class MainPlayoutCoordinator implements ExternalPlayoutController {
  private readonly events = new EventEmitter()
  private status: PlayoutStatusDto

  constructor(private readonly clock: () => string = () => new Date().toISOString()) {
    this.status = {
      playlistId: null,
      itemId: null,
      state: 'idle',
      lastCommand: null,
      updatedAt: this.clock(),
    }
  }

  play(_nowMs: number) {
    return this.updateStatus({
      state: 'playing',
      lastCommand: 'play',
    })
  }

  next(_nowMs: number) {
    return this.updateStatus({
      lastCommand: 'next',
    })
  }

  stop(_nowMs: number) {
    return this.updateStatus({
      itemId: null,
      state: 'idle',
      lastCommand: 'stop',
    })
  }

  pause(_nowMs: number) {
    return this.updateStatus({
      state: this.status.state === 'idle' ? 'idle' : 'paused',
      lastCommand: 'pause',
    })
  }

  resume(_nowMs: number) {
    return this.updateStatus({
      state: 'playing',
      lastCommand: 'resume',
    })
  }

  previous(_nowMs: number) {
    return this.updateStatus({
      lastCommand: 'prev',
    })
  }

  activateItem(itemId: string, _nowMs: number) {
    return this.updateStatus({
      itemId,
      state: 'playing',
      lastCommand: 'activateItem',
    })
  }

  getStatus(_nowMs: number) {
    return this.updateStatus({
      lastCommand: 'getStatus',
    })
  }

  subscribe(listener: (status: PlayoutStatusDto) => void) {
    this.events.on('status', listener)
    return () => {
      this.events.off('status', listener)
    }
  }

  private updateStatus(next: Partial<PlayoutStatusDto>) {
    this.status = {
      ...this.status,
      ...next,
      updatedAt: this.clock(),
    }
    this.events.emit('status', this.status)
    return this.status
  }
}

export function dispatchExternalPlayoutCommand(
  controller: ExternalPlayoutController,
  command: ExternalControlCommand,
  nowMs: number,
  itemId?: string,
) {
  switch (command) {
    case 'play':
      return controller.play(nowMs)
    case 'next':
      return controller.next(nowMs)
    case 'stop':
      return controller.stop(nowMs)
    case 'pause':
      return controller.pause(nowMs)
    case 'resume':
      return controller.resume(nowMs)
    case 'prev':
      return controller.previous(nowMs)
    case 'activateItem':
      return controller.activateItem(itemId ?? '', nowMs)
    case 'getStatus':
      return controller.getStatus(nowMs)
  }
}
