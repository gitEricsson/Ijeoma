import * as THREE from "three";

// IJEOMA's paint measures #e9401e (median of 63k car pixels across 8 public
// reels and 3 photos). The 3D base is a touch deeper because lighting adds
// white; with the shared look the render measures close to #e9401e.
export const IJEOMA_ORANGE = 0xe0300a;

// Panel artwork for the decals on the car: a transparent sticker with heavy
// white type, one line per sponsor. A panel with no sponsor gets only a thin
// outline, shown when it's selected. `aspect` is the decal's width / height.
export function panelTexture(names: string[], aspect = 2) {
  const W = 1024;
  const H = Math.max(96, Math.round(W / aspect));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const font = (size: number) => `900 ${size}px "Arial Black", "Helvetica Neue", system-ui, sans-serif`;
  const lines = names.length;
  if (!lines) {
    const inset = Math.max(10, H * 0.05);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(6, H * 0.03);
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  } else {
    const slot = H / lines;
    for (let i = 0; i < lines; i++) {
      let size = slot * 0.78;
      ctx.font = font(size);
      while (size > 10 && ctx.measureText(names[i]).width > W * 0.92) ctx.font = font((size -= 4));
      const y = slot * i + slot * 0.54;
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(3, size * 0.06);
      ctx.strokeStyle = "rgba(20,12,8,0.45)";
      ctx.strokeText(names[i], W / 2, y);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(names[i], W / 2, y);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
