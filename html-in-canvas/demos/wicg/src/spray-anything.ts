/**
 * spray-portable.ts
 *
 * Self-contained spray-paint effect for images. Combines the spray pipeline,
 * WebGPU compute shaders, image utilities, PRNG, CPU-side effects, and
 * canvas I/O into a single file you can drop into any project.
 *
 * Usage:
 *   import { sprayAnything, preloadSprayMap, DEFAULT_PARAMS } from "./spray-portable";
 *   // optionally preload the spray map texture so the first run is faster
 *   await preloadSprayMap("/SprayMap_composite.png");
 *   const result = await sprayAnything(myImg, DEFAULT_PARAMS, {
 *     sprayMapUrl: "/SprayMap_composite.png",
 *     onProgress: (step, pct) => console.log(step, pct),
 *   });
 *   // result.img is the output Img — convert to canvas/blob as needed.
 *
 * Dependencies: none (browser with WebGPU for GPU path, OffscreenCanvas for fallback).
 */

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1: Image data structure & pixel utilities
// ════════════════════════════════════════════════════════════════════════════

/** Core image type — a flat Float32Array of pixel values with width, height, channels. */
export interface Img {
  data: Float32Array;
  w: number;
  h: number;
  /** Number of channels: 1 = grayscale, 3 = RGB */
  c: number;
}

/** Allocate an image filled with `fill` (default 0). */
export function createImg(w: number, h: number, c = 3, fill = 0): Img {
  const data = new Float32Array(w * h * c);
  if (fill !== 0) data.fill(fill);
  return { data, w, h, c };
}

/** Deep-copy an image. */
export function cloneImg(img: Img): Img {
  return { data: new Float32Array(img.data), w: img.w, h: img.h, c: img.c };
}

/** Clamp a number to [lo, hi] (default [0, 255]). */
export function clamp(v: number, lo = 0, hi = 255): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Reflect an index at image boundaries (mirror padding).
 * Ensures sampling outside the image wraps smoothly.
 */
export function reflectCoord(v: number, max: number): number {
  if (v < 0) v = -v;
  if (v >= max) {
    const period = max * 2;
    v = v % period;
    if (v >= max) v = period - v - 1;
  }
  return v;
}

/** Convert 3-channel RGB image to 1-channel grayscale (Rec. 601 weights). */
export function toGrayscale(img: Img): Img {
  const out = createImg(img.w, img.h, 1);
  const n = img.w * img.h;
  for (let i = 0; i < n; i++) {
    out.data[i] = 0.299 * img.data[i * 3]! + 0.587 * img.data[i * 3 + 1]! + 0.114 * img.data[i * 3 + 2]!;
  }
  return out;
}

/** Expand 1-channel grayscale to 3-channel RGB (all channels equal). */
export function grayToRgb(gray: Img): Img {
  const out = createImg(gray.w, gray.h, 3);
  const n = gray.w * gray.h;
  for (let i = 0; i < n; i++) {
    out.data[i * 3] = out.data[i * 3 + 1] = out.data[i * 3 + 2] = gray.data[i]!;
  }
  return out;
}

/**
 * Crossfade between two images.
 * `pct` controls the mix: 0 = all `orig`, 100 = all `filt`.
 */
export function fade(orig: Img, filt: Img, pct: number): Img {
  const a = pct / 100;
  const b = 1 - a;
  const out = createImg(orig.w, orig.h, orig.c);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = clamp(filt.data[i]! * a + orig.data[i]! * b);
  }
  return out;
}

/** Circular shift (wrap) an image by (dx, dy) pixels. */
export function roll(img: Img, dx: number, dy: number): Img {
  const out = createImg(img.w, img.h, img.c);
  const { w, h, c } = img;
  for (let y = 0; y < h; y++) {
    const sy = (((y - dy) % h) + h) % h;
    for (let x = 0; x < w; x++) {
      const sx = (((x - dx) % w) + w) % w;
      const di = (y * w + x) * c;
      const si = (sy * w + sx) * c;
      for (let ch = 0; ch < c; ch++) out.data[di + ch] = img.data[si + ch]!;
    }
  }
  return out;
}

/** Binary threshold a grayscale image: above thresh → 255, else 0. */
export function threshold(gray: Img, thresh: number): Img {
  const out = createImg(gray.w, gray.h, 1);
  for (let i = 0; i < gray.data.length; i++) {
    out.data[i] = gray.data[i]! > thresh ? 255 : 0;
  }
  return out;
}

/** Per-pixel max of two images (acts like bitwise OR for binary masks). */
export function maxImages(a: Img, b: Img): Img {
  const out = createImg(a.w, a.h, a.c);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = Math.max(a.data[i]!, b.data[i]!);
  }
  return out;
}

/** Alias — used for combining binary dot masks. */
export function bitwiseOr(a: Img, b: Img): Img {
  return maxImages(a, b);
}

/** Stretch grayscale values so [lo, hi] maps to [0, 255]. */
export function levels(gray: Img, lo: number, hi: number): Img {
  const out = createImg(gray.w, gray.h, 1);
  const range = Math.max(hi - lo, 1);
  for (let i = 0; i < gray.data.length; i++) {
    out.data[i] = clamp(((gray.data[i]! - lo) / range) * 255);
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2: Seeded pseudo-random number generator (xoshiro128**)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Deterministic PRNG so every run with the same params produces identical output.
 * Uses xoshiro128** — fast, small state, good distribution.
 */
export class SeededRNG {
  private s: number[];

  constructor(seed = 0) {
    // Splitmix32 to expand a single seed into 4 state words
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.s = [next(), next(), next(), next()];
  }

  private _next(): number {
    const s = this.s;
    const result = ((Math.imul(s[1]! * 5, 1) << 7) | (Math.imul(s[1]! * 5, 1) >>> 25)) * 9;
    const t = s[1]! << 9;
    s[2]! ^= s[0]!;
    s[3]! ^= s[1]!;
    s[1]! ^= s[2]!;
    s[0]! ^= s[3]!;
    s[2] ^= t;
    s[3] = (s[3]! << 11) | (s[3]! >>> 21);
    return (result >>> 0) / 0x100000000;
  }

  /** Uniform float in [0, 1). */
  random(): number {
    return this._next();
  }

  /** Uniform integer in [0, max). */
  randint(max: number): number {
    return (this._next() * max) | 0;
  }

  /** Uniform float in [lo, hi). */
  uniform(lo: number, hi: number): number {
    return lo + this._next() * (hi - lo);
  }

  /** Standard normal via Box-Muller transform. */
  randn(): number {
    const u1 = this._next() || 1e-10;
    const u2 = this._next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3: Canvas I/O — loading, resizing, blurring images via Canvas API
// ════════════════════════════════════════════════════════════════════════════

/** Convert an Img (Float32 RGB) to an OffscreenCanvas with RGBA pixels. */
function imgToCanvas(img: Img): OffscreenCanvas {
  const canvas = new OffscreenCanvas(img.w, img.h);
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(img.w, img.h);
  const d = imageData.data;
  const n = img.w * img.h;
  if (img.c === 3) {
    for (let i = 0; i < n; i++) {
      d[i * 4] = clamp(Math.round(img.data[i * 3]!));
      d[i * 4 + 1] = clamp(Math.round(img.data[i * 3 + 1]!));
      d[i * 4 + 2] = clamp(Math.round(img.data[i * 3 + 2]!));
      d[i * 4 + 3] = 255;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const v = clamp(Math.round(img.data[i]!));
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Convert canvas RGBA data back to an RGB Float32 Img. */
function canvasToImg(canvas: OffscreenCanvas): Img {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const img = createImg(w, h, 3);
  const n = w * h;
  for (let i = 0; i < n; i++) {
    img.data[i * 3] = d[i * 4]!;
    img.data[i * 3 + 1] = d[i * 4 + 1]!;
    img.data[i * 3 + 2] = d[i * 4 + 2]!;
  }
  return img;
}

/** Draw a bitmap onto a white background, stripping alpha. */
function bitmapToWhiteBgCanvas(bitmap: ImageBitmap): OffscreenCanvas {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

/** Load an image from a File (drag-drop / file picker). */
export async function loadImageFromFile(file: File): Promise<Img> {
  const bitmap = await createImageBitmap(file);
  const canvas = bitmapToWhiteBgCanvas(bitmap);
  bitmap.close();
  return canvasToImg(canvas);
}

/** Load an image from a URL (used for the spray displacement map). */
export async function loadImageFromUrl(url: string): Promise<Img> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = bitmapToWhiteBgCanvas(bitmap);
  bitmap.close();
  return canvasToImg(canvas);
}

/**
 * Gaussian blur — tries GPU separable blur first, falls back to Canvas filter.
 * The Canvas fallback uses edge-padded drawing to avoid dark borders.
 */
export async function gaussianBlur(img: Img, sigma: number): Promise<Img> {
  const gpu = await gpuGaussianBlur(img, sigma);
  if (gpu) return gpu;
  return gaussianBlurCanvas(img, sigma);
}

function gaussianBlurCanvas(img: Img, sigma: number): Img {
  const pad = Math.ceil(sigma * 3);
  const srcCanvas = imgToCanvas(img);
  const padW = img.w + pad * 2;
  const padH = img.h + pad * 2;
  const dst = new OffscreenCanvas(padW, padH);
  const ctx = dst.getContext("2d")!;
  // Draw image offset by pad, then tile edges to avoid border artifacts
  ctx.drawImage(srcCanvas, pad, pad);
  ctx.drawImage(srcCanvas, 0, 0, img.w, 1, pad, 0, img.w, pad);
  ctx.drawImage(srcCanvas, 0, img.h - 1, img.w, 1, pad, pad + img.h, img.w, pad);
  ctx.drawImage(srcCanvas, 0, 0, 1, img.h, 0, pad, pad, img.h);
  ctx.drawImage(srcCanvas, img.w - 1, 0, 1, img.h, pad + img.w, pad, pad, img.h);
  ctx.drawImage(srcCanvas, 0, 0, 1, 1, 0, 0, pad, pad);
  ctx.drawImage(srcCanvas, img.w - 1, 0, 1, 1, pad + img.w, 0, pad, pad);
  ctx.drawImage(srcCanvas, 0, img.h - 1, 1, 1, 0, pad + img.h, pad, pad);
  ctx.drawImage(srcCanvas, img.w - 1, img.h - 1, 1, 1, pad + img.w, pad + img.h, pad, pad);
  const blurred = new OffscreenCanvas(padW, padH);
  const bCtx = blurred.getContext("2d")!;
  bCtx.filter = `blur(${sigma}px)`;
  bCtx.drawImage(dst, 0, 0);
  const crop = new OffscreenCanvas(img.w, img.h);
  const cCtx = crop.getContext("2d")!;
  cCtx.drawImage(blurred, -pad, -pad);
  return canvasToImg(crop);
}

/** Resize using Canvas drawImage with high-quality smoothing. */
export function resizeImg(img: Img, w: number, h: number): Img {
  const src = imgToCanvas(img);
  const dst = new OffscreenCanvas(w, h);
  const ctx = dst.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return canvasToImg(dst);
}

/** Convert an Img to a PNG Blob for download/preview. */
export async function imgToBlob(img: Img): Promise<Blob> {
  const canvas = imgToCanvas(img);
  return canvas.convertToBlob({ type: "image/png" });
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4: CPU image effects (ripple, motion blur, displace, morphology…)
// ════════════════════════════════════════════════════════════════════════════

/** Bilinear interpolation at fractional (fx, fy) with reflect-padding. */
function sampleBilinear(img: Img, fx: number, fy: number): number[] {
  const { w, h, c } = img;
  const x0 = Math.floor(fx),
    y0 = Math.floor(fy);
  const wx = fx - x0,
    wy = fy - y0;
  const rx0 = reflectCoord(x0, w),
    rx1 = reflectCoord(x0 + 1, w);
  const ry0 = reflectCoord(y0, h),
    ry1 = reflectCoord(y0 + 1, h);
  const i00 = (ry0 * w + rx0) * c,
    i10 = (ry0 * w + rx1) * c;
  const i01 = (ry1 * w + rx0) * c,
    i11 = (ry1 * w + rx1) * c;
  const result = Array.from<number>({ length: c });
  const w00 = (1 - wx) * (1 - wy),
    w10 = wx * (1 - wy);
  const w01 = (1 - wx) * wy,
    w11 = wx * wy;
  for (let ch = 0; ch < c; ch++) {
    result[ch] =
      img.data[i00 + ch]! * w00 + img.data[i10 + ch]! * w10 + img.data[i01 + ch]! * w01 + img.data[i11 + ch]! * w11;
  }
  return result;
}

/**
 * Remap (warp) an image using per-pixel coordinate maps.
 * mapX[i], mapY[i] give the source coordinate for output pixel i.
 * GPU-accelerated with CPU fallback.
 */
function remapCpu(img: Img, mapX: Float32Array, mapY: Float32Array): Img {
  const out = createImg(img.w, img.h, img.c);
  const { w, h, c, data } = img;
  if (c === 3) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const fx = mapX[idx]!,
          fy = mapY[idx]!;
        const x0 = Math.floor(fx),
          y0 = Math.floor(fy);
        const wx = fx - x0,
          wy = fy - y0;
        const rx0 = reflectCoord(x0, w),
          rx1 = reflectCoord(x0 + 1, w);
        const ry0 = reflectCoord(y0, h),
          ry1 = reflectCoord(y0 + 1, h);
        const i00 = (ry0 * w + rx0) * 3,
          i10 = (ry0 * w + rx1) * 3;
        const i01 = (ry1 * w + rx0) * 3,
          i11 = (ry1 * w + rx1) * 3;
        const w00 = (1 - wx) * (1 - wy),
          w10 = wx * (1 - wy);
        const w01 = (1 - wx) * wy,
          w11 = wx * wy;
        const oi = idx * 3;
        out.data[oi] = data[i00]! * w00 + data[i10]! * w10 + data[i01]! * w01 + data[i11]! * w11;
        out.data[oi + 1] = data[i00 + 1]! * w00 + data[i10 + 1]! * w10 + data[i01 + 1]! * w01 + data[i11 + 1]! * w11;
        out.data[oi + 2] = data[i00 + 2]! * w00 + data[i10 + 2]! * w10 + data[i01 + 2]! * w01 + data[i11 + 2]! * w11;
      }
    }
  } else if (c === 1) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const fx = mapX[idx]!,
          fy = mapY[idx]!;
        const x0 = Math.floor(fx),
          y0 = Math.floor(fy);
        const wx = fx - x0,
          wy = fy - y0;
        const rx0 = reflectCoord(x0, w),
          rx1 = reflectCoord(x0 + 1, w);
        const ry0 = reflectCoord(y0, h),
          ry1 = reflectCoord(y0 + 1, h);
        out.data[idx] =
          data[ry0 * w + rx0]! * (1 - wx) * (1 - wy) +
          data[ry0 * w + rx1]! * wx * (1 - wy) +
          data[ry1 * w + rx0]! * (1 - wx) * wy +
          data[ry1 * w + rx1]! * wx * wy;
      }
    }
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const px = sampleBilinear(img, mapX[idx]!, mapY[idx]!);
        const oi = idx * c;
        for (let ch = 0; ch < c; ch++) out.data[oi + ch] = px[ch]!;
      }
    }
  }
  return out;
}

