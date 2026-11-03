import sys,json,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=Path(os.environ.get('AIR_SGM_SOURCE_ROOT',str(ROOT.parent if (ROOT.parent/'backend').is_dir() else ROOT.parent/'Air_SGM_support_system'))).resolve()
sys.path.insert(0,str(source))
from fastapi.encoders import jsonable_encoder
import precompute_modes  # Apply only the approved exported transport supplement.
from backend.app import spatial_router as router
OUT=ROOT/'public/demo'
cities=json.loads((OUT/'cities.json').read_text(encoding='utf8'))
for city in cities:
    ready=jsonable_encoder(router._network_design_readiness_payload(city['id']))
    (OUT/'cities'/city['id']/'readiness.json').write_text(json.dumps(ready,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    if city['id'] in precompute_modes.OVERLAYS:
        roads=jsonable_encoder(router.network_design_input_features(territory_id=city['id'],layer='roads',offset=0,limit=500))
        assert roads['total']==len(roads['features'])
        (OUT/'cities'/city['id']/'roads.json').write_text(json.dumps(roads,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    for profile in ['annual','cold_period','warm_period','weak_wind','calm_accumulation','accumulation_risk']:
        meteo=jsonable_encoder(router.network_stored_meteo(longitude=city['longitude'],latitude=city['latitude'],profile=profile))
        (OUT/'cities'/city['id']/f'meteo-{profile}.json').write_text(json.dumps(meteo,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    print('REFRESHED',city['id'],flush=True)
for region in json.loads((OUT/'meteo-regions.json').read_text(encoding='utf8')):
    for profile in ['annual','cold_period','warm_period','weak_wind','calm_accumulation','accumulation_risk']:
        meteo=jsonable_encoder(router.network_stored_meteo(longitude=region['longitude'],latitude=region['latitude'],profile=profile))
        (OUT/f'meteo-region-{profile}.json').write_text(json.dumps(meteo,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('METADATA COMPLETE',flush=True)
