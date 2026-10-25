"""Validate data/idiot_cup.json, then publish it to docs/data.js for the website."""
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
check = subprocess.run([sys.executable, str(ROOT / "tools" / "validate.py")])
if check.returncode:
    sys.exit("Validation failed; site not rebuilt.")
data = json.loads((ROOT / "data" / "idiot_cup.json").read_text(encoding="utf-8"))
out = ROOT / "docs" / "data.js"
out.write_text("window.IC = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
print("wrote", out)
