"""Precompute original Air SGM mode/profile runs; no server or database writes."""
import sys, json, gzip, time, hashlib, copy, argparse, os, concurrent.futures, subprocess, functools, inspect
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(os.environ.get('AIR_SGM_SOURCE_ROOT',str(ROOT.parent if (ROOT.parent/'backend').is_dir() else ROOT.parent/'Air_SGM_support_system'))).resolve()
os.environ.setdefault('POSTGRES_POOL_MIN_SIZE','1')
os.environ.setdefault('POSTGRES_POOL_MAX_SIZE','2')
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
os.environ.setdefault('OMP_NUM_THREADS','1')
sys.path.insert(0,str(SOURCE))
from fastapi.encoders import jsonable_encoder
from backend.app import spatial_router as router
from backend.app.network_design_models import NetworkDesignRunRequest
from backend.app import network_analysis, network_design
OUT=ROOT/'public/demo'
# Exact bounding-box rejection before the unchanged ray-crossing predicate.
# Parsing immutable imported geometries once also avoids millions of repeated
# JSON parses in point refinement. This affects only this export process.
_loads=json.loads
@functools.lru_cache(maxsize=12000)
def geometry_loads(value): return _loads(value)
def loads(value,*args,**kwargs):
    if isinstance(value,str) and '"coordinates"' in value[:200] and '"type"' in value[:100] and len(value)<250000 and not args and not kwargs:
        return geometry_loads(value)
    return _loads(value,*args,**kwargs)
json.loads=loads
_point=network_analysis.point_in_geometry
_bounds={}
def bounded_point(lon,lat,geometry):
    if not geometry: return _point(lon,lat,geometry)
    record=_bounds.get(id(geometry))
    if record is None or record[0] is not geometry:
        rings=network_analysis._rings(geometry)
        points=[point for ring in rings for point in ring]
        bounds=(min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)) if points else None
        if len(_bounds)>20000: _bounds.clear()
        _bounds[id(geometry)]=(geometry,bounds)
    else: bounds=record[1]
    if bounds and (lon<bounds[0] or lon>bounds[2] or lat<bounds[1] or lat>bounds[3]): return False
    return _point(lon,lat,geometry)
network_analysis.point_in_geometry=bounded_point
network_design.point_in_geometry=bounded_point
router.point_in_geometry=bounded_point
router._persist_network_design_run=lambda record: None
router.spatial_repository.save_network_design_cache=lambda *args, **kwargs: None
OVERLAYS={file.stem:json.loads(file.read_text(encoding='utf8')) for file in (OUT/'transport-overlays').glob('*.json') if not file.stem.endswith('-overpass')}
LOCAL_WEIGHTS={'road_proxy_secondary':.25,'road_proxy_secondary_link':.25,'road_proxy_tertiary':.125,'road_proxy_tertiary_link':.125}
def transport_meta(city_id):
    overlay=OVERLAYS.get(city_id)
    if not overlay: return None
    return {'dataset_id':overlay['raw_sha256'],'provider':overlay['provider'],'fetched_at':overlay['fetched_at'],'osm_base_timestamp':overlay['osm_base_timestamp'],'road_count':len(overlay['rows']),'class_weights':LOCAL_WEIGHTS,'source_url':overlay['endpoint'],'license':overlay['license'],'note':'Для этого города транспортный критерий дополнен местными дорогами OSM: secondary — вес 0,25; tertiary — вес 0,125. Это условные геометрические веса скрининга, а не измеренная интенсивность движения или доли загрязнения.'}
original_context=router._network_context_records
def overlay_context(bounds):
    records=original_context(bounds)
    west,south,east,north=bounds
    seen={str(row['id']) for row in records}
    for overlay in OVERLAYS.values():
        for row in overlay['rows']:
            if row['max_lon']>=west and row['min_lon']<=east and row['max_lat']>=south and row['min_lat']<=north and row['id'] not in seen:
                records.append({**row,'demo_transport_dataset_id':overlay['raw_sha256']})
                seen.add(row['id'])
    return records
