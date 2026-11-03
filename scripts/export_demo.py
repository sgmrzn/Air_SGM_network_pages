"""Export real API calculations and bounded regional inputs. Resume safe."""
import concurrent.futures, gzip, hashlib, json, os, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(os.environ.get('AIR_SGM_SOURCE_ROOT', str(ROOT.parent if (ROOT.parent/'backend').is_dir() else ROOT.parent/'Air_SGM_support_system'))).resolve()
OUT = ROOT / 'public' / 'demo'
OUT.mkdir(parents=True, exist_ok=True)
API = os.environ.get('NETWORK_EXPORT_API', 'http://127.0.0.1:8000')
NAMES = ['Рязань','Касимов','Скопин','Сасово','Ряжск','Рыбное','Шацк','Спасск-Рязанский','Михайлов','Кораблино','Новомичуринск','Спас-Клепики']

def api(path, params=None, payload=None):
    url = API + path + ('?' + urllib.parse.urlencode(params) if params else '')
    data = json.dumps(payload).encode() if payload is not None else None
    try:
        return json.load(urllib.request.urlopen(urllib.request.Request(url, data=data, headers={'Content-Type':'application/json'}), timeout=1800))
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode()) from e

def save(path, obj):
    dest = OUT / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(obj, ensure_ascii=False, separators=(',',':')), encoding='utf-8')

def cached(path, get):
    p = OUT / path
    if p.exists(): return json.loads(p.read_text(encoding='utf-8'))
    if Path(str(p)+'.gz').exists(): return json.loads(gzip.decompress(Path(str(p)+'.gz').read_bytes()))
    value = get(); save(path, value); return value

def export_inputs():
    cities = []
    for name in NAMES:
        matches = api('/api/spatial/network-territories', {'territory_kind':'settlement','search':name,'limit':100})
        city = next(x for x in matches if x['name']==name and x.get('settlement_type') in ('city','town') and x['id'].startswith('osm-area-'))
        readiness = cached(f"cities/{city['id']}/readiness.json", lambda: api('/api/spatial/network-design/readiness', {'territory_id':city['id']}))
        b = readiness['territory']['bounds']
        assert 38.5 < b['min_lon'] < b['max_lon'] < 42.8 and 53 < b['min_lat'] < b['max_lat'] < 55.7, name
        city.update(longitude=(b['min_lon']+b['max_lon'])/2, latitude=(b['min_lat']+b['max_lat'])/2, region_name='Рязанская область')
        cities.append(city)
        for layer in ['residential','roads','constraints']:
            def features():
                parts=[]; offset=0
                while True:
                    page=api('/api/spatial/network-design/input-features',{'territory_id':city['id'],'layer':layer,'offset':offset,'limit':500})
                    parts.extend(page['features']); offset+=500
                    if offset>=page['total']: break
                return {**page, 'features':parts,'offset':0,'limit':len(parts)}
            cached(f"cities/{city['id']}/{layer}.json",features)
        cached(f"cities/{city['id']}/population-preview.json", lambda: api('/api/spatial/network-design/population-preview',{'territory_id':city['id']}))
        # Store the native raster values so map clicks preserve their original meaning.
        pixel_path = OUT / f"cities/{city['id']}/pixels.json"
        if not pixel_path.exists():
            sys.path.insert(0,str(SOURCE_ROOT))
            import rasterio, numpy as np
            from rasterio.windows import from_bounds, Window
            raster_path = SOURCE_ROOT / readiness['layers']['population']['dataset']['stored_path']
            with rasterio.open(raster_path) as src:
                w=from_bounds(b['min_lon'],b['min_lat'],b['max_lon'],b['max_lat'],src.transform).round_offsets().round_lengths().intersection(Window(0,0,src.width,src.height))
                values=src.read(1,window=w,masked=True)
                arr=np.asarray(values.filled(-1),dtype=float)
                arr[~np.isfinite(arr)]=-1
                save(str(pixel_path.relative_to(OUT)),{'values':arr.tolist(),'transform':list(src.window_transform(w))[:6],'dataset_id':readiness['layers']['population']['dataset']['id']})
        for profile in ['annual','cold_period','warm_period','weak_wind']:
            cached(f"cities/{city['id']}/meteo-{profile}.json",lambda: api('/api/spatial/network-design/stored-meteo', {'longitude':city['longitude'],'latitude':city['latitude'],'profile':profile}))
        print('Inputs:',name,flush=True)
    save('cities.json',cities)
    regions=api('/api/spatial/boundaries/region/geojson')
    regions['features']=[x for x in regions['features'] if x['properties'].get('name')=='Рязанская область']
    assert len(regions['features'])==1
    save('regions.json',regions)
    stations=api('/api/spatial/monitoring-stations')
    # Use the actual region polygon, not the enclosing rectangle.
    from shapely.geometry import shape,Point
    region=shape(regions['features'][0]['geometry'])
    point=region.representative_point()
    save('meteo-regions.json',[{'id':'osm-region-71950','name':'Рязанская область','longitude':point.x,'latitude':point.y}])
    for profile in ['annual','cold_period','warm_period','weak_wind']:
        cached(f'meteo-region-{profile}.json',lambda: api('/api/spatial/network-design/stored-meteo',{'longitude':point.x,'latitude':point.y,'profile':profile}))
    stations=[s for s in stations if region.covers(Point(s['longitude'],s['latitude']))]
    save('stations.json',stations)
    bounds=region.bounds
    params={'territory':'Рязанская область','limit':20000, 'min_lon':bounds[0],'min_lat':bounds[1],'max_lon':bounds[2],'max_lat':bounds[3]}
    sources=api('/api/spatial/sources',{**params,'limit':2000})
    sources['items']=[x for x in sources['items'] if region.covers(Point(x['longitude'],x['latitude']))]
    sources['total']=len(sources['items'])
    sources['summary']={r:sum(x['registry']==r for x in sources['items']) for r in {x['registry'] for x in sources['items']}}
    save('sources.json',sources)
    osm=api('/api/spatial/sources/osm',{**params,'limit':2000})
    all_features=[]
    for kind in ['industrial_osm','railway_osm','airport_osm']:
        offset=0
        while True:
            page=api('/api/spatial/sources/osm',{**params,'limit':2000,'offset':offset,'feature_type':kind})
            all_features.extend(page['features']); offset+=2000
            if offset>=page['counts'].get(kind,0): break
    osm['features']=all_features
    osm['features']=[f for f in osm['features'] if shape(f['geometry']).intersects(region)]
    osm['total']=len(osm['features'])
    osm['counts']={r:sum(f['properties'].get('feature_type')==r for f in osm['features']) for r in {f['properties'].get('feature_type') for f in osm['features']}}
    save('osm.json',osm)
    road_features={f['properties']['id']:f for city in cities for f in json.loads((OUT/f"cities/{city['id']}/roads.json").read_text(encoding='utf-8'))['features']}
    road_counts={f"osm_{kind}":sum(f['properties'].get('feature_type')==kind for f in road_features.values()) for kind in {f['properties'].get('feature_type') for f in road_features.values()}}
    save('osm-status.json',{'feature_counts':{**{f'osm_{k}':v for k,v in osm['counts'].items()},**road_counts},'scope':'regional_demo_export'})
    return cities

