"""Generate a chunky low-poly paint roller icon as SVG.

Usage (the four shipped variants):
  python3 paint_roller.py '{"out": "paint_roller_1.svg"}'
  python3 paint_roller.py '{"out": "paint_roller_2.svg", "roll": 25}'
  python3 paint_roller.py '{"out": "paint_roller_3.svg", "roll": -30}'
  python3 paint_roller.py '{"out": "paint_roller_4.svg", "mirror": true, "roll": -25}'
Add "outline": 0 for a version without the navy stroke.

Builds a small 3D model (octagonal prisms + a swept wire), projects it
orthographically, flat-shades each face with 3-tone ramps,
and wraps the silhouette in a thick navy stroke.
"""
import math, sys, json
import numpy as np

P = dict(
    cam=(0.42, 0.38, 1.0),     # direction toward camera
    light=(-0.35, 1.0, 0.75),
    roll=0.0,                   # 2D rotation (deg, clockwise)
    mirror=False,
    size=512,
    pad=34,
    outline=30,                 # stroke width of the under-layer (visible ~= half)
    outline_color="#232647",
    studs=False,
    stud_off=1.4,
    stud_gap=0.032,
    cover_studs=(6, 2),
    handle_studs=(9, 1),
    grout=0.28,
    out="paint_roller.svg",
)
if len(sys.argv) > 1:
    P.update(json.loads(sys.argv[1]))

def V(*a): return np.array(a, dtype=float)
def norm(v): return v / np.linalg.norm(v)

# ---------- materials: (light, mid, dark) ----------
MAT = {
    "cover":  ("#ffffff", "#e7ebf4", "#aab3c7"),
    "ring":   ("#d3d9e3", "#a8b0bf", "#7a8396"),
    "hole":   ("#8f98aa", "#737c90", "#5b6378"),
    "core":   ("#7491ff", "#3d5ee8", "#2237a6"),
    "metal":  ("#eef1f6", "#bcc3cf", "#7f889a"),
    "handle": ("#7190ff", "#3b5ce8", "#21369f"),
}

def hex2rgb(h): return np.array([int(h[i:i+2], 16) for i in (1, 3, 5)], float)
def rgb2hex(c): return "#" + "".join(f"{int(round(max(0, min(255, x)))):02x}" for x in c)
def mix(a, b, t): return a + (b - a) * t

def tone(mat, t):
    lt, md, dk = (hex2rgb(x) for x in MAT[mat])
    t = max(0.0, min(1.0, t))
    return mix(dk, md, t / 0.55) if t < 0.55 else mix(md, lt, (t - 0.55) / 0.45)

# ---------- geometry helpers ----------
N_SIDES = 8

def ring_pts(center, axis, radius, n=N_SIDES, phase=math.pi / 8, ref=None):
    axis = norm(axis)
    if ref is None:
        ref = V(0, 1, 0) if abs(axis[1]) < 0.9 else V(0, 0, 1)
    u = norm(np.cross(axis, ref)); w = np.cross(axis, u)
    return [center + radius * (math.cos(phase + k * 2 * math.pi / n) * u +
                               math.sin(phase + k * 2 * math.pi / n) * w) for k in range(n)]

parts = []  # each part: list of faces; face = dict(pts, mat, studs, kind)

def prism(c0, c1, r0, r1, mat, studs=None, caps=(True, True), ref=None):
    axis = c1 - c0
    a = ring_pts(c0, axis, r0, ref=ref); b = ring_pts(c1, axis, r1, ref=ref)
    faces = []
    for k in range(N_SIDES):
        k2 = (k + 1) % N_SIDES
        faces.append(dict(pts=[a[k], a[k2], b[k2], b[k]], mat=mat, studs=studs))
    if caps[0]: faces.append(dict(pts=a[::-1], mat=mat))
    if caps[1]: faces.append(dict(pts=b, mat=mat))
    return faces

def tube(path, r, mat, ref):
    """Sweep an octagon along a polyline; returns one part per segment."""
    rings = []
    for i, p in enumerate(path):
        if i == 0: t = path[1] - path[0]
        elif i == len(path) - 1: t = path[-1] - path[-2]
        else: t = norm(path[i + 1] - path[i]) + norm(path[i] - path[i - 1])
        rings.append(ring_pts(p, t, r, ref=ref))
    segs = []
    for i in range(len(path) - 1):
        a, b = rings[i], rings[i + 1]
        f = [dict(pts=[a[k], a[(k + 1) % 8], b[(k + 1) % 8], b[k]], mat=mat) for k in range(8)]
        if i == len(path) - 2: f.append(dict(pts=b, mat=mat))
        segs.append(f)
    return segs

