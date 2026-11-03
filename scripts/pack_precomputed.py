"""Lossless shared-block packaging for the static Pages catalogue."""
import json, gzip, hashlib, copy, functools, time, concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'public/demo'
BIG={'readiness','dataset_snapshot','boundary_layers','context_layers','population_geojson','territory_wind_rose','wind_rose','role_assessment','source_wind_context','sources','candidate_zones_geojson','map_geojson','candidates_geojson','alternatives_geojson','alternative_candidates_geojson'}
def dump(value): return json.dumps(value,ensure_ascii=False,separators=(',',':'),sort_keys=True,allow_nan=False).encode()
def read(file): return json.loads(gzip.decompress(file.read_bytes()))
def write(file,value):
    file.parent.mkdir(parents=True,exist_ok=True)
    temp=file.with_suffix('.tmp'); temp.write_bytes(gzip.compress(dump(value),compresslevel=6)); replace_retry(temp,file)
def replace_retry(temp,file):
    for attempt in range(40):
        try: temp.replace(file); return
        except PermissionError:
            if attempt==39: raise
            time.sleep(.1)
@functools.lru_cache(maxsize=2)
def base(file): return read(ROOT/file)
def native(row):
    value=read(ROOT/row['file'])
    if value.get('format')!='air-sgm-run-delta-v1': return value
    run=copy.deepcopy(base(value['base_file']))
    for path,item in value['changes']:
        if not path: run=item; continue
        parent=run
        for key in path[:-1]: parent=parent[key]
        parent[path[-1]]=item
    assert hashlib.sha256(dump(run)).hexdigest()==value['sha256'],row['key']
    return run
def city(city_dir):
    index=city_dir/'index.json'
    rows=[row for file in city_dir.glob('index*.json') for row in json.loads(file.read_text(encoding='utf8'))]
    repairs=ROOT/'repaired'/city_dir.name/'index.json'
    if repairs.exists(): rows.extend(json.loads(repairs.read_text(encoding='utf8')))
    overlay=ROOT/'transport-overlays'/(city_dir.name+'.json')
    revision=json.loads(overlay.read_text(encoding='utf8'))['raw_sha256'] if overlay.exists() else None
    if revision: rows=[row for row in rows if row.get('transport_snapshot')==revision]
    rows=list({row['key']:row for row in rows}.values())
    folder=ROOT/'packed'/city_dir.name; folder.mkdir(parents=True,exist_ok=True)
    packed_index=folder/'index.json'
    done=json.loads(packed_index.read_text(encoding='utf8')) if packed_index.exists() else []
    known={row['key']:row for row in done}
    if revision: known={key:row for key,row in known.items() if row.get('transport_snapshot')==revision}
    shared=ROOT/'shared'/city_dir.name
    blocks={}
    packed_blocks=set()
    def encode(value,key=''):
        if key in BIG and key!='source_wind_context' and isinstance(value,(dict,list)):
            content=dump(value)
            if len(content)>=4000:
                digest=hashlib.sha256(content).hexdigest(); file=shared/(digest+'.json.gz')
                if not file.exists(): write(file,value)
                blocks[digest]=value
                return {'$air_sgm_block':digest}
        packed={k:encode(v,k) for k,v in value.items()} if isinstance(value,dict) else [encode(v) for v in value] if isinstance(value,list) else value
        if key=='source_wind_context':
            content=dump(packed)
            if len(content)>=4000:
                digest=hashlib.sha256(content).hexdigest(); file=shared/(digest+'.json.gz')
                if not file.exists(): write(file,packed)
                blocks[digest]=packed
                packed_blocks.add(digest)
                return {'$air_sgm_block':digest}
        return packed
    def decode(value):
        if isinstance(value,dict) and set(value)=={'$air_sgm_block'}:
            digest=value['$air_sgm_block']
            if digest in blocks:
                return decode(blocks[digest]) if digest in packed_blocks else blocks[digest]
            block=read(shared/(digest+'.json.gz'))
            return decode(block) if b'"$air_sgm_block"' in dump(block) else block
        if isinstance(value,dict): return {k:decode(v) for k,v in value.items()}
        if isinstance(value,list): return [decode(v) for v in value]
        return value
    added=0
    failed=[]
    for row in rows:
        if row['key'] in known and row['id']==known[row['key']]['id']: continue
        try: run=native(row)
        except AssertionError:
            failed.append(row); continue
        for key in ('placement_mode','meteo_profile','planning_mode','post_count'):
            assert run['request'][key]==row[key],row['key']
        assert run['request']['territory_id']==row['city_id'],row['key']
        row={**row,'id':run['id'],'created_at':run['created_at'],'input_fingerprint':run['input_fingerprint'],'methodology_version':run['methodology_version'],'resolved_post_count':run['ensemble']['resolved_post_count'],'empty_baseline':bool(run.get('demo_baseline'))}
        packed=encode(run)
        assert decode(packed)==run,row['key']
        file=f"packed/{city_dir.name}/{Path(row['file']).name}"
        write(ROOT/file,{'format':'air-sgm-run-blocks-v1','shared_dir':f'shared/{city_dir.name}/','tree':packed,'sha256':hashlib.sha256(dump(run)).hexdigest()})
        known[row['key']]={**row,'file':file}
        blocks.clear(); packed_blocks.clear(); added+=1
        if added%20==0:
            temp=packed_index.with_suffix('.tmp'); temp.write_text(json.dumps(list(known.values()),ensure_ascii=False),encoding='utf8'); replace_retry(temp,packed_index)
    temp=packed_index.with_suffix('.tmp'); temp.write_text(json.dumps(list(known.values()),ensure_ascii=False),encoding='utf8'); replace_retry(temp,packed_index)
    errors=city_dir/'pack-errors.json'; temp=errors.with_suffix('.tmp'); temp.write_text(json.dumps(failed,ensure_ascii=False),encoding='utf8'); replace_retry(temp,errors)
    return len(known)
if __name__=='__main__':
    previous=-1
    while True:
        folders=list((ROOT/'prepared').glob('*/index.json'))
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            counts=list(pool.map(city,[file.parent for file in folders]))
        count=sum(counts)
        if count!=previous: print('PACKED',count,'/11160',flush=True); previous=count
        if count==11160:
            rows=[row for f in (ROOT/'packed').glob('*/index.json') for row in json.loads(f.read_text(encoding='utf8'))]
            rows.sort(key=lambda r:(r['city_id'],r['placement_mode'],r['meteo_profile'],r['planning_mode'],r['post_count']))
            (ROOT/'catalog-next-packed.json').write_text(json.dumps(rows,ensure_ascii=False),encoding='utf8')
            print('PACK COMPLETE',len(rows),flush=True); break
        time.sleep(5)
