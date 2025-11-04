# Knocker Extension Architecture

This document describes the architecture and implementation details of the Knocker GNOME Shell extension.

## Overview

The extension is designed with modularity and maintainability in mind, following GNOME Shell extension best practices for versions 48 and 49.

## Components

### 1. Extension Main (`extension.js`)

The main entry point that:
- Initializes all components when enabled
- Checks if knocker-cli is installed
- Sets up the Quick Settings indicator
- Handles auto-start of the service
- Cleans up all resources when disabled

### 2. Service Manager (`knockerService.js`)

Handles all interactions with the knocker-cli command and systemd service:

**Responsibilities:**
- Check if knocker-cli is installed (`which knocker`)
- Start the user systemd service (`systemctl --user start knocker.service`)
- Stop the user systemd service (`systemctl --user stop knocker.service`)
- Check service status (`systemctl --user is-active knocker.service`)
- Trigger manual knocks (`knocker knock`)

**Key Methods:**
- `checkKnockerInstalled()`: Returns boolean indicating if knocker-cli exists
- `startService()`: Starts knocker.service
- `stopService()`: Stops knocker.service
- `isServiceActive()`: Checks if service is running
- `triggerKnock()`: Executes a manual knock

### 3. Event Monitor (`knockerMonitor.js`)

Monitors journald logs for knocker events and maintains current state:

**Responsibilities:**
- Parse JSON-formatted journald entries from knocker.service
- Maintain current state (whitelist IP, expiry, next knock, etc.)
- Emit events to registered listeners
- Handle different event types according to the knocker-cli logging schema

**Event Types (from knocker-cli schema v1):**
- `ServiceState`: Service lifecycle events (started, stopping, stopped)
- `StatusSnapshot`: Complete state snapshot
- `WhitelistApplied`: New whitelist entry created
- `WhitelistExpired`: Whitelist entry expired
- `NextKnockUpdated`: Next scheduled knock changed
- `KnockTriggered`: Manual or automatic knock executed
- `Error`: Service errors

**Implementation Details:**
- Uses `journalctl --user -u knocker.service -o json -f` to follow logs
- Implements async/await pattern for reading log streams
- Auto-reconnects if the log stream is interrupted with proper timeout management
- Filters for entries with `KNOCKER_EVENT` field
- Validates schema version (currently "1")
- Properly cleans up timeouts on destroy

**Design Note:** Uses subprocess for journalctl rather than DBus Journal API for simplicity and maintainability. See `docs/DBUS_CONSIDERATIONS.md` for detailed rationale.

### 4. Quick Settings UI (`knockerQuickSettings.js`)

Implements the GNOME Quick Settings interface:

**Components:**

#### KnockerToggle (QuickMenuToggle)
The main UI component that:
- Shows service status (on/off) with appropriate colors
- Displays current whitelisted IP and expiry countdown
- Displays next scheduled knock time
- Provides "Knock Now" button
- Provides "Settings" button

**UI Updates:**
- Real-time countdown updates every 10 seconds
- Event-driven updates from monitor
- Smooth state transitions

#### KnockerIndicator (SystemIndicator)
Panel indicator that:
- Shows icon in the panel (when enabled in settings)
- Manages the KnockerToggle lifecycle
- Integrates with GNOME's Quick Settings system

### 5. Preferences (`prefs.js`)

GTK4/Adwaita preferences dialog:

**Settings:**
- Show/hide panel indicator
- Auto-start service on extension load
- Enable/disable error notifications
- Enable/disable knock success notifications

**GSettings Schema:**
Located in `schemas/org.gnome.shell.extensions.knocker.gschema.xml`

## Data Flow

```
┌─────────────────┐
│  knocker.service│
│   (journald)    │
└────────┬────────┘
         │ JSON logs
         ↓
┌─────────────────┐
│ KnockerMonitor  │ ← Parses events
│                 │   Updates state
└────────┬────────┘
         │ Events
         ↓
┌─────────────────┐
│ KnockerToggle   │ ← Updates UI
│  (Quick Settings)│   Shows status
└────────┬────────┘
         │ User actions
         ↓
┌─────────────────┐
│ KnockerService  │ → systemctl/knocker commands
└─────────────────┘
```

## State Management

The extension maintains state through:

1. **KnockerMonitor Internal State**:
   - `whitelistIp`: Current whitelisted IP (or null)
   - `expiresUnix`: Unix timestamp when whitelist expires
   - `ttlSec`: TTL in seconds
   - `nextAtUnix`: Unix timestamp of next scheduled knock
   - `serviceState`: Current service state (started, stopped, etc.)
   - `version`: Knocker-CLI version

2. **GSettings (User Preferences)**:
   - Persistent configuration stored in dconf
   - Automatically synced between extension and preferences

3. **Runtime State**:
   - Service active/inactive status
   - UI visibility and update timers
   - Event listeners and callbacks

## Error Handling

### Missing knocker-cli
- Detected on extension enable
- Shows error notification with installation link
- Extension disables gracefully

### Service Errors
- Captured from `KNOCKER_EVENT=Error` log entries
- Displayed as notifications (if enabled)
- Includes error message and context

### Command Failures
- All subprocess calls wrapped in try/catch
- Failed commands logged to console
- UI reverts to previous state on failure

## Lifecycle

### Enable
1. Create KnockerService instance
2. Create KnockerMonitor instance
3. Check if knocker-cli installed (abort if not)
4. Start monitoring journald logs
5. Create and add Quick Settings indicator
6. Optionally auto-start service

### Disable
1. Stop journald monitor
2. Destroy service manager
3. Remove Quick Settings indicator
4. Cancel all pending operations
5. Remove all event listeners

## Threading Model

- Main GNOME Shell thread handles UI
- Asynchronous subprocess calls for commands
- Async stream reading for journald logs
- GLib main loop for timers and callbacks

## Best Practices Followed

1. **Modern JavaScript**: ES6+ features, async/await
2. **GNOME Shell 48/49**: Uses QuickSettings API (45+)
3. **Clean Lifecycle**: Proper enable/disable with cleanup
4. **Error Recovery**: Reconnects on failures, validates data
5. **User Experience**: Real-time updates, clear feedback
6. **Modularity**: Separated concerns, reusable components
7. **Documentation**: Inline comments, JSDoc where appropriate

## Testing Strategy

Since GNOME Shell extensions don't have a standard unit testing framework, testing is done through:

1. **Manual Testing**:
   - Install extension
   - Test each feature interactively
   - Verify UI updates correctly
   - Test error conditions

2. **Log Inspection**:
   - Monitor gnome-shell logs: `journalctl -f -o cat /usr/bin/gnome-shell`
   - Monitor knocker logs: `journalctl --user -u knocker.service -o json`
   - Check for JavaScript errors and warnings

3. **State Verification**:
   - Use `dconf watch /org/gnome/shell/extensions/knocker` to verify settings
   - Verify systemd service state with `systemctl --user status knocker.service`

## Future Enhancements

Potential improvements:
- Support for multiple profiles (when knocker-cli adds this)
- Historical knock log viewer
- Configurable refresh intervals
- Custom notification sounds
- Quick actions (e.g., temporary service disable)