# ---------- the model (handle hangs from the roller's +X end) ----------
Rc, L = 0.64, 2.25
cover = prism(V(-L, 0, 0), V(0, 0, 0), Rc, Rc, "cover", studs=tuple(P["cover_studs"]), ref=V(0, 0, 1))
parts.append(("cover", cover))

# end-cap details on the +X face: cardboard ring, recessed hole, blue plug
end_details = []
eps = 0.004
end_details.append(dict(pts=ring_pts(V(eps, 0, 0), V(1, 0, 0), 0.43, ref=V(0, 0, 1)), mat="ring", flat=True))
end_details.append(dict(pts=ring_pts(V(2 * eps, 0, 0), V(1, 0, 0), 0.33, ref=V(0, 0, 1)), mat="hole", flat=True))
parts.append(("enddetail", end_details))
plug = prism(V(-0.02, 0, 0), V(0.07, 0, 0), 0.25, 0.25, "core", ref=V(0, 0, 1))
parts.append(("plug", plug))

# wire: out of the plug, quarter bend, then down to the ferrule
rw, rb, x0 = 0.085, 0.42, 0.14
path = [V(0.05, 0, 0), V(x0, 0, 0)]
for k in range(1, 7):
    ph = k / 6 * math.pi / 2
    path.append(V(x0 + rb * math.sin(ph), -rb * (1 - math.cos(ph)), 0))
hx = x0 + rb
path.append(V(hx, -rb - 0.32, 0))
for seg in tube(path, rw, "metal", ref=V(0, 0, 1)):
    parts.append(("wire", seg))

y = -rb - 0.32
parts.append(("ferrule_cone", prism(V(hx, y, 0), V(hx, y - 0.30, 0), 0.10, 0.205, "metal", ref=V(0, 0, 1))))
y -= 0.30
parts.append(("ferrule", prism(V(hx, y, 0), V(hx, y - 0.20, 0), 0.215, 0.215, "metal", studs=(1, 1), ref=V(0, 0, 1))))
y -= 0.20
HL = 2.2
parts.append(("handle", prism(V(hx, y, 0), V(hx, y - HL, 0), 0.19, 0.19, "handle", studs=tuple(P["handle_studs"]), ref=V(0, 0, 1))))
y -= HL
parts.append(("cap", prism(V(hx, y, 0), V(hx, y - 0.14, 0), 0.205, 0.205, "metal", ref=V(0, 0, 1))))
y -= 0.14
parts.append(("cap2", prism(V(hx, y, 0), V(hx, y - 0.07, 0), 0.205, 0.15, "metal", ref=V(0, 0, 1))))

# ---------- camera ----------
f = norm(V(*P["cam"]))
if P["mirror"]:
    f = V(-f[0], f[1], f[2])
r = norm(np.cross(V(0, 1, 0), f)); u = np.cross(f, r)
Ld = norm(V(*P["light"]))
Lf = norm(V(1.0, 0.25, 0.35))
th = math.radians(P["roll"])
cr, sr = math.cos(th), math.sin(th)

def proj(p):
    x, y_ = float(p @ r), float(-(p @ u))
    if P["mirror"]: x = -x
    return (x * cr - y_ * sr, x * sr + y_ * cr)

def face_normal(pts):
    n = np.zeros(3)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n += np.cross(a, b)
    return norm(n)

# ---------- collect drawable polygons ----------
draw = []  # (depth, order, fill, poly2d, extra)
for pi, (name, faces) in enumerate(parts):
    pdepth = np.mean([float(np.mean(fc["pts"], axis=0) @ f) for fc in faces])
    for fi, fc in enumerate(faces):
        n = face_normal(fc["pts"])
        if not fc.get("flat") and n @ f <= 1e-6:
            continue
        if fc.get("flat"):
            n = V(1, 0, 0)
        t = 0.32 + 0.68 * max(0.0, float(n @ Ld))
        col = tone(fc["mat"], t)
        draw.append(dict(part=pi, pdepth=pdepth, fi=fi, col=col, pts=fc["pts"],
                         studs=fc.get("studs"), name=name, mat=fc["mat"]))

