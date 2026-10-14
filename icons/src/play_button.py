"""Generate the rounded 'play' triangle icon (dark outline + vertical gradient).

Usage:  python3 play_button.py [out_dir]
Writes play_white.svg, play_black.svg, play_red.svg, play_green.svg.
"""
import math, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
S = 512
H, W = 352, 266            # triangle height / width (before outline); narrow like the original
OUTLINE = 76               # stroke width of the outline layer (about half shows outside)
CORNER = 56               # how far each corner's rounding reaches along the edges
OUTLINE_COLOR = "#141414"

COLORS = {                 # gradient top -> bottom
    "white": ("#ffffff", "#d3d9e4"),
    "black": ("#4b4f58", "#17181c"),
    "red":   ("#ff6a5c", "#d31620"),
    "green": ("#7ee35a", "#1f9a33"),
}

# vertices: left-top, right tip, left-bottom (centred on the canvas)
x0 = (S - W) / 2 + 6       # tiny nudge right so the shape looks optically centred
y0 = (S - H) / 2
V = [(x0, y0), (x0 + W, y0 + H / 2), (x0, y0 + H)]

def toward(a, b, d):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l = math.hypot(dx, dy)
    return (a[0] + dx * d / l, a[1] + dy * d / l)

def rounded_path(pts, d):
    n = len(pts)
    segs = []
    for i in range(n):
        p, v, q = pts[i - 1], pts[i], pts[(i + 1) % n]
        a, b = toward(v, p, d), toward(v, q, d)
        segs.append((a, v, b))
    path = f"M{segs[0][2][0]:.1f},{segs[0][2][1]:.1f} "
    for a, v, b in segs[1:] + segs[:1]:
        path += f"L{a[0]:.1f},{a[1]:.1f} Q{v[0]:.1f},{v[1]:.1f} {b[0]:.1f},{b[1]:.1f} "
    return path + "Z"

d = rounded_path(V, CORNER)
for name, (top, bot) in COLORS.items():
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">
<title>Play button</title>
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bot}"/>
</linearGradient></defs>
<path d="{d}" fill="{OUTLINE_COLOR}" stroke="{OUTLINE_COLOR}" stroke-width="{OUTLINE}" stroke-linejoin="round"/>
<path d="{d}" fill="url(#g)"/>
</svg>
'''
    path = os.path.join(OUT, f"play_{name}.svg")
    open(path, "w").write(svg)
    print("wrote", path)
