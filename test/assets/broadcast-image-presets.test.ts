import { describe, expect, test } from 'vitest'
import {
  BROADCAST_IMAGE_PRESETS,
  DEFAULT_BROADCAST_IMAGE_PRESET_ID,
  resolveBroadcastImagePreset,
} from '../../src/renderer/domain/image-transform'

describe('broadcast image presets', () => {
  test('uses a 16:9 preset by default for broadcast workflows', () => {
    const preset = resolveBroadcastImagePreset()

    expect(preset.id).toBe(DEFAULT_BROADCAST_IMAGE_PRESET_ID)
    expect(preset.aspectRatio).toBe('16:9')
    expect(preset.processedResolution).toEqual({ width: 1920, height: 1080 })
    expect(preset.previewResolution).toEqual({ width: 640, height: 360 })
  })

  test('exposes reusable standard broadcast resolutions', () => {
    expect(Object.keys(BROADCAST_IMAGE_PRESETS)).toEqual([
      'broadcast-hd-720p',
      'broadcast-full-hd-1080p',
    ])
  })
})