async function remap(img: Img, mapX: Float32Array, mapY: Float32Array): Promise<Img> {
  const gpu = await gpuRemap(img, mapX, mapY);
  if (gpu) return gpu;
  return remapCpu(img, mapX, mapY);
}

/** CPU 2D convolution with sparse kernel optimisation. */
function convolve2dCpu(img: Img, kernel: ArrayLike<number>, kw: number, kh: number): Img {
  const out = createImg(img.w, img.h, img.c);
  const { w, h, c } = img;
  const khh = (kh - 1) >> 1,
    kwh = (kw - 1) >> 1;
  // Only iterate non-zero kernel entries (big win for directional blur kernels)
  const sparseKy: number[] = [],
    sparseKx: number[] = [],
    sparseW: number[] = [];
  for (let ky = 0; ky < kh; ky++)
    for (let kx = 0; kx < kw; kx++) {
      const v = kernel[ky * kw + kx]!;
      if (v !== 0) {
        sparseKy.push(ky - khh);
        sparseKx.push(kx - kwh);
        sparseW.push(v);
      }
    }
  const sparseLen = sparseW.length;
  if (c === 1) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let i = 0; i < sparseLen; i++) {
          const sy = reflectCoord(y + sparseKy[i]!, h);
          const sx = reflectCoord(x + sparseKx[i]!, w);
          sum += img.data[sy * w + sx]! * sparseW[i]!;
        }
        out.data[y * w + x] = sum;
      }
  } else if (c === 3) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s0 = 0,
          s1 = 0,
          s2 = 0;
        for (let i = 0; i < sparseLen; i++) {
          const sy = reflectCoord(y + sparseKy[i]!, h);
          const sx = reflectCoord(x + sparseKx[i]!, w);
          const idx = (sy * w + sx) * 3;
          const wt = sparseW[i]!;
          s0 += img.data[idx]! * wt;
          s1 += img.data[idx + 1]! * wt;
          s2 += img.data[idx + 2]! * wt;
        }
        const oi = (y * w + x) * 3;
        out.data[oi] = s0;
        out.data[oi + 1] = s1;
        out.data[oi + 2] = s2;
      }
  } else {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let ch = 0; ch < c; ch++) {
          let sum = 0;
          for (let i = 0; i < sparseLen; i++) {
            const sy = reflectCoord(y + sparseKy[i]!, h);
            const sx = reflectCoord(x + sparseKx[i]!, w);
            sum += img.data[(sy * w + sx) * c + ch]! * sparseW[i]!;
          }
          out.data[(y * w + x) * c + ch] = sum;
        }
  }
  return out;
}

async function convolve2d(img: Img, kernel: ArrayLike<number>, kw: number, kh: number): Promise<Img> {
  const gpu = await gpuConvolve2d(img, kernel, kw, kh);
  if (gpu) return gpu;
  return convolve2dCpu(img, kernel, kw, kh);
}

/**
 * Generate Perlin-like cloud noise as a grayscale image.
 * Used as the base for the coverage mask that controls where paint is visible.
 * 7 octaves of bilinearly-upsampled random grids give organic-looking noise.
 */
export function generateClouds(h: number, w: number, seed = 0): Img {
  const rng = new SeededRNG(seed);
  const result = new Float32Array(w * h);
  for (let o = 0; o < 7; o++) {
    const f = 2 ** o;
    const sh = Math.max(2, Math.floor(h / (128 / f)));
    const sw = Math.max(2, Math.floor(w / (128 / f)));
    const small = new Float32Array(sh * sw);
    for (let i = 0; i < small.length; i++) small[i] = rng.randn();
    const weight = 1 / (f * 0.7 + 1);
    for (let y = 0; y < h; y++) {
      const fy = (y * (sh - 1)) / (h - 1 || 1);
      const y0 = Math.floor(fy),
        y1 = Math.min(y0 + 1, sh - 1);
      const wy = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = (x * (sw - 1)) / (w - 1 || 1);
        const x0 = Math.floor(fx),
          x1 = Math.min(x0 + 1, sw - 1);
        const wx = fx - x0;
        const v =
          small[y0 * sw + x0]! * (1 - wx) * (1 - wy) +
          small[y0 * sw + x1]! * wx * (1 - wy) +
          small[y1 * sw + x0]! * (1 - wx) * wy +
          small[y1 * sw + x1]! * wx * wy;
        result[y * w + x] += v * weight;
      }
    }
  }
  // Normalise to [0, 255]
  let mn = Infinity,
    mx = -Infinity;
  for (let i = 0; i < result.length; i++) {
    if (result[i]! < mn) mn = result[i]!;
    if (result[i]! > mx) mx = result[i]!;
  }
  const out = createImg(w, h, 1);
  const range = mx - mn || 1;
  for (let i = 0; i < result.length; i++) {
    out.data[i] = ((result[i]! - mn) / range) * 255;
  }
  return out;
}

/**
 * Ripple distortion — shifts rows horizontally and columns vertically
 * with a sine wave pattern, creating a wavy/wobbly look.
 * Jitter on the wavelength makes it feel organic, not mechanical.
 */
export async function ripple(img: Img, amount: number, size: "small" | "medium" | "large" = "large"): Promise<Img> {
  const wl = { small: 8, medium: 18, large: 40 }[size];
  const { w, h } = img;
  const rng = new SeededRNG(123);
  const yJitter = new Float32Array(h);
  const xJitter = new Float32Array(w);
  for (let i = 0; i < h; i++) yJitter[i] = rng.uniform(0.85, 1.15);
  for (let i = 0; i < w; i++) xJitter[i] = rng.uniform(0.85, 1.15);
  const rowDx = new Float32Array(h);
  for (let y = 0; y < h; y++) rowDx[y] = amount * Math.sin((2 * Math.PI * y) / (wl * yJitter[y]!));
  const colDy = new Float32Array(w);
  for (let x = 0; x < w; x++) colDy[x] = amount * Math.sin((2 * Math.PI * x) / (wl * xJitter[x]!));
  const gpu = await gpuRipple(img, rowDx, colDy);
  if (gpu) return gpu;
  // CPU fallback: build full coordinate maps
  const mapX = new Float32Array(w * h);
  const mapY = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const dx = rowDx[y]!;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      mapX[rowOff + x] = x + dx;
      mapY[rowOff + x] = y + colDy[x]!;
    }
  }
  return remapCpu(img, mapX, mapY);
}

/**
 * Build an angled motion-blur convolution kernel.
 * Returns a sparse kernel (mostly zeros) — the convolution step
 * skips zeros so this is efficient even at large distances.
 */
export function buildMotionKernel(angleDeg: number, distance: number): { kernel: Float64Array; ks: number } {
  const dist = Math.max(1, Math.round(distance));
  const ks = dist * 2 + 1;
  const kernel = new Float64Array(ks * ks);
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad),
    s = Math.sin(rad);
  const ctr = dist;
  const numSamples = ks * 4;
  for (let i = 0; i < numSamples; i++) {
    const t = (i / (numSamples - 1)) * (ks - 1) - ctr;
    const fx = ctr + t * c;
    const fy = ctr - t * s;
    const x0 = Math.floor(fx),
      y0 = Math.floor(fy);
    const wx = fx - x0,
      wy = fy - y0;
    for (const [yy, yw] of [
      [y0, 1 - wy],
      [y0 + 1, wy],
    ] as [number, number][]) {
      for (const [xx, xw] of [
        [x0, 1 - wx],
        [x0 + 1, wx],
      ] as [number, number][]) {
        if (xx >= 0 && xx < ks && yy >= 0 && yy < ks) kernel[yy * ks + xx] += yw * xw;
      }
    }
  }
  let sum = 0;
  for (let i = 0; i < kernel.length; i++) sum += kernel[i]!;
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  return { kernel, ks };
}

