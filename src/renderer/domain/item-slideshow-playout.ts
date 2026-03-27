import type { ItemVisualSlot, PlaylistItem, SlotTransitionSettings } from '@domain/media-library'
import {
  DeterministicTransitionEngine,
  type TransitionEngine,
  type TransitionKind,
  type TransitionPayload,
  type TransitionVisualRef,
} from '@domain/transition-engine'

export interface ActivateItemPlayoutInput {
  item: PlaylistItem
  loopMode: 'loop' | 'stop-at-end'
  nowMs: number
}

export interface TickPlayoutInput {
  nowMs: number
}

export interface ManualStepPlayoutInput {
  nowMs: number
}

export interface ItemSlideshowPlayoutState {
  itemId: string | null
  status: 'idle' | 'playing' | 'paused'
  loopMode: 'loop' | 'stop-at-end'
  activeSlotIndex: number | null
  activeImageId: string | null
  activeSlotIndexes: number[]
  nextAdvanceAtMs: number | null
  currentSlotDurationMs: number | null
  remainingMs: number | null
  progress: number
  countdownMs: number | null
  transition: TransitionPayload | null
  lastUpdatedAtMs: number
}

export interface PlaybackSession {
  item: PlaylistItem | null
  activeSlots: ItemVisualSlot[]
  status: ItemSlideshowPlayoutState['status']
  loopMode: ItemSlideshowPlayoutState['loopMode']
  activePosition: number
  startedAtMs: number | null
  nextAdvanceAtMs: number | null
  pausedRemainingMs: number | null
  transition: TransitionPayload | null
  lastUpdatedAtMs: number
}

export interface ItemSlideshowPlayoutMachine {
  activateItem(input: ActivateItemPlayoutInput): ItemSlideshowPlayoutState
  tick(input: TickPlayoutInput): ItemSlideshowPlayoutState
  pause(input: TickPlayoutInput): ItemSlideshowPlayoutState
  resume(input: TickPlayoutInput): ItemSlideshowPlayoutState
  stop(input: TickPlayoutInput): ItemSlideshowPlayoutState
  next(input: ManualStepPlayoutInput): ItemSlideshowPlayoutState
  previous(input: ManualStepPlayoutInput): ItemSlideshowPlayoutState
  getState(): ItemSlideshowPlayoutState
}

export interface GlobalTransitionFallback {
  kind: TransitionKind
  durationMs: number
}

const IDLE_STATE: ItemSlideshowPlayoutState = {
  itemId: null,
  status: 'idle',
  loopMode: 'stop-at-end',
  activeSlotIndex: null,
  activeImageId: null,
  activeSlotIndexes: [],
  nextAdvanceAtMs: null,
  currentSlotDurationMs: null,
  remainingMs: null,
  progress: 0,
  countdownMs: null,
  transition: null,
  lastUpdatedAtMs: 0,
}

export class InMemoryItemSlideshowPlayoutMachine implements ItemSlideshowPlayoutMachine {
  constructor(
    private readonly transitionEngine: TransitionEngine = new DeterministicTransitionEngine(),
    private readonly globalTransitionFallback: GlobalTransitionFallback = {
      kind: 'fade',
      durationMs: 300,
    },
  ) {}

  private session: PlaybackSession = createIdleSession()

  activateItem(input: ActivateItemPlayoutInput): ItemSlideshowPlayoutState {
    const activeSlots = collectActiveSlots(input.item)

    if (activeSlots.length === 0) {
      this.session = {
        ...createIdleSession(),
        item: input.item,
        loopMode: input.loopMode,
        lastUpdatedAtMs: input.nowMs,
      }

      return this.getState()
    }

    this.session = createPlayingSession({
      item: input.item,
      activeSlots,
      loopMode: input.loopMode,
      activePosition: 0,
      previousSlot: null,
      nowMs: input.nowMs,
      transitionEngine: this.transitionEngine,
      globalTransitionFallback: this.globalTransitionFallback,
    })

    return this.getState()
  }

  tick(input: TickPlayoutInput): ItemSlideshowPlayoutState {
    if (this.session.status !== 'playing' || this.session.activeSlots.length === 0) {
      return this.syncDerivedState(input.nowMs)
    }

    let nextSession = {
      ...this.session,
      lastUpdatedAtMs: input.nowMs,
    }

    while (nextSession.status === 'playing' && nextSession.nextAdvanceAtMs !== null && input.nowMs >= nextSession.nextAdvanceAtMs) {
      const advanced = advanceToNextPosition(
        nextSession,
        input.nowMs,
        this.transitionEngine,
        this.globalTransitionFallback,
      )

      if (advanced === null) {
        this.session = {
        ...createIdleSession(),
        lastUpdatedAtMs: input.nowMs,
      }
        return this.getState()
      }

      nextSession = advanced
    }

    this.session = nextSession
    return this.getState()
  }

