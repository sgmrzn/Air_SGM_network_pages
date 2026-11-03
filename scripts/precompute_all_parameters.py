"""Export every discrete wizard configuration with the original calculation code."""
import precompute_modes as export
from precompute_modes import router,network_design,NetworkDesignRunRequest
import json,gzip,hashlib,copy,time,functools,argparse,os,sys,subprocess,concurrent.futures,ast,inspect
from pathlib import Path
from collections import OrderedDict

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),default=str).encode()).hexdigest()

def memo(function,limit=64):
    cache=OrderedDict()
    @functools.wraps(function)
    def call(*args,**kwargs):
        key=digest([args,kwargs])
        if key not in cache:
            cache[key]=copy.deepcopy(function(*args,**kwargs))
            if len(cache)>limit:cache.popitem(last=False)
        else:cache.move_to_end(key)
        return copy.deepcopy(cache[key])
    return call

for name in ['_candidate_factor_scores','_source_wind_scores','_network_context_proximity_scores','_network_design_social_features','_coverage_boundary_layers','_network_design_dataset_snapshot','_network_design_meteo_fingerprint']:
    setattr(router,name,memo(getattr(router,name),16))
for name in ['known_source_zones','network_constraints','get_detail_zone','list_monitoring_stations','active_population_dataset']:
    setattr(router.spatial_repository,name,memo(getattr(router.spatial_repository,name),64))
original_rose=router._network_design_territory_rose
rose_cache={}
def territory_rose(repository,geometry,scenario,**kwargs):
    key=digest([geometry,scenario,kwargs])
    if key not in rose_cache:rose_cache[key]=original_rose(repository,geometry,scenario,**kwargs)
    return copy.deepcopy(rose_cache[key])
router._network_design_territory_rose=territory_rose

original_refine=router._refine_candidate_points
refinement_cache=OrderedDict()
def refine(design,**kwargs):
    key=digest([[(r['cell_id'],r['longitude'],r['latitude']) for r in design.get('scenarios',[])],design.get('candidate_zones_geojson'),design.get('spacing',{}).get('max_guideline_km'),kwargs])
    if key not in refinement_cache:
        result=original_refine(design,**kwargs)
        refinement_cache[key]=(copy.deepcopy(result),[{k:copy.deepcopy(r[k]) for k in ['site_suitability','nearest_post_km'] if k in r} for r in design.get('scenarios',[])],copy.deepcopy(design.get('spacing',{})))
        if len(refinement_cache)>256:refinement_cache.popitem(last=False)
    result,updates,spacing=refinement_cache[key]
    for row,update in zip(design.get('scenarios',[]),updates):
        for key in ['site_suitability','nearest_post_km']:
            row.pop(key,None)
        row.update(copy.deepcopy(update))
    design['spacing']=copy.deepcopy(spacing)
    return copy.deepcopy(result)
router._refine_candidate_points=refine

# Optimizer diagnostics are an explicit output argument, so retain them as
# well as the selected set. Cached inputs must be identical, not truncated.
original_optimizer=network_design._maximum_coverage
assert not any(isinstance(node,ast.Name) and node.id=='factor_scores' for node in ast.walk(ast.parse(inspect.getsource(original_optimizer))))
optimizer_cache=OrderedDict()
def optimizer(*args,**kwargs):
    diagnostics=kwargs.pop('optimization_diagnostics',None)
    # _maximum_coverage never reads factor_scores; ranking uses them later in
    # the unmodified design_scenarios. An exact-size request above the pool
    # is infeasible, and must never alias the request equal to the pool.
    cache_arguments={k:v for k,v in kwargs.items() if k!='factor_scores'}
    if args and not cache_arguments.get('exact_post_count'):
        cache_arguments['post_count']=min(cache_arguments['post_count'],len(args[0]))
    key=digest([args,cache_arguments])
    if key not in optimizer_cache:
        values={}
        result=original_optimizer(*args,**kwargs,optimization_diagnostics=values)
        optimizer_cache[key]=(copy.deepcopy(result),copy.deepcopy(values))
        if len(optimizer_cache)>256:optimizer_cache.popitem(last=False)
    result,values=optimizer_cache[key]
    if diagnostics is not None:diagnostics.update(copy.deepcopy(values))
    return copy.deepcopy(result)
