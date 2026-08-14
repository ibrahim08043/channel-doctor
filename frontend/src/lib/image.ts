/**
 * Client-side image helpers for the Thumbnail A/B optimizer.
 *
 * The Groq vision model caps image input at ~8000 tokens/min on the free tier;
 * two full-size thumbnails blow past that and the API returns HTTP 413. We
 * downscale images to a small 16:9-friendly size before uploading, which keeps
 * the request inside the token budget while preserving enough detail for a
 * color/contrast/readability comparison.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Max pixels on the longer edge after downscaling (before base64 encoding). */
const MAX_DIMENSION = 640;
const JPEG_QUALITY = 0.82;

export function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(type.toLowerCase());
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

/** Downscale an image data URI so it fits under the vision model's token cap. */
export function downscaleImage(dataUrl: string, maxDim = MAX_DIMENSION): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported in this browser.");
        ctx.drawImage(img, 0, 0, w, h);

        // JPEG keeps the base64 payload small; WEBP/PNG convert cleanly to JPEG.
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Could not load the selected image."));
    img.src = dataUrl;
  });
}

/** Sample the most frequent colors in an image for a quick color-analysis strip. */
export function extractDominantColors(dataUrl: string, count = 4): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Small sample canvas keeps this fast.
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas is not supported in this browser.");
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Map<string, number>();
        const key = (r: number, g: number, b: number) =>
          `${r >> 4},${g >> 4},${b >> 4}`; // 16-step quantization
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue; // skip transparent pixels
          const k = key(data[i], data[i + 1], data[i + 2]);
          buckets.set(k, (buckets.get(k) || 0) + 1);
        }

        const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, count);
        const colors = sorted.map(([k]) => {
          const [r, g, b] = k.split(",").map((n) => Number(n) * 16 + 8);
          return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
        });
        resolve(colors.length > 0 ? colors : ["#888888"]);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Could not load the selected image."));
    img.src = dataUrl;
  });
}
