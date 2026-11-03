import json,urllib.request,urllib.parse,hashlib,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'public/demo'
for city_id in ['osm-area-50058798','osm-area-1717310']:
    folder=ROOT/'transport-overlays';folder.mkdir(exist_ok=True)
    output=folder/(city_id+'.json')
    if output.exists(): print('CACHED',city_id,flush=True);continue
    ready=json.loads((ROOT/'cities'/city_id/'readiness.json').read_text(encoding='utf8'))
    b=ready['territory']['bounds']; bbox=f"{b['min_lat']},{b['min_lon']},{b['max_lat']},{b['max_lon']}"
    query=f'[out:json][timeout:60];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]({bbox});way["railway"="rail"]({bbox}););out meta geom;'
    for endpoint in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']:
        request=urllib.request.Request(endpoint,data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'Air-SGM-Ryazan-static-demo/0.3 (public OSM transport export)'})
        try:
            with urllib.request.urlopen(request,timeout=90) as response: raw=response.read()
            break
        except Exception as error:
            print('OSM server retry',endpoint,type(error).__name__,flush=True)
    else: raise RuntimeError('No public Overpass server returned transport data')
    original=json.loads(raw);assert not original.get('remark'),original.get('remark')
    rows=[]
    for way in original.get('elements',[]):
        coords=[[p['lon'],p['lat']] for p in way.get('geometry',[])];tags=way.get('tags',{})
        if len(coords)<2:continue
        feature_type='railway_osm' if tags.get('railway')=='rail' else 'road_proxy_'+tags['highway']
        rows.append({'id':f"osm-overpass-way-{way['id']}",'name':tags.get('name') or tags.get('ref') or f"OSM {tags.get('highway') or 'rail'} {way['id']}",'feature_type':feature_type,'geometry_json':json.dumps({'type':'LineString','coordinates':coords},separators=(',',':')),'min_lon':min(p[0] for p in coords),'min_lat':min(p[1] for p in coords),'max_lon':max(p[0] for p in coords),'max_lat':max(p[1] for p in coords),'source_url':f"https://www.openstreetmap.org/way/{way['id']}",'created_at':way.get('timestamp'),'data_quality':'osm_geometry_proxy','used_in_placement':False,'available_for_post_hoc':True,'osm_version':way.get('version'),'source_license':'ODbL 1.0'})
    assert rows,city_id
    snapshot={'provider':'OpenStreetMap / Overpass API','endpoint':endpoint,'query':query,'fetched_at':time.strftime('%Y-%m-%dT%H:%M:%S'),'osm_base_timestamp':original.get('osm3s',{}).get('timestamp_osm_base'),'raw_sha256':hashlib.sha256(raw).hexdigest(),'rows':rows,'license':'ODbL 1.0','scope':'actual transport ways intersecting the city bounding rectangle'}
    output.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    (folder/(city_id+'-overpass.json')).write_bytes(raw)
    print('TRANSPORT FETCHED',city_id,len(rows),flush=True)