network_design._maximum_coverage=optimizer

original_context=router._network_source_wind_context
context_cache=OrderedDict()
def source_context(candidates,**kwargs):
    key=digest([[(c.get('cell_id'),c.get('longitude'),c.get('latitude')) for c in candidates],kwargs])
    if key not in context_cache:
        summary=original_context(candidates,**kwargs)
        context_cache[key]=(copy.deepcopy(summary),[copy.deepcopy(c.get('source_wind_context')) for c in candidates])
        if len(context_cache)>512:context_cache.popitem(last=False)
    summary,contexts=context_cache[key]
    for candidate,context in zip(candidates,contexts):
        if context is not None:candidate['source_wind_context']=copy.deepcopy(context)
    return copy.deepcopy(summary)
router._network_source_wind_context=source_context
router._network_design_with_capacity=memo(router._network_design_with_capacity,32)

BLOCK_KEYS={'readiness','dataset_snapshot','boundary_layers','context_layers','population_geojson','territory_wind_rose','wind_rose','role_assessment','source_wind_context','source_wind_context_by_profile','presentation_geojson','sources','candidate_zones_geojson','map_geojson','candidates_geojson','alternatives_geojson','alternative_candidates_geojson','result','scenarios','core_recommendations','scenario_alternatives','normative_requirements','methodology','site_selection','rationale'}
def canonical(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),sort_keys=True,allow_nan=False,default=export.jsonable_encoder).encode()
def save(file,value):
    file.parent.mkdir(parents=True,exist_ok=True)
    temp=file.with_name(file.name+f'.tmp-{os.getpid()}')
    temp.write_bytes(gzip.compress(canonical(value),compresslevel=6));export.replace_retry(temp,file)
def encode_run(run,city_id):
    folder=export.OUT/'shared'/city_id
    blocks={}
    def encode(value,key=''):
        if key in BLOCK_KEYS and key not in {'source_wind_context','source_wind_context_by_profile','result','scenarios','core_recommendations','scenario_alternatives'} and isinstance(value,(dict,list)) and len(canonical(value))>=1200:
            block=value
        else:
            packed={k:encode(v,k) for k,v in value.items()} if isinstance(value,dict) else [encode(v) for v in value] if isinstance(value,list) else value
            if key not in {'source_wind_context','source_wind_context_by_profile','result','scenarios','core_recommendations','scenario_alternatives'} or len(canonical(packed))<1200:return packed
            block=packed
        content=canonical(block);hash_value=hashlib.sha256(content).hexdigest();file=folder/(hash_value+'.json.gz')
        if not file.exists():save(file,block)
        blocks[hash_value]=block
        return {'$air_sgm_block':hash_value}
    def decode(value):
        if isinstance(value,dict) and set(value)=={'$air_sgm_block'}:
            block=blocks[value['$air_sgm_block']]
            return decode(block) if b'"$air_sgm_block"' in canonical(block) else block
        if isinstance(value,dict):return {k:decode(v) for k,v in value.items()}
        if isinstance(value,list):return [decode(v) for v in value]
        return value
    tree=encode(run)
    assert decode(tree)==run
    return tree

def configuration_name(city,mode,grid,radius,masks,size):
    return f"{city['id']}--{mode}--g{grid:g}--r{radius}--m{int(masks)}--{size}"

