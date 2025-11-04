# DBus Considerations for Knocker Extension

This document addresses GNOME review feedback regarding the use of DBus instead of subprocess calls for systemd and journald operations.

## Review Question

The GNOME reviewer asked: "Isn't possible to use dbus instead (line 101 and 149 `knockerMonitor.js`)?"

Reference: [GJS Guide: D-Bus](https://gjs.guide/guides/gio/dbus.html#d-bus)

## Current Implementation

The extension currently uses `Gio.Subprocess` to interact with systemd and journald:

### In knockerMonitor.js:
- **Line 101**: `journalctl --user -u knocker.service -o json -n 100 --reverse` - Fetches initial state
- **Line 149**: `journalctl --user -u knocker.service -o json -f` - Follows logs in real-time

### In knockerService.js:
- `systemctl --user start knocker.service` - Start service
- `systemctl --user stop knocker.service` - Stop service  
- `systemctl --user is-active knocker.service` - Check status
- `knocker knock` - Trigger manual knock

## DBus Alternative Analysis

### Option 1: systemd DBus API for Service Control

**Pros:**
- Native DBus integration
- No subprocess overhead
- More "proper" API usage

**Cons:**
- More complex code for simple operations
- Requires managing DBus proxy objects
- Less readable/maintainable
- No significant performance benefit for these infrequent operations

**Example DBus implementation:**
```javascript
const systemdProxy = Gio.DBusProxy.new_for_bus_sync(
    Gio.BusType.SESSION,
    Gio.DBusProxyFlags.NONE,
    null,
    'org.freedesktop.systemd1',
    '/org/freedesktop/systemd1',
    'org.freedesktop.systemd1.Manager',
    null
);

// Start service
systemdProxy.call_sync(
    'StartUnit',
    new GLib.Variant('(ss)', ['knocker.service', 'replace']),
    Gio.DBusCallFlags.NONE,
    -1,
    null
);
```

### Option 2: systemd Journal DBus API

**Pros:**
- Native journal access
- Could be more efficient

**Cons:**
- **Much more complex**: Journal DBus API is significantly more complex than using `journalctl`
- **Limited GJS support**: The journal DBus API is not well-documented for GJS usage
- **No JSON parsing**: Would need to manually parse journal entry fields
- **Cursor management**: Must manually track journal position
- **Schema compatibility**: `journalctl -o json` provides exactly the format we need
- **Less maintainable**: Future developers would need deep systemd knowledge

**Current journalctl approach provides:**
- Automatic JSON formatting (`-o json`)
- Field filtering (`-u knocker.service`)
- Follow mode (`-f`) with automatic reconnection handling
- Simple, readable code

## Design Decision: Use Subprocess

After careful analysis, we've decided to **continue using subprocess calls** for the following reasons:

### 1. Simplicity and Maintainability
The subprocess approach is:
- Easier to understand and maintain
- More readable for developers
- Well-documented with standard man pages
- Less code to maintain (fewer lines, less complexity)

### 2. Reliability
- `journalctl` and `systemctl` are stable, well-tested tools
- Built-in error handling and output formatting
- Automatic field parsing with `-o json`
- Standard across all systemd distributions

### 3. Common Practice
Many GNOME Shell extensions use subprocess for systemd operations:
- It's an accepted pattern in the GNOME ecosystem
- The GNOME review guidelines don't prohibit subprocess usage
- subprocess is actually recommended for CLI tool integration

### 4. Performance
- Service operations (start/stop) are infrequent - performance is not critical
- Log monitoring is I/O-bound anyway (waiting for journal events)
- No measurable performance difference for our use case

### 5. JSON Output
`journalctl -o json` provides:
- Perfect format for our needs
- All fields automatically included
- No manual field extraction needed
- Schema version included

### 6. Future-Proofing
- If systemd/journald APIs change, `journalctl` provides stability
- CLI tools are more backward-compatible than DBus APIs
- Easier to test and debug

## Proper Subprocess Usage

We follow GNOME best practices for subprocess usage:

### ✅ Async Operations
```javascript
proc.communicate_utf8_async(null, this._cancellable, (proc, res) => {
    // Non-blocking, uses GLib main loop
});
```

### ✅ Cancellable Support
```javascript
this._cancellable = new Gio.Cancellable();
// Can cancel operations during cleanup
this._cancellable.cancel();
```

### ✅ Error Handling
```javascript
try {
    const [success, stdout, stderr] = await this._execCommand(argv);
    if (!success) {
        // Handle error
    }
} catch (e) {
    console.error('Command failed:', e);
}
```

### ✅ Resource Cleanup
```javascript
destroy() {
    this._cancellable.cancel();
    // All subprocess operations are cancelled
}
```

## When DBus Would Be Better

DBus would be more appropriate if we needed:

1. **Real-time systemd state changes** - Subscribe to PropertyChanged signals
2. **Service dependency management** - Complex unit relationships
3. **Transaction-based operations** - Multiple coordinated changes
4. **Fine-grained service control** - Setting specific properties
5. **High-frequency operations** - Thousands of calls per second

Our use case involves:
- Infrequent service start/stop (user-initiated)
- Log monitoring (I/O bound, not CPU bound)
- Simple status checks

## Conclusion

For the Knocker extension's use case, **subprocess is the right choice**:

1. ✅ Simpler, more maintainable code
2. ✅ Follows common GNOME extension patterns
3. ✅ Reliable and well-tested
4. ✅ Adequate performance for our needs
5. ✅ Better error messages from CLI tools
6. ✅ Easier to debug and troubleshoot

The subprocess approach is **not a workaround** - it's the **appropriate solution** for this type of integration.

## References

- [GJS Guide: Subprocess](https://gjs.guide/guides/gio/subprocesses.html)
- [GNOME Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
- [Gio.Subprocess Documentation](https://gjs-docs.gnome.org/gio20~2.66/gio.subprocess)
- [systemd Journal Export Format](https://www.freedesktop.org/wiki/Software/systemd/export/)

## Reviewer Response

If the GNOME reviewer still prefers DBus, we can implement it, but we believe the current approach is:
- More appropriate for this use case
- More maintainable
- Following GNOME extension best practices
- Used by many other approved extensions

We're open to discussion if there are specific concerns about the subprocess approach.
