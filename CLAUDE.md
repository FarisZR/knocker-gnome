# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GNOME Shell extension (versions 48-49) that provides Quick Settings integration for the Knocker-CLI port knocking service. The extension monitors the systemd user service `knocker.service` via journald logs and provides real-time status updates, manual knock triggers, and service management.

## Development Commands

### Testing & Quality
```bash
npm test              # Syntax check all JS files + validate schemas
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix linting issues
```

### Installation & Building
```bash
./install.sh          # Install extension to ~/.local/share/gnome-shell/extensions/
./build.sh            # Build distributable .zip package
```

### GNOME Shell Operations
```bash
# Enable/disable extension
gnome-extensions enable Knocker@fariszr.com
gnome-extensions disable Knocker@fariszr.com

# Open preferences
gnome-extensions prefs Knocker@fariszr.com

# Restart GNOME Shell (X11 only)
# Press Alt+F2, type 'r', press Enter
# Wayland: Log out and log back in
```

### Debugging
```bash
# Monitor GNOME Shell logs
journalctl -f -o cat /usr/bin/gnome-shell

# Monitor knocker service logs (JSON format)
journalctl --user -u knocker.service -f -o json-pretty

# Watch GSettings changes
dconf watch /org/gnome/shell/extensions/knocker/

# Use Looking Glass debugger
# Press Alt+F2, type 'lg', press Enter
```

## Architecture

### Component Structure

1. **extension.js** - Main entry point
   - Extension lifecycle (enable/disable)
   - Checks for knocker-cli installation
   - Initializes all components with proper async handling
   - Manages auto-start functionality

2. **knockerService.js** - CLI/systemd interface
   - Wraps `systemctl --user` commands for knocker.service
   - Wraps `knocker` CLI commands (knock, etc.)
   - All operations return Promises
   - Uses Gio.Subprocess for command execution

3. **knockerMonitor.js** - Event monitoring
   - Follows journald logs: `journalctl --user -u knocker.service -o json -f`
   - Parses JSON-formatted log entries with `KNOCKER_EVENT` field
   - Maintains current state (whitelist IP, expiry, next knock, etc.)
   - Emits events to registered listeners
   - Validates knocker-cli logging schema v1

4. **knockerQuickSettings.js** - UI components
   - `KnockerToggle` (QuickMenuToggle): Main Quick Settings UI
   - `KnockerIndicator` (SystemIndicator): Panel integration
   - Real-time countdown updates
   - Event-driven UI updates

5. **prefs.js** - GTK4/Adwaita preferences
   - GSettings bindings
   - Settings: show-indicator, auto-start-service, notify-on-error, notify-on-knock

### Event System (knocker-cli schema v1)

The monitor parses these event types from journald:
- `ServiceState`: Service lifecycle (started, stopping, stopped)
- `StatusSnapshot`: Complete state snapshot
- `WhitelistApplied`: New whitelist entry
- `WhitelistExpired`: Whitelist expired
- `NextKnockUpdated`: Next scheduled knock changed
- `KnockTriggered`: Manual/automatic knock executed
- `Error`: Service errors

All events require `KNOCKER_EVENT` field and `schema_version: "1"`.

### State Management

State flows: knocker.service → journald → KnockerMonitor → KnockerToggle UI

Key state maintained by KnockerMonitor:
- `whitelistIp`: Current whitelisted IP (or null)
- `expiresUnix`: Unix timestamp when whitelist expires
- `ttlSec`: TTL in seconds
- `nextAtUnix`: Unix timestamp of next scheduled knock
- `serviceState`: Service state string
- `version`: Knocker-CLI version

## Critical Implementation Details

### Async Initialization Pattern

The extension uses a cancellable async initialization pattern to handle enable/disable race conditions. When implementing new async operations during enable(), always check for cancellation using the `checkAborted()` pattern seen in extension.js:40-60.

### Resource Cleanup

All components must implement `destroy()` methods that:
- Cancel pending async operations (Gio.Cancellable)
- Remove timeouts/intervals (GLib.source_remove)
- Disconnect signal handlers
- Clean up subprocess streams

**Critical: Timeout Management**

All timeouts created with `GLib.timeout_add()` or `GLib.timeout_add_seconds()` MUST:
1. Store the timeout ID in an instance variable
2. Remove any existing timeout before creating a new one with the same ID
3. Be removed in the `destroy()` method

