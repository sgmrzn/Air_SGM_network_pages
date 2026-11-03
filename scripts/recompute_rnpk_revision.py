"""Recalculate all catalogue requests with the current reconciled algorithm.

Workers write a separate, resumable revision. Activation is a separate step
after every native passport and its lossless encoding have been verified.
"""
import argparse
import copy
import gzip
import hashlib
import json
import os
from pathlib import Path
import time
import uuid
import functools
import concurrent.futures
import subprocess
import sys
import shutil

import precompute_all_parameters as engine
from backend.app.source_entities import AGREEMENT_VERSION
from backend.app import network_source_geometry, network_planning_lab

# Read-only spatial queries with identical bounds are shared within a worker.
# Defensive copies retain the native caller's mutable placement flags.
engine.router._network_context_records = engine.memo(engine.router._network_context_records, 64)
engine.router.spatial_api_datasets = engine.memo(engine.router.spatial_api_datasets, 1)

# Export-process-only accelerations: immutable geometry lookup and buffered
# persistence of the exact same input envelope. No solver options change.
original_location = network_source_geometry.source_location
@functools.lru_cache(maxsize=4096)
def location_arguments(geometry, longitude, latitude, min_lon, min_lat, max_lon, max_lat):
    return original_location({"geometry_json": geometry, "longitude": longitude, "latitude": latitude,
        "min_lon": min_lon, "min_lat": min_lat, "max_lon": max_lon, "max_lat": max_lat})
def location(source):
    geometry = source.get("geometry_json") or source.get("geometry")
    if not geometry:
        geometry = None
    elif not isinstance(geometry, str):
        geometry = json.dumps(geometry, sort_keys=True, separators=(",", ":"))
    return location_arguments(geometry, *(source.get(key) for key in
        ("longitude", "latitude", "min_lon", "min_lat", "max_lon", "max_lat")))
network_source_geometry.source_location = location
engine.router.source_location = location

