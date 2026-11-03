import json,time,concurrent.futures,sys,gzip,os
from pathlib import Path
from precompute_modes import calculate,pack,OUT
cities=json.loads((OUT/'cities.json').read_text(encoding='utf8'))
def repair_city(city):
    file=OUT/'prepared'/city['id']/'pack-errors.json'
    if not file.exists(): return 0
    rows=json.loads(file.read_text(encoding='utf8'))
    folder=OUT/'repaired'/city['id']; folder.mkdir(parents=True,exist_ok=True)
    index=folder/'index.json'; fixed=json.loads(index.read_text(encoding='utf8')) if index.exists() else []
    known={r['key']:r for r in fixed}
    for row in rows:
        if row['key'] in known: continue
        run=calculate(city,row['placement_mode'],row['meteo_profile'],row['planning_mode'],row['post_count'])
        output=f"repaired/{city['id']}/{row['key']}.json.gz"
        pack(OUT/output,run)
        known[row['key']]={**row,'id':run['id'],'file':output,'resolved_post_count':run['ensemble']['resolved_post_count'],'input_fingerprint':run['input_fingerprint'],'created_at':run['created_at'],'methodology_version':run['methodology_version']}
        temp=index.with_suffix('.tmp'); temp.write_text(json.dumps(list(known.values()),ensure_ascii=False),encoding='utf8'); temp.replace(index)
        print('REPAIRED',row['key'],flush=True)
    return len(known)
while not (OUT/'catalog-next-packed.json').exists():
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: list(pool.map(repair_city,cities))
    time.sleep(5)