/** Apply directional motion blur at a given angle and pixel distance. */
export async function motionBlur(img: Img, angleDeg: number, distance: number): Promise<Img> {
  const { kernel, ks } = buildMotionKernel(angleDeg, distance);
  return convolve2d(img, kernel, ks, ks);
}

/**
 * Displace (warp) an image using a displacement map.
 * Each pixel in `dmap` has two channels: horizontal and vertical displacement.
 * Values are centred at 128 — above pushes right/down, below pushes left/up.
 * `hScale`/`vScale` control the displacement magnitude.
 */
export async function displace(img: Img, dmap: Img, hScale: number, vScale: number): Promise<Img> {
  const { w, h } = img;
  const mapX = new Float32Array(w * h);
  const mapY = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const hv = dmap.data[idx * dmap.c]!;
      const vv = dmap.data[idx * dmap.c + 1]!;
      mapX[idx] = x + ((hv - 128) / 128) * hScale;
      mapY[idx] = y + ((vv - 128) / 128) * vScale;
    }
  return remap(img, mapX, mapY);
}

/**
 * Mezzotint: stochastic halftone — each pixel becomes black or white
 * with probability proportional to its brightness. Creates a gritty texture.
 */
export function mezzotint(gray: Img, rng: SeededRNG): Img {
  const out = createImg(gray.w, gray.h, 1);
  for (let i = 0; i < gray.data.length; i++) {
    out.data[i] = rng.randint(256) < gray.data[i]! ? 255 : 0;
  }
  return out;
}

/**
 * 5×5 Sobel edge detection. Returns a normalised gradient magnitude image.
 * Used to find paint edges for the speckle effect.
 */
export async function sobel5x5(gray: Img): Promise<Img> {
  const kx = [-1, -2, 0, 2, 1, -4, -8, 0, 8, 4, -6, -12, 0, 12, 6, -4, -8, 0, 8, 4, -1, -2, 0, 2, 1];
  const ky = [-1, -4, -6, -4, -1, -2, -8, -12, -8, -2, 0, 0, 0, 0, 0, 2, 8, 12, 8, 2, 1, 4, 6, 4, 1];
  const gx = await convolve2d(gray, kx, 5, 5);
  const gy = await convolve2d(gray, ky, 5, 5);
  const out = createImg(gray.w, gray.h, 1);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = Math.sqrt(gx.data[i]! ** 2 + gy.data[i]! ** 2);
  }
  let mx = 0;
  for (let i = 0; i < out.data.length; i++) if (out.data[i]! > mx) mx = out.data[i]!;
  if (mx > 0) for (let i = 0; i < out.data.length; i++) out.data[i] = (out.data[i]! / mx) * 255;
  return out;
}

/** Build an elliptical structuring element (kernel mask) for morphological ops. */
export function makeEllipseKernel(size: number): Uint8Array {
  const r = (size - 1) / 2;
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x - r) / r,
        dy = (y - r) / r;
      mask[y * size + x] = dx * dx + dy * dy <= 1 ? 1 : 0;
    }
  return mask;
}

/** Morphological erode: shrink bright regions using an elliptical kernel. */
export async function erode(gray: Img, kernelSize: number): Promise<Img> {
  const mask = makeEllipseKernel(kernelSize);
  const gpu = await gpuErode(gray, kernelSize, mask);
  if (gpu) return gpu;
  const out = createImg(gray.w, gray.h, 1);
  const { w, h } = gray;
  const r = (kernelSize - 1) >> 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let minVal = 255;
      for (let ky = 0; ky < kernelSize; ky++)
        for (let kx = 0; kx < kernelSize; kx++) {
          if (!mask[ky * kernelSize + kx]) continue;
          const sy = reflectCoord(y + ky - r, h);
          const sx = reflectCoord(x + kx - r, w);
          const v = gray.data[sy * w + sx]!;
          if (v < minVal) minVal = v;
        }
      out.data[y * w + x] = minVal;
    }
  return out;
}

/**
 * Morphological dilate: expand bright regions using an elliptical kernel.
 * For large kernels (>15), uses an optimised decomposed sliding-max approach
 * instead of brute-force to keep it tractable.
 */
export async function dilate(gray: Img, kernelSize: number): Promise<Img> {
  const mask = makeEllipseKernel(kernelSize);
  const gpu = await gpuDilate(gray, kernelSize, mask);
  if (gpu) return gpu;
  const { w, h } = gray;

  if (kernelSize <= 15) {
    const out = createImg(w, h, 1);
    const r = (kernelSize - 1) >> 1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let maxVal = 0;
        for (let ky = 0; ky < kernelSize; ky++)
          for (let kx = 0; kx < kernelSize; kx++) {
            if (!mask[ky * kernelSize + kx]) continue;
            const sy = reflectCoord(y + ky - r, h);
            const sx = reflectCoord(x + kx - r, w);
            const v = gray.data[sy * w + sx]!;
            if (v > maxVal) maxVal = v;
          }
        out.data[y * w + x] = maxVal;
      }
    return out;
  }

  // Large kernel: decompose into per-row horizontal spans with sliding max
  const r = (kernelSize - 1) >> 1;
  const rowMinX = new Int32Array(kernelSize);
  const rowMaxX = new Int32Array(kernelSize);
  for (let ky = 0; ky < kernelSize; ky++) {
    let minX = kernelSize,
      maxX = -1;
    for (let kx = 0; kx < kernelSize; kx++) {
      if (mask[ky * kernelSize + kx]) {
        if (kx < minX) minX = kx;
        if (kx > maxX) maxX = kx;
      }
    }
    rowMinX[ky] = minX - r;
    rowMaxX[ky] = maxX - r;
  }

  const out = createImg(w, h, 1);
  const temp = new Float32Array(w);
  const deque = new Int32Array(w);

  for (let ky = 0; ky < kernelSize; ky++) {
    const spanLeft = rowMinX[ky]!;
    const spanRight = rowMaxX[ky]!;
    if (spanRight < spanLeft) continue;
    const dy = ky - r;
    for (let y = 0; y < h; y++) {
      const sy = reflectCoord(y + dy, h);
      const srcRow = sy * w;
      let dqFront = 0,
        dqBack = 0;
      for (let x = 0; x < w; x++) {
        const winRight = x + spanRight;
        const winLeft = x + spanLeft;
        if (winRight < w) {
          const val = gray.data[srcRow + winRight]!;
          while (dqBack > dqFront && gray.data[srcRow + deque[dqBack - 1]!]! <= val) dqBack--;
          deque[dqBack++] = winRight;
        } else {
          const rx = reflectCoord(winRight, w);
          const val = gray.data[srcRow + rx]!;
          while (dqBack > dqFront && gray.data[srcRow + deque[dqBack - 1]!]! <= val) dqBack--;
          deque[dqBack++] = winRight;
        }
        while (dqFront < dqBack && deque[dqFront]! < winLeft) dqFront++;
        temp[x] = gray.data[srcRow + reflectCoord(deque[dqFront]!, w)]!;
      }
      const outRow = y * w;
      for (let x = 0; x < w; x++) {
        if (temp[x]! > out.data[outRow + x]!) out.data[outRow + x] = temp[x]!;
      }
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5: WebGPU compute shaders — GPU-accelerated image processing
// ════════════════════════════════════════════════════════════════════════════
//
// Each shader runs as a compute pass with 256-thread workgroups, one thread
// per pixel. Data is uploaded as Float32 storage buffers, processed entirely
// on-GPU, then read back. A buffer pool avoids repeated allocation.
//
// If WebGPU is unavailable the callers fall back to their CPU implementations.

let device: GPUDevice | null = null;
let gpuAvailable: boolean | null = null;

/** Lazily initialise the WebGPU device. Returns null if unsupported. */
async function getDevice(): Promise<GPUDevice | null> {
  if (gpuAvailable === false) return null;
  if (device) return device;
  try {
    if (!navigator.gpu) {
      gpuAvailable = false;
      return null;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      gpuAvailable = false;
      return null;
    }
    device = await adapter.requestDevice();
    void device.lost.then(() => {
      device = null;
    });
    gpuAvailable = true;
    return device;
  } catch {
    gpuAvailable = false;
    return null;
  }
}

// ── Buffer Pool ─────────────────────────────────────────────────────────────
// Reuse GPU buffers across dispatches within a single pipeline run.
// Key = "usage|byteLength" so matching buffers are recycled.

const bufferPool = new Map<string, GPUBuffer[]>();

function poolKey(size: number, usage: number): string {
  return `${usage}|${size}`;
}

function acquireBuffer(dev: GPUDevice, size: number, usage: number): GPUBuffer {
  const key = poolKey(size, usage);
  const pool = bufferPool.get(key);
  if (pool && pool.length > 0) return pool.pop()!;
  return dev.createBuffer({ size, usage });
}

function releaseBuffer(buf: GPUBuffer, size: number, usage: number): void {
  const key = poolKey(size, usage);
  let pool = bufferPool.get(key);
  if (!pool) {
    pool = [];
    bufferPool.set(key, pool);
  }
  pool.push(buf);
}

/** Destroy all pooled buffers. Call between pipeline runs to free VRAM. */
export function flushBufferPool(): void {
  for (const pool of bufferPool.values()) for (const buf of pool) buf.destroy();
  bufferPool.clear();
}

const STORAGE_DST = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
const STORAGE_SRC = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
const READ_DST = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;
const UNIFORM_DST = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;

function allocAndWrite(dev: GPUDevice, data: BufferSource, usage: number): GPUBuffer {
  const buf = acquireBuffer(dev, (data as ArrayBuffer).byteLength, usage);
  dev.queue.writeBuffer(buf, 0, data);
  return buf;
}

/** Copy a GPU buffer back to CPU as Float32Array. */
async function readBackFloat32(dev: GPUDevice, src: GPUBuffer, size: number): Promise<Float32Array> {
  const readBuf = dev.createBuffer({ size, usage: READ_DST });
  const encoder = dev.createCommandEncoder();
  encoder.copyBufferToBuffer(src, 0, readBuf, 0, size);
  dev.queue.submit([encoder.finish()]);
  await readBuf.mapAsync(GPUMapMode.READ);
  const mapped = new Float32Array(readBuf.getMappedRange());
  const result = new Float32Array(mapped.length);
  result.set(mapped);
  readBuf.unmap();
  readBuf.destroy();
  return result;
}

function submitCompute(
  dev: GPUDevice,
  pipeline: GPUComputePipeline,
  bindGroup: GPUBindGroup,
  workgroups: number
): void {
  const encoder = dev.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(workgroups);
  pass.end();
  dev.queue.submit([encoder.finish()]);
}

// ── GPU Roll (circular shift) ───────────────────────────────────────────────

const ROLL_SHADER = /* wgsl */ `
struct Params { w: u32, h: u32, c: u32, _p: u32, dx: i32, dy: i32, _p2: u32, _p3: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x; if (px >= params.w * params.h) { return; }
  let y = i32(px / params.w); let x = i32(px % params.w);
  let w = i32(params.w); let h = i32(params.h);
  let sy = ((y - params.dy) % h + h) % h;
  let sx = ((x - params.dx) % w + w) % w;
  let si = u32(sy * w + sx);
  if (params.c == 1u) { output[px] = input[si]; }
  else { let oi = px * 3u; let ii = si * 3u; output[oi] = input[ii]; output[oi+1u] = input[ii+1u]; output[oi+2u] = input[ii+2u]; }
}`;
let rollPipeline: GPUComputePipeline | null = null;

// ── GPU Sparse Convolution ──────────────────────────────────────────────────
// Stores only the non-zero kernel taps as (dy, dx, weight) triples.

const CONVOLVE_SHADER = /* wgsl */ `
struct Params { w: u32, h: u32, c: u32, numTaps: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<storage, read> taps: array<f32>;
fn rc(v: i32, mx: i32) -> i32 {
  var r = v; if (r < 0) { r = -r; }
  if (r >= mx) { let p = mx * 2; r = r % p; if (r >= mx) { r = p - r - 1; } }
  return r;
}
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x; if (px >= params.w * params.h) { return; }
  let y = i32(px / params.w); let x = i32(px % params.w);
  let w = i32(params.w); let h = i32(params.h); let n = params.numTaps;
  if (params.c == 1u) {
    var s: f32 = 0.0;
    for (var i = 0u; i < n; i++) { s += input[u32(rc(y + i32(taps[i*3u]), h) * w + rc(x + i32(taps[i*3u+1u]), w))] * taps[i*3u+2u]; }
    output[px] = s;
  } else {
    var s0: f32 = 0.0; var s1: f32 = 0.0; var s2: f32 = 0.0;
    for (var i = 0u; i < n; i++) {
      let idx = u32(rc(y + i32(taps[i*3u]), h) * w + rc(x + i32(taps[i*3u+1u]), w)) * 3u;
      let wt = taps[i*3u+2u];
      s0 += input[idx] * wt; s1 += input[idx+1u] * wt; s2 += input[idx+2u] * wt;
    }
    let oi = px * 3u; output[oi] = s0; output[oi+1u] = s1; output[oi+2u] = s2;
  }
}`;
let convolvePipeline: GPUComputePipeline | null = null;

async function gpuConvolve2d(img: Img, kernel: ArrayLike<number>, kw: number, kh: number): Promise<Img | null> {
  const dev = await getDevice();
  if (!dev) return null;
  const { w, h, c } = img;
  const khh = (kh - 1) >> 1,
    kwh = (kw - 1) >> 1;
  const tapsList: number[] = [];
  for (let ky = 0; ky < kh; ky++)
    for (let kx = 0; kx < kw; kx++) {
      const v = kernel[ky * kw + kx]!;
      if (v !== 0) tapsList.push(ky - khh, kx - kwh, v);
    }
  const numTaps = tapsList.length / 3;
  if (!convolvePipeline) {
    convolvePipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: CONVOLVE_SHADER }), entryPoint: "main" },
    });
  }
  const totalPx = w * h;
  const dataSize = totalPx * c * 4;
  const paramBuf = allocAndWrite(dev, new Uint32Array([w, h, c, numTaps]), UNIFORM_DST);
  const inputBuf = allocAndWrite(dev, img.data as unknown as BufferSource, STORAGE_DST);
  const outputBuf = acquireBuffer(dev, dataSize, STORAGE_SRC);
  const tapsBuf = allocAndWrite(dev, new Float32Array(tapsList) as unknown as BufferSource, STORAGE_DST);
  const bg = dev.createBindGroup({
    layout: convolvePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramBuf } },
      { binding: 1, resource: { buffer: inputBuf } },
      { binding: 2, resource: { buffer: outputBuf } },
      { binding: 3, resource: { buffer: tapsBuf } },
    ],
  });
  submitCompute(dev, convolvePipeline, bg, Math.ceil(totalPx / 256));
  const result = await readBackFloat32(dev, outputBuf, dataSize);
  releaseBuffer(paramBuf, 16, UNIFORM_DST);
  releaseBuffer(inputBuf, dataSize, STORAGE_DST);
  releaseBuffer(outputBuf, dataSize, STORAGE_SRC);
  releaseBuffer(tapsBuf, tapsList.length * 4, STORAGE_DST);
  const out = createImg(w, h, c);
  out.data.set(result);
  return out;
}

