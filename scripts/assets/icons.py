"""Turn the side-view render from scripts/assets/model-side.mjs into the site icons:
app/icon.svg (vector, traced from the real model), app/favicon.ico and
app/apple-icon.png (rasterised from the same render)."""
import json
import os
import tempfile
import numpy as np
from PIL import Image
from shapely.geometry import box, Polygon, MultiPolygon
from shapely.ops import unary_union

HERE = tempfile.gettempdir()  # where model-side.mjs left its render
APP = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "app")
meta = json.load(open(os.path.join(HERE, "side.json")))
W, H = meta["W"], meta["H"]
L = np.fromfile(os.path.join(HERE, "side.labels"), dtype=np.uint8).reshape(H, W)

TILE = "#151311"
COLORS = {  # class index -> fill
    1: "#E9401E",  # body: IJEOMA's measured orange
    2: "#24252a",  # glass
    3: "#2c2825",  # black trim
    4: "#26221f",  # tyre
    5: "#b3ada6",  # rims
    6: "#d6d1ca",  # chrome
    7: "#f2eee6",  # headlamp
    8: "#c22a1c",  # tail lamp
    9: "#77736e",  # brakes
}

# Icon geometry: 64-unit tile, the car 58 units long, centred.
TILE_SIZE, CAR_W = 64.0, 61.0
k = CAR_W / W
car_h = H * k
ox, oy = (TILE_SIZE - CAR_W) / 2, (TILE_SIZE - car_h) / 2 + 1.5  # a touch low reads as "on the ground"


def mask_polygons(mask):
    rects = []
    for y in range(H):
        row = mask[y]
        if not row.any():
            continue
        d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
        starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
        rects += [box(s, y, e, y + 1) for s, e in zip(starts, ends)]
    return unary_union(rects) if rects else None


def to_path(geom, min_area, holes=True):
    # Close hairline gaps (1 px panel seams) and smooth pixel steps before simplifying.
    geom = geom.buffer(2, join_style=2).buffer(-2, join_style=2)
    polys = [geom] if isinstance(geom, Polygon) else list(geom.geoms) if isinstance(geom, MultiPolygon) else []
    out = []
    for p in polys:
        if p.area < min_area:
            continue
        p = p.simplify(3.5, preserve_topology=True)
        keep = [r for r in p.interiors if holes and Polygon(r).area >= min_area * 2]
        for ring in [p.exterior, *keep]:
            pts = [(ox + x * k, oy + y * k) for x, y in ring.coords[:-1]]
            if len(pts) < 3:
                continue
            out.append("M" + "L".join(f"{x:.1f},{y:.1f}".replace(".0,", ",") for x, y in pts) + "Z")
    return "".join(out)


parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="{TILE}"/>']
# Base silhouette in trim colour so simplified neighbours never show slivers of tile between them.
whole = mask_polygons(L > 0)
parts.append(f'<path fill="{COLORS[3]}" fill-rule="evenodd" d="{to_path(whole, 400, holes=False)}"/>')
for cls in (1, 2, 4, 5, 9, 6, 7, 8):
    g = mask_polygons(L == cls)
    if g is None:
        continue
    d = to_path(g, 400 if cls in (1, 2, 4, 5) else 150)
    if d:
        parts.append(f'<path fill="{COLORS[cls]}" fill-rule="evenodd" d="{d}"/>')
parts.append("</svg>")
svg = "".join(parts)
open(os.path.join(APP, "icon.svg"), "w", encoding="utf8").write(svg)
print("icon.svg", len(svg), "bytes")


# Rasters straight from the render (supersampled), matching the SVG layout.
def raster(size, rounded=True):
    S = 8
    big = size * S
    tile = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    from PIL import ImageDraw
    d = ImageDraw.Draw(tile)
    if rounded:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=14 / 64 * big, fill=TILE)
    else:
        d.rectangle([0, 0, big, big], fill=TILE)
    rgba = np.zeros((H, W, 4), np.uint8)
    for cls, hexc in {**COLORS}.items():
        c = tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5))
        rgba[L == cls] = (*c, 255)
    car = Image.fromarray(rgba)
    cw = round(CAR_W / 64 * big)
    ch = round(car_h / 64 * big)
    car = car.resize((cw, ch), Image.LANCZOS)
    tile.alpha_composite(car, (round(ox / 64 * big), round(oy / 64 * big)))
    return tile.resize((size, size), Image.LANCZOS)


raster(180, rounded=False).save(os.path.join(APP, "apple-icon.png"))
raster(256).save(os.path.join(APP, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
prev = raster(256)
sheet = Image.new("RGBA", (256 + 16 + 32 + 48 + 64 + 40, 256), (60, 60, 60, 255))
sheet.paste(prev, (0, 0))
x = 266
for s in (16, 32, 48, 64):
    sheet.paste(prev.resize((s, s), Image.LANCZOS), (x, 10))
    x += s + 10
sheet.save(os.path.join(HERE, "icon_sheet.png"))  # preview, in the temp folder
print("done")
