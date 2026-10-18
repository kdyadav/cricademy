export const AVATAR_SIZE = 256

/** Center-crops and downsizes an image to a square JPEG data URL. */
export async function toSquareDataUrl(file: File, size = AVATAR_SIZE): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

export async function toSquareJpeg(file: File, size = AVATAR_SIZE): Promise<Blob> {
  return (await fetch(await toSquareDataUrl(file, size))).blob()
}