// ── GPU Ripple (separable: rowDx + colDy shifts) ────────────────────────────

const RIPPLE_SHADER = /* wgsl */ `
struct Params { w: u32, h: u32, c: u32, _p: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<storage, read> rowDx: array<f32>;
@group(0) @binding(4) var<storage, read> colDy: array<f32>;
fn rc(v: i32, mx: i32) -> i32 {
  var r = v; if (r < 0) { r = -r; }
  if (r >= mx) { let p = mx * 2; r = r % p; if (r >= mx) { r = p - r - 1; } }
  return r;
}
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x; if (px >= params.w * params.h) { return; }
  let y = i32(px / params.w); let x = i32(px % params.w);
  let w = i32(params.w); let h = i32(params.h);
  let fx = f32(x) + rowDx[y]; let fy = f32(y) + colDy[x];
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy));
  let wx = fx - f32(x0); let wy = fy - f32(y0);
  let rx0 = rc(x0, w); let rx1 = rc(x0+1, w);
  let ry0 = rc(y0, h); let ry1 = rc(y0+1, h);
  let w00 = (1.0-wx)*(1.0-wy); let w10 = wx*(1.0-wy);
  let w01 = (1.0-wx)*wy; let w11 = wx*wy;
  if (params.c == 1u) {
    output[px] = input[u32(ry0*w+rx0)]*w00 + input[u32(ry0*w+rx1)]*w10 + input[u32(ry1*w+rx0)]*w01 + input[u32(ry1*w+rx1)]*w11;
  } else {
    let i00=u32(ry0*w+rx0)*3u; let i10=u32(ry0*w+rx1)*3u;
    let i01=u32(ry1*w+rx0)*3u; let i11=u32(ry1*w+rx1)*3u;
    let oi = px*3u;
    output[oi]   = input[i00]*w00+input[i10]*w10+input[i01]*w01+input[i11]*w11;
    output[oi+1u]= input[i00+1u]*w00+input[i10+1u]*w10+input[i01+1u]*w01+input[i11+1u]*w11;
    output[oi+2u]= input[i00+2u]*w00+input[i10+2u]*w10+input[i01+2u]*w01+input[i11+2u]*w11;
  }
}`;
let ripplePipeline: GPUComputePipeline | null = null;

async function gpuRipple(img: Img, rowDx: Float32Array, colDy: Float32Array): Promise<Img | null> {
  const dev = await getDevice();
  if (!dev) return null;
  const { w, h, c } = img;
  const totalPx = w * h;
  const dataSize = totalPx * c * 4;
  if (!ripplePipeline) {
    ripplePipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: RIPPLE_SHADER }), entryPoint: "main" },
    });
  }
  const paramBuf = allocAndWrite(dev, new Uint32Array([w, h, c, 0]), UNIFORM_DST);
  const inputBuf = allocAndWrite(dev, img.data as unknown as BufferSource, STORAGE_DST);
  const outputBuf = acquireBuffer(dev, dataSize, STORAGE_SRC);
  const dxBuf = allocAndWrite(dev, rowDx as unknown as BufferSource, STORAGE_DST);
  const dyBuf = allocAndWrite(dev, colDy as unknown as BufferSource, STORAGE_DST);
  const bg = dev.createBindGroup({
    layout: ripplePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramBuf } },
      { binding: 1, resource: { buffer: inputBuf } },
      { binding: 2, resource: { buffer: outputBuf } },
      { binding: 3, resource: { buffer: dxBuf } },
      { binding: 4, resource: { buffer: dyBuf } },
    ],
  });
  submitCompute(dev, ripplePipeline, bg, Math.ceil(totalPx / 256));
  const result = await readBackFloat32(dev, outputBuf, dataSize);
  releaseBuffer(paramBuf, 16, UNIFORM_DST);
  releaseBuffer(inputBuf, dataSize, STORAGE_DST);
  releaseBuffer(outputBuf, dataSize, STORAGE_SRC);
  releaseBuffer(dxBuf, rowDx.byteLength, STORAGE_DST);
  releaseBuffer(dyBuf, colDy.byteLength, STORAGE_DST);
  const out = createImg(w, h, c);
  out.data.set(result);
  return out;
}

// ── GPU Remap (bilinear warp by coordinate maps) ────────────────────────────

const REMAP_SHADER = /* wgsl */ `
struct Params { w: u32, h: u32, c: u32, _p: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<storage, read> mapX: array<f32>;
@group(0) @binding(4) var<storage, read> mapY: array<f32>;
fn rc(v: i32, mx: i32) -> i32 {
  var r = v; if (r < 0) { r = -r; }
  if (r >= mx) { let p = mx * 2; r = r % p; if (r >= mx) { r = p - r - 1; } }
  return r;
}
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x; if (px >= params.w * params.h) { return; }
  let w = i32(params.w); let h = i32(params.h);
  let fx = mapX[px]; let fy = mapY[px];
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy));
  let wx = fx - f32(x0); let wy = fy - f32(y0);
  let rx0 = rc(x0, w); let rx1 = rc(x0+1, w);
  let ry0 = rc(y0, h); let ry1 = rc(y0+1, h);
  let w00 = (1.0-wx)*(1.0-wy); let w10 = wx*(1.0-wy);
  let w01 = (1.0-wx)*wy; let w11 = wx*wy;
  if (params.c == 1u) {
    output[px] = input[u32(ry0*w+rx0)]*w00 + input[u32(ry0*w+rx1)]*w10 + input[u32(ry1*w+rx0)]*w01 + input[u32(ry1*w+rx1)]*w11;
  } else {
    let i00=u32(ry0*w+rx0)*3u; let i10=u32(ry0*w+rx1)*3u;
    let i01=u32(ry1*w+rx0)*3u; let i11=u32(ry1*w+rx1)*3u;
    let oi = px*3u;
    output[oi]   = input[i00]*w00+input[i10]*w10+input[i01]*w01+input[i11]*w11;
    output[oi+1u]= input[i00+1u]*w00+input[i10+1u]*w10+input[i01+1u]*w01+input[i11+1u]*w11;
    output[oi+2u]= input[i00+2u]*w00+input[i10+2u]*w10+input[i01+2u]*w01+input[i11+2u]*w11;
  }
}`;
let remapPipeline: GPUComputePipeline | null = null;

async function gpuRemap(img: Img, mapXData: Float32Array, mapYData: Float32Array): Promise<Img | null> {
  const dev = await getDevice();
  if (!dev) return null;
  const { w, h, c } = img;
  const totalPx = w * h;
  const dataSize = totalPx * c * 4;
  const mapSize = totalPx * 4;
  if (!remapPipeline) {
    remapPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: REMAP_SHADER }), entryPoint: "main" },
    });
  }
  const paramBuf = allocAndWrite(dev, new Uint32Array([w, h, c, 0]), UNIFORM_DST);
  const inputBuf = allocAndWrite(dev, img.data as unknown as BufferSource, STORAGE_DST);
  const outputBuf = acquireBuffer(dev, dataSize, STORAGE_SRC);
  const mapXBuf = allocAndWrite(dev, mapXData as unknown as BufferSource, STORAGE_DST);
  const mapYBuf = allocAndWrite(dev, mapYData as unknown as BufferSource, STORAGE_DST);
  const bg = dev.createBindGroup({
    layout: remapPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramBuf } },
      { binding: 1, resource: { buffer: inputBuf } },
      { binding: 2, resource: { buffer: outputBuf } },
      { binding: 3, resource: { buffer: mapXBuf } },
      { binding: 4, resource: { buffer: mapYBuf } },
    ],
  });
  submitCompute(dev, remapPipeline, bg, Math.ceil(totalPx / 256));
  const result = await readBackFloat32(dev, outputBuf, dataSize);
  releaseBuffer(paramBuf, 16, UNIFORM_DST);
  releaseBuffer(inputBuf, dataSize, STORAGE_DST);
  releaseBuffer(outputBuf, dataSize, STORAGE_SRC);
  releaseBuffer(mapXBuf, mapSize, STORAGE_DST);
  releaseBuffer(mapYBuf, mapSize, STORAGE_DST);
  const out = createImg(w, h, c);
  out.data.set(result);
  return out;
}

