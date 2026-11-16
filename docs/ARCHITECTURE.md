# Architecture

GNOME Shell 48–51 use the same extension entry points and Quick Settings APIs.
No version-specific UI branch is needed. Metadata declares the supported versions.

| Module | Owns |
| --- | --- |
| `extension.js` | One enabled session, initialization and ordered destruction |
| `src/knocker/service.js` | CLI discovery, systemctl commands, active/busy state and one 10-second reconciliation loop |
| `src/knocker/protocol.js` | Knocker schema v1 fields, validation and immutable state reduction |
| `src/knocker/monitor.js` | Journal process, stream, cursor, history classification and reconnect source |
| `src/process.js` | Cancellable one-shot subprocesses, output and termination |
| `src/quickSettings.js` | Toggle, panel indicator, countdown display and UI subscriptions |
| `src/notifications.js` | One Shell notification source per enabled session |
| `prefs.js`, `schemas/` | Preferences UI and persistent GSettings contract |

Service activity comes from systemd. Both UI actors consume the same service
snapshot, so an external start/stop is reconciled for both. Operations publish
busy state and refresh confirmed state when systemctl finishes. The service is
never stopped merely because the extension is disabled.

Journalctl streams the last 100 records and then follows without a separate
bootstrap query. Every valid event updates state; records older than the enabled
session never produce notifications. Reconnection resumes after the last cursor.
The journal transport ignores malformed/unrelated data; the pure protocol rejects
unsupported versions and invalid numeric fields. Journald offers no journal-reading
D-Bus API, so the extension owns a journalctl subprocess.

Disabling disconnects UI subscriptions, cancels reads and commands, terminates
children, removes timers, and destroys the notification source. Each enable uses
a distinct session identity so a previous startup completion cannot affect it.

The only delays are a 10-second countdown/reconciliation interval and a two-second
journal reconnect backoff. Startup, toggling and manual knocks await completion.

Packaging, development installation and releases share `scripts/package.py`.
See [the decision log](DECISIONS.md) for the original problems and redesign.
