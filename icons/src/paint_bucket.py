"""Generate a chunky low-poly paint bucket icon as SVG (matches paint_roller.py).

Usage (the four shipped variants):
  python3 paint_bucket.py '{"out": "paint_bucket_1.svg"}'
  python3 paint_bucket.py '{"out": "paint_bucket_2.svg", "roll": 15}'
  python3 paint_bucket.py '{"out": "paint_bucket_3.svg", "roll": -15}'
  python3 paint_bucket.py '{"out": "paint_bucket_4.svg", "mirror": true}'
Other options (JSON): cam, light, size, pad, sides, height, bail_h, bail_tilt, grip_len.
Add "outline": 0 for a version without the navy stroke.

Builds a small 3D model (open can with paint, drips, wire bail with grip),
projects it orthographically, flat-shades each face with 3-tone ramps,
and wraps the silhouette in a thick navy stroke.
"""
import math, sys, json
import numpy as np

P = dict(
    cam=(0.22, 0.62, 1.0),      # direction toward camera
    light=(-0.35, 1.0, 0.75),
    roll=0.0,                   # 2D rotation (deg, clockwise)
    mirror=False,
    size=512,
    pad=34,
    outline=30,                 # stroke width of the under-layer (visible ~= half)
    outline_color="#232647",
    sides=10,
    height=2.3,
    bail_gap=0.42,
    bail_h=1.15,
    bail_exp=0.45,
    grip_len=0.15,
    wire_r=0.07,
    bail_tilt=37.0,             # degrees the handle leans back from vertical
    out="paint_bucket.svg",
)
if len(sys.argv) > 1:
    P.update(json.loads(sys.argv[1]))

def V(*a): return np.array(a, dtype=float)
def norm(v): return v / np.linalg.norm(v)

# ---------- materials: (light, mid, dark) — same palette as the roller ----------
MAT = {
    "body":   ("#ffffff", "#e7ebf4", "#aab3c7"),
    "inside": ("#c3cad7", "#9ea7b8", "#78829a"),
    "paint":  ("#7491ff", "#3d5ee8", "#2237a6"),
    "metal":  ("#eef1f6", "#bcc3cf", "#7f889a"),
    "grip":   ("#7190ff", "#3b5ce8", "#21369f"),
}

def hex2rgb(h): return np.array([int(h[i:i+2], 16) for i in (1, 3, 5)], float)
def rgb2hex(c): return "#" + "".join(f"{int(round(max(0, min(255, x)))):02x}" for x in c)
def mix(a, b, t): return a + (b - a) * t

def tone(mat, t):
    lt, md, dk = (hex2rgb(x) for x in MAT[mat])
    t = max(0.0, min(1.0, t))
    return mix(dk, md, t / 0.55) if t < 0.55 else mix(md, lt, (t - 0.55) / 0.45)

# ---------- geometry helpers ----------
NS = P["sides"]

def ring_pts(center, axis, radius, n=8, phase=math.pi / 8, ref=None):
    axis = norm(axis)
    if ref is None:
        ref = V(0, 1, 0) if abs(axis[1]) < 0.9 else V(0, 0, 1)
    u = norm(np.cross(axis, ref)); w = np.cross(axis, u)
    return [center + radius * (math.cos(phase + k * 2 * math.pi / n) * u +
                               math.sin(phase + k * 2 * math.pi / n) * w) for k in range(n)]

def yring(y, r):
    """Horizontal ring with a flat side facing the camera (+Z)."""
    return ring_pts(V(0, y, 0), V(0, 1, 0), r, n=NS, phase=0.0)

def prism(c0, c1, r0, r1, mat, caps=(True, True), n=8, phase=math.pi / 8, ref=None):
    axis = c1 - c0
    a = ring_pts(c0, axis, r0, n, phase, ref); b = ring_pts(c1, axis, r1, n, phase, ref)
    faces = [dict(pts=[a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]], mat=mat) for k in range(n)]
    if caps[0]: faces.append(dict(pts=a[::-1], mat=mat))
    if caps[1]: faces.append(dict(pts=b, mat=mat))
    return faces

def yband(y0, y1, r0, r1, mat, inward=False):
    a, b = yring(y0, r0), yring(y1, r1)
    out = []
    for k in range(NS):
        k2 = (k + 1) % NS
        q = [a[k], a[k2], b[k2], b[k]]
        out.append(dict(pts=q[::-1] if inward else q, mat=mat, k=k))
    return out

