"""Move obsolete, unreferenced payload into a recoverable local archive.

Only use after activating the fully verified revision. No file is deleted.
"""
import gzip
import json
from pathlib import Path
import shutil

root = (Path(__file__).resolve().parents[1] / "public/demo").resolve()
assert root == Path(r"D:\Air_SGM_support_system\.network-pages-stage\public\demo")
backup = (root.parents[1] / ".precompute/rnpk-20261026/legacy-payload").resolve()
assert backup.is_relative_to(Path(r"D:\Air_SGM_support_system\.network-pages-stage\.precompute"))
summary = json.loads((root / "revisions/rnpk-20261026/summary.json").read_bytes())
assert summary["updated_runs"] == 22320 and summary["status"] == "validated"

referenced = set()
def read(file):
    data = file.read_bytes()
    return json.loads(gzip.decompress(data) if file.suffix == ".gz" else data)

def scan(value, directory):
    if isinstance(value, dict):
        if set(value) == {"$air_sgm_block"}:
            relative = Path(directory) / (value["$air_sgm_block"] + ".json.gz")
            if relative not in referenced:
                referenced.add(relative)
                scan(read(root / relative), directory)
        else:
            for v in value.values():
                scan(v, directory)
    elif isinstance(value, list):
        for v in value:
            scan(v, directory)

for bundle_path in (root / "presets").glob("*.json.gz"):
    bundle = read(bundle_path)
    assert bundle["revision"] == "rnpk-20261026"
    scan(bundle["runs"], bundle["shared_dir"])

def archive(path):
    source = path.resolve()
    assert source.is_relative_to(root)
    target = (backup / source.relative_to(root)).resolve()
    assert target.is_relative_to(backup)
    assert not target.exists(), target
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(target))

count = 0
for file in (root / "shared").rglob("*.json.gz"):
    if file.relative_to(root) not in referenced:
        archive(file)
        count += 1
# The active catalogue exclusively loads presets; HTML reports are generated
# from those passports. Keep the former separate exports only in the archive.
for directory in ("packed", "runs", "reports", "revisions/rnpk-20261026/presets", "revisions/rnpk-20261026/parts"):
    if (root / directory).exists():
        archive(root / directory)
print("Archived obsolete blocks", count, "active blocks", len(referenced), "at", backup, flush=True)
