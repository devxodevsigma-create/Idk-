"""Generate the cartoon water spray icon as SVG (same navy outline as the other icons).

Usage:  python3 water_spray.py [out_dir]      (needs: pip install shapely)
Writes water_spray.svg (jet going right, nozzle end on the left) and
water_spray_tilted.svg (tilted 14 degrees up to line up with the water gun icons).
Layers: outline, base, dark, light, shine (plain filled paths, easy to recolor).
"""
import os, sys
from shapely import affinity
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from water_fx import make_spray, layers_svg

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
S, PAD = 512, 12

def build(angle):
    layers = make_spray((40, 300), (370, 250), 26, 62, bend=0.10, outline=15)
    if angle:
        layers = [(n, affinity.rotate(g, angle, origin=(256, 256))) for n, g in layers]
    minx, miny, maxx, maxy = layers[0][1].bounds
    sc = (S - 2 * PAD) / max(maxx - minx, maxy - miny)
    ox = S / 2 - (minx + maxx) / 2 * sc; oy = S / 2 - (miny + maxy) / 2 * sc
    return [(n, affinity.affine_transform(g, [sc, 0, 0, sc, ox, oy])) for n, g in layers]

for name, angle in (("water_spray", 0.0), ("water_spray_tilted", -14.0)):
    path = os.path.join(OUT, f"{name}.svg")
    open(path, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
                          f'<title>Water spray</title>{layers_svg(build(angle), prefix=name)}</svg>\n')
    print("wrote", path)
