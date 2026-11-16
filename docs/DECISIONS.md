# Untangling decision log

Scope: preserve GNOME 48–50 support, add GNOME 51, preserve Knocker's service
and configuration, and publish every main commit and version tag to Homebrew.
The user selected both optional comment and test cleanup.

## Audit before implementation

### Give service status one owner and make completion explicit

- Hidden link: toggle and indicator independently query systemd, subscribe to
  journal lifecycle events, and maintain different refresh schedules. External
  starts/stops update the icon but can leave the toggle stale.
- Special case: extension.js waits one second for monitor initialization. Its
  initialization token is cleared first, so the callback always considers itself
  stale and automatic startup never happens.
- Special cases: the toggle waits 500ms after systemctl and the knock button waits
  two seconds after its command, despite both commands already having completion.
- Hidden link: asynchronous service/UI callbacks assume their actors still exist
  after disable; some can create new sources after destruction.
- Hidden link: `which knocker` and `knocker knock` assume Shell inherited a login
  shell's PATH, which need not include Linuxbrew.

Design: service owns executable discovery, command completion, one active/busy
snapshot, and one status refresh loop. UI subscribes to that snapshot. Startup
awaits status explicitly; commands finish before controls become available again.

### Separate the journal protocol from its owned stream

- Hidden link: protocol fields, parsing, state reduction, replay and stream cleanup
  are interwoven in knockerMonitor.js; UI imports event names from that I/O module.
- Surplus: `_startFollowing()` only forwards to `_followProcess()`; reserved
  profile/port data have no consumers; public stop/restart creates cancellables
  without owning the old processes.
- Hidden link: cancelling reads never terminates journalctl, which is only a local
  variable. Bootstrap can start a new follower after disable.
- Special cases: separate five-second spawn retry and two-second EOF reconnect
  duplicate one recovery policy and its source cleanup.
- Hidden link: asynchronous history replay suppresses all UI updates, then follow
  replays its default ten records and can duplicate success/error notifications.
- Special cases: parse errors and listener failures are swallowed together, so
  consumer bugs look like malformed journal data.
- Hidden link: subprocess communication is copied between monitor and service.
- Special cases: `|| null` erases zero values and permissive parseInt accepts
  malformed protocol numbers. Unknown protocol versions are used after a warning.

Design: a pure protocol module defines supported events, typed fields and state
updates. One follower replays bounded history and then follows continuously;
timestamps distinguish history from live notifications. Monitor owns process,
stream, cancellable and one retry source. A command runner owns cancellable
subprocesses and their termination. Malformed/unrelated records are ignored at the
protocol boundary; listener failures are logged separately.

### Own Shell integration once, using APIs common to GNOME 48–51

- Hidden link: metadata stops at 50 while the installed desktop runs 51.1.
- Hidden link: extension and toggle each implement notification-source lifecycle
  using positional constructors and removed methods.
- Needless link: UI writes PopupMenu's private `_settingsActions` registry.
- Surplus: a single-label menu section, stored dependencies with no consumers,
  restating comments, and an unused gettext import increase the reading surface.

Design: one notification owner uses Source/Notification property bags and
addNotification, supported across the declared versions. UI uses public session
signals for settings visibility and cleans up subscriptions before its actors.

### Use one package manifest and the tap's existing release synchronizer

- Hidden link: build.sh and install.sh duplicate UUID, module and asset lists.
- Special case: install.sh copies deleted stylesheet.css and removes the old
  installation before validating inputs.
- Hidden link: build runs relative to the caller's directory, updates an existing
  zip without removing stale entries, and leaves schema compilation ambiguous.
- Hidden link: CI and release duplicate validation/build steps; npm test's
  `node --check *.js` only checks the first supplied script, and metadata's UUID
  check compares a value to itself. No behavioral regression coverage exists.
- Surplus: unused build variables, disabled schema commands, unpinned npm install
  and obsolete implementation/review documents obscure the actual workflow.
- Hidden link: release.yml publishes only tags, has stale GNOME requirements,
  and has no tap integration. The tap knows only Whisper's portable bundle.
- Special case: tap updater uses Whisper's name to choose version parsing, archive
  name, install directory and caveats.
- Hidden link: installation and architecture instructions are repeated across
  README, guides and CLAUDE.md, with obsolete version and lifecycle guidance.