// ── GPU Displace+Fade (batched: multiple passes, single upload) ─────────────
// This shader reads a displacement map, warps the image, then blends the
// warped result with the original ("fade"). Multiple passes ping-pong between
// two GPU buffers without reading back to CPU in between.

const DISPLACE_FADE_SHADER = /* wgsl */ `
struct Params { w: u32, h: u32, dmapC: u32, _p: u32, hScale: f32, vScale: f32, fadeA: f32, fadeB: f32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<storage, read> dmap: array<f32>;
fn rc(v: i32, mx: i32) -> i32 {
  var r = v; if (r < 0) { r = -r; }
  if (r >= mx) { let p = mx * 2; r = r % p; if (r >= mx) { r = p - r - 1; } }
  return r;
}
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x; if (px >= params.w * params.h) { return; }
  let y = i32(px / params.w); let x = i32(px % params.w);
  let w = i32(params.w); let h = i32(params.h);
  let dmapC = params.dmapC;
  let hv = dmap[px * dmapC]; let vv = dmap[px * dmapC + 1u];
  let fx = f32(x) + (hv - 128.0) / 128.0 * params.hScale;
  let fy = f32(y) + (vv - 128.0) / 128.0 * params.vScale;
  let x0 = i32(floor(fx)); let y0 = i32(floor(fy));
  let wx = fx - f32(x0); let wy = fy - f32(y0);
  let rx0 = rc(x0, w); let rx1 = rc(x0+1, w);
  let ry0 = rc(y0, h); let ry1 = rc(y0+1, h);
  let w00 = (1.0-wx)*(1.0-wy); let w10 = wx*(1.0-wy);
  let w01 = (1.0-wx)*wy; let w11 = wx*wy;
  let i00=u32(ry0*w+rx0)*3u; let i10=u32(ry0*w+rx1)*3u;
  let i01=u32(ry1*w+rx0)*3u; let i11=u32(ry1*w+rx1)*3u;
  let oi = px * 3u;
  let dr = input[i00]*w00+input[i10]*w10+input[i01]*w01+input[i11]*w11;
  let dg = input[i00+1u]*w00+input[i10+1u]*w10+input[i01+1u]*w01+input[i11+1u]*w11;
  let db = input[i00+2u]*w00+input[i10+2u]*w10+input[i01+2u]*w01+input[i11+2u]*w11;
  let origR = input[oi]; let origG = input[oi+1u]; let origB = input[oi+2u];
  output[oi]   = clamp(dr * params.fadeA + origR * params.fadeB, 0.0, 255.0);
  output[oi+1u]= clamp(dg * params.fadeA + origG * params.fadeB, 0.0, 255.0);
  output[oi+2u]= clamp(db * params.fadeA + origB * params.fadeB, 0.0, 255.0);
}`;
let displaceFadePipeline: GPUComputePipeline | null = null;

// ── GPU Morphology (dilate/erode) ───────────────────────────────────────────

const MORPH_SHADER = /* wgsl */ `
struct Params { w: u32, h: u32, numOffsets: u32, mode: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<storage, read> offsets: array<i32>;
fn rc(v: i32, mx: i32) -> i32 {
  var r = v; if (r < 0) { r = -r; }
  if (r >= mx) { let p = mx * 2; r = r % p; if (r >= mx) { r = p - r - 1; } }
  return r;
}
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x; if (px >= params.w * params.h) { return; }
  let y = i32(px / params.w); let x = i32(px % params.w);
  let w = i32(params.w); let h = i32(params.h);
  var val: f32;
  if (params.mode == 0u) { val = 0.0; } else { val = 255.0; }
  for (var i = 0u; i < params.numOffsets; i++) {
    let sy = rc(y + offsets[i*2u], h); let sx = rc(x + offsets[i*2u+1u], w);
    let v = input[u32(sy * w + sx)];
    if (params.mode == 0u) { val = max(val, v); } else { val = min(val, v); }
  }
  output[px] = val;
}`;
let morphPipeline: GPUComputePipeline | null = null;

async function gpuMorph(gray: Img, kernelSize: number, mask: Uint8Array, mode: number): Promise<Img | null> {
  const dev = await getDevice();
  if (!dev) return null;
  const { w, h } = gray;
  const r = (kernelSize - 1) >> 1;
  const offList: number[] = [];
  for (let ky = 0; ky < kernelSize; ky++)
    for (let kx = 0; kx < kernelSize; kx++) {
      if (mask[ky * kernelSize + kx]) offList.push(ky - r, kx - r);
    }
  const numOff = offList.length / 2;
  if (!morphPipeline) {
    morphPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: MORPH_SHADER }), entryPoint: "main" },
    });
  }
  const totalPx = w * h;
  const dataSize = totalPx * 4;
  const offSize = Math.max(offList.length * 4, 16);
  const paramBuf = allocAndWrite(dev, new Uint32Array([w, h, numOff, mode]), UNIFORM_DST);
  const inputBuf = allocAndWrite(dev, gray.data as unknown as BufferSource, STORAGE_DST);
  const outputBuf = acquireBuffer(dev, dataSize, STORAGE_SRC);
  const offBuf = allocAndWrite(dev, new Int32Array(offList) as unknown as BufferSource, STORAGE_DST);
  const bg = dev.createBindGroup({
    layout: morphPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramBuf } },
      { binding: 1, resource: { buffer: inputBuf } },
      { binding: 2, resource: { buffer: outputBuf } },
      { binding: 3, resource: { buffer: offBuf } },
    ],
  });
  submitCompute(dev, morphPipeline, bg, Math.ceil(totalPx / 256));
  const result = await readBackFloat32(dev, outputBuf, dataSize);
  releaseBuffer(paramBuf, 16, UNIFORM_DST);
  releaseBuffer(inputBuf, dataSize, STORAGE_DST);
  releaseBuffer(outputBuf, dataSize, STORAGE_SRC);
  releaseBuffer(offBuf, offSize, STORAGE_DST);
  const out = createImg(w, h, 1);
  out.data.set(result);
  return out;
}

async function gpuDilate(gray: Img, kernelSize: number, mask: Uint8Array): Promise<Img | null> {
  return gpuMorph(gray, kernelSize, mask, 0);
}

async function gpuErode(gray: Img, kernelSize: number, mask: Uint8Array): Promise<Img | null> {
  return gpuMorph(gray, kernelSize, mask, 1);
}

// ── GPU Separable Gaussian Blur ─────────────────────────────────────────────
// Two passes (horizontal then vertical) with a 1D Gaussian kernel.

const BLUR1D_SHADER = /* wgsl */ `
struct Params { w: u32, h: u32, c: u32, radius: u32, dir: u32, _p1: u32, _p2: u32, _p3: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<storage, read> weights: array<f32>;
fn rc(v: i32, mx: i32) -> i32 {
  var r = v; if (r < 0) { r = -r; }
  if (r >= mx) { let p = mx * 2; r = r % p; if (r >= mx) { r = p - r - 1; } }
  return r;
}
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x; if (px >= params.w * params.h) { return; }
  let y = i32(px / params.w); let x = i32(px % params.w);
  let w = i32(params.w); let h = i32(params.h);
  let r = i32(params.radius); let c = params.c;
  if (c == 1u) {
    var s: f32 = 0.0;
    for (var i = -r; i <= r; i++) {
      var sy: i32; var sx: i32;
      if (params.dir == 0u) { sy = y; sx = rc(x + i, w); }
      else { sy = rc(y + i, h); sx = x; }
      s += input[u32(sy * w + sx)] * weights[u32(i + r)];
    }
    output[px] = s;
  } else {
    var s0: f32 = 0.0; var s1: f32 = 0.0; var s2: f32 = 0.0;
    for (var i = -r; i <= r; i++) {
      var sy: i32; var sx: i32;
      if (params.dir == 0u) { sy = y; sx = rc(x + i, w); }
      else { sy = rc(y + i, h); sx = x; }
      let idx = u32(sy * w + sx) * 3u;
      let wt = weights[u32(i + r)];
      s0 += input[idx] * wt; s1 += input[idx+1u] * wt; s2 += input[idx+2u] * wt;
    }
    let oi = px * 3u; output[oi] = s0; output[oi+1u] = s1; output[oi+2u] = s2;
  }
}`;
let blur1dPipeline: GPUComputePipeline | null = null;

function makeGaussianKernel1D(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i]!;
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return kernel;
}

async function gpuGaussianBlur(img: Img, sigma: number): Promise<Img | null> {
  const dev = await getDevice();
  if (!dev) return null;
  const { w, h, c } = img;
  const kernel = makeGaussianKernel1D(sigma);
  const radius = (kernel.length - 1) / 2;
  if (!blur1dPipeline) {
    blur1dPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: BLUR1D_SHADER }), entryPoint: "main" },
    });
  }
  const totalPx = w * h;
  const dataSize = totalPx * c * 4;
  const wgCount = Math.ceil(totalPx / 256);
  const paramH = allocAndWrite(dev, new Uint32Array([w, h, c, radius, 0, 0, 0, 0]), UNIFORM_DST);
  const inputBuf = allocAndWrite(dev, img.data as unknown as BufferSource, STORAGE_DST);
  const midBuf = acquireBuffer(dev, dataSize, STORAGE_SRC | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const wBuf = allocAndWrite(dev, kernel as unknown as BufferSource, STORAGE_DST);
  const bgH = dev.createBindGroup({
    layout: blur1dPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramH } },
      { binding: 1, resource: { buffer: inputBuf } },
      { binding: 2, resource: { buffer: midBuf } },
      { binding: 3, resource: { buffer: wBuf } },
    ],
  });
  const paramV = allocAndWrite(dev, new Uint32Array([w, h, c, radius, 1, 0, 0, 0]), UNIFORM_DST);
  const outputBuf = acquireBuffer(dev, dataSize, STORAGE_SRC);
  const bgV = dev.createBindGroup({
    layout: blur1dPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramV } },
      { binding: 1, resource: { buffer: midBuf } },
      { binding: 2, resource: { buffer: outputBuf } },
      { binding: 3, resource: { buffer: wBuf } },
    ],
  });
  const encoder = dev.createCommandEncoder();
  let pass = encoder.beginComputePass();
  pass.setPipeline(blur1dPipeline);
  pass.setBindGroup(0, bgH);
  pass.dispatchWorkgroups(wgCount);
  pass.end();
  pass = encoder.beginComputePass();
  pass.setPipeline(blur1dPipeline);
  pass.setBindGroup(0, bgV);
  pass.dispatchWorkgroups(wgCount);
  pass.end();
  dev.queue.submit([encoder.finish()]);
  const result = await readBackFloat32(dev, outputBuf, dataSize);
  const midUsage = STORAGE_SRC | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
  releaseBuffer(paramH, 32, UNIFORM_DST);
  releaseBuffer(paramV, 32, UNIFORM_DST);
  releaseBuffer(inputBuf, dataSize, STORAGE_DST);
  releaseBuffer(midBuf, dataSize, midUsage);
  releaseBuffer(outputBuf, dataSize, STORAGE_SRC);
  releaseBuffer(wBuf, kernel.byteLength, STORAGE_DST);
  const out = createImg(w, h, c);
  out.data.set(result);
  return out;
}

