import * as THREE from "three";

// IJEOMA's paint measures #e9401e (median of 63k car pixels across 8 public
// reels and 3 photos). The 3D base is a touch deeper because lighting adds
// white; with the shared look the render measures close to #e9401e.
export const IJEOMA_ORANGE = 0xe0300a;

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string) {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}

function stickerCanvas(aspect: number) {
  const W = 1024;
  const H = Math.max(96, Math.round(W / aspect));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, ctx: c.getContext("2d")!, W, H, tex };
}

// Draws a logo as large as fits in the box, centred.
function drawContained(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height);
  ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s);
}

/** One logo as a transparent sticker. `aspect` is the decal's width / height. */
export function logoTexture(url: string, aspect = 2) {
  const { ctx, W, H, tex } = stickerCanvas(aspect);
  loadImage(url)
    .then((img) => {
      drawContained(ctx, img, 0, 0, W, H);
      tex.needsUpdate = true;
    })
    .catch(() => {});
  return tex;
}

// Where the vinyl on the car differs from a sponsor's full logo, as in the
// photos: Wraphaus wears just its wordmark.
const DECAL_ART: Record<string, string> = {
  "/sponsors/wraphaus.webp": "/sponsors/wraphaus-wordmark.webp",
};

// Panel artwork for the decals on the car: each sponsor's logo, stacked if a
// panel has several, or its name in heavy white type when there's no logo.
// A panel with no sponsor gets only a thin outline, shown when it's
// selected. `aspect` is the decal's width / height.
export function panelTexture(sponsors: { name: string; logo_url: string | null }[], aspect = 2) {
  const { ctx, W, H, tex } = stickerCanvas(aspect);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const font = (size: number) => `900 ${size}px "Arial Black", "Helvetica Neue", system-ui, sans-serif`;
  const lines = sponsors.length;
  if (!lines) {
    const inset = Math.max(10, H * 0.05);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(6, H * 0.03);
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    return tex;
  }
  const slot = H / lines;
  sponsors.forEach(({ name, logo_url }, i) => {
    if (logo_url) {
      loadImage(DECAL_ART[logo_url] ?? logo_url)
        .then((img) => {
          drawContained(ctx, img, 0, slot * i, W, slot);
          tex.needsUpdate = true;
        })
        .catch(() => {});
      return;
    }
    let size = slot * 0.78;
    ctx.font = font(size);
    while (size > 10 && ctx.measureText(name).width > W * 0.92) ctx.font = font((size -= 4));
    const y = slot * i + slot * 0.54;
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.06);
    ctx.strokeStyle = "rgba(20,12,8,0.45)";
    ctx.strokeText(name, W / 2, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(name, W / 2, y);
  });
  return tex;
}