Example pattern:
```javascript
// Store timeout ID
this._myTimeoutId = null;

// Before creating timeout, remove existing
if (this._myTimeoutId) {
    GLib.source_remove(this._myTimeoutId);
    this._myTimeoutId = null;
}

// Create new timeout
this._myTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    this._myTimeoutId = null;  // Clear on execute
    this._doSomething();
    return GLib.SOURCE_REMOVE;
});

// In destroy()
if (this._myTimeoutId) {
    GLib.source_remove(this._myTimeoutId);
    this._myTimeoutId = null;
}
```

Never skip cleanup - GNOME Shell will leak resources otherwise.

### GSettings Schema

Schema ID: `org.gnome.shell.extensions.knocker`
Location: `schemas/org.gnome.shell.extensions.knocker.gschema.xml`

After modifying schemas:
```bash
glib-compile-schemas schemas/
```

### Subprocess Execution

All command execution uses `Gio.Subprocess` with:
- `STDOUT_PIPE | STDERR_PIPE` flags
- Async callbacks via `communicate_utf8_async`
- Cancellable support for cleanup
- Proper error handling (try/catch)

Example in knockerService.js:85-106.

### Journald Log Monitoring

The monitor uses async stream reading to follow logs via `journalctl` subprocess. Key implementation:
- Only processes entries with `KNOCKER_EVENT` field
- Validates `schema_version === "1"`
- Auto-reconnects on stream interruption
- Filters by systemd unit (knocker.service)

**Important: journalctl subprocess vs D-Bus**

While GNOME Shell extensions typically prefer D-Bus over subprocess execution, systemd's journald **does not provide a D-Bus API for reading journal entries**. The only programmatic interfaces are:
- Native C API (sd-journal)
- journalctl CLI tool

Since GJS doesn't have direct bindings to sd-journal and journalctl is the standard user-facing tool, this extension uses `Gio.Subprocess` to run `journalctl --user -u knocker.service -o json -f`.

See knockerMonitor.js for full implementation.

## Code Style

### ESLint Configuration

Using `@eslint/js` with custom rules:
- 4-space indentation
- Single quotes (avoidEscape: true)
- Semicolons required
- Unix line endings
- Unused vars prefixed with `_` are allowed
- Arrow functions: parens as-needed
- No var, prefer const

### Naming Conventions

- Classes: PascalCase (KnockerService)
- Methods: camelCase (startService)
- Private methods: _prefixedUnderscore (_processEntry)
- Constants: UPPER_SNAKE_CASE (KNOCKER_SCHEMA_VERSION)
- GObject properties: kebab-case in schemas, camelCase in code

### GObject Registration

UI components extend GNOME Shell classes and use `GObject.registerClass`:

```javascript
export const MyComponent = GObject.registerClass(
class MyComponent extends QuickSettings.QuickToggle {
    _init(params) {
        super._init({...params});
    }
});
```

## Common Modifications

### Adding New Settings

1. Add to `schemas/org.gnome.shell.extensions.knocker.gschema.xml`
2. Add UI in prefs.js (Adwaita widgets with settings.bind)
3. Compile: `glib-compile-schemas schemas/`
4. Access: `this.getSettings().get_boolean('setting-name')`

### Adding Event Handlers

1. Define event type in KnockerEvent enum (knockerMonitor.js)
2. Add case in `_processEntry` to update state
3. Listen in UI: `this._knockerMonitor.on(KnockerEvent.TYPE, callback)`

### Modifying UI

Quick Settings UI is in knockerQuickSettings.js. The toggle extends `QuickSettings.QuickMenuToggle` and menu items use `this.menu.addAction()`. Always update UI in response to monitor events, not on timers (except countdown displays).

## Dependencies

- GNOME Shell 48 or 49
- GJS runtime (provided by GNOME)
- Knocker-CLI (external, must be installed separately)
- systemd (user services)

## Testing Strategy

No unit test framework exists for GNOME Shell extensions. Testing is manual:

1. Install extension: `./install.sh`
2. Test each feature interactively
3. Monitor logs for errors
4. Test error conditions (service not running, knocker-cli missing, etc.)
5. Verify state in Looking Glass: `ext.stateObj._knockerMonitor.getState()`
6. Check settings with dconf

See docs/TESTING.md for comprehensive test cases.

## Related Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Detailed architecture and data flow
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) - Extended development guide with examples
- [TESTING.md](docs/TESTING.md) - Comprehensive test procedures
- [Knocker-CLI](https://github.com/FarisZR/Knocker-CLI) - The underlying service this extension manages
