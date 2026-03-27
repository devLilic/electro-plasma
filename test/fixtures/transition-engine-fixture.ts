import type { TransitionVisualRef } from '../../src/renderer/domain/transition-engine'

export function createTransitionVisualRef(
  imageId: string,
  slotIndex: number,
): TransitionVisualRef {
  return {
    slotIndex,
    imageId,
    path: `/library/processed/${imageId}.png`,
  }
}
