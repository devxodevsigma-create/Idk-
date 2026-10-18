"""Generate chunky low-poly water gun icons as SVG (same style as paint_roller.py).

Usage:  python3 water_guns.py [out_dir] ['{"roll": -14}']
Writes water_gun_1.svg (rifle), water_gun_2.svg (pump), water_gun_3.svg (pistol),
water_gun_4.svg (blue blaster).

Each gun is a small 3D model made of bevelled extrusions, lathed tanks and
barrels, tubes and flat decals. It is projected orthographically, flat-shaded
with 3-tone ramps and wrapped in a thick navy stroke. Part positions are taken
from the 1200x720 model renders (image pixels, y down) and converted to model
units (100 px = 1 unit).
"""
import math, os, sys, json
import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
P = dict(
    cam=(0.30, 0.30, 1.0),      # direction toward camera (front-right, slightly above)
    light=(-0.35, 1.0, 0.75),
    roll=-14.0,                 # 2D rotation in degrees (negative tilts the barrel up)
    size=512,
    pad=34,
    outline=30,
    outline_color="#232647",
)
if len(sys.argv) > 2:
    P.update(json.loads(sys.argv[2]))

def V(*a): return np.array(a, dtype=float)
def norm(v): return v / np.linalg.norm(v)

# ---------- vibrant materials: (light, mid, dark) ----------
MAT = {
    "orange":  ("#ffb44a", "#ff8a1c", "#d45a08"),
    "dorange": ("#ff8a45", "#ec5a17", "#b03a0a"),
    "sky":     ("#86dcff", "#33b8f5", "#1580c4"),
    "azure":   ("#72c4ff", "#2b8df2", "#1a5ec4"),
    "blue":    ("#6f97ff", "#2f6bff", "#1b43c0"),
    "royal":   ("#6a92ff", "#2e66ea", "#1a40ac"),
    "green":   ("#86f075", "#3fd24e", "#1f9a32"),
    "red":     ("#ff7466", "#f23b30", "#bd1d18"),
    "white":   ("#ffffff", "#e7ebf4", "#aab3c7"),
    "black":   ("#535a6e", "#2c3040", "#191b26"),
    "yellow":  ("#ffe46e", "#ffc824", "#dc950c"),
}

def hex2rgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
def rgb2hex(c): return "#" + "".join(f"{int(round(max(0, min(255, x)))):02x}" for x in c)
def mix(a, b, t): return a + (b - a) * t

def tone(mat, t):
    lt, md, dk = (hex2rgb(x) for x in MAT[mat])
    t = max(0.0, min(1.0, t))
    return mix(dk, md, t / 0.55) if t < 0.55 else mix(md, lt, (t - 0.55) / 0.45)

# ---------- coordinates ----------
CX, CY = 600.0, 360.0
def M(x, y):
    """Render pixel -> model XY."""
    return ((x - CX) / 100.0, (CY - y) / 100.0)
def U(px): return px / 100.0

# ---------- primitives (every part is convex) ----------
def inset2d(poly, d):
    n = len(poly)
    cx = sum(p[0] for p in poly) / n; cy = sum(p[1] for p in poly) / n
    lines = []
    for i in range(n):
        p, q = np.array(poly[i]), np.array(poly[(i + 1) % n])
        dvec = norm(q - p); nr = np.array([-dvec[1], dvec[0]])
        if (np.array([cx, cy]) - p) @ nr < 0: nr = -nr
        lines.append((p + nr * d, dvec))
    out = []
    for i in range(n):
        (p1, d1), (p2, d2) = lines[i - 1], lines[i]
        den = d1[0] * d2[1] - d1[1] * d2[0]
        t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
        out.append(p1 + d1 * t)
    return out

def chamfer2d(poly, c):
    out = []
    n = len(poly)
    for i in range(n):
        p, v, q = np.array(poly[i - 1]), np.array(poly[i]), np.array(poly[(i + 1) % n])
        out.append(v + norm(p - v) * c); out.append(v + norm(q - v) * c)
    return out

