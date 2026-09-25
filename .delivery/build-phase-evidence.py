"""Build gate evidence from a phase contract, a reviewed evidence map and fresh run receipts.

The map declares, per TC, which single test proves it and which assertion lines carry the
proof; this script only resolves line numbers, hashes and JUnit results. It never marks a TC
PASS unless that exact test passed in the receipt, and it leaves `reviews` empty for the
independent reviewer.

    python .delivery/build-phase-evidence.py --map .delivery/phases/plan-18-evidence-map.json \
        --receipt .gate-artifacts/plan18-node.json --receipt .gate-artifacts/plan18-e2e.json \
        --output .gate-artifacts/plan18-evidence.json
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".master_process" / "scripts"))
from gates.common import GateError, require, load, digest, meaning  # noqa: E402
from gates.results import junit_cases  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def source_lines(rel):
    path = ROOT / rel
    require(path.is_file(), f"Missing source: {rel}")
    return path.read_text(encoding="utf-8-sig").splitlines()


def find_line(lines, snippet, start, label):
    for index in range(start, len(lines)):
        if snippet in lines[index]:
            return index + 1
    raise GateError(f"{label}: snippet not found after line {start}: {snippet}")


def anchor(ref, label):
    lines = source_lines(ref["path"])
    line = find_line(lines, ref["snippet"], 0, label)
    return {"path": ref["path"], "sha256": digest(ROOT / ref["path"]), "line": line, "snippet": ref["snippet"]}


def design_of(spec):
    design = {}
    for group, fields in spec.items():
        design[group] = {}
        for field, ref in fields.items():
            if field == "inventory":
                design[group][field] = {**ref, "sha256": digest(ROOT / ref["path"])}
            else:
                design[group][field] = anchor(ref, f"{group}.{field}")
    return design


def test_id_of(entry):
    if "suite" in entry:
        return f"{Path(entry['source']).name}.{entry['suite']} › {entry['test']}"
    return f"test.{entry['test']}"


def case_row(case_id, case, entry, runs, default_regression):
    lines = source_lines(entry["source"])
    decl = find_line(lines, entry.get("decl", entry["test"]), 0, f"{case_id} declaration")
    assertions = []
    for item in entry["assertions"]:
        start = 0 if item.get("scope") == "file" else decl - 1
        line = find_line(lines, item["snippet"], start, case_id)
        assertions.append({"line": line, "snippet": item["snippet"], "observable": item["observable"]})
    test_id = test_id_of(entry)
    results = runs.get(entry["run"])
    require(results is not None, f"{case_id}: unknown run {entry['run']}")
    status = results.get(test_id)
    require(status is not None, f"{case_id}: test not in JUnit: {test_id}")
    regression = dict(entry.get("regression", default_regression))
    if regression.get("status") == "REPRODUCED":
        regression["before_log"] = {"path": regression["before_log"], "sha256": digest(ROOT / regression["before_log"])}
    return {
        "id": case_id,
        "ac_id": case["ac_id"],
        "ac_sha256": case["ac_sha256"],
        "intent_sha256": meaning(case["intent"]),
        "coverage": "FULL",
        "result": "PASS" if status == "PASS" else "FAIL",
        "level": case["level"],
        "entrypoint": entry["entrypoint"],
        "test_id": test_id,
        "run": entry["run"],
        "source": {"path": entry["source"], "sha256": digest(ROOT / entry["source"])},
        "assertions": assertions,
        "regression": regression,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--map", required=True)
    parser.add_argument("--receipt", action="append", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        spec = load(ROOT / args.map)
        contract_path = ROOT / spec["contract"]
        contract = load(contract_path)
        cases = {}
        for ac in contract["criteria"]:
            for case in ac["cases"]:
                cases[case["id"]] = {**case, "ac_id": ac["id"], "ac_sha256": meaning(ac["text"])}
        require(set(cases) == set(spec["cases"]), "Evidence map and contract list different TCs")
        revision = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"], encoding="utf-8").strip()
        runs = {}
        for receipt_path in args.receipt:
            receipt = load(ROOT / receipt_path)
            require(receipt["revision"] == revision, f"{receipt['id']}: receipt is for {receipt['revision']}, HEAD is {revision}")
            runs[receipt["id"]] = junit_cases(ROOT / receipt["junit"]["path"])
        rows = [case_row(cid, cases[cid], spec["cases"][cid], runs, spec["regression_default"]) for cid in cases]
        evidence = {
            "schema_version": 1,
            "phase": contract["phase"],
            "revision": revision,
            "contract_sha256": hashlib.sha256(contract_path.read_bytes()).hexdigest(),
            "implementation": spec["implementation"],
            "design": design_of(spec["design"]),
            "cases": rows,
            "reviews": {},
        }
        failed = [row["id"] for row in rows if row["result"] != "PASS"]
        Path(ROOT / args.output).write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{len(rows)} TC, {len(rows) - len(failed)} PASS" + (f", FAIL: {', '.join(failed)}" if failed else ""))
        return 1 if failed else 0
    except (GateError, KeyError, OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"EVIDENCE BLOCKED: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