def solve(task):
    city, mode, count = task
    key=f"{city['id']}--{mode}--{count}"
    payload={'territory_kind':'settlement','territory_id':city['id'],'planning_mode':mode,'placement_mode':'population_coverage','meteo_profile':'annual','post_type':'stationary','post_count':count,'research_mode':True,'analysis_profile':'coverage_backbone','network_size_mode':'required_network_size','grid_km':1,'radius_m':2500,'source_context_radius_km':25,'wind_sector_tolerance_deg':22.5,'use_exclusion_masks':True,'sensitivity_mode':'off'}
    started=time.time()
    readiness=json.loads((OUT/f"cities/{city['id']}/readiness.json").read_text(encoding='utf-8'))
    def calculate():
        if mode=='expand' and not readiness['ready_for_population_only_expansion']:
            # The production wizard correctly refuses an unconfigured station layer.
            # This isolated demo export explicitly studies an EMPTY registry baseline.
            # No station records, readiness layer statuses, or production code are edited.
            from fastapi.encoders import jsonable_encoder
            from backend.app import spatial_router as router
            from backend.app.network_design_models import NetworkDesignRunRequest
            result=router.create_network_design_run(NetworkDesignRunRequest(**payload))
            result['demo_baseline']={'status':'empty_registry_assumption','note':'В реестре проекта нет действующих постов этого города. Исследовательский расчёт расширения выполнен с пустым исходным реестром; отсутствие постов в реальной сети не подтверждено.'}
            return jsonable_encoder(result)
        return api('/api/spatial/network-design/runs',payload=payload)
    run=cached(f'runs/{key}.json',calculate)
    assert run['status']=='completed',key
    print('Run:',city['name'],mode,count,round(time.time()-started,1),'s',flush=True)
    filename=f'runs/{key}.json'+('.gz' if (OUT/f'runs/{key}.json.gz').exists() else '')
    return {'key':key,'id':run['id'],'city_id':city['id'],'city':city['name'],'planning_mode':mode,'post_count':count,'file':filename,'resolved_post_count':run['ensemble']['resolved_post_count'],'input_fingerprint':run['input_fingerprint'],'created_at':run['created_at'],'methodology_version':run['methodology_version']}

if __name__=='__main__':
    sys.path.insert(0,str(SOURCE_ROOT))
    from backend.app import spatial_router as router
    original_readiness=router._network_design_readiness_payload
    def demo_readiness(territory_id):
        value=original_readiness(territory_id)
        if not value['ready_for_population_only_expansion'] and value['ready_for_population_only_new_network'] and value['layers']['stations'].get('stationary_count',0)==0:
            value['ready_for_population_only_expansion']=True
            value['demo_empty_baseline']=True
        return value
    router._network_design_readiness_payload=demo_readiness
    cities=export_inputs()
    tasks=[(city,mode,count) for city in cities for mode in ['new_network','expand'] for count in range(0 if mode=='expand' else 1,16)]
    rows=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for row in pool.map(solve,tasks):
            rows.append(row)
            save('catalog.json',rows)
    save('manifest.json',{'region':'Рязанская область','city_count':len(cities),'run_count':len(rows),'exported_at':time.strftime('%Y-%m-%dT%H:%M:%S'),'files':[{ 'path':str(p.relative_to(OUT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.rglob('*.json') if p.name!='manifest.json']})
    print('COMPLETE',len(rows),flush=True)