router._network_context_records=overlay_context
original_scores=router._network_context_proximity_scores
score_source=inspect.getsource(original_scores)
anchor='"road_proxy_primary": 0.5,'
assert anchor in score_source
score_source=score_source.replace(anchor,anchor+'\n        '+',\n        '.join(f'"{key}": {value}' for key,value in LOCAL_WEIGHTS.items())+',')
score_namespace=dict(router.__dict__);exec(compile(score_source,'<demo-local-road-proxy>','exec'),score_namespace)
extended_scores=score_namespace[original_scores.__name__]
def scores(points,records):
    return (extended_scores if any(r.get('demo_transport_dataset_id') for r in records) else original_scores)(points,records)
router._network_context_proximity_scores=scores
original_snapshot=router._network_design_dataset_snapshot
def snapshot(value):
    result=original_snapshot(value)
    meta=transport_meta(value['territory']['id'])
    if meta: result['demo_transport_dataset']=meta
    return result
router._network_design_dataset_snapshot=snapshot
original_readiness=router._network_design_readiness_payload
original_readiness=functools.lru_cache(maxsize=16)(original_readiness)
def readiness(territory_id):
    value=copy.deepcopy(original_readiness(territory_id))
    if not value['ready_for_population_only_expansion'] and value['ready_for_population_only_new_network'] and value['layers']['stations'].get('stationary_count',0)==0:
        value['ready_for_population_only_expansion']=True
    return value
router._network_design_readiness_payload=readiness
MODES=['population_coverage','industrial_influence','transport_influence','urban_background','integrated_screening']
PROFILES=['annual','cold_period','warm_period','weak_wind','calm_accumulation','accumulation_risk']
def pack(file, data):
    file.parent.mkdir(parents=True,exist_ok=True)
    temp=file.with_suffix(file.suffix+'.tmp')
    temp.write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode(),compresslevel=6))
    replace_retry(temp,file)
def replace_retry(temp,file):
    for attempt in range(40):
        try: temp.replace(file); return
        except PermissionError:
            if attempt==39: raise
            time.sleep(.1)
def changes(old, new, path=()):
    if old==new and json.dumps(old,separators=(',',':'),sort_keys=True)==json.dumps(new,separators=(',',':'),sort_keys=True): return []
    if type(old)!=type(new): return [[list(path),new]]
    if isinstance(new,dict) and old.keys()==new.keys():
        return [entry for key in new for entry in changes(old[key],new[key],(*path,key))]
    if isinstance(new,list) and len(old)==len(new):
        return [entry for i,value in enumerate(new) for entry in changes(old[i],value,(*path,i))]
    return [] if old==new else [[list(path),new]]
def unpack(file):
    return json.loads(gzip.decompress(file.read_bytes()))
def calculate(city, mode, profile, planning, count):
    payload=dict(territory_kind='settlement',territory_id=city['id'],planning_mode=planning,placement_mode=mode,meteo_profile=profile,post_type='stationary',post_count=count,research_mode=True,analysis_profile='coverage_backbone',network_size_mode='required_network_size',grid_km=1,radius_m=2500,source_context_radius_km=25,wind_sector_tolerance_deg=22.5,use_exclusion_masks=True,sensitivity_mode='off')
    start=time.perf_counter()
    raw=router.create_network_design_run(NetworkDesignRunRequest(**payload))
    run=_loads(json.dumps(raw,ensure_ascii=False,separators=(',',':'),default=jsonable_encoder))
    with router._network_runs_lock: router._network_design_runs.clear()
    _bounds.clear()
    if planning=='expand' and run['readiness']['layers']['stations'].get('stationary_count',0)==0:
        run['demo_baseline']={'status':'empty_registry_assumption','note':'В реестре проекта нет действующих постов этого города. Исследовательский расчёт расширения выполнен с пустым исходным реестром; отсутствие постов в реальной сети не подтверждено.'}
    run['demo_export']={'calculated_at':time.strftime('%Y-%m-%dT%H:%M:%S'),'source':'original_air_sgm_backend','snapshot':'2026-10-12','precomputed':True}
    meta=transport_meta(city['id'])
    if meta:
        run['demo_transport_snapshot']=meta
        run['methodology_version']+='-demo-local-roads-v1'
    return run