Design: packaging reads metadata and recursively includes runtime modules from a
single source tree, validates before writing, and creates both a review ZIP
(schema XML) and portable tarball (compiled schema) from one staging tree.
Development install consumes the validated ZIP through gnome-extensions. CI tests/builds once, publishes
immutable commit and tagged releases, and dispatches the existing tap sync with a
scheduled fallback. Tap defines extension requirements as project data and uses
one portable-extension renderer. README leads with brew install/upgrade;
contributor and architecture docs describe the current boundaries.

## Special cases retained by design

- Journalctl needs a bounded reconnect delay after an external stream failure;
  immediate reconnect would spin when the journal is unavailable.
- Historical journal entries update state but must not announce old knocks/errors.
- Supported protocol version, optional/missing fields and malformed journal records
  are external input constraints, not workflow exceptions.
- CLI discovery checks standard Homebrew locations when Shell lacks brew in PATH.
- Wayland requires a new login to load changed extension modules in the running Shell.
- Published assets are immutable; main-head checks prevent delayed builds from
  moving the tap backwards. Tags and commit builds use distinct release names.

## Implementation and review

The runtime now has one systemd state owner, one continuous journal transport,
a pure protocol module, one notification owner and explicit enabled-session
lifetimes. The UI subscribes to snapshots; command completion replaced all three
startup/button delays. The unused icon, forwarding wrapper, reserved profile/port
fields, restating comments and obsolete checklist/implementation documents were
removed. Contributor docs link to current architecture and commands.

Independent runtime review found two additional races: repeated toggle activation
while busy, and auto-start during a pending user action. Both are guarded and
covered in the real Shell integration test. The same review removed duplicate JSON
decoding. Final review found no further worthwhile runtime structural issues.

Independent publishing review found that existing release checksums must match the
fresh deterministic build, PR concurrency must not replace pending publication,
and schema tests must isolate the user's preferences. These are fixed, with
publication behavior regressions for reruns, partial drafts, stale-main checks,
changed assets and version tags. Publication has a separate queued concurrency
job (`queue: max`, supported by current GitHub Actions), so PR builds cannot evict
main/tag publications.

Verification completed locally:

- ESLint and per-file JavaScript syntax/schema validation.
- Protocol behavior tests and real GJS command, service, journal and cancellation
  checks. The failed-start diagnostic is intentionally exercised.
- Package tests for loadable schemas, complete imports, stale-file removal and
  deterministic ZIP/tarball bytes; publication behavior tests use a fake GitHub CLI.
- Real headless GNOME Shell 48.8, 49.8, 50.6 and 51.1 sessions. Each tests auto-start,
  toggle/indicator agreement, concurrent activation, notification APIs, preferences,
  cancellation and disable/re-enable. The container harness uses a private system
  bus because older Shell versions require one even without system services.
- Tap generator's 15 release-validation tests, including portable Knocker commit
  builds and version releases, incomplete assets and untrusted tags.

Live activation also passed:

- Source workflow run `43859982798` passed every job and published immutable
  `build-6194492be2769d0c338a844a3d1f2add75f0f344` with all three verified assets.
- Tap commit `21d75bf` adds the generator, cask, installation matrix and documentation.
  Tap test run `43860423903` passed updater tests and install/reinstall/uninstall on
  both Linux x86_64 and ARM64. Sync run `43860423960` also passed.
- Local Homebrew fetch/install/reinstall succeeded after backing up the manual
  extension under `~/.local/state/knocker-gnome/backups/`. The running service's
  MainPID/ActiveState and extension preferences matched before and after install.
- The regenerated TAP_GITHUB_TOKEN was installed in both Knocker and Whisper.
  Whisper's notification job rerun succeeded and triggered tap sync `43860457696`.
  No workflow source edit was necessary there: it already referenced that secret.

The final verification commit also exercises automatic source publication and tap
synchronization after the token rotation.
A new Wayland login remains required to reload the existing desktop's cached
extension metadata and modules.


## Follow-up: stable default and explicit @main development channel

The user requested a moving `@main` release and a stable default. This supersedes
the earlier choice to mark commit builds latest. Version tags now publish full
releases and update the default cask; main builds are prereleases. A verified
immutable build is published first, then the `@main` tag/assets are refreshed.
The development cask resolves that moving ref to immutable, checksummed assets.
Mutual Homebrew conflicts protect the shared extension directory when switching.
The GNOME 51 changes are released as v1.1.0, with GNOME metadata version 2.
Regression checks cover main tag movement, preserving immutable assets, stable
latest selection, stable rejection of commit/prerelease data, and tag resolution.
