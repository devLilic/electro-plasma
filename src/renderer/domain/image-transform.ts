import type { ImageAsset } from '@domain/media-library'

export type ImageTransformOperation =
  | { type: 'crop-16:9' }
  | { type: 'flip' }
  | { type: 'flop' }
  | { type: 'rotate'; degrees: 90 | 180 | 270 }

export type BroadcastImagePresetId = 'broadcast-hd-720p' | 'broadcast-full-hd-1080p'

export interface BroadcastImagePreset {
  id: BroadcastImagePresetId
  label: string
  aspectRatio: '16:9'
  processedResolution: {
    width: number
    height: number
  }
  previewResolution: {
    width: number
    height: number
  }
  cropFit: 'cover'
  defaultFit: 'contain'
}

export interface ApplyImageTransformsInput {
  asset: ImageAsset
  operations: ImageTransformOperation[]
  presetId?: BroadcastImagePresetId
}

export interface ImageTransformPipeline {
  applyTransforms(input: ApplyImageTransformsInput): Promise<ImageAsset>
}

export const DEFAULT_BROADCAST_IMAGE_PRESET_ID = 'broadcast-full-hd-1080p' as const

export const BROADCAST_IMAGE_PRESETS: Record<BroadcastImagePresetId, BroadcastImagePreset> = {
  'broadcast-hd-720p': {
    id: 'broadcast-hd-720p',
    label: 'Broadcast HD 720p',
    aspectRatio: '16:9',
    processedResolution: {
      width: 1280,
      height: 720,
    },
    previewResolution: {
      width: 640,
      height: 360,
    },
    cropFit: 'cover',
    defaultFit: 'contain',
  },
  'broadcast-full-hd-1080p': {
    id: 'broadcast-full-hd-1080p',
    label: 'Broadcast Full HD 1080p',
    aspectRatio: '16:9',
    processedResolution: {
      width: 1920,
      height: 1080,
    },
    previewResolution: {
      width: 640,
      height: 360,
    },
    cropFit: 'cover',
    defaultFit: 'contain',
  },
}

export function resolveBroadcastImagePreset(
  presetId: BroadcastImagePresetId = DEFAULT_BROADCAST_IMAGE_PRESET_ID,
): BroadcastImagePreset {
  return BROADCAST_IMAGE_PRESETS[presetId]
}
