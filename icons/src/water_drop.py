"""Generate a single cartoon water drop icon as SVG (same style as water_spray.py).

Usage:  python3 water_drop.py [out_dir]      (needs: pip install shapely)
Writes water_drop.svg with plain filled layers: outline, base, dark, light, shine.
"""
import math, os, sys
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from shapely import affinity

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
S, OUTLINE, PAD = 512, 15, 12
COL = dict(outline="#232647", dark="#1d6fe2", base="#2eaaff", light="#7fdcff", shine="#ffffff")

# teardrop: pointed tip on top, round belly at the bottom, slightly curved sides
pts = []
for i in range(240):
    t = 2 * math.pi * i / 240
    x = 1.0 * math.sin(t) * math.sin(t / 2) ** 0.9
    y = -math.cos(t)
    pts.append((x, y))
drop = affinity.scale(Polygon(pts).buffer(0.01), 150, 200, origin=(0, 0))
drop = affinity.translate(drop, 256, 256)
k = 150  # size used for the shading offsets
dark = drop.difference(affinity.translate(drop, -0.12 * k, -0.22 * k))
light = drop.difference(affinity.translate(drop, 0.08 * k, 0.14 * k)).difference(dark)
shine = unary_union([
    affinity.rotate(affinity.scale(Point(196, 300).buffer(26, quad_segs=16), 0.7, 1.35), 25, origin=(196, 300)),
    Point(184, 370).buffer(11, quad_segs=12),
    LineString([(232, 150), (212, 200)]).buffer(7, quad_segs=8),
]).intersection(drop)
outline = drop.buffer(OUTLINE / 1.3, quad_segs=16)   # the fit below scales by ~1.3, giving ~15px like the other icons

minx, miny, maxx, maxy = outline.bounds
sc = (S - 2 * PAD) / max(maxx - minx, maxy - miny)
ox = S / 2 - (minx + maxx) / 2 * sc; oy = S / 2 - (miny + maxy) / 2 * sc
fit = lambda g: affinity.affine_transform(g, [sc, 0, 0, sc, ox, oy]).simplify(0.25)

def path_d(geom):
    d = []
    for p in getattr(geom, "geoms", [geom]):
        if p.is_empty or p.geom_type != "Polygon":
            continue
        for ring in [p.exterior, *p.interiors]:
            d.append("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in list(ring.coords)[:-1]) + " Z")
    return " ".join(d)

layers = [("outline", outline), ("base", drop), ("dark", dark), ("light", light), ("shine", shine)]
body = "".join(f'<path id="{n}" d="{path_d(fit(g))}" fill="{COL[n]}" fill-rule="evenodd"/>' for n, g in layers)
path = os.path.join(OUT, "water_drop.svg")
open(path, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
                      f'<title>Water drop</title>{body}</svg>\n')
print("wrote", path)