def box(pts_px, z0, z1, mat, bevel=0.05, chamfer=0.0):
    """Bevelled extrusion of a convex side profile (render px) between z0 and z1 (units)."""
    poly = [np.array(M(*p)) for p in pts_px]
    if chamfer: poly = chamfer2d(poly, chamfer)
    ins = inset2d(poly, bevel)
    faces = []
    n = len(poly)
    zf, zb = z1, z0
    full = lambda p, z: V(p[0], p[1], z)
    faces.append(dict(pts=[full(p, zf) for p in ins], mat=mat))
    faces.append(dict(pts=[full(p, zb) for p in ins], mat=mat))
    for i in range(n):
        j = (i + 1) % n
        faces.append(dict(pts=[full(poly[i], zf - bevel), full(poly[j], zf - bevel),
                               full(poly[j], zb + bevel), full(poly[i], zb + bevel)], mat=mat))
        faces.append(dict(pts=[full(ins[i], zf), full(ins[j], zf),
                               full(poly[j], zf - bevel), full(poly[i], zf - bevel)], mat=mat))
        faces.append(dict(pts=[full(ins[i], zb), full(ins[j], zb),
                               full(poly[j], zb + bevel), full(poly[i], zb + bevel)], mat=mat))
    return faces

def ring_pts(center, axis, radius, n=8, phase=math.pi / 8, ref=None):
    axis = norm(axis)
    if ref is None:
        ref = V(0, 1, 0) if abs(axis[1]) < 0.9 else V(0, 0, 1)
    u = norm(np.cross(axis, ref)); w = np.cross(axis, u)
    return [center + radius * (math.cos(phase + k * 2 * math.pi / n) * u +
                               math.sin(phase + k * 2 * math.pi / n) * w) for k in range(n)]

def lathe(origin, axis, profile, mat, caps=(True, True), n=8):
    """profile: list of (t, r) in units along axis from origin."""
    axis = norm(axis)
    rings = [ring_pts(origin + axis * t, axis, r, n) for t, r in profile]
    faces = []
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            faces.append(dict(pts=[a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]], mat=mat))
    if caps[0]: faces.append(dict(pts=rings[0], mat=mat))
    if caps[1]: faces.append(dict(pts=rings[-1], mat=mat))
    return faces

def xlathe(x_px, y_px, profile_px, mat, caps=(True, True), n=8, z=0.0):
    """Lathe along +X; profile in render px: [(x, r), ...]."""
    ox, oy = M(x_px, y_px)
    return lathe(V(ox, oy, z), V(1, 0, 0), [(U(x - x_px), U(r)) for x, r in profile_px], mat, caps, n)

def ylathe(x_px, y_px, profile_px, mat, n=8, z=0.0):
    """Lathe along +Y (up); profile in render px: [(height_up, r), ...]."""
    ox, oy = M(x_px, y_px)
    return lathe(V(ox, oy, z), V(0, 1, 0), [(U(h), U(r)) for h, r in profile_px], mat, n=n)

def capsule(x0, x1, yc, R, mat, neck=0.45, dome=None):
    dome = dome or R * 0.9
    prof = [(x0, R * neck), (x0 + dome * 0.3, R * 0.82), (x0 + dome, R),
            (x1 - dome, R), (x1 - dome * 0.3, R * 0.82), (x1, R * neck)]
    return xlathe(x0, yc, prof, mat)

def strap(x_px, yc_px, R_px, w_px, mat, thick=4.0):
    """Band around an X-axis tank; only the camera-facing half of its edges is kept."""
    ox, oy = M(x_px - w_px / 2, yc_px)
    o = V(ox, oy, 0.0); ax = V(1, 0, 0)
    r_in, r_out, w = U(R_px), U(R_px + thick), U(w_px)
    a, b = ring_pts(o, ax, r_out), ring_pts(o + ax * w, ax, r_out)
    ai, bi = ring_pts(o, ax, r_in), ring_pts(o + ax * w, ax, r_in)
    faces = [dict(pts=[a[k], a[(k + 1) % 8], b[(k + 1) % 8], b[k]], mat=mat) for k in range(8)]
    for ring_o, ring_i, c in ((a, ai, o), (b, bi, o + ax * w)):
        for k in range(8):
            q = [ring_o[k], ring_o[(k + 1) % 8], ring_i[(k + 1) % 8], ring_i[k]]
            radial = norm((ring_o[k] + ring_o[(k + 1) % 8]) / 2 - c)
            if radial @ CAM > 0:
                faces.append(dict(pts=q, mat=mat, flat=True))
    return faces