input_files_by_digest = {}
def buffered_save_inputs(run_id, inputs):
    identifier = str(uuid.UUID(run_id))
    directory = engine.export.SOURCE / "data/outputs/network_planning_inputs"
    directory.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(json.dumps(inputs, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    temporary = directory / f"{identifier}.tmp"
    identical = input_files_by_digest.get(digest)
    if identical is not None and identical.is_file():
        # Matrices are immutable and saved through atomic replacement. Every
        # run keeps its own UUID path and native hash-checked envelope; exact
        # duplicate inputs need not be compressed and stored repeatedly.
        try:
            os.link(identical, temporary)
        except OSError:
            shutil.copyfile(identical, temporary)
    else:
        payload = json.dumps({"inputs": inputs, "sha256": digest}).encode()
        temporary.write_bytes(gzip.compress(payload, compresslevel=6))
    temporary.replace(directory / f"{identifier}.json.gz")
    input_files_by_digest[digest] = directory / f"{identifier}.json.gz"
    if len(input_files_by_digest) > 256:
        input_files_by_digest.pop(next(iter(input_files_by_digest)))
network_planning_lab.save_inputs = buffered_save_inputs

ROOT = engine.export.OUT
REVISION = "rnpk-20261026"
CITY = "osm-area-1782722"
MODES = tuple(engine.export.MODES)
OUT = ROOT / "revisions" / REVISION
BACKUP = engine.export.ROOT / ".precompute" / REVISION / "original"


def read(path):
    return json.loads(gzip.decompress(path.read_bytes()))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def worker(mode, part=0, parts=1, city=CITY, repair_cache=False):
    name = f"{city}--{mode}--g1--r2500--m1--required_network_size.json.gz"
    original = ROOT / "presets" / name
    BACKUP.mkdir(parents=True, exist_ok=True)
    saved = BACKUP / name
    if not saved.exists():
        saved.write_bytes(original.read_bytes())
    old = read(saved)
    output = OUT / "presets" / name
    seed = read(output) if output.exists() else {
        "format": "air-sgm-preset-bundle-v1", "shared_dir": f"shared/{city}/",
        "runs": {}, "hashes": {}, "revision": REVISION,
        "source_agreement_version": AGREEMENT_VERSION,
        "previous_bundle_sha256": sha(saved),
    }
    keys = [key for key in old["runs"] if engine.export.PROFILES.index(key.split("|")[0]) % parts == part]
    if parts > 1:
        output = OUT / "parts" / f"{city}-{mode}-{part}.json.gz"
    current = read(output) if output.exists() else {**seed,
        "runs": {key: value for key, value in seed["runs"].items() if key in keys},
        "hashes": {key: value for key, value in seed["hashes"].items() if key in keys}}
    if city != CITY and current.get("export_cache_key_version") != "exact-budget-v2":
        # Discard preliminary non-Ryazan trials from before the cache audit.
        current["runs"] = {}
        current["hashes"] = {}
    current["export_cache_key_version"] = "exact-budget-v2"
    if repair_cache:
        assert city == CITY and parts == 3
        for key in keys:
            profile, planning, count, analysis = key.split("|")
            if planning == "expand" and analysis == "research" and int(count) >= 11:
                current["runs"].pop(key, None)
                current["hashes"].pop(key, None)
    assert current["source_agreement_version"] == AGREEMENT_VERSION
    assert current["previous_bundle_sha256"] == sha(saved)
    started = time.monotonic()
    for key, previous in old["runs"].items():
        if key not in keys:
            continue
        if key in current["runs"]:
            continue
        # Explicit stored parameters avoid silently adopting changed defaults.
        request = copy.deepcopy(previous["request"])
        run = engine.router.create_network_design_run(engine.NetworkDesignRunRequest(**request))
        with engine.router._network_runs_lock:
            engine.router._network_design_runs.clear()
        engine.export._bounds.clear()
        assert run["request"] == request, (key, run["request"], request)
        assert run["status"] == "completed", (key, run["status"])
        sources = run["readiness"]["layers"]["sources"]["items"]
        if city == CITY:
            assert sum(s["id"] == "facility:rnpk-ryazan" for s in sources) == 1
        assert not any(s["id"] in {"file:climate-trace:3144077", "osm-industrial_osm-59165930"} for s in sources)
        assert run["id"] != previous["id"]
        assert run["input_fingerprint"] != previous["input_fingerprint"]
        run["demo_export"] = {
            "source": "original_air_sgm_backend", "precomputed": True,
            "revision": REVISION, "calculated_at": run["completed_at"],
            "source_agreement_version": AGREEMENT_VERSION,
            "previous_run_id": previous["id"],
            "previous_methodology_version": previous["methodology_version"],
            "interpretation": "Новый запуск текущей версии с исходными параметрами. Различия включают изменения алгоритма после исторической серии; их нельзя приписывать только РНПК.",
        }
        if previous.get("demo_baseline"):
            run["demo_baseline"] = copy.deepcopy(previous["demo_baseline"])
        if meta := engine.export.transport_meta(city):
            run["demo_transport_snapshot"] = meta
        current["runs"][key] = engine.encode_run(run, city)
        current["hashes"][key] = hashlib.sha256(engine.canonical(run)).hexdigest()
        engine.save(output, current)
        print(city, mode, part, len(current["runs"]), "/", len(keys), key,
              round(time.monotonic()-started, 1), "s", flush=True)
    assert len(current["runs"]) == len(keys)
    print("COMPLETE", city, mode, part, sha(output), flush=True)


def launch(task):
    city, mode, part, parts = task
    logs = engine.export.ROOT / ".precompute" / REVISION / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    with (logs / f"{city}--{mode}--part{part}.log").open("a", encoding="utf8") as stdout, (logs / f"{city}--{mode}--part{part}.err").open("a", encoding="utf8") as stderr:
        code = subprocess.run([sys.executable, "-u", str(Path(__file__).resolve()), "--city", city, "--mode", mode, "--part", str(part), "--parts", str(parts)], stdout=stdout, stderr=stderr).returncode
    print("TASK", city, mode, part, "exit", code, flush=True)
    return city, mode, code


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=MODES)
    parser.add_argument("--city", default=CITY)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--repair-cache", action="store_true")
    parser.add_argument("--part", type=int, default=0)
    parser.add_argument("--parts", type=int, default=1)
    args = parser.parse_args()
    if (OUT / "summary.json").exists():
        print("Revision already validated; choose a new revision identifier for another full recalculation.", flush=True)
        sys.exit(0)
    if args.all:
        cities = json.loads((ROOT / "cities.json").read_text(encoding="utf8"))
        tasks = [(c["id"], mode, part, 3 if c["id"] == CITY else 1) for c in cities for mode in MODES for part in range(3 if c["id"] == CITY else 1)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            results = list(pool.map(launch, tasks))
        assert not any(code for city, mode, code in results), results
        print("ALL COMPLETE", len(cities) * len(MODES) * 372, flush=True)
    else:
        assert args.mode
        worker(args.mode, args.part, args.parts, args.city, args.repair_cache)