def tube(path, r, mat, n=8, ref=None):
    rings = []
    for i, p in enumerate(path):
        if i == 0: t = path[1] - path[0]
        elif i == len(path) - 1: t = path[-1] - path[-2]
        else: t = norm(path[i + 1] - path[i]) + norm(path[i] - path[i - 1])
        rings.append(ring_pts(p, t, r, n=n, ref=ref))
    segs = []
    for i in range(len(path) - 1):
        a, b = rings[i], rings[i + 1]
        f = [dict(pts=[a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]], mat=mat) for k in range(n)]
        if i == 0: f.append(dict(pts=a[::-1], mat=mat))
        if i == len(path) - 2: f.append(dict(pts=b, mat=mat))
        segs.append(f)
    return segs

# ---------- the model ----------
H = P["height"]
Y_BOT, Y_RING, Y_TOP_BODY, Y_LIP0, Y_RIM = 0.0, 0.16, H - 0.18, H - 0.24, H
R_BOT, R_TOP = 0.98, 1.12            # body frustum radii
R_RING, R_LIP, R_IN = 1.04, 1.22, 1.06
Y_PAINT = H - 0.24

def r_body(y):
    return R_BOT + (R_TOP - R_BOT) * (y - Y_RING) / (Y_TOP_BODY - Y_RING)

layers = {k: [] for k in ("inside", "paint", "body", "drip_body", "rim", "drip_rim")}

# interior wall (only faces looking back at the camera survive culling) + paint
layers["inside"] += yband(Y_PAINT, Y_RIM, R_IN - 0.02, R_IN, "inside", inward=True)
layers["paint"].append(dict(pts=yring(Y_PAINT, R_IN - 0.02), mat="paint"))

# body + bottom ring
body_faces = yband(Y_RING, Y_TOP_BODY, R_BOT, R_TOP, "body")
layers["body"] += prism(V(0, Y_BOT, 0), V(0, Y_RING, 0), R_RING, R_RING, "metal",
                        n=NS, phase=0.0, ref=V(0, 0, 1))
layers["body"] += body_faces
Y_RIB = 0.52
layers["body"] += prism(V(0, Y_RIB - 0.07, 0), V(0, Y_RIB + 0.07, 0), r_body(Y_RIB) + 0.035,
                        r_body(Y_RIB) + 0.035, "metal", caps=(False, False), n=NS, phase=0.0,
                        ref=V(0, 0, 1))
ro, ri = yring(Y_RIB + 0.07, r_body(Y_RIB) + 0.035), yring(Y_RIB + 0.07, r_body(Y_RIB + 0.07))
# only the camera-side half of the rib's top lip; the rest is hidden behind the body
_fh = norm(V(P["cam"][0], 0, P["cam"][2]))
layers["body"] += [dict(pts=[ro[k], ro[(k + 1) % NS], ri[(k + 1) % NS], ri[k]], mat="metal")
                   for k in range(NS) if (ro[k] + ro[(k + 1) % NS]) @ _fh > 0]

# rolled rim: outer band + flat top annulus
rim_out = yband(Y_LIP0, Y_RIM, R_LIP, R_LIP, "metal")
lip_under = yband(Y_LIP0 - 0.06, Y_LIP0, R_TOP + 0.005, R_LIP, "metal")
oa, ia = yring(Y_RIM, R_LIP), yring(Y_RIM, R_IN)
annulus = [dict(pts=[oa[k], oa[(k + 1) % NS], ia[(k + 1) % NS], ia[k]], mat="metal", k=k)
           for k in range(NS)]
layers["rim"] += lip_under + rim_out + annulus

