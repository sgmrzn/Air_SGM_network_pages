"""Reconcile index metadata with verified native passports after resumable export."""
import json,gzip
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'public/demo'
changed=0
all_rows=[]
for file in (root/'packed').glob('*/index.json'):
    rows=json.loads(file.read_text(encoding='utf8'))
    for row in rows:
        run=json.loads(gzip.decompress((root/row['file']).read_bytes()))['tree']
        for key in ('placement_mode','meteo_profile','planning_mode','post_count'):
            assert run['request'][key]==row[key],row['key']
        assert run['request']['territory_id']==row['city_id'],row['key']
        before=dict(row)
        row.update(id=run['id'],created_at=run['created_at'],input_fingerprint=run['input_fingerprint'],methodology_version=run['methodology_version'],resolved_post_count=run['ensemble']['resolved_post_count'],empty_baseline=bool(run.get('demo_baseline')))
        changed+=before!=row
    file.write_text(json.dumps(rows,ensure_ascii=False),encoding='utf8')
    all_rows.extend(rows)
assert len(all_rows)==11160
assert len({r['id'] for r in all_rows})==11160
all_rows.sort(key=lambda r:(r['city_id'],r['placement_mode'],r['meteo_profile'],r['planning_mode'],r['post_count']))
(root/'catalog.json').write_text(json.dumps(all_rows,ensure_ascii=False),encoding='utf8')
print('Index metadata reconciled:',changed,'of',len(all_rows))
