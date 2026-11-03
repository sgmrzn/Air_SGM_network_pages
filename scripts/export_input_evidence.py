"""Export the current input screen as a separate, read-only static snapshot.

Run with the main application's API available. Saved calculation inputs are
never replaced. The publication needs no Python or running API afterwards.
"""
import concurrent.futures
import gzip
import hashlib
import io
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'demo'
API = os.environ.get('NETWORK_EXPORT_API', 'http://127.0.0.1:8000')
LAYERS = ('residential', 'roads', 'constraints')


def update_publication_manifest():
    path = ROOT / 'manifest.json'
    if not path.exists():
        return
    manifest = json.loads(path.read_text(encoding='utf-8'))
    entries = {item['path']: item for item in manifest['files'] if not item['path'].startswith('input-evidence/')}
    for file in (ROOT / 'input-evidence').rglob('*'):
        if file.is_file():
            name = file.relative_to(ROOT).as_posix()
            content = file.read_bytes()
            entries[name] = {'path': name, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
    manifest['files'] = sorted(entries.values(), key=lambda item: item['path'])
    manifest['total_bytes'] = sum(item['bytes'] for item in manifest['files'])
    manifest['input_evidence_manifest'] = 'input-evidence/manifest.json'
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')


def fetch(endpoint, **params):
    with urlopen(API + '/api/spatial/network-design/' + endpoint + '?' + urlencode(params), timeout=600) as response:
        return response.read()


def export_city(city):
    directory = ROOT / 'input-evidence' / city['id']
    directory.mkdir(parents=True, exist_ok=True)
    passport = json.loads(fetch('input-passport', territory_id=city['id']))
    passport['scope'] = 'published_input_snapshot_not_saved_run'
    passport['snapshot_exported_at'] = datetime.now(timezone.utc).isoformat()
    files = {}

    def save(name, value):
        (directory / name).write_bytes(value)
        files[str((directory / name).relative_to(ROOT)).replace('\\', '/')] = hashlib.sha256(value).hexdigest()

    for layer in LAYERS:
        bundle = fetch('input-export', territory_id=city['id'], layer=layer)
        # Read the display layer from the very same ZIP snapshot. In particular,
        # preserve the backend's canonical timestamp serialization byte for byte.
        with zipfile.ZipFile(io.BytesIO(bundle)) as archive:
            raw = archive.read('objects.geojson')
            data = json.loads(raw)
            summary = json.loads(archive.read('passport.json'))
            if data['summary'] != passport['vectors'][layer] or summary['summary'] != data['summary']:
                raise RuntimeError(f"Inputs changed during export: {city['id']}/{layer}; repeat export")
            for name, digest in json.loads(archive.read('manifest.json')).items():
                if hashlib.sha256(archive.read(name)).hexdigest() != digest:
                    raise RuntimeError(f"Invalid ZIP checksum: {city['id']}/{layer}/{name}")
        save(layer + '.json.gz', gzip.compress(raw, mtime=0))
        save(layer + '.zip', bundle)
    save('passport.json', json.dumps(passport, ensure_ascii=False, indent=2).encode())
    print(city['name'], 'exported', flush=True)
    return files


if __name__ == '__main__':
    cities = json.loads((ROOT / 'cities.json').read_text(encoding='utf-8'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        checksums = dict(item for result in pool.map(export_city, cities) for item in result.items())
    manifest = {'format': 'air-sgm-input-evidence-v1', 'exported_at': datetime.now(timezone.utc).isoformat(),
                'scope': 'published_input_snapshot_not_saved_run', 'city_count': len(cities), 'files': checksums}
    (ROOT / 'input-evidence' / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    update_publication_manifest()