# paint drips: (face index, centre u, width u, length in world units)
FRONT = (3 * NS // 4) % NS   # face centred on +Z with phase 0
DRIPS = [(FRONT, 0.30, 0.26, 0.95), (FRONT, 0.72, 0.20, 0.50),
         ((FRONT + 1) % NS, 0.45, 0.30, 0.72), ((FRONT - 1) % NS, 0.62, 0.22, 0.38)]
EPS = 0.006

def on_quad(q, u, t):
    a, b, c, d = q  # a,b bottom; d,c top (yband order)
    top = d + (c - d) * u; bot = a + (b - a) * u
    return top + (bot - top) * t

for k, uc, uw, ln in DRIPS:
    bq = body_faces[k]["pts"]
    n_out = norm(np.cross(bq[1] - bq[0], bq[3] - bq[0]))
    fw = np.linalg.norm(bq[2] - bq[3]); fh = np.linalg.norm(bq[3] - bq[0])
    u0, u1 = uc - uw / 2, uc + uw / 2
    tl = ln / fh
    rad_t = (uw / 2) * fw / fh                       # round tip in face units
    pts = [on_quad(bq, u0, 0.0), on_quad(bq, u1, 0.0), on_quad(bq, u1, tl - rad_t)]
    for i in range(1, 6):
        ang = math.pi * i / 6
        pts.append(on_quad(bq, uc + (uw / 2) * math.cos(ang), tl - rad_t + rad_t * math.sin(ang)))
    pts.append(on_quad(bq, u0, tl - rad_t))
    layers["drip_body"].append(dict(pts=[p + n_out * EPS for p in pts], mat="paint", n=n_out))
    # the spill over the rim: outer band, underside and top annulus at the same u-range
    for src in (rim_out[k], lip_under[k]):
        q = src["pts"]; nn = norm(np.cross(q[1] - q[0], q[3] - q[0]))
        layers["drip_rim"].append(dict(pts=[on_quad(q, u0, 0) + nn * EPS, on_quad(q, u1, 0) + nn * EPS,
                                            on_quad(q, u1, 1) + nn * EPS, on_quad(q, u0, 1) + nn * EPS],
                                       mat="paint", n=nn))
    o0, o1 = oa[k] + (oa[(k + 1) % NS] - oa[k]) * u0, oa[k] + (oa[(k + 1) % NS] - oa[k]) * u1
    i0, i1 = ia[k] + (ia[(k + 1) % NS] - ia[k]) * u0, ia[k] + (ia[(k + 1) % NS] - ia[k]) * u1
    layers["drip_rim"].append(dict(pts=[o0 + V(0, EPS, 0), i0 + V(0, EPS, 0), i1 + V(0, EPS, 0),
                                        o1 + V(0, EPS, 0)], mat="paint", n=V(0, 1, 0)))

# paint highlight blobs (flat, slightly above the surface)
def blob(cx, cz, rx, rz, n=7, rot=0.3):
    return [V(cx + rx * math.cos(rot + 2 * math.pi * i / n), Y_PAINT + EPS,
              cz + rz * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)]
hi_blobs = [blob(-0.38, -0.30, 0.34, 0.20), blob(0.12, -0.52, 0.12, 0.08, rot=0.8)]

# ears + wire bail with a blue grip
Y_EAR = H - 0.56
ear_x = r_body(Y_EAR)
extra = []  # (name, faces) depth-sorted against the can
for s in (-1, 1):
    extra.append(("ear", prism(V(s * (ear_x - 0.02), Y_EAR, 0), V(s * (ear_x + 0.09), Y_EAR, 0),
                               0.15, 0.15, "metal", ref=V(0, 1, 0))))
RB, a = P["bail_h"], math.radians(P["bail_tilt"])
xb = R_LIP + P["bail_gap"]
def bail_pt(th):  # th: 0 (right ear) .. pi (left ear); squarish arc clears the rim
    c = math.cos(th)
    x, h = xb * math.copysign(abs(c) ** P["bail_exp"], c), RB * math.sin(th)
    return V(x, Y_EAR + h * math.cos(a), -h * math.sin(a))
bail_n = V(0, math.sin(a), math.cos(a))  # normal of the bail plane
g0, g1 = math.pi * (0.5 - P["grip_len"]), math.pi * (0.5 + P["grip_len"])
def arc(t0, t1, n):
    return [bail_pt(t0 + (t1 - t0) * i / n) for i in range(n + 1)]
# wire halves stop just inside the grip so they never poke through it
right = [V(ear_x + 0.05, Y_EAR, 0)] + arc(0.28, g0 + 0.04, 6)
left = arc(g1 - 0.04, math.pi - 0.28, 6) + [V(-ear_x - 0.05, Y_EAR, 0)]
for half in (right, left):
    for seg in tube(half, P["wire_r"], "metal", ref=bail_n):
        extra.append(("bail", seg))
for seg in tube(arc(g0, g1, 6), 0.14, "grip", ref=bail_n):
    extra.append(("grip", seg))

# ---------- camera ----------
f = norm(V(*P["cam"]))
r = norm(np.cross(V(0, 1, 0), f)); u = np.cross(f, r)
Ld = norm(V(*P["light"]))
th = math.radians(P["roll"])
cr, sr = math.cos(th), math.sin(th)

def proj(p):
    x, y_ = float(p @ r), float(-(p @ u))
    if P["mirror"]: x = -x
    return (x * cr - y_ * sr, x * sr + y_ * cr)

def face_normal(pts):
    n = np.zeros(3)
    for i in range(len(pts)):
        n += np.cross(pts[i], pts[(i + 1) % len(pts)])
    return norm(n)

def shade(fc, normal=None):
    n = normal if normal is not None else face_normal(fc["pts"])
    return tone(fc["mat"], 0.32 + 0.68 * max(0.0, float(n @ Ld)))

draw = []
def emit(faces, cull=True, normal=None):
    for fc in faces:
        n = fc.get("n", normal if normal is not None else face_normal(fc["pts"]))
        if cull and n @ f <= 1e-6:
            continue
        draw.append((fc["pts"], shade(fc, n)))

can_depth = float(V(0, 1.0, 0) @ f)
def part_depth(faces):
    return float(np.mean([np.mean(fc["pts"], axis=0) @ f for fc in faces]))

behind = sorted([e for e in extra if part_depth(e[1]) < can_depth], key=lambda e: part_depth(e[1]))
front = sorted([e for e in extra if part_depth(e[1]) >= can_depth], key=lambda e: part_depth(e[1]))

for _, faces in behind: emit(faces)
emit(layers["inside"])
emit(layers["paint"], cull=False, normal=V(0, 1, 0))
Rp = R_IN - 0.02
back = [k * math.pi / 12 for k in range(13)]  # 0..pi over the back half (z<0)
outer = [V(Rp * math.cos(t), Y_PAINT + EPS / 2, -Rp * math.sin(t)) for t in back]
inner = [V(0.9 * Rp * math.cos(t), Y_PAINT + EPS / 2, -0.78 * Rp * math.sin(t) - 0.04) for t in back[::-1]]
draw.append((outer + inner, mix(tone("paint", 1.0), hex2rgb(MAT["paint"][2]), 0.22)))
for b in hi_blobs:
    draw.append((b, mix(tone("paint", 1.0), V(255, 255, 255), 0.28)))
emit(layers["body"])
# drips: only where the face they sit on is visible
emit(layers["drip_body"])
emit(layers["rim"])
emit(layers["drip_rim"])
for _, faces in front: emit(faces)

# ---------- fit to canvas & write ----------
pts2all = [proj(p) for pts, _ in draw for p in pts]
xs, ys = [p[0] for p in pts2all], [p[1] for p in pts2all]
w, h = max(xs) - min(xs), max(ys) - min(ys)
S, pad = P["size"], P["pad"]
sc = (S - 2 * pad) / max(w, h)
ox = S / 2 - (min(xs) + w / 2) * sc
oy = S / 2 - (min(ys) + h / 2) * sc

def poly_str(pts):
    return " ".join(f"{ox + x * sc:.1f},{oy + y_ * sc:.1f}" for x, y_ in (proj(p) for p in pts))

polys = [(poly_str(pts), rgb2hex(col)) for pts, col in draw]
ow = P["outline"]
outline_layer = ""
if ow > 0:
    oc = P["outline_color"]
    outline_layer = (f'<g fill="{oc}" stroke="{oc}" stroke-width="{ow}" stroke-linejoin="round">' +
                     "".join(f'<polygon points="{s}"/>' for s, _ in polys) + "</g>")
body = "".join(f'<polygon points="{s}" fill="{c}" stroke="{c}"/>' for s, c in polys)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
       f'<title>Paint bucket</title>{outline_layer}'
       f'<g stroke-width="0.8" stroke-linejoin="round">{body}</g></svg>')
open(P["out"], "w").write(svg)
print("wrote", P["out"], "scale", round(sc, 1))
