#!/usr/bin/env python3
"""Verify every Swift PBXFileReference in SOSMesh.xcodeproj resolves to an on-disk file."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PBX = ROOT / "SOSMesh.xcodeproj" / "project.pbxproj"


def parse_objects(text: str) -> dict[str, dict]:
    objects: dict[str, dict] = {}
    pattern = re.compile(
        r"\t\t(A[A-Z0-9]+)(?: /\* [^*]+ \*/)? = \{([^}]+)\};",
        re.MULTILINE,
    )
    for match in pattern.finditer(text):
        oid, body = match.groups()
        isa_m = re.search(r"isa = (\w+);", body)
        if not isa_m:
            continue
        isa = isa_m.group(1)
        path_m = re.search(r"path = ([^;]+);", body)
        path = path_m.group(1).strip().strip('"') if path_m else None
        source_m = re.search(r"sourceTree = ([^;]+);", body)
        source_tree = source_m.group(1).strip().strip('"') if source_m else "<group>"
        children_m = re.search(r"children = \(([^)]*)\);", body, re.DOTALL)
        children: list[str] = []
        if children_m:
            children = re.findall(r"(A[A-Z0-9]+)", children_m.group(1))
        objects[oid] = {
            "isa": isa,
            "path": path,
            "sourceTree": source_tree,
            "children": children,
        }
    return objects


def build_parent_map(objects: dict[str, dict]) -> dict[str, str]:
    parents: dict[str, str] = {}
    for oid, obj in objects.items():
        for child in obj.get("children", []):
            parents[child] = oid
    return parents


def resolve_file_path(file_id: str, objects: dict[str, dict], parents: dict[str, str]) -> Path | None:
    obj = objects.get(file_id)
    if not obj or obj["isa"] != "PBXFileReference":
        return None
    if not obj["path"] or not obj["path"].endswith(".swift"):
        return None

    if obj["sourceTree"] == "SOURCE_ROOT":
        return ROOT / obj["path"]

    parts: list[str] = [obj["path"]]
    current = parents.get(file_id)
    while current:
        group = objects.get(current)
        if not group or group["isa"] != "PBXGroup":
            break
        if group.get("path"):
            parts.insert(0, group["path"])
        current = parents.get(current)
    return ROOT / Path(*parts)


def main() -> int:
    text = PBX.read_text(encoding="utf-8")
    objects = parse_objects(text)
    parents = build_parent_map(objects)

    missing: list[str] = []
    checked: list[str] = []
    for oid, obj in objects.items():
        if obj["isa"] != "PBXFileReference":
            continue
        resolved = resolve_file_path(oid, objects, parents)
        if resolved is None:
            continue
        rel = resolved.relative_to(ROOT)
        checked.append(str(rel))
        if not resolved.is_file():
            missing.append(str(rel))

    checked.sort()
    print(f"Checked {len(checked)} Swift file reference(s) under {ROOT}")
    for path in checked:
        status = "OK" if Path(ROOT / path).is_file() else "MISSING"
        print(f"  [{status}] {path}")

    if missing:
        print(f"\nFAIL: {len(missing)} missing file(s)", file=sys.stderr)
        return 1
    print("\nOK: all Swift PBXFileReference paths exist on disk")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