// ── GPU Paint Grain (fused grayscale + random grain mask) ───────────────────
// Simulates paint texture: pixels randomly darken based on luminance,
// giving a stippled, grainy paint look.

const GRAIN_SHADER = /* wgsl */ `
struct Params { w: u32, h: u32, darkFactor: f32, _p: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<storage, read> rng: array<f32>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) gid: vec3u) {
  let px = gid.x; if (px >= params.w * params.h) { return; }
  let oi = px * 3u;
  let r = input[oi]; let g = input[oi+1u]; let b = input[oi+2u];
  let gray = 0.299 * r + 0.587 * g + 0.114 * b;
  let rand = rng[px];
  let mask = select(0.0, 1.0, rand < gray);
  let df = params.darkFactor;
  output[oi]   = r * mask + r * df * (1.0 - mask);
  output[oi+1u]= g * mask + g * df * (1.0 - mask);
  output[oi+2u]= b * mask + b * df * (1.0 - mask);
}`;
let grainPipeline: GPUComputePipeline | null = null;

async function gpuPaintGrain(img: Img, rngValues: Float32Array, darkFactor: number): Promise<Img | null> {
  const dev = await getDevice();
  if (!dev) return null;
  const { w, h } = img;
  if (!grainPipeline) {
    grainPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: GRAIN_SHADER }), entryPoint: "main" },
    });
  }
  const totalPx = w * h;
  const dataSize = totalPx * 3 * 4;
  const rngSize = totalPx * 4;
  const paramData = new ArrayBuffer(16);
  new Uint32Array(paramData, 0, 2).set([w, h]);
  new Float32Array(paramData, 8, 1).set([darkFactor]);
  new Uint32Array(paramData, 12, 1).set([0]);
  const paramBuf = allocAndWrite(dev, paramData, UNIFORM_DST);
  const inputBuf = allocAndWrite(dev, img.data as unknown as BufferSource, STORAGE_DST);
  const outputBuf = acquireBuffer(dev, dataSize, STORAGE_SRC);
  const rngBuf = allocAndWrite(dev, rngValues as unknown as BufferSource, STORAGE_DST);
  const bg = dev.createBindGroup({
    layout: grainPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramBuf } },
      { binding: 1, resource: { buffer: inputBuf } },
      { binding: 2, resource: { buffer: outputBuf } },
      { binding: 3, resource: { buffer: rngBuf } },
    ],
  });
  submitCompute(dev, grainPipeline, bg, Math.ceil(totalPx / 256));
  const result = await readBackFloat32(dev, outputBuf, dataSize);
  releaseBuffer(paramBuf, 16, UNIFORM_DST);
  releaseBuffer(inputBuf, dataSize, STORAGE_DST);
  releaseBuffer(outputBuf, dataSize, STORAGE_SRC);
  releaseBuffer(rngBuf, rngSize, STORAGE_DST);
  const out = createImg(w, h, 3);
  out.data.set(result);
  return out;
}

// ── GPU Sharpen (fused: two Gaussian blurs + unsharp mask) ──────────────────
// Runs 4 blur passes (sigma1 H+V, sigma2 H+V) in a single command buffer,
// reads back both blurred results, then applies unsharp mask on CPU:
//   output = blurred_small + (blurred_small - blurred_large)

async function gpuSharpen(img: Img, sigma1: number, sigma2: number): Promise<Img | null> {
  const dev = await getDevice();
  if (!dev) return null;
  const { w, h, c } = img;
  const k1 = makeGaussianKernel1D(sigma1);
  const k2 = makeGaussianKernel1D(sigma2);
  const r1 = (k1.length - 1) / 2;
  const r2 = (k2.length - 1) / 2;
  if (!blur1dPipeline) {
    blur1dPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: BLUR1D_SHADER }), entryPoint: "main" },
    });
  }
  const totalPx = w * h;
  const dataSize = totalPx * c * 4;
  const wgCount = Math.ceil(totalPx / 256);
  const midUsage = STORAGE_SRC | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
  const inputBuf = allocAndWrite(dev, img.data as unknown as BufferSource, STORAGE_DST);
  const buf1 = acquireBuffer(dev, dataSize, midUsage);
  const buf2 = acquireBuffer(dev, dataSize, midUsage);
  const buf3 = acquireBuffer(dev, dataSize, midUsage);
  const buf4 = acquireBuffer(dev, dataSize, STORAGE_SRC);
  const w1Buf = allocAndWrite(dev, k1 as unknown as BufferSource, STORAGE_DST);
  const w2Buf = allocAndWrite(dev, k2 as unknown as BufferSource, STORAGE_DST);
  const mkParams = (radius: number, dir: number) =>
    allocAndWrite(dev, new Uint32Array([w, h, c, radius, dir, 0, 0, 0]), UNIFORM_DST);
  const p1h = mkParams(r1, 0);
  const p1v = mkParams(r1, 1);
  const p2h = mkParams(r2, 0);
  const p2v = mkParams(r2, 1);
  const mkBg = (pBuf: GPUBuffer, inBuf: GPUBuffer, outBuf: GPUBuffer, wBuf: GPUBuffer) =>
    dev.createBindGroup({
      layout: blur1dPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: pBuf } },
        { binding: 1, resource: { buffer: inBuf } },
        { binding: 2, resource: { buffer: outBuf } },
        { binding: 3, resource: { buffer: wBuf } },
      ],
    });
  const encoder = dev.createCommandEncoder();
  const passes = [
    mkBg(p1h, inputBuf, buf1, w1Buf),
    mkBg(p1v, buf1, buf2, w1Buf),
    mkBg(p2h, buf2, buf3, w2Buf),
    mkBg(p2v, buf3, buf4, w2Buf),
  ];
  for (const bg of passes) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(blur1dPipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(wgCount);
    pass.end();
  }
  const readBuf1 = dev.createBuffer({ size: dataSize, usage: READ_DST });
  const readBuf2 = dev.createBuffer({ size: dataSize, usage: READ_DST });
  encoder.copyBufferToBuffer(buf2, 0, readBuf1, 0, dataSize);
  encoder.copyBufferToBuffer(buf4, 0, readBuf2, 0, dataSize);
  dev.queue.submit([encoder.finish()]);
  await Promise.all([readBuf1.mapAsync(GPUMapMode.READ), readBuf2.mapAsync(GPUMapMode.READ)]);
  const m1 = new Float32Array(readBuf1.getMappedRange());
  const r04 = new Float32Array(m1.length);
  r04.set(m1);
  readBuf1.unmap();
  readBuf1.destroy();
  const m2 = new Float32Array(readBuf2.getMappedRange());
  const r2data = new Float32Array(m2.length);
  r2data.set(m2);
  readBuf2.unmap();
  readBuf2.destroy();
  for (const b of [inputBuf, buf1, buf3]) releaseBuffer(b, dataSize, midUsage);
  releaseBuffer(buf2, dataSize, midUsage);
  releaseBuffer(buf4, dataSize, STORAGE_SRC);
  releaseBuffer(w1Buf, k1.byteLength, STORAGE_DST);
  releaseBuffer(w2Buf, k2.byteLength, STORAGE_DST);
  for (const b of [p1h, p1v, p2h, p2v]) releaseBuffer(b, 32, UNIFORM_DST);
  // Unsharp mask: clamp(blurred_small + (blurred_small - blurred_large))
  const out = createImg(w, h, c);
  for (let i = 0; i < r04.length; i++) {
    const v = r04[i]! + (r04[i]! - r2data[i]!);
    out.data[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return out;
}

// ── GPU Fused Distortion ────────────────────────────────────────────────────
// Chains ripple → roll → motion blur → N× displacement+fade in a single
// GPU command buffer. One upload, one readback — all intermediate data
// stays on GPU via ping-pong buffers.

async function gpuFusedDistortion(
  img: Img,
  sprayMap: Img,
  rippleRowDx: Float32Array,
  rippleColDy: Float32Array,
  rollDxVal: number,
  rollDyVal: number,
  motionKernelTaps: Float32Array,
  motionNumTaps: number,
  dispPasses: [number, number, number][]
): Promise<Img | null> {
  const dev = await getDevice();
  if (!dev) return null;
  const { w, h, c } = img;
  const totalPx = w * h;
  const dataSize = totalPx * c * 4;
  const wgCount = Math.ceil(totalPx / 256);
  const midUsage = STORAGE_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;

  // Ensure all pipelines are compiled
  if (!ripplePipeline)
    ripplePipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: RIPPLE_SHADER }), entryPoint: "main" },
    });
  if (!rollPipeline)
    rollPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: ROLL_SHADER }), entryPoint: "main" },
    });
  if (!convolvePipeline)
    convolvePipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: CONVOLVE_SHADER }), entryPoint: "main" },
    });
  if (!displaceFadePipeline)
    displaceFadePipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: DISPLACE_FADE_SHADER }), entryPoint: "main" },
    });

  // Two ping-pong data buffers — all intermediate results stay on GPU
  const bufA = acquireBuffer(dev, dataSize, midUsage);
  const bufB = acquireBuffer(dev, dataSize, midUsage);
  dev.queue.writeBuffer(bufA, 0, img.data as unknown as BufferSource);

  // Upload helper data
  const dxBuf = allocAndWrite(dev, rippleRowDx as unknown as BufferSource, STORAGE_DST);
  const dyBuf = allocAndWrite(dev, rippleColDy as unknown as BufferSource, STORAGE_DST);
  const tapsBuf = allocAndWrite(dev, motionKernelTaps as unknown as BufferSource, STORAGE_DST);
  const dmapSize = totalPx * sprayMap.c * 4;
  const dmapBuf = allocAndWrite(dev, sprayMap.data as unknown as BufferSource, STORAGE_DST);

  const encoder = dev.createCommandEncoder();
  let curIn = bufA,
    curOut = bufB;
  const swap = () => {
    const tmp = curIn;
    curIn = curOut;
    curOut = tmp;
  };

  // Pass 1: Ripple
  const rippleParams = allocAndWrite(dev, new Uint32Array([w, h, c, 0]), UNIFORM_DST);
  let pass = encoder.beginComputePass();
  pass.setPipeline(ripplePipeline);
  pass.setBindGroup(
    0,
    dev.createBindGroup({
      layout: ripplePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rippleParams } },
        { binding: 1, resource: { buffer: curIn } },
        { binding: 2, resource: { buffer: curOut } },
        { binding: 3, resource: { buffer: dxBuf } },
        { binding: 4, resource: { buffer: dyBuf } },
      ],
    })
  );
  pass.dispatchWorkgroups(wgCount);
  pass.end();
  swap();

  // Pass 2: Roll
  const rollParamData = new ArrayBuffer(32);
  new Uint32Array(rollParamData, 0, 4).set([w, h, c, 0]);
  new Int32Array(rollParamData, 16, 2).set([rollDxVal, rollDyVal]);
  const rollParams = allocAndWrite(dev, rollParamData, UNIFORM_DST);
  pass = encoder.beginComputePass();
  pass.setPipeline(rollPipeline);
  pass.setBindGroup(
    0,
    dev.createBindGroup({
      layout: rollPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rollParams } },
        { binding: 1, resource: { buffer: curIn } },
        { binding: 2, resource: { buffer: curOut } },
      ],
    })
  );
  pass.dispatchWorkgroups(wgCount);
  pass.end();
  swap();

  // Pass 3: Motion blur convolution
  const convolveParams = allocAndWrite(dev, new Uint32Array([w, h, c, motionNumTaps]), UNIFORM_DST);
  pass = encoder.beginComputePass();
  pass.setPipeline(convolvePipeline);
  pass.setBindGroup(
    0,
    dev.createBindGroup({
      layout: convolvePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: convolveParams } },
        { binding: 1, resource: { buffer: curIn } },
        { binding: 2, resource: { buffer: curOut } },
        { binding: 3, resource: { buffer: tapsBuf } },
      ],
    })
  );
  pass.dispatchWorkgroups(wgCount);
  pass.end();
  swap();

  // Passes 4+: displacement + fade (ping-pong)
  const dispParamBufs: GPUBuffer[] = [];
  for (let i = 0; i < dispPasses.length; i++) {
    const [hs, vs, fp] = dispPasses[i]!;
    const fadeA = fp / 100,
      fadeB = 1 - fadeA;
    const paramData = new ArrayBuffer(32);
    new Uint32Array(paramData, 0, 4).set([w, h, sprayMap.c, 0]);
    new Float32Array(paramData, 16, 4).set([hs, vs, fadeA, fadeB]);
    const pBuf = allocAndWrite(dev, paramData, UNIFORM_DST);
    dispParamBufs.push(pBuf);
    pass = encoder.beginComputePass();
    pass.setPipeline(displaceFadePipeline!);
    pass.setBindGroup(
      0,
      dev.createBindGroup({
        layout: displaceFadePipeline!.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: pBuf } },
          { binding: 1, resource: { buffer: curIn } },
          { binding: 2, resource: { buffer: curOut } },
          { binding: 3, resource: { buffer: dmapBuf } },
        ],
      })
    );
    pass.dispatchWorkgroups(wgCount);
    pass.end();
    swap();
  }

  dev.queue.submit([encoder.finish()]);
  const result = await readBackFloat32(dev, curIn, dataSize);

  // Cleanup
  releaseBuffer(bufA, dataSize, midUsage);
  releaseBuffer(bufB, dataSize, midUsage);
  releaseBuffer(dxBuf, rippleRowDx.byteLength, STORAGE_DST);
  releaseBuffer(dyBuf, rippleColDy.byteLength, STORAGE_DST);
  releaseBuffer(tapsBuf, motionKernelTaps.byteLength, STORAGE_DST);
  releaseBuffer(dmapBuf, dmapSize, STORAGE_DST);
  releaseBuffer(rippleParams, 16, UNIFORM_DST);
  releaseBuffer(rollParams, 32, UNIFORM_DST);
  releaseBuffer(convolveParams, 16, UNIFORM_DST);
  for (const pb of dispParamBufs) releaseBuffer(pb, 32, UNIFORM_DST);

  const out = createImg(w, h, c);
  out.data.set(result);
  return out;
}

