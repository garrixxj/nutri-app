/**
 * Photo preparation before anything leaves the phone or hits IndexedDB.
 * Re-encoding through a canvas drops all EXIF (GPS, device, time). If decoding
 * fails we refuse to send the original file, because that copy carries the EXIF.
 */

export const AI_MAX_SIDE = 1024
export const AI_JPEG_QUALITY = 0.8
export const THUMB_MAX_SIDE = 200
export const THUMB_JPEG_QUALITY = 0.7

export interface PreparedPhoto {
  /** JPEG for Gemini, base64 without the data: prefix. */
  aiBase64: string
  /** Small JPEG data URL stored with the entry. */
  thumbDataUrl: string
}

export class PhotoError extends Error {
  override name = 'PhotoError'
}

/** Scales (w, h) to fit inside `max` on the longer side; never upscales. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const ratio = max / longest
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

type Drawable = ImageBitmap | HTMLImageElement

async function decode(file: Blob): Promise<{ source: Drawable; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Applies EXIF orientation (default 'from-image'), so portraits stay upright.
      const bmp = await createImageBitmap(file)
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch {
      // Fall through to <img>, which also decodes HEIC on Safari.
    }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new PhotoError('No pude abrir esa foto. Prueba con otra.')
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
}

function render(source: Drawable, width: number, height: number, max: number, quality: number): string {
  const size = fitWithin(width, height, max)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('Tu navegador no pudo procesar la foto.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, size.width, size.height)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  // Release the backing store right away; iOS caps total canvas memory.
  canvas.width = 0
  canvas.height = 0
  if (!dataUrl.startsWith('data:image/jpeg')) throw new PhotoError('Tu navegador no pudo procesar la foto.')
  return dataUrl
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const { source, width, height, release } = await decode(file)
  try {
    if (!width || !height) throw new PhotoError('No pude abrir esa foto. Prueba con otra.')
    const ai = render(source, width, height, AI_MAX_SIDE, AI_JPEG_QUALITY)
    const thumb = render(source, width, height, THUMB_MAX_SIDE, THUMB_JPEG_QUALITY)
    return { aiBase64: ai.slice(ai.indexOf(',') + 1), thumbDataUrl: thumb }
  } finally {
    release()
  }
}