  pause(input: TickPlayoutInput): ItemSlideshowPlayoutState {
    if (this.session.status !== 'playing') {
      return this.syncDerivedState(input.nowMs)
    }

    const remainingMs = Math.max(0, (this.session.nextAdvanceAtMs ?? input.nowMs) - input.nowMs)
    this.session = {
      ...this.session,
      status: 'paused',
      pausedRemainingMs: remainingMs,
      nextAdvanceAtMs: null,
      lastUpdatedAtMs: input.nowMs,
    }

    return this.getState()
  }

  resume(input: TickPlayoutInput): ItemSlideshowPlayoutState {
    if (this.session.status !== 'paused' || this.session.activeSlots.length === 0) {
      return this.syncDerivedState(input.nowMs)
    }

    const durationMs = getActiveSlotDurationMs(this.session.activeSlots[this.session.activePosition])
    this.session = {
      ...this.session,
      status: 'playing',
      startedAtMs: input.nowMs,
      nextAdvanceAtMs: input.nowMs + durationMs,
      pausedRemainingMs: null,
      lastUpdatedAtMs: input.nowMs,
    }

    return this.getState()
  }

  stop(input: TickPlayoutInput): ItemSlideshowPlayoutState {
    this.session = {
      ...createIdleSession(),
      lastUpdatedAtMs: input.nowMs,
    }

    return this.getState()
  }

  next(input: ManualStepPlayoutInput): ItemSlideshowPlayoutState {
    if (this.session.activeSlots.length === 0) {
      return this.syncDerivedState(input.nowMs)
    }

    const nextPosition = resolveWrappedPosition(this.session.activePosition + 1, this.session.activeSlots.length)
    this.session = createPlayingSession({
      item: this.session.item,
      activeSlots: this.session.activeSlots,
      loopMode: this.session.loopMode,
      activePosition: nextPosition,
      previousSlot: this.session.activeSlots[this.session.activePosition] ?? null,
      nowMs: input.nowMs,
      transitionEngine: this.transitionEngine,
      globalTransitionFallback: this.globalTransitionFallback,
    })

    return this.getState()
  }

  previous(input: ManualStepPlayoutInput): ItemSlideshowPlayoutState {
    if (this.session.activeSlots.length === 0) {
      return this.syncDerivedState(input.nowMs)
    }

    const previousPosition = resolveWrappedPosition(this.session.activePosition - 1, this.session.activeSlots.length)
    this.session = createPlayingSession({
      item: this.session.item,
      activeSlots: this.session.activeSlots,
      loopMode: this.session.loopMode,
      activePosition: previousPosition,
      previousSlot: this.session.activeSlots[this.session.activePosition] ?? null,
      nowMs: input.nowMs,
      transitionEngine: this.transitionEngine,
      globalTransitionFallback: this.globalTransitionFallback,
    })

    return this.getState()
  }

  getState(): ItemSlideshowPlayoutState {
    return mapSessionToState(this.session)
  }

  private syncDerivedState(nowMs: number) {
    this.session = {
      ...this.session,
      lastUpdatedAtMs: nowMs,
    }

    return this.getState()
  }
}

function createIdleSession(): PlaybackSession {
  return {
    item: null,
    activeSlots: [],
    status: 'idle',
    loopMode: 'stop-at-end',
    activePosition: -1,
    startedAtMs: null,
    nextAdvanceAtMs: null,
    pausedRemainingMs: null,
    transition: null,
    lastUpdatedAtMs: 0,
  }
}

function createPlayingSession(input: {
  item: PlaylistItem | null
  activeSlots: ItemVisualSlot[]
  loopMode: PlaybackSession['loopMode']
  activePosition: number
  previousSlot: ItemVisualSlot | null
  nowMs: number
  transitionEngine: TransitionEngine
  globalTransitionFallback: GlobalTransitionFallback
}): PlaybackSession {
  const activeSlot = input.activeSlots[input.activePosition]
  const durationMs = getActiveSlotDurationMs(activeSlot)

  return {
    item: input.item,
    activeSlots: input.activeSlots,
    status: 'playing',
    loopMode: input.loopMode,
    activePosition: input.activePosition,
    startedAtMs: input.nowMs,
    nextAdvanceAtMs: input.nowMs + durationMs,
    pausedRemainingMs: null,
    transition: input.transitionEngine.resolve({
      from: input.previousSlot ? toTransitionVisualRef(input.previousSlot) : null,
      to: toTransitionVisualRef(activeSlot),
      transition: resolveTransitionConfig(activeSlot.transition, input.globalTransitionFallback),
      changedAtMs: input.nowMs,
    }),
    lastUpdatedAtMs: input.nowMs,
  }
}