// ── GPU Warm-up ─────────────────────────────────────────────────────────────
// Pre-compile all shader pipelines and run a tiny dispatch through each to
// trigger the driver's JIT. This way the first real frame doesn't stutter.

let warmedUp = false;

async function warmUpGpu(): Promise<void> {
  if (warmedUp) return;
  const dev = await getDevice();
  if (!dev) return;

  if (!convolvePipeline)
    convolvePipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: CONVOLVE_SHADER }), entryPoint: "main" },
    });
  if (!remapPipeline)
    remapPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: REMAP_SHADER }), entryPoint: "main" },
    });
  if (!morphPipeline)
    morphPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: MORPH_SHADER }), entryPoint: "main" },
    });
  if (!blur1dPipeline)
    blur1dPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: BLUR1D_SHADER }), entryPoint: "main" },
    });
  if (!grainPipeline)
    grainPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: GRAIN_SHADER }), entryPoint: "main" },
    });
  if (!ripplePipeline)
    ripplePipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: RIPPLE_SHADER }), entryPoint: "main" },
    });
  if (!rollPipeline)
    rollPipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: ROLL_SHADER }), entryPoint: "main" },
    });
  if (!displaceFadePipeline)
    displaceFadePipeline = dev.createComputePipeline({
      layout: "auto",
      compute: { module: dev.createShaderModule({ code: DISPLACE_FADE_SHADER }), entryPoint: "main" },
    });

  // Run a 1-pixel dispatch through key pipelines to trigger driver JIT
  const dummyBuf = dev.createBuffer({ size: 16, usage: STORAGE_DST | GPUBufferUsage.COPY_SRC });
  const dummyOut = dev.createBuffer({ size: 16, usage: STORAGE_SRC | GPUBufferUsage.STORAGE });
  const dummyUni = dev.createBuffer({ size: 32, usage: UNIFORM_DST });

  const encoder = dev.createCommandEncoder();

  // Warm convolve
  dev.queue.writeBuffer(dummyUni, 0, new Uint32Array([1, 1, 1, 1]));
  dev.queue.writeBuffer(dummyBuf, 0, new Float32Array([0, 0, 0, 1]));
  let p = encoder.beginComputePass();
  p.setPipeline(convolvePipeline);
  p.setBindGroup(
    0,
    dev.createBindGroup({
      layout: convolvePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: dummyUni } },
        { binding: 1, resource: { buffer: dummyBuf } },
        { binding: 2, resource: { buffer: dummyOut } },
        { binding: 3, resource: { buffer: dummyBuf } },
      ],
    })
  );
  p.dispatchWorkgroups(1);
  p.end();

  // Warm morph
  dev.queue.writeBuffer(dummyUni, 0, new Uint32Array([1, 1, 1, 0]));
  p = encoder.beginComputePass();
  p.setPipeline(morphPipeline);
  p.setBindGroup(
    0,
    dev.createBindGroup({
      layout: morphPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: dummyUni } },
        { binding: 1, resource: { buffer: dummyBuf } },
        { binding: 2, resource: { buffer: dummyOut } },
        { binding: 3, resource: { buffer: dummyBuf } },
      ],
    })
  );
  p.dispatchWorkgroups(1);
  p.end();

  dev.queue.submit([encoder.finish()]);
  await dev.queue.onSubmittedWorkDone();
  dummyBuf.destroy();
  dummyOut.destroy();
  dummyUni.destroy();
  warmedUp = true;
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6: Spray-paint parameters
// ════════════════════════════════════════════════════════════════════════════

export interface SprayParams {
  // ── Step 1: Initial distortion ──
  // Ripple warps the image with sine waves to simulate uneven spray application
  rippleAmount: number;
  rippleSize: "small" | "medium" | "large";
  // Roll shifts the entire image to offset the spray pattern
  rollDx: number;
  rollDy: number;
  // Motion blur simulates directional spray movement
  motionBlurAngle: number;
  motionBlurDistance: number;

  // ── Step 2: Displacement mapping ──
  // Multiple passes of displacement using the spray map texture.
  // Each pass is [horizontalScale, verticalScale, fadePercent].
  // Progressively warps the image to look like it was painted through a stencil.
  dispPasses: [number, number, number][];
  // How much to blend the displaced result back with the original
  displacedBlendPct: number;

  // ── Step 3: Coverage mask ──
  // Controls where paint appears vs. where the surface shows through.
  // Cloud noise + mezzotint create organic, uneven coverage.
  cloudsSeed: number;
  mezzSeed: number;
  coverageMezzBlend: number; // How much mezzotint texture to blend into the clouds
  coverageLevelsLo: number; // Black point for the coverage mask
  coverageLevelsHi: number; // White point for the coverage mask
  coverageMotionAngle: number; // Direction of coverage motion blur (matches spray angle)
  coverageMotionDist: number;
  slightOriginalPct: number; // How much original shows through in uncovered areas

  // ── Step 4: Edge speckles ──
  // Adds scattered dots near edges to simulate paint overspray
  edgeDilateSize: number;
  edgeBlurSigma: number;
  fineDotsContrast: number;
  fineDotsThreshold: number;
  fineDotsErodeSize: number;
  fineDotsRipple: number;
  largeDotsSeed1: number;
  largeDotsSeed2: number;
  largeDotsContrast: number;
  largeDotsDilateSize: number;
  largeDotsRipple: number;
  speckleDispScale: number;

  // ── Step 5: Paint grain ──
  // Simulates the granular texture of dried spray paint
  grainSeed: number;
  grainDarkFactor: number; // How dark the grain shadows are (0-1)

  // ── Step 6: Sharpening ──
  // Unsharp mask to recover detail lost in the blur/displacement steps
  sharpenSigma1: number;
  sharpenSigma2: number;

  // ── Input constraint ──
  maxDim: number; // Max width or height — images are scaled down to fit
}

/** Battle-tested default parameters that produce a convincing spray-paint look. */
export const DEFAULT_PARAMS: SprayParams = {
  rippleAmount: 14,
  rippleSize: "large",
  rollDx: 6,
  rollDy: 6,
  motionBlurAngle: -27,
  motionBlurDistance: 12,

  dispPasses: [
    [120, 120, 75],
    [120, -120, 75],
    [0, 120, 75],
    [120, 0, 75],
    [999, 999, 75],
    [-999, 999, 25],
  ],
  displacedBlendPct: 70,

  cloudsSeed: 42,
  mezzSeed: 99,
  coverageMezzBlend: 50,
  coverageLevelsLo: 8,
  coverageLevelsHi: 194,
  coverageMotionAngle: -27,
  coverageMotionDist: 6,
  slightOriginalPct: 90,

  edgeDilateSize: 51,
  edgeBlurSigma: 20,
  fineDotsContrast: 52,
  fineDotsThreshold: 128,
  fineDotsErodeSize: 3,
  fineDotsRipple: 150,
  largeDotsSeed1: 888,
  largeDotsSeed2: 999,
  largeDotsContrast: 50,
  largeDotsDilateSize: 13,
  largeDotsRipple: 150,
  speckleDispScale: 150,

  grainSeed: 555,
  grainDarkFactor: 0.85,

  sharpenSigma1: 0.4,
  sharpenSigma2: 2.0,

  maxDim: 1500,
};

// ════════════════════════════════════════════════════════════════════════════
// SECTION 7: The spray-paint pipeline
// ════════════════════════════════════════════════════════════════════════════
//
// Overview of the 6-step pipeline:
//
// 1. DISTORTION: ripple + roll + motion blur — warps the image to break up
//    its structure, simulating how spray paint doesn't land perfectly.
//
// 2. DISPLACEMENT: multiple passes of displacement mapping using a spray
//    texture (SprayMap). Each pass warps the image differently, then fades
//    the result back toward the original. This is the core of the effect.
//
// 3. COVERAGE: a procedural mask (cloud noise + mezzotint) controls where
//    paint appears. The mask is motion-blurred to match the spray direction.
//    Areas with low coverage show a faint version of the original image.
//
// 4. EDGE SPECKLES: Sobel edge detection finds paint boundaries, then
//    random dot patterns are masked to the edge zone and blended in.
//    This simulates paint overspray and uneven edges.
//
// 5. PAINT GRAIN: a random stipple pattern darkens pixels based on their
//    luminance, creating the grainy texture of dried spray paint.
//
// 6. SHARPEN: unsharp mask recovers detail lost in the displacement and
//    blur steps without introducing harsh artefacts.
//
// Steps 1-3 run on the main thread while step 4 (edge detection + dots)
// runs in parallel on a separate async branch, since it only needs the
// original image.

export interface StepTiming {
  label: string;
  durationMs: number;
}

export type ProgressCallback = (step: string, pct: number) => void;
export type DebugCallback = (label: string, img: Img, timing: StepTiming) => Promise<void> | void;

export interface SprayOptions {
  onProgress?: ProgressCallback;
  onDebugStep?: DebugCallback;
  /** URL to the spray displacement map PNG (defaults to "/SprayMap_composite.png") */
  sprayMapUrl?: string;
}

export interface SprayResult {
  img: Img;
  timings: StepTiming[];
  totalMs: number;
}

