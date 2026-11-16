# Verification

Run the commands in [development](DEVELOPMENT.md). Tests cover:

- Journal renewal, expiry, scheduling, malformed records and diagnostic events.
- Real GJS command results, failure recovery, manual knocks, cancellation, historical
  versus live journal records, and child termination on disable.
- Complete local imports and loadable settings in both package formats; stale-file
  removal and reproducible archive checksums.
- Real headless GNOME auto-start, toggle/indicator consistency, repeated activation,
  notifications, show-indicator preference, and disable/re-enable with work pending.

The headless Shell uses fake external commands to exercise controls without changing
the host service. After installation, confirm the real configured service is active
with `systemctl --user is-active knocker.service`; open Quick Settings and check the
IP/countdown against recent structured journal events. Confirm preferences open,
manual knock reaches your configured endpoint, and external service state changes
are reflected within ten seconds. Desktop interaction and real network success are
separate from the isolated integration checks.

A running Wayland Shell caches loaded extension modules and metadata. Log out/in
after updating files; disabling/enabling alone does not reload the JavaScript.
