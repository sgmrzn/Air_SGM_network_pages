"""Finish staging only after all scheduled native calculations are complete."""
import gzip
import json
from pathlib import Path
import re
import subprocess
import sys
import time

project = Path(__file__).resolve().parents[1]
revision = project / "public/demo/revisions/rnpk-20261026"
logs = project / ".precompute/rnpk-20261026/logs"
previous = -1
while True:
    for error in logs.glob("*--part*.err"):
        if "Traceback (most recent call last)" in error.read_text(encoding="utf8"):
            raise RuntimeError("Calculation failed: " + str(error))
    count = 0
    complete = 0
    # Log progress is appended only after atomically saving each passport.
    for log in logs.glob("*--part*.log"):
        text = log.read_text(encoding="utf8")
        matches = re.findall(r" (\d+) / (\d+) ", text)
        if matches:
            count += int(matches[-1][0])
            complete += int(matches[-1][0] == matches[-1][1] and "COMPLETE" in text)
    if count != previous:
        print("REVISION PROGRESS", count, "/ 22320", complete, "/ 70 tasks", flush=True)
        previous = count
    if count == 22320 and complete == 70:
        break
    time.sleep(30)

def call(args):
    print("PHASE", " ".join(map(str, args)), flush=True)
    subprocess.run(args, cwd=project, check=True)

call([sys.executable, "-u", str(project / "scripts/activate_rnpk_revision.py")])
call([sys.executable, "-u", str(project / "scripts/refresh_catalogue_context.py")])
call([sys.executable, "-u", str(project / "scripts/archive_legacy_payload.py")])
call(["node", "scripts/finalize_modes.mjs"])
call(["node", "scripts/verify_modes.mjs"])
call(["npm.cmd", "run", "build"])
(project / ".precompute/rnpk-20261026/STAGING_READY.json").write_text(json.dumps({
    "status": "ready", "runs": 22320, "verification": "all passports, source blocks, catalogue contracts, payload hashes and production build passed",
}), encoding="utf8")
print("STAGING READY FOR PUBLICATION FOLDER SYNC", flush=True)