def worker(city, only_mode=None):
    folder=OUT/'prepared'/city['id']; folder.mkdir(parents=True,exist_ok=True)
    index=folder/(f'index-{only_mode}.json' if only_mode else 'index.json')
    rows=json.loads(index.read_text(encoding='utf8')) if index.exists() else []
    bykey={row['key']:row for row in rows}
    started=time.time()
    for mode in MODES:
      if only_mode and mode!=only_mode: continue
      for profile in PROFILES:
       for planning in ['new_network','expand']:
        base_file=f"prepared/{city['id']}/{mode}--{profile}--{planning}--base.json.gz"
        base_path=OUT/base_file
        base=unpack(base_path) if base_path.exists() else None
        for count in range(0 if planning=='expand' else 1,16):
            key=f"{city['id']}--{mode}--{profile}--{planning}--{count}"
            if key in bykey and (OUT/bykey[key]['file']).exists() and (not transport_meta(city['id']) or bykey[key].get('transport_snapshot')==transport_meta(city['id'])['dataset_id']): continue
            run=calculate(city,mode,profile,planning,count)
            file=f"prepared/{city['id']}/{mode}--{profile}--{planning}--{count}.json.gz"
            if base is None:
                base=run; pack(base_path,base)
            patch=changes(base,run)
            encoded={'format':'air-sgm-run-delta-v1','base_file':base_file,'changes':patch,'sha256':hashlib.sha256(json.dumps(run,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()).hexdigest()}
            # Verify exact round-trip before storing the result.
            restored=copy.deepcopy(base)
            for path,value in patch:
                if not path: restored=value; continue
                parent=restored
                for part in path[:-1]: parent=parent[part]
                parent[path[-1]]=value
            assert restored==run,key
            pack(OUT/file,encoded)
            row={'key':key,'id':run['id'],'city_id':city['id'],'city':city['name'],'planning_mode':planning,'placement_mode':mode,'meteo_profile':profile,'post_count':count,'file':file,'resolved_post_count':run['ensemble']['resolved_post_count'],'input_fingerprint':run['input_fingerprint'],'created_at':run['created_at'],'methodology_version':run['methodology_version'],'empty_baseline':bool(run.get('demo_baseline')),'generated_report':True}
            if meta:=transport_meta(city['id']): row['transport_snapshot']=meta['dataset_id']
            bykey[key]=row
            index_tmp=index.with_suffix('.tmp'); index_tmp.write_text(json.dumps(list(bykey.values()),ensure_ascii=False),encoding='utf8'); replace_retry(index_tmp,index)
            if len(bykey)%10==0: print(city['id'],len(bykey),'/930',round(time.time()-started,1),'s',flush=True)
    print('CITY COMPLETE',city['id'],len(bykey),flush=True)
def launch(task):
    city,mode=task
    return subprocess.run([sys.executable,str(Path(__file__).resolve()),'--city',city['id'],'--mode',mode],env={**os.environ,'PYTHONUTF8':'1','OMP_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','MKL_NUM_THREADS':'1'}).returncode
if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--city'); parser.add_argument('--mode'); parser.add_argument('--all',action='store_true'); args=parser.parse_args()
    cities=json.loads((OUT/'cities.json').read_text(encoding='utf8'))
    if args.city: worker(next(city for city in cities if city['id']==args.city),args.mode)
    elif args.all:
        for city in cities:
            folder=OUT/'prepared'/city['id']; folder.mkdir(parents=True,exist_ok=True)
            index=folder/'index.json'
            existing={r['key']:r for f in folder.glob('index*.json') for r in json.loads(f.read_text(encoding='utf8'))}
            if not index.exists(): index.write_text('[]',encoding='utf8')
            for mode in MODES:
                mode_index=folder/f'index-{mode}.json'
                mode_index.write_text(json.dumps([r for r in existing.values() if r['placement_mode']==mode],ensure_ascii=False),encoding='utf8')
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(6,os.cpu_count() or 4)) as pool:
            codes=list(pool.map(launch,[(city,mode) for city in cities for mode in MODES]))
        assert not any(codes),codes
        rows=[row for city in cities for mode in MODES for row in json.loads((OUT/'prepared'/city['id']/f'index-{mode}.json').read_text(encoding='utf8'))]
        assert len(rows)==11160,len(rows)
        (OUT/'catalog-next.json').write_text(json.dumps(rows,ensure_ascii=False),encoding='utf8')
        print('ALL COMPLETE',len(rows),flush=True)
    else:
        for count in [1,7,15]:
            start=time.time(); run=calculate(cities[0],'integrated_screening','annual','new_network',count)
            pack(ROOT/f'scripts/trial-{count}.json.gz',run)
            print('TRIAL',count,round(time.time()-start,2),'s',flush=True)