def tube_path(pts_px, r_px, mat, z=0.0, n=8):
    path = [V(*M(x, y), z) for x, y in pts_px]
    r = U(r_px)
    rings = []
    for i, p in enumerate(path):
        if i == 0: t = path[1] - path[0]
        elif i == len(path) - 1: t = path[-1] - path[-2]
        else: t = norm(path[i + 1] - path[i]) + norm(path[i] - path[i - 1])
        rings.append(ring_pts(p, t, r, n=n, ref=V(0, 0, 1)))
    segs = []
    for i in range(len(path) - 1):
        a, b = rings[i], rings[i + 1]
        f = [dict(pts=[a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]], mat=mat) for k in range(n)]
        if i == 0: f.append(dict(pts=a, mat=mat))
        if i == len(path) - 2: f.append(dict(pts=b, mat=mat))
        segs.append(f)
    return segs

def smooth(pts, steps=4):
    """Chaikin-smooth a polyline (keeps the end points)."""
    pts = [np.array(p, float) for p in pts]
    for _ in range(steps):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            out += [a * 0.75 + b * 0.25, a * 0.25 + b * 0.75]
        out.append(pts[-1])
        pts = out
    return [tuple(p) for p in pts[::2]] + [tuple(pts[-1])]

def decal(pts_px, z, mat):
    """Flat sticker on the camera-facing side (+Z) of a part."""
    return [dict(pts=[V(*M(x, y), z + 0.004) for x, y in pts_px], mat=mat, flat=True, n=V(0, 0, 1))]

def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

# ---------- camera / shading ----------
CAM = norm(V(*P["cam"]))
R_ = norm(np.cross(V(0, 1, 0), CAM)); U_ = np.cross(CAM, R_)
LD = norm(V(*P["light"]))
TH = math.radians(P["roll"]); CR, SR = math.cos(TH), math.sin(TH)

def proj(p):
    x, y = float(p @ R_), float(-(p @ U_))
    return (x * CR - y * SR, x * SR + y * CR)

def face_normal(pts):
    n = np.zeros(3)
    for i in range(len(pts)):
        n += np.cross(pts[i], pts[(i + 1) % len(pts)])
    return norm(n)

class Gun:
    def __init__(self):
        self.parts = []   # dict(faces, bias, children)

    def add(self, faces, bias=0.0, parent=None):
        part = dict(faces=faces, bias=bias, children=[])
        if parent is None: self.parts.append(part)
        else: parent["children"].append(part)
        return part

    def svg(self):
        draw = []
        def emit(part):
            pts_all = [p for f in part["faces"] for p in f["pts"]]
            c = np.mean(pts_all, axis=0)
            for fc in part["faces"]:
                n = fc.get("n")
                if n is None:
                    n = face_normal(fc["pts"])
                    if (np.mean(fc["pts"], axis=0) - c) @ n < 0: n = -n   # point outward
                if n @ CAM <= 1e-6:
                    continue
                t = 0.32 + 0.68 * max(0.0, float(n @ LD))
                draw.append((fc["pts"], tone(fc["mat"], t)))
            for ch in sorted(part["children"], key=depth): emit(ch)
        def depth(part):
            pts_all = [p for f in part["faces"] for p in f["pts"]]
            return float(np.mean(pts_all, axis=0) @ CAM) + part["bias"]
        for part in sorted(self.parts, key=depth):
            emit(part)

        pts2 = [proj(p) for pts, _ in draw for p in pts]
        xs, ys = [p[0] for p in pts2], [p[1] for p in pts2]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        S, pad = P["size"], P["pad"]
        sc = (S - 2 * pad) / max(w, h)
        ox = S / 2 - (min(xs) + w / 2) * sc; oy = S / 2 - (min(ys) + h / 2) * sc
        def ps(pts):
            return " ".join(f"{ox + x * sc:.1f},{oy + y * sc:.1f}" for x, y in (proj(p) for p in pts))
        polys = [(ps(pts), rgb2hex(col)) for pts, col in draw]
        oc, ow = P["outline_color"], P["outline"]
        outline = ""
        if ow > 0:
            outline = (f'<g fill="{oc}" stroke="{oc}" stroke-width="{ow}" stroke-linejoin="round">' +
                       "".join(f'<polygon points="{s}"/>' for s, _ in polys) + "</g>")
        body = "".join(f'<polygon points="{s}" fill="{c}" stroke="{c}"/>' for s, c in polys)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
                f'<title>Water gun</title>{outline}'
                f'<g stroke-width="0.8" stroke-linejoin="round">{body}</g></svg>\n')

