"""Cartoon water jet + splash geometry shared by water_spray.py and banner.py (needs shapely).

make_spray(p0, p1, ...) builds a smooth arcing jet from p0 (nozzle) to p1 (impact)
that widens as it travels and bursts into a splash of round droplets.
It returns plain-polygon layers: outline, base, dark, light, shine.
"""
import math
import numpy as np
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union
from shapely import affinity

COL = dict(outline="#232647", base="#2eaaff", dark="#1d6fe2", light="#86e0ff", shine="#ffffff")

def _bezier(p0, c, p1, n=80):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t ** 2 * p1, t[:, 0]

def _teardrop(center, r, toward, stretch=1.7):
    d = np.array(center) - np.array(toward); d = d / np.linalg.norm(d)
    tip = Point(*(np.array(center) - d * r * stretch))
    return unary_union([Point(*center).buffer(r, quad_segs=20), tip]).convex_hull

def make_spray(p0, p1, w0, w1, bend=0.12, outline=15, seed=3, splash=1.0):
    """p0 nozzle, p1 impact (canvas px, y down); w0/w1 jet width at each end;
    bend: how much the jet arcs upward (fraction of its length)."""
    rng = np.random.default_rng(seed)
    p0, p1 = np.array(p0, float), np.array(p1, float)
    L = np.linalg.norm(p1 - p0); d = (p1 - p0) / L
    nrm = np.array([d[1], -d[0]])                       # left normal (points up for a rightward jet)
    if nrm[1] > 0: nrm = -nrm                           # always arc upward on screen
    c = (p0 + p1) / 2 + nrm * bend * L
    C, t = _bezier(p0, c, p1)
    tang = np.gradient(C, axis=0); tang /= np.linalg.norm(tang, axis=1)[:, None]
    side = np.stack([tang[:, 1], -tang[:, 0]], axis=1)
    side[side[:, 1] > 0] *= -1                          # side = "up" normal along the jet
    w = w0 + (w1 - w0) * t ** 1.3
    ripple = 0.06 * w * np.sin(t * 9 * math.pi) * t     # gentle ripple that grows downstream
    top = C + side * (w / 2 + ripple)[:, None]
    bot = C - side * (w / 2 - ripple)[:, None]
    jet = Polygon(np.vstack([top, bot[::-1]])).buffer(1.5, quad_segs=6)

    # splash: a splat with pointed lobes at the impact, plus big drops flung back and sideways
    k = w1 * splash
    back = math.atan2(-d[1], -d[0])                     # direction the water came from
    lobes = []
    for a in (-2.2, -1.25, -0.45, 0.45, 1.25, 2.2):
        ang = back + a
        tipp = p1 + 1.15 * k * np.array([math.cos(ang), math.sin(ang)])
        base = p1 + 0.25 * k * np.array([math.cos(ang), math.sin(ang)])
        lobes.append(unary_union([Point(*base).buffer(0.34 * k, quad_segs=16), Point(*tipp)]).convex_hull)
        lobes.append(Point(*(p1 + 0.95 * k * np.array([math.cos(ang), math.sin(ang)]))).buffer(0.16 * k, quad_segs=12))
    blob = unary_union([Point(*p1).buffer(0.55 * k, quad_segs=24)] + lobes)
    drops = []
    for i, a in enumerate((-2.0, -1.0, 1.0, 2.0)):
        ang = back + a + rng.uniform(-0.12, 0.12)
        dist = k * (1.95 + 0.25 * (i % 2))
        r = k * (0.27 if i in (1, 2) else 0.21)
        cpos = p1 + dist * np.array([math.cos(ang), math.sin(ang)])
        drops.append(_teardrop(tuple(cpos), r, tuple(p1), stretch=1.9))
    mist = []
    i = int(0.62 * (len(C) - 1))
    mist.append(Point(*(C[i] + side[i] * (w[i] / 2 + 0.6 * w1))).buffer(0.16 * w1, quad_segs=12))

    shapes = [unary_union([jet, blob])] + drops + mist
    U = unary_union(shapes)
    sizes = [w1 * 0.7] + [k * 0.25] * len(drops) + [0.16 * w1] * len(mist)
    dark = unary_union([s.difference(affinity.translate(s, -0.10 * z, -0.32 * z))
                        for s, z in zip(shapes, sizes)]).intersection(U)
    light = unary_union([s.difference(affinity.translate(s, 0.06 * z, 0.22 * z))
                         for s, z in zip(shapes, sizes)]).intersection(U).difference(dark)
    # shine: two streaks riding the top of the jet + glints on the bigger drops
    def streak(a, b, off, width):
        ia, ib = int(a * (len(C) - 1)), int(b * (len(C) - 1))
        line = [tuple(C[j] + side[j] * (w[j] / 2) * off) for j in range(ia, ib + 1)]
        return LineString(line).buffer(width, quad_segs=8)
    shine = [streak(0.06, 0.48, 0.45, max(3, w0 * 0.16)), streak(0.56, 0.74, 0.42, max(3, w0 * 0.16))]
    for dr in drops:
        cx, cy = dr.centroid.x, dr.centroid.y
        rr = math.sqrt(dr.area / math.pi)
        if rr > 9:
            shine.append(Point(cx - 0.3 * rr, cy - 0.32 * rr).buffer(0.22 * rr, quad_segs=10))
    shine.append(Point(*(p1 + np.array([-0.18, -0.22]) * k)).buffer(0.12 * k, quad_segs=12))
    shine = unary_union(shine).intersection(U)
    return [("outline", U.buffer(outline, quad_segs=16)), ("base", U), ("dark", dark),
            ("light", light), ("shine", shine)]

def path_d(geom):
    d = []
    for p in getattr(geom, "geoms", [geom]):
        if p.is_empty or p.geom_type != "Polygon":
            continue
        for ring in [p.exterior, *p.interiors]:
            d.append("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in list(ring.coords)[:-1]) + " Z")
    return " ".join(d)

def layers_svg(layers, prefix="water", simplify=0.3):
    return "".join(f'<path id="{prefix}-{n}" d="{path_d(g.simplify(simplify))}" fill="{COL[n]}" '
                   f'fill-rule="evenodd"/>' for n, g in layers)
