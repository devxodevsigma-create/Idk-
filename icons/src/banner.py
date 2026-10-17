"""Compose the Wash & Paint banner (1920x1080, no text) from the icon SVGs.

Usage:  python3 banner.py [icons_dir] [out_dir]
Left half: paint theme with the roller. Right half: water theme with the pump
water gun spraying toward the centre. Icons are embedded as nested SVGs.
"""
import math, os, random, re, sys

ICONS = sys.argv[1] if len(sys.argv) > 1 else ".."
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
W, H = 1920, 1080
NAVY = "#232647"
random.seed(7)

def icon(name, x, y, size, rot=0, flip=False):
    """Place a 512x512 icon centred at (x, y)."""
    src = open(os.path.join(ICONS, name)).read()
    inner = re.sub(r"^.*?<svg[^>]*>", "", src, flags=re.S).rsplit("</svg>", 1)[0]
    inner = re.sub(r"<title>.*?</title>", "", inner)
    inner = re.sub(r'id="([a-z]+)"', lambda m: f'id="{name[:-4]}-{m.group(1)}"', inner)
    s = size / 512
    fx = -s if flip else s
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({fx} {s}) translate(-256 -256)">'
            f'{inner}</g>')

def wave(x_top, x_bot, amp, offset=0.0):
    """Wavy diagonal from the top edge to the bottom edge."""
    pts = []
    for i in range(41):
        t = i / 40
        y = -20 + (H + 40) * t
        x = x_top + (x_bot - x_top) * t + amp * math.sin(t * math.pi * 4 + offset) + offset * 0
        pts.append((x, y))
    return pts

def poly(pts):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)

def rays(cx, cy, n, color, op):
    out = []
    for i in range(n):
        a0 = 2 * math.pi * i / n; a1 = a0 + math.pi / n
        r = 1600
        out.append(f'<polygon points="{cx},{cy} {cx + r * math.cos(a0):.0f},{cy + r * math.sin(a0):.0f} '
                   f'{cx + r * math.cos(a1):.0f},{cy + r * math.sin(a1):.0f}" fill="{color}" opacity="{op}"/>')
    return "".join(out)

def splat(cx, cy, r, color, op):
    """Paint splat: a blob with round droplets around it."""
    parts = [f'<circle cx="{cx}" cy="{cy}" r="{r}"/>']
    for i in range(9):
        a = random.uniform(0, 2 * math.pi)
        d = r * random.uniform(0.8, 1.15)
        rr = r * random.uniform(0.3, 0.5)
        parts.append(f'<circle cx="{cx + d * math.cos(a):.0f}" cy="{cy + d * math.sin(a):.0f}" r="{rr:.0f}"/>')
        d2 = r * random.uniform(1.5, 2.0)
        parts.append(f'<circle cx="{cx + d2 * math.cos(a + 0.3):.0f}" cy="{cy + d2 * math.sin(a + 0.3):.0f}" '
                     f'r="{r * random.uniform(0.1, 0.18):.0f}"/>')
    return f'<g fill="{color}" opacity="{op}">{"".join(parts)}</g>'

def sparkle(x, y, s, op=0.95):
    p = f"M{x},{y - s} Q{x + s * .18},{y - s * .18} {x + s},{y} Q{x + s * .18},{y + s * .18} {x},{y + s} " \
        f"Q{x - s * .18},{y + s * .18} {x - s},{y} Q{x - s * .18},{y - s * .18} {x},{y - s} Z"
    return f'<path d="{p}" fill="#fff" opacity="{op}"/>'

divider = wave(1040, 880, 26)
left_clip = [(-10, -20)] + divider + [(-10, H + 20)]
right_clip = [(W + 10, -20)] + divider + [(W + 10, H + 20)]

paint_bg = "".join(splat(x, y, r, c, op) for x, y, r, c, op in [
    (170, 170, 90, "#ffd23a", 0.55), (760, 120, 60, "#ffffff", 0.25), (120, 860, 110, "#ffe14d", 0.45),
    (640, 960, 70, "#ffffff", 0.22), (880, 520, 50, "#ffd23a", 0.4), (380, 640, 40, "#ffffff", 0.18)])
bubbles = "".join(
    f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" '
    f'stroke-opacity="0.55" stroke-width="{max(4, r / 7):.0f}"/>'
    f'<circle cx="{x - r * .35:.0f}" cy="{y - r * .35:.0f}" r="{r * .18:.0f}" fill="#fff" opacity="0.7"/>'
    for x, y, r in [(1180, 140, 46), (1760, 120, 64), (1840, 520, 38), (1690, 930, 70), (1210, 960, 40),
                    (1500, 80, 26), (1110, 760, 30), (1880, 800, 24)])

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<title>Wash and Paint banner</title>
<defs>
<linearGradient id="paintBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb02e"/><stop offset="0.55" stop-color="#ff6a3d"/><stop offset="1" stop-color="#ff3d8b"/></linearGradient>
<linearGradient id="waterBg" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fe0ff"/><stop offset="0.5" stop-color="#2aa6ff"/><stop offset="1" stop-color="#1f5fe0"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0b0d2a" stop-opacity="0.35"/></radialGradient>
<clipPath id="leftSide"><polygon points="{poly(left_clip)}"/></clipPath>
<clipPath id="rightSide"><polygon points="{poly(right_clip)}"/></clipPath>
</defs>
<g clip-path="url(#leftSide)">
  <rect width="{W}" height="{H}" fill="url(#paintBg)"/>
  {rays(470, 540, 18, "#ffffff", 0.08)}
  {paint_bg}
  <ellipse cx="470" cy="540" rx="430" ry="400" fill="url(#glow)"/>
</g>
<g clip-path="url(#rightSide)">
  <rect width="{W}" height="{H}" fill="url(#waterBg)"/>
  {rays(1430, 540, 18, "#ffffff", 0.08)}
  {bubbles}
  <ellipse cx="1430" cy="540" rx="430" ry="400" fill="url(#glow)"/>
</g>
<polyline points="{poly(divider)}" fill="none" stroke="{NAVY}" stroke-width="44" stroke-linejoin="round"/>
<polyline points="{poly(divider)}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linejoin="round"/>
<rect width="{W}" height="{H}" fill="url(#vignette)"/>
{icon("water_spray_tilted.svg", 815, 395, 600, rot=0, flip=True)}
{icon("paint_roller_2.svg", 480, 540, 880)}
{icon("water_gun_2.svg", 1440, 560, 860, flip=True)}
{icon("water_drop.svg", 1000, 205, 120, rot=-18)}
{icon("water_drop.svg", 1095, 880, 90, rot=22)}
{sparkle(860, 170, 34)}{sparkle(130, 470, 24)}{sparkle(1820, 330, 30)}{sparkle(1260, 290, 22)}{sparkle(780, 880, 26)}{sparkle(1560, 990, 22)}
</svg>
'''
path = os.path.join(OUT, "wash_and_paint_banner.svg")
open(path, "w").write(svg)
print("wrote", path)
