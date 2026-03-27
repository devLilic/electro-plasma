import type { ApplyImageProcessingPayload } from '@shared/plasma-api'

export const plasmaImageProcessingApi = {
  applyTransforms(payload: ApplyImageProcessingPayload) {
    return window.plasma.imageProcessing.applyTransforms(payload)
  },
}
