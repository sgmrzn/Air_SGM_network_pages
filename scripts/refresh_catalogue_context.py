"""Refresh public readiness snapshots after the full revision is validated."""
import json
from pathlib import Path
import shutil
import precompute_modes as export

root = export.OUT
backup = export.ROOT / ".precompute/rnpk-20261026/original"
for city in json.loads((root / "cities.json").read_text(encoding="utf8")):
    for name, value in (
        ("readiness.json", export.router._network_design_readiness_payload(city["id"])),
        ("population-preview.json", export.router.network_population_preview(city["id"])),
    ):
        relative = Path("cities") / city["id"] / name
        saved = backup / relative
        if not saved.exists():
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / relative, saved)
        (root / relative).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=export.jsonable_encoder), encoding="utf8")
    print("CONTEXT UPDATED", city["name"], flush=True)