// Cache the raw spray map and the last resized version
let sprayMapRaw: Img | null = null;
let sprayMapResized: Img | null = null;
let sprayMapResizedKey = "";

/** Pre-load the spray displacement map so the first call to sprayAnything is faster. */
export async function preloadSprayMap(url = "/SprayMap_composite.png"): Promise<void> {
  if (!sprayMapRaw) sprayMapRaw = await loadImageFromUrl(url);
}

async function getResizedSprayMap(w: number, h: number, url: string): Promise<Img> {
  const key = `${w}x${h}`;
  if (sprayMapResized && sprayMapResizedKey === key) return sprayMapResized;
  if (!sprayMapRaw) sprayMapRaw = await loadImageFromUrl(url);
  sprayMapResized = resizeImg(sprayMapRaw, w, h);
  sprayMapResizedKey = key;
  return sprayMapResized;
}

/**
 * Apply the full spray-paint effect to an image.
 *
 * @param inputImg  Source image (RGB, Float32)
 * @param params    Effect parameters (use DEFAULT_PARAMS as a starting point)
 * @param options   Progress/debug callbacks and spray map URL
 * @returns         The sprayed image, step timings, and total duration
 */
export async function sprayAnything(
  inputImg: Img,
  params: SprayParams,
  options: SprayOptions = {}
): Promise<SprayResult> {
  const { onProgress = () => {}, onDebugStep, sprayMapUrl = "/SprayMap_composite.png" } = options;
  const timings: StepTiming[] = [];
  const totalStart = performance.now();
  const isDebug = !!onDebugStep;

  let stepStart = performance.now();
  const dbg = async (label: string, img: Img) => {
    const durationMs = performance.now() - stepStart;
    const timing: StepTiming = { label, durationMs };
    timings.push(timing);
    if (onDebugStep) await onDebugStep(label, img, timing);
    stepStart = performance.now();
  };

  // Cap input size to maxDim
  let img: Img;
  if (inputImg.w > params.maxDim || inputImg.h > params.maxDim) {
    const scale = params.maxDim / Math.max(inputImg.w, inputImg.h);
    const nw = Math.round(inputImg.w * scale);
    const nh = Math.round(inputImg.h * scale);
    img = resizeImg(inputImg, nw, nh);
  } else {
    img = cloneImg(inputImg);
  }

  const { w, h } = img;
  const n = w * h;
  onProgress("Loading spray map...", 0);

  // Warm up GPU pipelines before first real dispatch
  await warmUpGpu();

  const sprayMap = await getResizedSprayMap(w, h, sprayMapUrl);
  const original = cloneImg(img);

  await dbg("original", img);

  // ── PARALLEL BRANCH: edge detection + dot generation ──────────────────
  // These only need the original image, so they run concurrently with
  // the main distortion pipeline.
  const edgeBranchPromise = (async () => {
    const grayOrig = toGrayscale(original);
    const [edgeF, dots1Result, dots2Result] = await Promise.all([
      // Edge zone: Sobel → dilate → blur → normalise to [0, 1]
      (async () => {
        const grad = await sobel5x5(grayOrig);
        const edgeZone = await dilate(grad, params.edgeDilateSize);
        const edgeBlurred = await gaussianBlur(grayToRgb(edgeZone), params.edgeBlurSigma);
        const ef = toGrayscale(edgeBlurred);
        for (let i = 0; i < ef.data.length; i++) ef.data[i] /= 255;
        if (isDebug) await dbg("edge zone", edgeZone);
        return ef;
      })(),
      // Fine dots: random noise → threshold → erode → ripple
      (async () => {
        const rngDots = new SeededRNG(777);
        const fineDots = createImg(w, h, 1);
        for (let i = 0; i < n; i++) {
          fineDots.data[i] = clamp((rngDots.randint(256) * params.fineDotsContrast) / 100);
        }
        let d1 = threshold(fineDots, params.fineDotsThreshold);
        d1 = await erode(d1, params.fineDotsErodeSize);
        d1 = await ripple(d1, params.fineDotsRipple, "medium");
        if (isDebug) await dbg("fine dots", d1);
        return d1;
      })(),
      // Large dots: two random noise layers → threshold → OR → dilate → ripple
      (async () => {
        function makeDots(rng: SeededRNG): Img {
          const d = createImg(w, h, 1);
          for (let i = 0; i < n; i++) {
            d.data[i] = clamp(128 + ((rng.randint(256) - 128) * params.largeDotsContrast) / 100);
          }
          return threshold(d, 253);
        }
        const rngD2a = new SeededRNG(params.largeDotsSeed1);
        const rngD2b = new SeededRNG(params.largeDotsSeed2);
        let d2 = bitwiseOr(makeDots(rngD2a), makeDots(rngD2b));
        d2 = await dilate(d2, params.largeDotsDilateSize);
        d2 = await ripple(d2, params.largeDotsRipple, "medium");
        if (isDebug) await dbg("large dots", d2);
        return d2;
      })(),
    ]);
    return { edgeF, dots1: dots1Result, dots2: dots2Result };
  })();

  // ── MAIN PIPELINE ─────────────────────────────────────────────────────

  // Steps 1+2: Fused distortion (ripple → roll → motion blur → displacement)
  // All done in a single GPU command buffer when WebGPU is available.
  onProgress("Distortion + displacement...", 5);
  {
    const wl = { small: 8, medium: 18, large: 40 }[params.rippleSize];
    const rngRipple = new SeededRNG(123);
    const yJitter = new Float32Array(h);
    const xJitter = new Float32Array(w);
    for (let i = 0; i < h; i++) yJitter[i] = rngRipple.uniform(0.85, 1.15);
    for (let i = 0; i < w; i++) xJitter[i] = rngRipple.uniform(0.85, 1.15);
    const rowDx = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      rowDx[y] = params.rippleAmount * Math.sin((2 * Math.PI * y) / (wl * yJitter[y]!));
    }
    const colDy = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      colDy[x] = params.rippleAmount * Math.sin((2 * Math.PI * x) / (wl * xJitter[x]!));
    }

    const { kernel: motionKernel, ks } = buildMotionKernel(params.motionBlurAngle, params.motionBlurDistance);
    const khh = (ks - 1) >> 1;
    const tapsList: number[] = [];
    for (let ky = 0; ky < ks; ky++)
      for (let kx = 0; kx < ks; kx++) {
        const v = motionKernel[ky * ks + kx]!;
        if (v !== 0) tapsList.push(ky - khh, kx - khh, v);
      }

    const fusedResult = await gpuFusedDistortion(
      img,
      sprayMap,
      rowDx,
      colDy,
      params.rollDx,
      params.rollDy,
      new Float32Array(tapsList),
      tapsList.length / 3,
      params.dispPasses
    );
    if (fusedResult) {
      img = fusedResult;
    } else {
      // CPU fallback: run each step sequentially
      img = await ripple(img, params.rippleAmount, params.rippleSize);
      img = roll(img, params.rollDx, params.rollDy);
      img = await motionBlur(img, params.motionBlurAngle, params.motionBlurDistance);
      for (let i = 0; i < params.dispPasses.length; i++) {
        const [hs, vs, fp] = params.dispPasses[i]!;
        const pre = cloneImg(img);
        img = await displace(img, sprayMap, hs, vs);
        img = fade(pre, img, fp);
      }
    }
  }
  await dbg("distortion + displacement", img);

  // Blend displaced result with original
  onProgress("Blending displaced...", 45);
  img = fade(original, img, params.displacedBlendPct);
  const displaced = cloneImg(img);
  await dbg("blend displaced", img);

  // Step 3: Coverage mask
  onProgress("Coverage...", 50);
  const clouds = generateClouds(h, w, params.cloudsSeed);
  if (isDebug) await dbg("clouds", clouds);
  const rngMezz = new SeededRNG(params.mezzSeed);
  const mezz = mezzotint(clouds, rngMezz);
  if (isDebug) await dbg("mezzotint", mezz);
  let coverage: Img = fade(clouds, mezz, params.coverageMezzBlend);
  coverage = levels(coverage, params.coverageLevelsLo, params.coverageLevelsHi);
  coverage = await motionBlur(coverage, params.coverageMotionAngle, params.coverageMotionDist);
  if (isDebug) await dbg("coverage mask", coverage);
  const slightOriginal = fade(original, displaced, params.slightOriginalPct);
  const covOut = createImg(w, h, 3);
  for (let i = 0; i < n; i++) {
    const cf = coverage.data[i]! / 255;
    for (let ch = 0; ch < 3; ch++) {
      covOut.data[i * 3 + ch] = displaced.data[i * 3 + ch]! * cf + slightOriginal.data[i * 3 + ch]! * (1 - cf);
    }
  }
  img = covOut;
  if (isDebug) await dbg("coverage applied", img);

  // ── Wait for edge/dots branch ─────────────────────────────────────────
  const edgeStart = performance.now();
  const { edgeF, dots1, dots2 } = await edgeBranchPromise;
  timings.push({ label: "edge/dots wait", durationMs: performance.now() - edgeStart });
  stepStart = performance.now();

  // Step 4: Combine speckles into the image
  onProgress("Applying speckles...", 80);
  const allDots = maxImages(dots1, dots2);
  const speckleWeight = createImg(w, h, 1);
  for (let i = 0; i < n; i++) {
    speckleWeight.data[i] = Math.min(1, (allDots.data[i]! / 255) * edgeF.data[i]! * 2);
  }
  const heavyDisp = await displace(displaced, sprayMap, params.speckleDispScale, params.speckleDispScale);
  for (let i = 0; i < n; i++) {
    const sw = speckleWeight.data[i]!;
    for (let ch = 0; ch < 3; ch++) {
      img.data[i * 3 + ch] = heavyDisp.data[i * 3 + ch]! * sw + img.data[i * 3 + ch]! * (1 - sw);
    }
  }
  await dbg("speckles applied", img);

  // Step 5: Paint grain
  onProgress("Paint grain...", 85);
  const rngGrain = new SeededRNG(params.grainSeed);
  const rngValues = new Float32Array(n);
  for (let i = 0; i < n; i++) rngValues[i] = rngGrain.randint(256);
  const grainResult = await gpuPaintGrain(img, rngValues, params.grainDarkFactor);
  if (grainResult) {
    img = grainResult;
  } else {
    // CPU fallback
    const gray = toGrayscale(img);
    for (let i = 0; i < n; i++) {
      const mask = rngValues[i]! < gray.data[i]! ? 1 : 0;
      for (let ch = 0; ch < 3; ch++) {
        const v = img.data[i * 3 + ch]!;
        img.data[i * 3 + ch] = v * mask + v * params.grainDarkFactor * (1 - mask);
      }
    }
  }
  await dbg("paint grain", img);

  // Step 6: Sharpen (unsharp mask with two blur radii)
  onProgress("Sharpening...", 92);
  const sharpenResult = await gpuSharpen(img, params.sharpenSigma1, params.sharpenSigma2);
  if (sharpenResult) {
    img = sharpenResult;
  } else {
    // CPU fallback
    const blurred04 = await gaussianBlur(img, params.sharpenSigma1);
    const blurred2 = await gaussianBlur(blurred04, params.sharpenSigma2);
    for (let i = 0; i < blurred04.data.length; i++) {
      img.data[i] = clamp(blurred04.data[i]! + (blurred04.data[i]! - blurred2.data[i]!));
    }
  }
  await dbg("sharpen (final)", img);

  onProgress("Done!", 100);
  const totalMs = performance.now() - totalStart;
  flushBufferPool();
  return { img, timings, totalMs };
}