# part draw order: by depth, but end-cap details must follow the cover and
# the plug/wire must follow the details.
order_override = {"cover": 0, "enddetail": 1, "plug": 2}
def part_key(d):
    if d["name"] in order_override:
        return (0, order_override[d["name"]])
    return (1, d["pdepth"])
draw.sort(key=lambda d: (part_key(d), d["fi"]))

# ---------- fit to canvas ----------
all2d = [proj(p) for d in draw for p in d["pts"]]
xs, ys = [a for a, _ in all2d], [b for _, b in all2d]
w, h = max(xs) - min(xs), max(ys) - min(ys)
S = P["size"]; pad = P["pad"]
sc = (S - 2 * pad) / max(w, h)
ox = S / 2 - (min(xs) + w / 2) * sc
oy = S / 2 - (min(ys) + h / 2) * sc
def to_px(p):
    x, y_ = proj(p)
    return (ox + x * sc, oy + y_ * sc)

def poly_str(pts2):
    return " ".join(f"{x:.1f},{y_:.1f}" for x, y_ in pts2)

# ---------- studs ----------
def studs_for(d):
    if not P["studs"] or not d["studs"]:
        return []
    nu, nv = d["studs"]
    a, b, c, e = d["pts"]  # a->b around, b->c along axis
    out = []
    gap = P["stud_gap"]          # world-space margin, same on both axes
    lu = np.linalg.norm(b - a) / nv; lv = np.linalg.norm(e - a) / nu
    mu, mv = min(0.3, gap / lu), min(0.3, gap / lv)
    for i in range(nv):          # across the face (a->b direction)
        for j in range(nu):      # along the axis (a->e direction)
            def at(s, t):
                return a + (b - a) * s + (e - a) * t
            s0, s1 = (i + mu) / nv, (i + 1 - mu) / nv
            t0, t1 = (j + mv) / nu, (j + 1 - mv) / nu
            q = [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)]
            out.append([to_px(p) for p in q])
    return out

svg_faces, svg_studs, sil = [], [], []
for d in draw:
    pts2 = [to_px(p) for p in d["pts"]]
    fill = rgb2hex(d["col"])
    if P["studs"] and d["studs"]:
        fill = rgb2hex(mix(d["col"], hex2rgb(MAT[d["mat"]][2]), P["grout"]))
    sil.append(poly_str(pts2))
    svg_faces.append(f'<polygon points="{poly_str(pts2)}" fill="{fill}" stroke="{fill}"/>')
    for q in studs_for(d):
        top = rgb2hex(mix(d["col"], np.array([255, 255, 255.]), 0.06))
        hi = rgb2hex(mix(d["col"], np.array([255, 255, 255.]), 0.55))
        sh = rgb2hex(mix(d["col"], hex2rgb(MAT[d["mat"]][2]) * 0.85, 0.55))
        o = P["stud_off"]
        svg_faces.append(f'<polygon points="{poly_str([(x + o, y_ + o) for x, y_ in q])}" fill="{sh}" class="s"/>')
        svg_faces.append(f'<polygon points="{poly_str([(x - o * 0.7, y_ - o * 0.7) for x, y_ in q])}" fill="{hi}" class="s"/>')
        svg_faces.append(f'<polygon points="{poly_str(q)}" fill="{top}" class="s"/>')

ow = P["outline"]
outline_layer = ""
if ow > 0:
    outline_layer = (f'<g fill="{P["outline_color"]}" stroke="{P["outline_color"]}" stroke-width="{ow}" '
                     f'stroke-linejoin="round">' + "".join(f'<polygon points="{s}"/>' for s in sil) + "</g>")
# thin same-colour seam stroke under faces hides hairline AA gaps between polygons
seams = ('<g stroke-linejoin="round">' +
         "".join(sf.replace("/>", f' stroke="{sf.split("fill=")[1].split(chr(34))[1]}" stroke-width="0.8"/>')
                 for sf in svg_faces if 'class="s"' not in sf) + "</g>")
body = "".join(sf for sf in svg_faces)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
       f'<title>Paint roller</title>{outline_layer}<g stroke-width="0.8" stroke-linejoin="round">{body}</g></svg>')
open(P["out"], "w").write(svg)
print("wrote", P["out"], "scale", round(sc, 1))
