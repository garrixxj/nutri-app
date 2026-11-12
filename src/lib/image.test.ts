import { describe, expect, it } from 'vitest'
import { AI_MAX_SIDE, THUMB_MAX_SIDE, fitWithin } from './image.ts'

describe('fitWithin', () => {
  it('scales a 12 MP portrait to 1024 on the long side', () => {
    expect(fitWithin(3024, 4032, AI_MAX_SIDE)).toEqual({ width: 768, height: 1024 })
  })

  it('scales landscape thumbnails to 200 px wide', () => {
    expect(fitWithin(4032, 3024, THUMB_MAX_SIDE)).toEqual({ width: 200, height: 150 })
  })

  it('never upscales small images', () => {
    expect(fitWithin(640, 480, AI_MAX_SIDE)).toEqual({ width: 640, height: 480 })
  })
})