# =====================================================================
# Gun 1: rifle with sky-blue tank, handguard slots and blue magazine
# =====================================================================
def gun1():
    g = Gun()
    Z = 0.30
    # stock + butt plate + connector
    g.add(box([(318, 298), (400, 302), (404, 378), (322, 381)], -0.30, 0.30, "orange", chamfer=0.10))
    g.add(box([(304, 302), (322, 298), (326, 382), (308, 385)], -0.31, 0.31, "black", bevel=0.03))
    g.add(box(rect(396, 308, 452, 338), -0.13, 0.13, "dorange", bevel=0.03))
    # receiver with sky label
    rec = g.add(box(rect(447, 292, 656, 384), -Z, Z, "orange", chamfer=0.10))
    g.add(decal(rect(518, 330, 594, 354), Z, "sky"), parent=rec)
    g.add(box(rect(474, 372, 622, 392), -0.24, 0.24, "dorange", bevel=0.03), bias=0.05)
    # handguard with slots
    hg = g.add(box(rect(650, 314, 796, 388), -0.27, 0.27, "dorange", chamfer=0.08))
    for x in (666, 694, 722, 750):
        g.add(decal(rect(x, 342, x + 14, 374), 0.27, "black"), parent=hg)
    # rail, front sight
    g.add(box(rect(470, 289, 770, 304), -0.13, 0.13, "black", bevel=0.03), bias=0.3)
    g.add(box(rect(776, 292, 787, 324), -0.05, 0.05, "black", bevel=0.015), bias=0.3)
    # tank: body, caps, straps, filler cap, mounts, hose
    tank = g.add(xlathe(486, 270, [(486, 23), (686, 23)], "sky"), bias=0.2)
    g.add(xlathe(474, 270, [(474, 13), (488, 15)], "blue"), bias=0.2)
    g.add(xlathe(684, 270, [(684, 15), (697, 13)], "blue"), bias=0.2)
    for x in (530, 634):
        g.add(strap(x, 270, 23, 9, "dorange"), parent=tank)
    g.add(ylathe(508, 247, [(-2, 8), (9, 8), (9, 6), (13, 5)], "green"), bias=0.3)
    for x in (526, 630):
        g.add(box(rect(x - 6, 290, x + 6, 297), -0.07, 0.07, "black", bevel=0.01), bias=0.15)
    for seg in tube_path(smooth([(694, 270), (722, 270), (736, 285), (738, 300)], 3), 5, "white"):
        g.add(seg, bias=0.2)
    # barrel
    g.add(xlathe(795, 351, [(795, 12), (866, 12)], "white"))
    g.add(xlathe(862, 355, [(862, 19), (894, 19)], "green"))
    g.add(xlathe(892, 356, [(892, 12), (910, 12)], "red"))
    g.add(xlathe(909, 356, [(909, 4.5), (916, 4.5)], "black"))
    # grip + base plate, trigger guard + trigger
    g.add(box([(455, 378), (508, 378), (494, 432), (440, 426)], -0.21, 0.21, "dorange", chamfer=0.05))
    g.add(box([(432, 415), (500, 426), (494, 446), (428, 434)], -0.25, 0.25, "orange", bevel=0.03))
    g.add(box([(530, 388), (540, 388), (540, 408), (532, 409)], -0.03, 0.03, "yellow", bevel=0.01))
    for seg in tube_path(smooth([(505, 386), (514, 416), (552, 416), (568, 388)], 3), 5, "orange"):
        g.add(seg)
    # magazine + base
    g.add(box([(574, 388), (626, 388), (640, 462), (586, 466)], -0.18, 0.18, "sky", chamfer=0.05))
    g.add(box([(580, 460), (644, 455), (646, 474), (582, 480)], -0.21, 0.21, "blue", bevel=0.03))
    return g