function collectActiveSlots(item: PlaylistItem) {
  return item.visual.slots.filter((slot) => slot.isActive)
}

function getActiveSlotDurationMs(slot: ItemVisualSlot) {
  return slot.slideshow.enabled && slot.slideshow.intervalMs
    ? slot.slideshow.intervalMs
    : 3000
}

function advanceToNextPosition(
  session: PlaybackSession,
  nowMs: number,
  transitionEngine: TransitionEngine,
  globalTransitionFallback: GlobalTransitionFallback,
) {
  const nextPosition = session.activePosition + 1

  if (nextPosition >= session.activeSlots.length) {
    if (session.loopMode === 'stop-at-end') {
      return null
    }

    return createPlayingSession({
      item: session.item,
      activeSlots: session.activeSlots,
      loopMode: session.loopMode,
      activePosition: 0,
      previousSlot: session.activeSlots[session.activePosition] ?? null,
      nowMs,
      transitionEngine,
      globalTransitionFallback,
    })
  }

  return createPlayingSession({
    item: session.item,
    activeSlots: session.activeSlots,
    loopMode: session.loopMode,
    activePosition: nextPosition,
    previousSlot: session.activeSlots[session.activePosition] ?? null,
    nowMs,
    transitionEngine,
    globalTransitionFallback,
  })
}

function resolveWrappedPosition(position: number, length: number) {
  return ((position % length) + length) % length
}

function mapSessionToState(session: PlaybackSession): ItemSlideshowPlayoutState {
  if (!session.item || session.activeSlots.length === 0 || session.activePosition < 0) {
    return {
      ...IDLE_STATE,
      loopMode: session.loopMode,
      lastUpdatedAtMs: session.lastUpdatedAtMs,
    }
  }

  const activeSlot = session.activeSlots[session.activePosition]
  const durationMs = getActiveSlotDurationMs(activeSlot)
  const remainingMs = session.status === 'paused'
    ? (session.pausedRemainingMs ?? durationMs)
    : session.nextAdvanceAtMs === null
      ? null
      : Math.max(0, session.nextAdvanceAtMs - session.lastUpdatedAtMs)
  const progress = session.status === 'paused'
    ? clampProgress((durationMs - (session.pausedRemainingMs ?? durationMs)) / durationMs)
    : session.startedAtMs === null
      ? 0
      : clampProgress((session.lastUpdatedAtMs - session.startedAtMs) / durationMs)

  return {
    itemId: session.item.id,
    status: session.status,
    loopMode: session.loopMode,
    activeSlotIndex: activeSlot.slotIndex,
    activeImageId: activeSlot.image.id,
    activeSlotIndexes: session.activeSlots.map((slot) => slot.slotIndex),
    nextAdvanceAtMs: session.nextAdvanceAtMs,
    currentSlotDurationMs: durationMs,
    remainingMs,
    progress,
    countdownMs: remainingMs,
    transition: session.transition,
    lastUpdatedAtMs: session.lastUpdatedAtMs,
  }
}

function resolveTransitionConfig(
  slotTransition: SlotTransitionSettings,
  globalTransitionFallback: GlobalTransitionFallback,
) {
  if (slotTransition.type === 'none') {
    return {
      kind: globalTransitionFallback.kind,
      durationMs: globalTransitionFallback.durationMs,
    }
  }

  return {
    kind: toTransitionKind(slotTransition.type),
    durationMs: slotTransition.durationMs,
  }
}

function toTransitionKind(type: SlotTransitionSettings['type']): TransitionKind {
  switch (type) {
    case 'none':
    case 'cut':
      return 'cut'
    case 'fade':
      return 'fade'
    case 'slide':
    case 'slide-left':
      return 'slide-left'
    case 'slide-right':
      return 'slide-right'
    case 'zoom-soft':
      return 'zoom-soft'
  }
}

function toTransitionVisualRef(slot: ItemVisualSlot): TransitionVisualRef {
  return {
    slotIndex: slot.slotIndex,
    imageId: slot.image.id,
    path: slot.image.processedPath || slot.image.path,
  }
}

function clampProgress(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(1, value))
}
