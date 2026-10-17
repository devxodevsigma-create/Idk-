"""Generate a cartoon water spray icon as SVG (same navy outline as the other icons).

Usage:  python3 water_spray.py [out_dir]      (needs: pip install shapely)
Writes water_spray.svg (horizontal, nozzle end on the left) and
water_spray_tilted.svg (tilted 14 degrees up to line up with the water gun icons).

Everything is built with shapely and written as plain filled paths in separate
layers (outline, water, shadow, light, shine), so the SVG stays easy to edit.
"""
import math, os, sys
import numpy as np
from shapely.geometry import Point, LineString, Polygon
from shapely.ops import unary_union
from shapely import affinity

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
S = 512
OUTLINE = 15                 # visible outline thickness (matches the other icons)
PAD = 12
COL = dict(outline="#232647", dark="#1d6fe2", base="#2eaaff", light="#7fdcff", shine="#ffffff")

# ---------- shapes (drawn in a 512 box, nozzle on the left, spray going right) ----------
def stream():
    x0, x1, cy = 22.0, 286.0, 256.0
    xs = np.linspace(x0, x1, 90)
    h = 17 + 15 * ((xs - x0) / (x1 - x0)) ** 1.4
    top = [(x, cy - hh - 3.5 * math.sin(x / 19)) for x, hh in zip(xs, h)]
    bot = [(x, cy + hh + 3.5 * math.sin((x + 11) / 19)) for x, hh in zip(xs, h)]
    body = Polygon(top + bot[::-1]).buffer(3, quad_segs=8)
    # splashy front: a big lobe with two smaller lobes peeling off up and down
    lobes = [Point(x1, cy).buffer(36, quad_segs=24),
             Point(x1 + 20, cy - 30).buffer(22, quad_segs=24),
             Point(x1 + 20, cy + 30).buffer(22, quad_segs=24),
             Point(x1 + 34, cy).buffer(24, quad_segs=24)]
    return unary_union([body] + lobes)

FOCUS = (250.0, 256.0)       # droplets fly away from here
def droplet(cx, cy, r, stretch=1.9):
    d = np.array([cx - FOCUS[0], cy - FOCUS[1]]); d = d / np.linalg.norm(d)
    tip = Point(cx - d[0] * r * stretch, cy - d[1] * r * stretch)
    return unary_union([Point(cx, cy).buffer(r, quad_segs=24), tip]).convex_hull

DROPS = [  # (x, y, radius) -- spaced so each drop keeps its own outline
    (420, 256, 27), (372, 160, 21), (372, 352, 21),
    (462, 196, 15), (462, 316, 15), (300, 166, 11), (300, 346, 11),
    (432, 108, 10), (432, 404, 10), (504, 262, 9),
]

def build(angle=0.0):
    shapes = [stream()] + [droplet(*d) for d in DROPS]
    if angle:
        shapes = [affinity.rotate(s, angle, origin=(256, 256)) for s in shapes]
    U = unary_union(shapes)
    outline = U.buffer(OUTLINE, quad_segs=16)
    # cel shading per shape: dark crescent bottom-right, light crescent top-left,
    # sized to each shape so small drops are not swallowed by shadow
    sizes = [34.0] + [r for _, _, r in DROPS]
    dark = unary_union([s.difference(affinity.translate(s, -0.12 * k, -0.30 * k))
                        for s, k in zip(shapes, sizes)]).intersection(U)
    light = unary_union([s.difference(affinity.translate(s, 0.08 * k, 0.22 * k))
                         for s, k in zip(shapes, sizes)]).intersection(U).difference(dark)
    # shine: streaks along the top of the stream, glints on the bigger drops, a few bubbles
    shine = [LineString([(62, 245), (178, 240)]).buffer(4.5, quad_segs=8),
             LineString([(194, 238), (226, 235)]).buffer(4.5, quad_segs=8),
             LineString([(262, 228), (280, 223), (296, 223)]).buffer(5, quad_segs=8),
             Point(140, 266).buffer(4.5), Point(222, 272).buffer(5.5), Point(300, 270).buffer(7),
             Point(316, 226).buffer(4.5)]
    for x, y, r in DROPS:
        if r >= 18:
            shine.append(affinity.scale(Point(x - 0.32 * r, y - 0.36 * r).buffer(0.26 * r, quad_segs=12), 1.3, 0.8))
    shine = unary_union(shine)
    if angle:
        shine = affinity.rotate(shine, angle, origin=(256, 256))
    shine = shine.intersection(U)
    # fit everything (including the outline) into the canvas
    minx, miny, maxx, maxy = outline.bounds
    sc = (S - 2 * PAD) / max(maxx - minx, maxy - miny)
    ox = S / 2 - (minx + maxx) / 2 * sc; oy = S / 2 - (miny + maxy) / 2 * sc
    fit = lambda g: affinity.affine_transform(g, [sc, 0, 0, sc, ox, oy])
    return [(name, fit(g).simplify(0.25)) for name, g in
            (("outline", outline), ("base", U), ("dark", dark), ("light", light), ("shine", shine))]

def path_d(geom):
    polys = getattr(geom, "geoms", [geom])
    d = []
    for p in polys:
        if p.is_empty or p.geom_type != "Polygon":
            continue
        for ring in [p.exterior, *p.interiors]:
            c = list(ring.coords)[:-1]
            d.append("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in c) + " Z")
    return " ".join(d)

def svg(layers):
    body = "".join(f'<path id="{n}" d="{path_d(g)}" fill="{COL[n]}" fill-rule="evenodd"/>' for n, g in layers)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
            f'<title>Water spray</title>{body}</svg>\n')

for name, angle in (("water_spray", 0.0), ("water_spray_tilted", -14.0)):
    path = os.path.join(OUT, f"{name}.svg")
    open(path, "w").write(svg(build(angle)))
    print("wrote", path)