# =====================================================================
# Gun 2: pump gun with big green tank and ribbed pump grip
# =====================================================================
def gun2():
    g = Gun()
    Z = 0.32
    g.add(box([(316, 316), (342, 312), (346, 408), (320, 412)], -0.30, 0.30, "black", bevel=0.03))
    g.add(box(rect(336, 318, 410, 405), -0.27, 0.27, "orange", chamfer=0.08))
    g.add(box(rect(402, 308, 466, 406), -0.30, 0.30, "dorange", chamfer=0.08))
    body = g.add(box(rect(456, 310, 722, 420), -Z, Z, "orange", chamfer=0.10))
    g.add(decal(rect(508, 372, 670, 390), Z, "dorange"), parent=body)
    g.add(box(rect(716, 318, 732, 412), -0.26, 0.26, "dorange", bevel=0.03))
    g.add(ylathe(701, 312, [(-4, 10), (16, 10)], "orange"), bias=0.1)
    # tank with saddle, straps, neck and rear pressure chamber on a post
    g.add(box(rect(505, 314, 688, 330), -0.26, 0.26, "dorange", bevel=0.03), bias=0.05)
    tank = g.add(capsule(486, 700, 266, 58, "green", neck=0.55, dome=40), bias=0.2)
    for x in (548, 646):
        g.add(strap(x, 266, 58, 14, "dorange", thick=5), parent=tank)
    g.add(xlathe(462, 250, [(462, 25), (492, 25)], "green"), bias=0.15)
    g.add(box(rect(441, 270, 459, 316), -0.08, 0.08, "orange", bevel=0.02), bias=0.05)
    g.add(xlathe(420, 250, [(420, 31), (466, 33)], "orange"), bias=0.2)
    # barrel, under tube, pump grip, front bracket
    g.add(xlathe(730, 357, [(730, 17), (856, 17)], "white"))
    g.add(xlathe(852, 365, [(852, 24), (880, 24)], "green"))
    g.add(xlathe(878, 367, [(878, 17), (896, 17)], "red"))
    g.add(xlathe(895, 367, [(895, 5), (901, 5)], "black"))
    g.add(xlathe(722, 412, [(722, 8), (852, 8)], "white"))
    for i in range(5):
        x = 736 + i * 17.5
        g.add(xlathe(x, 408, [(x, 26), (x + 11, 26)], "green"))
        g.add(xlathe(x + 10, 408, [(x + 10, 21), (x + 18, 21)], "green"))
    g.add(box(rect(838, 384, 856, 434), -0.08, 0.08, "orange", bevel=0.02))
    # grip, base plate, trigger guard, trigger
    g.add(box([(456, 412), (546, 412), (526, 488), (442, 484)], -0.24, 0.24, "dorange", chamfer=0.06))
    g.add(box([(440, 462), (530, 476), (524, 500), (436, 486)], -0.27, 0.27, "orange", bevel=0.03))
    g.add(box([(570, 414), (582, 414), (594, 440), (584, 444)], -0.03, 0.03, "yellow", bevel=0.01))
    for seg in tube_path(smooth([(546, 416), (556, 446), (608, 444), (622, 416)], 3), 5, "orange"):
        g.add(seg)
    return g

# =====================================================================
# Gun 3: pistol with yellow tank, blue straps and green barrel
# =====================================================================
def gun3():
    g = Gun()
    Z = 0.34
    g.add(box(rect(396, 284, 436, 426), -0.36, 0.36, "dorange", chamfer=0.07))
    body = g.add(box(rect(428, 294, 706, 436), -Z, Z, "orange", chamfer=0.10))
    g.add(decal(rect(484, 352, 662, 392), Z, "royal"), parent=body)
    # tank, straps, filler cap, hose
    tank = g.add(capsule(440, 662, 230, 70, "yellow", neck=0.6, dome=48), bias=0.2)
    for x in (500, 606):
        g.add(strap(x, 230, 70, 20, "royal", thick=5), parent=tank)
    g.add(ylathe(500, 162, [(-4, 23), (6, 23), (6, 13), (14, 12)], "green"), bias=0.3)
    for seg in tube_path(smooth([(446, 202), (398, 202), (376, 232), (384, 286), (402, 300)], 3), 8, "white"):
        g.add(seg, bias=-0.1)
    # barrel
    g.add(xlathe(700, 395, [(700, 46), (738, 46)], "green"))
    g.add(xlathe(736, 395, [(736, 30), (806, 30)], "green"))
    g.add(xlathe(802, 395, [(802, 34), (846, 34)], "red"))
    g.add(xlathe(845, 395, [(845, 7), (851, 7)], "black"))
    # grip, base plate, trigger guard, trigger
    g.add(box([(442, 426), (532, 426), (510, 544), (414, 532)], -0.28, 0.28, "dorange", chamfer=0.07))
    g.add(box([(388, 506), (522, 520), (518, 556), (384, 538)], -0.32, 0.32, "orange", bevel=0.04))
    g.add(box([(560, 426), (574, 426), (590, 468), (578, 472)], -0.035, 0.035, "yellow", bevel=0.012))
    for seg in tube_path(smooth([(524, 432), (532, 476), (622, 472), (636, 434)], 3), 6, "orange"):
        g.add(seg)
    return g

