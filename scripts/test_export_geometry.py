"""Boundary/hole/multipolygon checks for the export-only exact rejection."""
import runpy, random
from pathlib import Path
module=runpy.run_path(str(Path(__file__).with_name('precompute_modes.py')))
original,accelerated=module['_point'],module['bounded_point']
ring=[[0,0],[4,0],[4,4],[0,4],[0,0]]
hole=[[1,1],[3,1],[3,3],[1,3],[1,1]]
geometries=[None,{'type':'Polygon','coordinates':[ring]},{'type':'Polygon','coordinates':[ring,hole]},{'type':'MultiPolygon','coordinates':[[ring,hole],[[[10,10],[12,10],[12,12],[10,12],[10,10]]]]}]
points=[(x,y) for x in [0,1,2,3,4,10,11,12] for y in [0,1,2,3,4,10,11,12]]
rng=random.Random(2718)
points += [(rng.uniform(-1,13),rng.uniform(-1,13)) for _ in range(500)]
for geometry in geometries:
    for lon,lat in points:
        assert original(lon,lat,geometry)==accelerated(lon,lat,geometry),(lon,lat,geometry)
print('Exact geometry checks:',len(geometries)*len(points))
