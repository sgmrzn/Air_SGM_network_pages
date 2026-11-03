"""Build compact catalogue shards from complete, precomputed wizard bundles."""
import pathlib,json,gzip,itertools,argparse
root=pathlib.Path(__file__).resolve().parents[1]/'public/demo'
parser=argparse.ArgumentParser();parser.add_argument('--partial',action='store_true');parser.add_argument('--base-only',action='store_true');args=parser.parse_args()
cities={c['id']:c['name'] for c in json.loads((root/'cities.json').read_text(encoding='utf8'))}
groups={};incomplete=[]
for file in (root/'presets').glob('*.json.gz'):
 bundle=json.loads(gzip.decompress(file.read_bytes()))
 if len(bundle['runs'])!=372:incomplete.append(file.name)
 for preset_key,run in bundle['runs'].items():
  request=run['request'];city_id=request['territory_id']
  group=f"g{request['grid_km']:g}--r{request['radius_m']}--m{int(request['use_exclusion_masks'])}--{request['network_size_mode']}"
  key='|'.join(str(request[k]) for k in ['territory_id','placement_mode','meteo_profile','planning_mode','post_count','analysis_profile','grid_km','radius_m','use_exclusion_masks','network_size_mode'])
  groups.setdefault(group,[]).append(dict(key=key,id=run['id'],city_id=city_id,city=cities[city_id],planning_mode=request['planning_mode'],placement_mode=request['placement_mode'],meteo_profile=request['meteo_profile'],post_count=request['post_count'],analysis_profile=request['analysis_profile'],sensitivity_mode=request['sensitivity_mode'],grid_km=request['grid_km'],radius_m=request['radius_m'],use_exclusion_masks=request['use_exclusion_masks'],network_size_mode=request['network_size_mode'],file='presets/'+file.name,preset_key=preset_key,resolved_post_count=run['ensemble']['resolved_post_count'],input_fingerprint=run['input_fingerprint'],created_at=run['created_at'],methodology_version=run['methodology_version'],empty_baseline=bool(run.get('demo_baseline')),generated_report=True,scenario_count=len(run['scenario_results'])))
expected=1 if args.base_only else 24
if not args.partial:
 assert not incomplete,incomplete
 assert len(groups)==expected,(len(groups),expected)
 assert all(len(rows)==22320 for rows in groups.values())
 assert len({r['id'] for rows in groups.values() for r in rows})==expected*22320
(root/'catalogs').mkdir(exist_ok=True)
for name,rows in groups.items():
 rows.sort(key=lambda r:(r['city_id'],r['placement_mode'],r['meteo_profile'],r['planning_mode'],r['post_count'],r['analysis_profile']))
 (root/'catalogs'/(name+'.json.gz')).write_bytes(gzip.compress(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode(),compresslevel=9))
base=groups.get('g1--r2500--m1--required_network_size',[])
if args.partial:
 (root/'qa-catalog.json').write_text(json.dumps(base,ensure_ascii=False),encoding='utf8')
else:
 (root/'catalog.json').write_text(json.dumps(base,ensure_ascii=False),encoding='utf8')
 (root/'presets-manifest.json').write_text(json.dumps({'configuration_count':sum(map(len,groups.values())),'parameter_groups':len(groups),'base_catalog_count':len(base),'cities':12,'placement_modes':5,'meteo_profiles':6,'analysis_profiles':2,'grids_km':[1] if args.base_only else [1,.5],'radii_m':[2500] if args.base_only else [2500,5000,10000],'network_size_modes':['required_network_size'] if args.base_only else ['required_network_size','budget_ceiling'],'exclusion_masks':[True] if args.base_only else [True,False],'research_comparison_grids_km':[1,.5],'research_comparison_radii_m':[2500,5000]},ensure_ascii=False,indent=2),encoding='utf8')
print('CATALOGUES',len(groups),'PRESETS',sum(map(len,groups.values())),'INCOMPLETE BUNDLES',len(incomplete))