# =====================================================================
# Gun 4: blue blaster with long yellow tank, rear pressure chamber and slotted pump
# =====================================================================
def gun4():
    g = Gun()
    Z = 0.32
    # rear pressure chamber (yellow disc), orange collar, blue neck, hose elbow
    g.add(xlathe(310, 263, [(310, 50), (318, 58), (362, 58), (370, 50)], "yellow"), bias=0.1)
    g.add(xlathe(357, 265, [(357, 25), (385, 25)], "orange"), bias=0.15)
    g.add(xlathe(380, 266, [(380, 16), (412, 16)], "azure"), bias=0.15)
    for seg in tube_path(smooth([(334, 310), (334, 336), (350, 352)], 3), 10, "azure"):
        g.add(seg, bias=-0.1)
    g.add(ylathe(334, 330, [(-4, 13), (4, 13)], "orange"), bias=-0.05)
    # long tank with strap, front mount
    tank = g.add(xlathe(407, 271, [(407, 20), (440, 46), (645, 46), (667, 30)], "yellow"), bias=0.2)
    g.add(strap(458, 271, 46, 20, "azure", thick=6), parent=tank)
    g.add(box(rect(640, 307, 678, 345), -0.20, 0.20, "azure", chamfer=0.06), bias=0.1)
    # body: rear block, main body, top ridge, yellow label
    g.add(box(rect(347, 322, 404, 390), -0.30, 0.30, "azure", chamfer=0.07))
    body = g.add(box(rect(398, 322, 650, 412), -Z, Z, "azure", chamfer=0.08))
    g.add(decal(rect(502, 367, 575, 392), Z, "yellow"), parent=body)
    g.add(box(rect(412, 316, 606, 340), -0.22, 0.22, "azure", bevel=0.04), bias=0.1)
    # barrel, slotted pump, orange front plate, tip
    g.add(xlathe(648, 382, [(648, 17), (868, 17)], "white"))
    hg = g.add(box(rect(657, 362, 757, 422), -0.26, 0.26, "azure", chamfer=0.07), bias=0.6)  # wraps the barrel
    for x in (668, 688, 708, 728):
        g.add(decal(rect(x, 382, x + 11, 414), 0.26, "black"), parent=hg)
    g.add(box(rect(755, 372, 768, 413), -0.21, 0.21, "orange", bevel=0.03), bias=0.6)
    g.add(xlathe(866, 383, [(866, 20), (898, 20)], "orange"))
    g.add(xlathe(897, 383, [(897, 5), (904, 5)], "black"))
    # grip, base plate, red triggers, trigger guard
    g.add(box([(442, 400), (497, 400), (474, 470), (416, 460)], -0.24, 0.24, "azure", chamfer=0.05))
    g.add(box([(414, 450), (476, 466), (482, 490), (408, 476)], -0.27, 0.27, "azure", bevel=0.03))
    g.add(box([(482, 404), (494, 404), (506, 466), (494, 468)], -0.04, 0.04, "red", bevel=0.012), bias=0.15)
    g.add(box([(512, 404), (522, 404), (530, 426), (522, 428)], -0.035, 0.035, "red", bevel=0.01))
    for seg in tube_path(smooth([(496, 408), (500, 438), (548, 438), (554, 410)], 3), 5, "azure"):
        g.add(seg)
    return g

for i, build in enumerate((gun1, gun2, gun3, gun4), start=1):
    path = os.path.join(OUT, f"water_gun_{i}.svg")
    open(path, "w").write(build().svg())
    print("wrote", path)
