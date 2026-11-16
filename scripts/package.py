#!/usr/bin/env python3
"""Build review and portable bundles from the same runtime tree."""

import gzip
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def package(output, commit=""):
    metadata = json.loads((ROOT / "metadata.json").read_text())
    uuid = metadata["uuid"]
    if not re.fullmatch(r"[A-Za-z0-9_.+-]+@[A-Za-z0-9_.-]+", uuid):
        raise ValueError("Invalid extension UUID")
    if not isinstance(metadata.get("version"), int) or metadata["version"] < 1:
        raise ValueError("Extension version must be a positive integer")
    if not metadata.get("shell-version") or not all(isinstance(v, str) for v in metadata["shell-version"]):
        raise ValueError("shell-version must contain version strings")
    if commit and not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Build commit must be a full Git commit hash")
    if commit:
        metadata["build-commit"] = commit
    subprocess.run(["glib-compile-schemas", "--strict", "--dry-run", str(ROOT / "schemas")], check=True)
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="knocker-package-") as temporary:
        stage = Path(temporary) / uuid
        stage.mkdir()
        for name in ("extension.js", "prefs.js", "LICENSE"):
            shutil.copy2(ROOT / name, stage / name)
        shutil.copytree(ROOT / "src", stage / "src")
        shutil.copytree(ROOT / "schemas", stage / "schemas", ignore=shutil.ignore_patterns("gschemas.compiled"))
        (stage / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
        zip_path = output / f"{uuid}.shell-extension.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(stage.rglob("*")):
                if path.is_file():
                    info = zipfile.ZipInfo(path.relative_to(stage).as_posix(), (1980, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o100644 << 16
                    archive.writestr(info, path.read_bytes())
        subprocess.run(["glib-compile-schemas", "--strict", str(stage / "schemas")], check=True)
        tar_path = output / "knocker-gnome.tar.gz"
        def normalize(info):
            info.uid = info.gid = info.mtime = 0
            info.uname = info.gname = ""
            info.mode = 0o755 if info.isdir() else 0o644
            return info

        with tar_path.open("wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as archive:
                archive.add(stage, arcname=uuid, filter=normalize)
        print(zip_path)
        print(tar_path)


if __name__ == "__main__":
    package(*sys.argv[1:])
