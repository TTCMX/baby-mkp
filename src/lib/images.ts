// Client-side photo processing: resize + re-encode before upload so photos
// are light on mobile data and we can serve them without an image CDN.

export type ProcessedImage = { full: Blob; thumb: Blob; ext: "webp" | "jpg"; width: number; height: number };

const FULL_MAX = 1600;
const THUMB_MAX = 600;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(canvas: HTMLCanvasElement, quality: number, ext: "webp" | "jpg") {
  const blob = await toBlob(canvas, ext === "webp" ? "image/webp" : "image/jpeg", quality);
  if (!blob) throw new Error("encode_failed");
  return blob;
}

function draw(bitmap: ImageBitmap, max: number) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  // Respects EXIF orientation in modern browsers.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const fullCanvas = draw(bitmap, FULL_MAX);
    // Safari cannot encode WebP and silently returns PNG: fall back to JPEG.
    const webp = await toBlob(fullCanvas, "image/webp", 0.82);
    const ext = webp?.type === "image/webp" ? "webp" : "jpg";
    const full = ext === "webp" && webp ? webp : await encode(fullCanvas, 0.82, "jpg");
    const thumb = await encode(draw(bitmap, THUMB_MAX), 0.78, ext);
    return { full, thumb, ext, width: fullCanvas.width, height: fullCanvas.height };
  } finally {
    bitmap.close();
  }
}
