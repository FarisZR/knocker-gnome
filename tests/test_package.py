import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("packaging", ROOT / "scripts/package.py")
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)


class Bundles(unittest.TestCase):
    def test_review_and_portable_bundles_load_all_runtime_imports_and_settings(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            commit = "a" * 40
            packaging.package(output, commit)
            uuid = json.loads((ROOT / "metadata.json").read_text())["uuid"]
            with zipfile.ZipFile(output / f"{uuid}.shell-extension.zip") as archive:
                names = set(archive.namelist())
                self.assertNotIn("schemas/gschemas.compiled", names)
                metadata = json.loads(archive.read("metadata.json"))
                self.assertEqual(metadata["shell-version"], ["48", "49", "50", "51"])
                self.assertEqual(metadata["build-commit"], commit)
                for name in names:
                    if name.endswith(".js"):
                        for imported in re.findall(r"from ['\"](\.[^'\"]+)", archive.read(name).decode()):
                            resolved = (ROOT / name).parent.joinpath(imported).resolve().relative_to(ROOT).as_posix()
                            self.assertIn(resolved, names, f"{name} cannot load {imported}")
                self.assertFalse(any(name.startswith(("tests/", ".git/", "node_modules/")) for name in names))
            with tarfile.open(output / "knocker-gnome.tar.gz") as archive:
                archive.extractall(output / "portable", filter="data")
            stage = output / "portable" / uuid
            result = subprocess.run([
                "gsettings", "--schemadir", str(stage / "schemas"), "get",
                metadata["settings-schema"], "show-indicator",
            ], check=True, capture_output=True, text=True, env=os.environ | {"GSETTINGS_BACKEND": "memory"})
            self.assertEqual(result.stdout.strip(), "true")

    def test_rebuilding_removes_deleted_files_from_existing_archives(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "Knocker@fariszr.com.shell-extension.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("obsolete.js", "stale")
            packaging.package(temporary)
            with zipfile.ZipFile(path) as archive:
                self.assertNotIn("obsolete.js", archive.namelist())

    def test_repeated_builds_keep_release_checksums_stable(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            packaging.package(output, "a" * 40)
            first = {path.name: path.read_bytes() for path in output.iterdir()}
            packaging.package(output, "a" * 40)
            self.assertEqual(first, {path.name: path.read_bytes() for path in output.iterdir()})
