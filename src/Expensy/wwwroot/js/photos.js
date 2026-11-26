// Photos on the device: downscaling before upload, and wiping cached photos on logout.

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // same limit as the server (PhotoStore.MaxBytes)
const MAX_PHOTO_SIDE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Downscales a photo to max 1600 px JPEG in the browser — phones produce 3–10 MB images, this makes them ~200 KB.
 * Falls back to the original file (e.g. HEIC in a browser that can't decode it; the server accepts it as-is).
 */
export async function shrinkImage(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// The service worker keeps viewed photos in their own cache (see sw.js) so they load instantly and offline.
const PHOTO_CACHE = 'expensy-photos'; // same name as in sw.js

/** Wipes cached photos, so receipts don't stay on a shared phone or computer after logout. */
export async function clearPhotoCache() {
  try { await caches.delete(PHOTO_CACHE); } catch { /* Cache API unavailable — nothing was cached */ }
}
