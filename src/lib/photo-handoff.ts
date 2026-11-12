/**
 * Holds the photo picked from the Registrar sheet until the photo screen takes it.
 * The file input lives in the shell so the camera opens inside the user's tap
 * (iOS ignores programmatic clicks that happen after a navigation).
 */
let pending: File | null = null

export function setPendingPhoto(file: File): void {
  pending = file
}

export function takePendingPhoto(): File | null {
  const file = pending
  pending = null
  return file
}
