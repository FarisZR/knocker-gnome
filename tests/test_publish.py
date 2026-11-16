import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "a" * 40
ASSETS = ["Knocker@fariszr.com.shell-extension.zip", "knocker-gnome.tar.gz"]

GH = '''#!/usr/bin/env python3
import json, os, pathlib, shutil, sys
base = pathlib.Path(os.environ["FAKE_GITHUB"])
args = sys.argv[1:]
with (base / "calls").open("a") as log:
    log.write(json.dumps(args) + "\\n")
if args[0] == "api":
    endpoint = next(arg for arg in args[1:] if arg.startswith("repos/"))
    if endpoint.endswith("commits/main"):
        heads = json.loads((base / "heads").read_text())
        print(heads[0])
        if len(heads) > 1:
            (base / "heads").write_text(json.dumps(heads[1:]))
    elif "--method" in args:
        sha = next(arg.removeprefix("sha=") for arg in args if arg.startswith("sha="))
        (base / "main-ref").write_text(sha)
    elif not (base / "main-ref").exists():
        sys.exit(1)
else:
    release = base / "releases" / args[2]
    if args[1] == "view":
        if not release.exists():
            sys.exit(1)
        if "--json" in args:
            print("\\n".join(sorted(path.name for path in release.iterdir())))
    elif args[1] == "create":
        release.mkdir(parents=True)
    elif args[1] == "upload":
        for path in args[3:]:
            if not path.startswith("--"):
                shutil.copyfile(path, release / pathlib.Path(path).name)
    elif args[1] == "download":
        shutil.copytree(release, args[args.index("--dir") + 1])
    elif args[1] != "edit":
        sys.exit(2)
'''



class Publication(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.dist = self.base / "dist"
        self.dist.mkdir()
        for name in ASSETS:
            (self.dist / name).write_bytes(name.encode())
        self.checksums(self.dist)
        self.github = self.base / "github"
        self.github.mkdir()
        (self.github / "heads").write_text(json.dumps([COMMIT]))
        binary = self.base / "bin"
        binary.mkdir()
        gh = binary / "gh"
        gh.write_text(GH)
        gh.chmod(0o755)
        self.env = os.environ | {
            "PATH": f"{binary}:{os.environ['PATH']}", "FAKE_GITHUB": str(self.github),
            "GH_REPO": "FarisZR/knocker-gnome", "BUILD_COMMIT": COMMIT,
            "RELEASE_TAG": f"build-{COMMIT}", "GITHUB_OUTPUT": str(self.base / "output"),
        }

    def checksums(self, directory):
        (directory / "SHA256SUMS").write_text("".join(
            f"{hashlib.sha256((directory / name).read_bytes()).hexdigest()}  {name}\n" for name in ASSETS
        ))

    def run_publish(self):
        return subprocess.run([str(ROOT / "scripts/publish.sh"), str(self.dist)],
                              env=self.env, capture_output=True, text=True)

    def calls(self):
        return [json.loads(line) for line in (self.github / "calls").read_text().splitlines()]

    def test_publish_and_rerun_keep_assets_immutable(self):
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        first_uploads = sum(call[:3] == ["release", "upload", f"build-{COMMIT}"] for call in self.calls())
        self.assertEqual(first_uploads, 3)
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sum(call[:3] == ["release", "upload", f"build-{COMMIT}"] for call in self.calls()), first_uploads)
        self.assertIn("published=true", (self.base / "output").read_text())

    def test_stale_main_does_not_create_a_release(self):
        (self.github / "heads").write_text(json.dumps(["b" * 40]))
        self.assertEqual(self.run_publish().returncode, 0)
        self.assertFalse((self.github / "releases" / f"build-{COMMIT}").exists())
        self.assertFalse((self.base / "output").exists())

    def test_newer_main_during_upload_prevents_latest_and_dispatch(self):
        (self.github / "heads").write_text(json.dumps([COMMIT, "b" * 40]))
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(call[-1] == "--latest" for call in self.calls()))
        self.assertFalse((self.base / "output").exists())

    def test_different_preexisting_release_cannot_be_promoted(self):
        release = self.github / "releases" / f"build-{COMMIT}"
        shutil.copytree(self.dist, release)
        (release / ASSETS[0]).write_bytes(b"older build")
        self.checksums(release)
        self.assertNotEqual(self.run_publish().returncode, 0)
        self.assertFalse(any(call[:2] == ["release", "edit"] for call in self.calls()))
        self.assertFalse((self.base / "output").exists())

    def test_partial_draft_upload_can_be_completed(self):
        release = self.github / "releases" / f"build-{COMMIT}"
        release.mkdir(parents=True)
        shutil.copy2(self.dist / ASSETS[0], release / ASSETS[0])
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sum(call[:3] == ["release", "upload", f"build-{COMMIT}"] for call in self.calls()), 2)

    def test_version_tag_publishes_without_requiring_main_head(self):
        self.env["RELEASE_TAG"] = "v1.2.3"
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(call[0] == "api" for call in self.calls()))

    def test_main_is_a_moving_prerelease_and_never_becomes_latest(self):
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.github / "main-ref").read_text(), COMMIT)
        main = self.github / "releases" / "@main"
        self.assertEqual((main / "SHA256SUMS").read_bytes(), (self.dist / "SHA256SUMS").read_bytes())
        self.assertTrue(any(call[:3] == ["release", "edit", "@main"] and "--prerelease" in call for call in self.calls()))
        self.assertFalse(any(call[-1] == "--latest" for call in self.calls()))
        self.env["BUILD_COMMIT"] = "b" * 40
        self.env["RELEASE_TAG"] = "build-" + "b" * 40
        (self.github / "heads").write_text(json.dumps(["b" * 40]))
        (self.dist / ASSETS[0]).write_bytes(b"next main commit")
        self.checksums(self.dist)
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.github / "main-ref").read_text(), "b" * 40)
        self.assertEqual((main / ASSETS[0]).read_bytes(), b"next main commit")
        self.assertEqual((self.github / "releases" / f"build-{COMMIT}" / ASSETS[0]).read_bytes(), ASSETS[0].encode())

    def test_stable_is_latest_and_does_not_move_main(self):
        self.env["RELEASE_TAG"] = "v1.1.0"
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any(call == ["release", "edit", "v1.1.0", "--latest"] for call in self.calls()))
        self.assertTrue(any("--prerelease=false" in call for call in self.calls()))
        self.assertFalse((self.github / "main-ref").exists())

    def test_invalid_version_tag_is_rejected_before_publication(self):
        self.env["RELEASE_TAG"] = "vnext"
        self.assertNotEqual(self.run_publish().returncode, 0)
        self.assertFalse((self.github / "releases").exists())