def worker(city,mode,base_only=False):
    configs=[(g,r,m,s) for g in [1,.5] for r in [2500,5000,10000] for m in [True,False] for s in ['required_network_size','budget_ceiling']]
    if base_only:configs=configs[:1]
    for grid,radius,masks,size in configs:
        name=configuration_name(city,mode,grid,radius,masks,size)
        file=export.OUT/'presets'/(name+'.json.gz')
        bundle=export.unpack(file) if file.exists() else {'format':'air-sgm-preset-bundle-v1','shared_dir':f"shared/{city['id']}/",'runs':{},'hashes':{}}
        started=time.time();added=0
        for planning in ['new_network','expand']:
          for count in range(0 if planning=='expand' else 1,16):
           for profile in export.PROFILES:
            for research in [False,True]:
                key=f'{profile}|{planning}|{count}|{"research" if research else "quick"}'
                if key in bundle['runs']:continue
                run=calculate(city,mode,profile,planning,count,grid,radius,masks,size,research)
                bundle['runs'][key]=encode_run(run,city['id'])
                bundle['hashes'][key]=hashlib.sha256(canonical(run)).hexdigest()
                added+=1
                if added%12==0:
                    save(file,bundle)
                    print('PRESET',name,len(bundle['runs']),'/372',round(time.time()-started,1),'s',flush=True)
        save(file,bundle)
        assert len(bundle['runs'])==372
        print('COMPLETE',name,flush=True)

def launch(task):
    city,mode,base_only=task
    argv=[sys.executable,str(Path(__file__).resolve()),'--city',city['id'],'--mode',mode]
    if base_only:argv.append('--base-only')
    return subprocess.run(argv,env={**os.environ,'PYTHONUTF8':'1','OMP_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','MKL_NUM_THREADS':'1'}).returncode

def calculate(city,mode,profile,planning,count,grid=1,radius=2500,masks=True,size='required_network_size',research=False):
    request=NetworkDesignRunRequest(territory_id=city['id'],placement_mode=mode,meteo_profile=profile,planning_mode=planning,post_count=count,research_mode=True,grid_km=grid,radius_m=radius,use_exclusion_masks=masks,network_size_mode=size,analysis_profile='extended_diagnostics' if research else 'coverage_backbone',sensitivity_mode='standard' if research else 'off')
    raw=router.create_network_design_run(request)
    run=raw
    with router._network_runs_lock:router._network_design_runs.clear()
    export._bounds.clear()
    if planning=='expand' and not run['readiness']['layers']['stations'].get('stationary_count'):
        run['demo_baseline']={'status':'empty_registry_assumption','note':'В реестре проекта нет действующих постов этого города. Расширение рассчитано с пустым исходным реестром; отсутствие постов в реальной сети не подтверждено.'}
    if meta:=export.transport_meta(city['id']):
        run['demo_transport_snapshot']=meta;run['methodology_version']+='-demo-local-roads-v1'
    run['demo_export']={'source':'original_air_sgm_backend','precomputed':True,'snapshot':'2026-10-12'}
    return run

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--probe',action='store_true');parser.add_argument('--all',action='store_true');parser.add_argument('--city');parser.add_argument('--mode');parser.add_argument('--base-only',action='store_true');args=parser.parse_args()
    cities=json.loads((export.OUT/'cities.json').read_text(encoding='utf8'))
    if args.probe:
        for count in [7,8,7]:
            start=time.time();run=calculate(cities[0],'integrated_screening','annual','new_network',count,research=True)
            export.pack(export.ROOT/f'.precompute/research-probe-{count}.json.gz',run)
            print('PROBE',count,round(time.time()-start,2),'seconds',len(run['scenario_results']),run['sensitivity']['status'],flush=True)
    elif args.city:
        worker(next(city for city in cities if city['id']==args.city),args.mode,args.base_only)
    elif args.all:
        tasks=[(city,mode,args.base_only) for city in cities for mode in export.MODES]
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            codes=list(pool.map(launch,tasks))
        assert not any(codes),codes
        expected=60 if args.base_only else 1440
        files=list((export.OUT/'presets').glob('*.json.gz'))
        assert len(files)>=expected
        print('ALL PRESETS COMPLETE',expected*372,flush=True)
