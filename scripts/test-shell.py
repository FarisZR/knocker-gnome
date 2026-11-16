#!/usr/bin/env python3
"""Exercise the installed extension in a private headless GNOME Shell session."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]

with tempfile.TemporaryDirectory(prefix="knocker-shell-") as temporary:
    base = Path(temporary)
    subprocess.run([str(ROOT / "build.sh"), str(base / "dist")], check=True)
    extensions = base / "data/gnome-shell/extensions"
    extensions.mkdir(parents=True)
    with tarfile.open(base / "dist/knocker-gnome.tar.gz") as archive:
        archive.extractall(extensions, filter="data")
    driver = extensions / "knocker-test@example.com"
    driver.mkdir()
    shutil.copy2(ROOT / "tests/shell/extension.js", driver / "extension.js")
    shell_version = subprocess.check_output(["gnome-shell", "--version"], text=True).split()[-1].split(".")[0]
    (driver / "metadata.json").write_text(json.dumps({
        "uuid": driver.name, "name": "Knocker shell test", "description": "Private integration test",
        "shell-version": [shell_version],
    }))
    binary = base / "bin"
    binary.mkdir()
    fixtures = {
        "knocker": "#!/bin/sh\nexit 0\n",
        "journalctl": "#!/bin/sh\nexec /bin/sleep 60\n",
        "systemctl": """#!/bin/sh
case "$2" in
is-active) if [ -f "$KNOCKER_TEST_DIR/active" ]; then echo active; else echo inactive; exit 3; fi ;;
start) sleep 0.1; touch "$KNOCKER_TEST_DIR/active" ;;
stop) sleep 0.1; rm -f "$KNOCKER_TEST_DIR/active" ;;
esac
""",
    }
    for name, content in fixtures.items():
        path = binary / name
        path.write_text(content)
        path.chmod(0o755)
    runtime = base / "runtime"
    runtime.mkdir(mode=0o700)
    env = os.environ | {
        "XDG_CONFIG_HOME": str(base / "config"), "XDG_DATA_HOME": str(base / "data"),
        "XDG_CACHE_HOME": str(base / "cache"), "XDG_RUNTIME_DIR": str(runtime),
        "GSETTINGS_BACKEND": "keyfile", "LIBGL_ALWAYS_SOFTWARE": "1",
        "KNOCKER_TEST_DIR": str(base), "PATH": f"{binary}:{os.environ['PATH']}",
        "GNOME_SHELL_SESSION_MODE": "user",
    }
    for name in ("DISPLAY", "WAYLAND_DISPLAY", "DBUS_SESSION_BUS_ADDRESS"):
        env.pop(name, None)
    subprocess.run(["gsettings", "set", "org.gnome.shell", "enabled-extensions",
                    "['Knocker@fariszr.com', 'knocker-test@example.com']"], env=env, check=True)
    subprocess.run(["gsettings", "--schemadir", str(extensions / "Knocker@fariszr.com/schemas"),
                    "set", "org.gnome.shell.extensions.knocker", "auto-start-service", "true"], env=env, check=True)
    command = ["dbus-run-session", "--", "/bin/sh", "-c",
               'export DBUS_SYSTEM_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS"; '
               'exec gnome-shell --headless --no-x11 --virtual-monitor 1024x768']
    try:
        result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=40)
    except subprocess.TimeoutExpired as error:
        print(error.stdout.decode() if isinstance(error.stdout, bytes) else error.stdout)
        print(error.stderr.decode() if isinstance(error.stderr, bytes) else error.stderr)
        raise
    if "KNOCKER_SHELL_TEST_PASS" not in result.stderr + result.stdout or "KNOCKER_SHELL_TEST_FAIL" in result.stderr + result.stdout:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit("Headless GNOME Shell test failed")
    print(f"GNOME Shell {shell_version}: auto-start, toggle, concurrent activation, notifications, preferences and disable/re-enable passed")
