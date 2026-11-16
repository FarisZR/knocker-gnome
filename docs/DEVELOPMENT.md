# Development

Install Node.js 22+, Python 3.12+, GJS, GLib tools, and GNOME Shell for integration
tests. Work from this repository; the scripts also accept invocation from elsewhere.

```bash
npm ci
npm run lint
npm test
python3 scripts/test-shell.py
./build.sh
```

`npm test` checks every JavaScript file and the schema, then runs protocol behavior,
real GJS subprocess/service/journal lifecycle checks, and package validation.
The Shell test starts a private headless GNOME session with isolated settings and
fake service/CLI commands. It does not toggle the user's running Knocker service.
CI runs the Shell checks on Fedora 42–45 (GNOME 48–51).

Build outputs go in `dist/`. `./build.sh /absolute/output/directory` overrides that
location. `BUILD_COMMIT=<full sha> ./build.sh` embeds the source commit. Repeated
builds produce identical archives. The ZIP omits compiled schemas for GNOME review;
the portable tarball includes them for Homebrew installation.

For local development installation, run `./install.sh`, then log out/in and enable
`Knocker@fariszr.com`. This uses the validated package and gnome-extensions instead
of copying the repository. If Homebrew owns the extension, develop in an isolated
Shell session or uninstall the cask first so package ownership stays clear.

Runtime boundaries are described in [architecture](ARCHITECTURE.md). Add protocol
fields/events there with tests, rather than parsing logs in UI code. Subscribe to
service state instead of launching another poller. Own async work and unsubscribe
before destroying actors. Keep GTK/Adwaita imports in prefs.js.

Inspect Shell errors with `journalctl --user -b --no-pager --grep='Knocker|JS ERROR'`
and service activity with `systemctl --user status knocker.service`. Do not include
credentials from `~/.knocker.yaml` in diagnostics.
