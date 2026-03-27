export type TransitionKind = 'cut' | 'fade' | 'slide-left' | 'slide-right' | 'zoom-soft'

export interface TransitionVisualRef {
  slotIndex: number
  imageId: string
  path: string
}

export interface ResolveTransitionInput {
  from: TransitionVisualRef | null
  to: TransitionVisualRef
  transition: {
    kind: TransitionKind
    durationMs: number
  }
  changedAtMs: number
}

export interface TransitionPayload {
  key: string
  kind: TransitionKind
  durationMs: number
  fromImageId: string | null
  toImageId: string
  fromPath: string | null
  toPath: string
  startedAtMs: number
}

export interface TransitionEngine {
  resolve(input: ResolveTransitionInput): TransitionPayload
}

export class DeterministicTransitionEngine implements TransitionEngine {
  resolve(input: ResolveTransitionInput): TransitionPayload {
    return {
      key: `${input.from?.imageId ?? 'empty'}->${input.to.imageId}:${input.transition.kind}:${String(input.changedAtMs)}`,
      kind: input.transition.kind,
      durationMs: input.transition.durationMs,
      fromImageId: input.from?.imageId ?? null,
      toImageId: input.to.imageId,
      fromPath: input.from?.path ?? null,
      toPath: input.to.path,
      startedAtMs: input.changedAtMs,
    }
  }
}
