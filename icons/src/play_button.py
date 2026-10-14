"""Generate the rounded 'play' triangle icon (dark outline, bevel, gradient, shine).

Usage:  python3 play_button.py [out_dir]
Writes play_white.svg, play_black.svg, play_red.svg, play_green.svg.
"""
import math, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
S = 512
H, W = 352, 266            # triangle height / width (before outline); narrow like the original
OUTLINE = 76               # stroke width of the outline layer (about half shows outside)
CORNER = 56                # how far each corner's rounding reaches along the edges
OUTLINE_COLOR = "#141414"
# bevel: how far the lit face sits inside each edge (top, bottom, left)
BEVEL = (6, 20, 24)

COLORS = {  # side (bevel), face light (top-left), face mid, face dark (bottom-right)
    "white": ("#aeb8ca", "#ffffff", "#eef2f8", "#cfd6e3"),
    "black": ("#0e0f12", "#686d7a", "#40444d", "#24262c"),
    "red":   ("#9e0d16", "#ff7a6b", "#f2443c", "#c8161f"),
    "green": ("#2f9408", "#c2fc80", "#5cec18", "#3fbf0c"),  # bright cartoon lime
}

# vertices: left-top, right tip, left-bottom (centred on the canvas)
x0 = (S - W) / 2 + 6       # tiny nudge right so the shape looks optically centred
y0 = (S - H) / 2
V = [(x0, y0), (x0 + W, y0 + H / 2), (x0, y0 + H)]

def sub(a, b): return (a[0] - b[0], a[1] - b[1])
def add(a, b): return (a[0] + b[0], a[1] + b[1])
def mul(a, k): return (a[0] * k, a[1] * k)
def length(a): return math.hypot(*a)
def unit(a): return mul(a, 1 / length(a))
def lerp(a, b, t): return add(a, mul(sub(b, a), t))

def toward(a, b, d):
    return add(a, mul(unit(sub(b, a)), d))

def rounded_path(pts, d):
    n = len(pts)
    segs = []
    for i in range(n):
        p, v, q = pts[i - 1], pts[i], pts[(i + 1) % n]
        segs.append((toward(v, p, d), v, toward(v, q, d)))
    path = f"M{segs[0][2][0]:.1f},{segs[0][2][1]:.1f} "
    for a, v, b in segs[1:] + segs[:1]:
        path += f"L{a[0]:.1f},{a[1]:.1f} Q{v[0]:.1f},{v[1]:.1f} {b[0]:.1f},{b[1]:.1f} "
    return path + "Z"

def inset(pts, dists):
    """Move each edge i (pts[i] -> pts[i+1]) inward by dists[i]; return new vertices."""
    n = len(pts)
    cx = sum(p[0] for p in pts) / n; cy = sum(p[1] for p in pts) / n
    lines = []
    for i in range(n):
        p, q = pts[i], pts[(i + 1) % n]
        d = unit(sub(q, p)); nrm = (-d[1], d[0])
        if (cx - p[0]) * nrm[0] + (cy - p[1]) * nrm[1] < 0:
            nrm = mul(nrm, -1)
        lines.append((add(p, mul(nrm, dists[i])), d))
    out = []
    for i in range(n):
        (p1, d1), (p2, d2) = lines[i - 1], lines[i]
        den = d1[0] * d2[1] - d1[1] * d2[0]
        t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den
        out.append(add(p1, mul(d1, t)))
    return out

def poly(pts):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)

def taper(start, end, inward, w0):
    """Thin glint that is w0 wide at start and comes to a point at end."""
    return [start, end, add(start, mul(inward, w0))]

outer = rounded_path(V, CORNER)
F = inset(V, BEVEL)                       # lit face triangle
face = rounded_path(F, CORNER - 10)

# shine: an L-shaped glint hugging the face's top-left corner
A, B, C = F
k = CORNER - 10
corner_top = toward(A, B, k * 0.55)       # just past the rounded corner on the top edge
corner_left = toward(A, C, k * 0.55)
in_top = unit((-(B[1] - A[1]), B[0] - A[0]))  # normal pointing into the face from the top edge
if in_top[1] < 0: in_top = mul(in_top, -1)
glint_top = [toward(A, B, k * 0.25), toward(A, B, 0.42 * length(sub(B, A))),
             add(toward(A, B, k * 0.9), mul(in_top, 13)), add(toward(A, B, k * 0.25), mul(in_top, 12))]
glint_left = [toward(A, C, k * 0.25), add(toward(A, C, k * 0.25), (13, 0)),
              add(toward(A, C, k * 0.9), (12, 0)), toward(A, C, 0.30 * length(sub(C, A)))]
corner_dot = [toward(A, B, k * 0.32), add(A, (k * 0.17, k * 0.17)), toward(A, C, k * 0.32),
              add(add(A, (k * 0.17, k * 0.17)), (15, 15))]
# small glint on the bevel's lower-left corner, like the arrow's shoulder highlight
tip_glint = [toward(B, A, k * 0.35), toward(B, A, k * 1.15), add(toward(B, A, k * 0.6), (-2, 9))]

for name, (side, lt, md, dk) in COLORS.items():
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">
<title>Play button</title>
<defs>
<linearGradient id="face" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{lt}"/><stop offset="0.42" stop-color="{md}"/>
<stop offset="0.52" stop-color="{lt}" stop-opacity="0.9"/><stop offset="0.62" stop-color="{md}"/>
<stop offset="1" stop-color="{dk}"/>
</linearGradient>
<linearGradient id="side" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="{side}" stop-opacity="0.75"/><stop offset="1" stop-color="{side}"/>
</linearGradient>
<linearGradient id="glintT" gradientUnits="userSpaceOnUse" x1="{A[0]:.1f}" y1="{A[1]:.1f}" x2="{lerp(A, B, 0.42)[0]:.1f}" y2="{lerp(A, B, 0.42)[1]:.1f}">
<stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<linearGradient id="glintL" gradientUnits="userSpaceOnUse" x1="{A[0]:.1f}" y1="{A[1]:.1f}" x2="{lerp(A, C, 0.30)[0]:.1f}" y2="{lerp(A, C, 0.30)[1]:.1f}">
<stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
</defs>
<path d="{outer}" fill="{OUTLINE_COLOR}" stroke="{OUTLINE_COLOR}" stroke-width="{OUTLINE}" stroke-linejoin="round"/>
<path d="{outer}" fill="{side}"/>
<path d="{outer}" fill="url(#side)"/>
<path d="{face}" fill="url(#face)"/>
<polygon points="{poly(glint_top)}" fill="url(#glintT)"/>
<polygon points="{poly(glint_left)}" fill="url(#glintL)"/>
<polygon points="{poly(corner_dot)}" fill="#fff"/>
<polygon points="{poly(tip_glint)}" fill="#fff" opacity="0.7"/>
</svg>
'''
    path = os.path.join(OUT, f"play_{name}.svg")
    open(path, "w").write(svg)
    print("wrote", path)
