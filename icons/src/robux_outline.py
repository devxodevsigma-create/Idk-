"""Rebuild the white hexagon coin icon as a vector and give it a black outline.

Usage:  python3 robux_outline.py [out_dir] [outline_px]
Writes robux_outline.svg (white icon, black outline) and robux_plain.svg
(no outline, for checking against the original 64px image).

Measurements are in the original 64x64 pixel grid.
"""
import math, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
T = float(sys.argv[2]) if len(sys.argv) > 2 else 30      # visible outline thickness (px @512)
S = 512
SCALE = (S - 2 * T - 12) / 64                          # 64-grid units -> px (leaves room for the outline)
C = 32.0                                               # icon centre in the 64 grid

def hexagon(hw):
    """Pointy-top hexagon with half-width hw (flat left/right sides)."""
    R = hw / math.cos(math.radians(30))
    return [(C + R * math.cos(math.radians(a)), C + R * math.sin(math.radians(a)))
            for a in (-90, -30, 30, 90, 150, 210)]

def square(half):
    return [(C - half, C - half), (C + half, C - half), (C + half, C + half), (C - half, C + half)]

def toward(a, b, d):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l = math.hypot(dx, dy)
    return (a[0] + dx * d / l, a[1] + dy * d / l)

def rounded(pts, d, reverse=False):
    if reverse:
        pts = pts[::-1]
    off = (S - 64 * SCALE) / 2
    P = lambda p: f"{off + p[0] * SCALE:.1f},{off + p[1] * SCALE:.1f}"
    n = len(pts)
    segs = [(toward(pts[i], pts[i - 1], d), pts[i], toward(pts[i], pts[(i + 1) % n], d)) for i in range(n)]
    path = f"M{P(segs[0][2])} "
    for a, v, b in segs[1:] + segs[:1]:
        path += f"L{P(a)} Q{P(v)} {P(b)} "
    return path + "Z"

ring = rounded(hexagon(29), 6) + " " + rounded(hexagon(21), 3.5, reverse=True)
core = rounded(hexagon(17), 4) + " " + rounded(square(5), 1, reverse=True)

def svg(outline):
    under = ""
    if outline:
        under = (f'<g fill="#000" stroke="#000" stroke-width="{2 * T:g}" stroke-linejoin="round" '
                 f'fill-rule="evenodd"><path d="{ring}"/><path d="{core}"/>'
                 # the thick outline nearly closes the centre hole, so fill it solid black
                 f'<path d="{rounded(square(5), 1)}"/></g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
            f'<title>Hexagon coin</title>{under}'
            f'<g fill="#fff" fill-rule="evenodd"><path d="{ring}"/><path d="{core}"/></g></svg>\n')

for name, outline in (("robux_outline", True), ("robux_plain", False)):
    path = os.path.join(OUT, f"{name}.svg")
    open(path, "w").write(svg(outline))
    print("wrote", path)
