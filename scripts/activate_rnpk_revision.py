"""Validate the complete 22,320-run revision before activating any new passport."""
import collections
import functools
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import concurrent.futures
import math
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1] / "public/demo"
REVISION = "rnpk-20261026"
CITY = "osm-area-1782722"
MODES = ("population_coverage", "industrial_influence", "transport_influence", "urban_background", "integrated_screening")
OUT = ROOT / "revisions" / REVISION
BACKUP = ROOT.parents[1] / ".precompute" / REVISION / "original"


def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True, allow_nan=False).encode()


@functools.lru_cache(maxsize=512)
def block(directory, digest):
    packed = read(ROOT / directory / (digest + ".json.gz"))
    assert hashlib.sha256(canonical(packed)).hexdigest() == digest
    return restore(packed, directory)


def restore(value, directory):
    if isinstance(value, dict):
        if set(value) == {"$air_sgm_block"}:
            digest = value["$air_sgm_block"]
            return block(directory, digest)
        return {k: restore(v, directory) for k, v in value.items()}
    if isinstance(value, list):
        return [restore(v, directory) for v in value]
    return value


def positions(run):
    return sorted((x["longitude"], x["latitude"]) for x in run["ensemble"]["scenarios"])


def main():
    subprocess.run([sys.executable, str(ROOT.parents[1] / "scripts/test_export_cache.py")], check=True)
    source_root = ROOT.parents[2]
    audit = read(ROOT.parents[1] / ".precompute" / REVISION / "baseline-audit.json")
    for relative, expected in {**audit["protected_study_files"], **audit["calculation_source_sha256"]}.items():
        assert hashlib.sha256((source_root / relative).read_bytes()).hexdigest() == expected, relative
    # Early Ryazan workers imported the historical exporter before its exact-N
    # cache rule was audited. Only the 5-km expansion sensitivity pool (11
    # candidates) can alias N>=11 in this city's N<=15 requests. Re-run all
    # affected extended passports, including their alternatives/diagnostics.
    repair_marker = ROOT.parents[1] / ".precompute" / REVISION / "exact-cache-repair.json"
    if not repair_marker.exists():
        def repair(task):
            mode, part = task
            subprocess.run([sys.executable, "-u", str(ROOT.parents[1] / "scripts/recompute_rnpk_revision.py"),
                "--city", CITY, "--mode", mode, "--part", str(part), "--parts", "3", "--repair-cache"], check=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(repair, [(mode, part) for mode in MODES for part in range(3)]))
        repair_marker.write_bytes(canonical({"status": "completed", "rerun_passports": 150,
            "scope": "Ryazan extended expansion N=11..15; native exact-size cache keys preserved"}))
    BACKUP.mkdir(parents=True, exist_ok=True)
    for relative in ("catalog.json", "catalogs/g1--r2500--m1--required_network_size.json.gz", "manifest.json", "presets-manifest.json"):
        saved = BACKUP / relative
        if not saved.exists():
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, saved)
    catalog = read(BACKUP / "catalog.json")
    previous_manifest = {x["path"]: x["sha256"] for x in read(BACKUP / "manifest.json")["files"]}
    assert len(catalog) == 22320
    by_preset = {(r["file"], r["preset_key"]): r for r in catalog}
    replacements, comparisons, counts = {}, [], collections.Counter()
    agreement = None
    cities = read(ROOT / "cities.json")
    for city, mode in [(city, mode) for city in cities for mode in MODES]:
        city_id = city["id"]
        name = f"{city_id}--{mode}--g1--r2500--m1--required_network_size.json.gz"
        if city_id == CITY:
            seed = read(OUT / "presets" / name)
            merged = {**seed, "runs": {}, "hashes": {}}
            for part in range(3):
                piece = read(OUT / "parts" / f"{city_id}-{mode}-{part}.json.gz")
                assert not set(merged["runs"]).intersection(piece["runs"])
                assert len(piece["runs"]) == 124
                assert piece["export_cache_key_version"] == "exact-budget-v2"
                merged["runs"].update(piece["runs"])
                merged["hashes"].update(piece["hashes"])
            merged["export_cache_key_version"] = "exact-budget-v2"
            (OUT / "presets" / name).write_bytes(gzip.compress(canonical(merged), compresslevel=6))
        bundle = read(OUT / "presets" / name)
        assert bundle["export_cache_key_version"] == "exact-budget-v2"
        previous = read(BACKUP / name)
        assert hashlib.sha256((BACKUP / name).read_bytes()).hexdigest() == previous_manifest["presets/" + name]
        assert len(bundle["runs"]) == len(previous["runs"]) == 372
        assert bundle["runs"].keys() == previous["runs"].keys()
        agreement = bundle["source_agreement_version"]
        for key, packed in bundle["runs"].items():
            run = restore(packed, bundle["shared_dir"])
            old = previous["runs"][key]
            assert hashlib.sha256(canonical(run)).hexdigest() == bundle["hashes"][key], key
            assert run["request"] == old["request"]
            assert run["status"] == "completed"
            assert run["demo_export"]["source_agreement_version"] == agreement
            items = run["readiness"]["layers"]["sources"]["items"]
            if city_id == CITY:
                assert sum(x["id"] == "facility:rnpk-ryazan" for x in items) == 1
            n = run["request"]["post_count"]
            assert len(run["ensemble"]["scenarios"]) == run["ensemble"]["resolved_post_count"]
            assert run["ensemble"]["resolved_post_count"] in {0, n}, key
            coverage = run["ensemble"]["coverage_summary"]
            values = {name: float(coverage[name]) for name in (
                "population_total", "baseline_covered_population", "additional_covered_population",
                "total_covered_population", "remaining_uncovered_population")}
            assert all(math.isfinite(v) and v >= 0 for v in values.values()), key
            assert abs(values["baseline_covered_population"] + values["additional_covered_population"] - values["total_covered_population"]) <= .01, key
            # Native design_scenarios rounds each point's marginal population
            # gain to whole persons before aggregation. The resulting union
            # may differ from fractional raster totals by <=0.5 per point.
            population_rounding_bound = .5 * run["ensemble"]["resolved_post_count"] + .01
            assert abs(values["population_total"] - values["total_covered_population"] - values["remaining_uncovered_population"]) <= population_rounding_bound, key
            assert run["request"]["sensitivity_grid_km"] == [1, .5]
            assert run["request"]["sensitivity_radii_m"] == [2500, 5000]
            if run["request"]["analysis_profile"] == "extended_diagnostics":
                assert run["sensitivity"]["status"] == ("ready" if n else "disabled")
                assert len(run["sensitivity"]["variants"]) == (2 if n else 0)
            row = by_preset[("presets/" + name, key)]
            old_positions = restore(old["ensemble"]["scenarios"], previous["shared_dir"])
            changed = positions(run) != sorted((x["longitude"], x["latitude"]) for x in old_positions)
            counts[mode] += 1
            comparisons.append({"key": row["key"], "previous_id": old["id"], "id": run["id"],
                "positions_changed": changed, "previous_resolved_post_count": old["ensemble"]["resolved_post_count"],
                "resolved_post_count": run["ensemble"]["resolved_post_count"],
                "previous_coverage": restore(old["ensemble"].get("coverage_summary"), previous["shared_dir"]),
                "coverage": run["ensemble"].get("coverage_summary")})
            replacements[row["key"]] = {**row, "id": run["id"], "resolved_post_count": run["ensemble"]["resolved_post_count"],
                "input_fingerprint": run["input_fingerprint"], "created_at": run["created_at"],
                "methodology_version": run["methodology_version"], "scenario_count": len(run["scenario_results"]),
                "revision": REVISION, "previous_run_id": old["id"]}
            if len(comparisons) % 100 == 0:
                print("RESTORED AND HASH VERIFIED", len(comparisons), flush=True)
    assert len(replacements) == 22320
    next_catalog = [replacements.get(row["key"], row) for row in catalog]
    assert len({r["id"] for r in next_catalog}) == 22320
    untouched = [r for r in catalog if r["key"] not in replacements]
    assert not untouched
    assert [r for r in next_catalog if r["key"] not in replacements] == untouched
    summary = {"revision": REVISION, "status": "validated", "completed_at": datetime.now(timezone.utc).isoformat(),
        "updated_runs": 22320, "unchanged_runs": len(untouched), "catalog_runs": 22320,
        "cities": [c["id"] for c in cities], "modes": dict(counts), "source_agreement_version": agreement,
        "methodology_versions": sorted({r["methodology_version"] for r in next_catalog}),
        "positions_changed": sum(r["positions_changed"] for r in comparisons),
        "position_comparison_policy": "Sorted exact WGS84 coordinate sets; ignore ranking and cell identifiers",
        "population_consistency_policy": "Baseline + gain equals covered within 0.01; covered + remaining equals raster total within 0.5 person per selected point + 0.01, because native point gains are rounded to whole persons",
        "protected_study_files_verified": len(audit["protected_study_files"]),
        "backend_source_files_verified": len(audit["calculation_source_sha256"]),
        "export_cache_validation": read(repair_marker),
        "export_source_sha256": {name: hashlib.sha256((ROOT.parents[1] / "scripts" / name).read_bytes()).hexdigest()
            for name in ("precompute_modes.py", "precompute_all_parameters.py", "recompute_rnpk_revision.py")},
        "execution_context": "Parallel batch precomputation with equivalent read-only and solver caches. Run durations describe this batch, not a cold-start performance benchmark. Identical input envelopes may share storage while retaining individual UUID paths and native SHA256 checks.",
        "research_verification_cases": "49-case population-only series unchanged",
        "interpretation": "Current algorithm reruns using exact stored requests; differences are not an isolated RNPK causal experiment.",
        "original_catalog_sha256": hashlib.sha256((BACKUP / "catalog.json").read_bytes()).hexdigest(),
        "comparisons_file": f"revisions/{REVISION}/comparisons.json.gz"}
    assert len({r["methodology_version"] for r in next_catalog}) == 1
    (OUT / "comparisons.json.gz").write_bytes(gzip.compress(canonical(comparisons), compresslevel=6))
    (OUT / "summary.json").write_bytes(canonical(summary))
    # No active preset changes occur until all 22,320 full-passport hashes pass.
    for city, mode in [(city, mode) for city in cities for mode in MODES]:
        name = f"{city['id']}--{mode}--g1--r2500--m1--required_network_size.json.gz"
        shutil.copyfile(OUT / "presets" / name, ROOT / "presets" / name)
    (ROOT / "catalog.json").write_bytes(canonical(next_catalog))
    (ROOT / "catalogs/g1--r2500--m1--required_network_size.json.gz").write_bytes(gzip.compress(canonical(next_catalog), compresslevel=9))
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
