# Developer Guide

This guide is for developers who want to contribute to or modify the Knocker GNOME extension.

## Development Setup

### Prerequisites

1. **Development Tools:**
   ```bash
   sudo apt install gjs gnome-shell-extension-tool git
   ```

2. **GNOME Shell Development:**
   - GNOME Shell 48 or 49
   - Looking Glass debugger (Alt+F2, type `lg`)

3. **Knocker-CLI:**
   - Installed and configured for testing
   - User systemd service set up

### Clone and Install for Development

```bash
git clone https://github.com/FarisZR/knocker-gnome.git
cd knocker-gnome
./install.sh
```

## Project Structure

```
knocker-gnome/
├── extension.js              # Main extension entry point
├── knockerService.js         # Service/CLI command interface
├── knockerMonitor.js         # Journald log monitor
├── knockerQuickSettings.js   # UI components
├── prefs.js                  # Preferences dialog
├── metadata.json             # Extension metadata
├── schemas/                  # GSettings schemas
│   └── org.gnome.shell.extensions.knocker.gschema.xml
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md
│   ├── INSTALLATION.md
│   └── TESTING.md
├── build.sh                  # Build script
└── install.sh                # Install script
```

## Development Workflow

### 1. Make Changes

Edit the JavaScript files as needed. The main modules are:

- **extension.js**: Extension lifecycle (enable/disable)
- **knockerService.js**: Systemd and CLI interactions
- **knockerMonitor.js**: Log monitoring and state management
- **knockerQuickSettings.js**: UI implementation
- **prefs.js**: Settings UI

### 2. Test Changes

After making changes:

```bash
# Reinstall the extension
./install.sh

# Reload GNOME Shell
# X11: Alt+F2, type 'r', press Enter
# Wayland: Log out and log back in

# Or disable/enable the extension
gnome-extensions disable Knocker@fariszr.com
gnome-extensions enable Knocker@fariszr.com
```

### 3. Monitor Logs

Always have logs running to catch errors:

**Terminal 1 - GNOME Shell logs:**
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

**Terminal 2 - Knocker service logs:**
```bash
journalctl --user -u knocker.service -f -o json-pretty
```

**Terminal 3 - Preferences logs (when testing prefs):**
```bash
journalctl -f -o cat /usr/bin/gjs
```

### 4. Use Looking Glass

GNOME Shell's debugging tool (Alt+F2, type `lg`):

```javascript
// Get the extension
let ext = imports.ui.main.extensionManager.lookup('Knocker@fariszr.com');

// Check if enabled
ext.state

// Access extension instance (when running)
ext.stateObj

// Check service status
ext.stateObj._knockerService.isServiceActive()

// View current state
ext.stateObj._knockerMonitor.getState()
```

## Coding Standards

### JavaScript Style

- **ES6+**: Use modern JavaScript features
- **Async/await**: Preferred for async operations (but not for lifecycle methods)
- **Arrow functions**: Use for callbacks
- **Template literals**: Use for string interpolation
- **Const/let**: Never use `var`

### Naming Conventions

- **Classes**: PascalCase (`KnockerService`)
- **Methods/Functions**: camelCase (`startService`)
- **Private methods**: Prefix with underscore (`_processEntry`)
- **Constants**: UPPER_SNAKE_CASE (`KNOCKER_SCHEMA_VERSION`)
- **GObject properties**: kebab-case in definitions, camelCase in code

### Error Handling

Always handle errors:

```javascript
// Good
try {
    await someAsyncOperation();
} catch (e) {
    console.error('Operation failed:', e);
    Main.notifyError('Title', 'User-friendly message');
}

// Better - with cleanup
try {
    await someAsyncOperation();
} catch (e) {
    console.error('Operation failed:', e);
    this._cleanup();
    Main.notifyError('Title', 'User-friendly message');
}
```

### Resource Cleanup

Always clean up in `destroy()` methods:

```javascript
destroy() {
    // Cancel async operations
    if (this._cancellable) {
        this._cancellable.cancel();
    }

    // Remove timeouts - CRITICAL: always remove all timeouts
    if (this._timeoutId) {
        GLib.source_remove(this._timeoutId);
        this._timeoutId = null;
    }

    // Remove signal handlers
    if (this._signalId) {
        someObject.disconnect(this._signalId);
        this._signalId = null;
    }

    // Call parent
    super.destroy();
}
```

**Important: Timeout Management**

When creating timeouts, always:
1. Store the timeout ID in an instance variable
2. Remove any existing timeout before creating a new one
3. Clear the timeout ID when it executes
4. Remove all timeouts in destroy()

```javascript
// Before creating a timeout
if (this._myTimeoutId) {
    GLib.source_remove(this._myTimeoutId);
    this._myTimeoutId = null;
}

this._myTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    this._myTimeoutId = null;  // Clear on execute
    this._doSomething();
    return GLib.SOURCE_REMOVE;
});
```

## GObject Registration

For UI components, use GObject.registerClass:

```javascript
import GObject from 'gi://GObject';
import QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

export const MyToggle = GObject.registerClass(
class MyToggle extends QuickSettings.QuickToggle {
    _init(params) {
        super._init({
            title: 'My Toggle',
            iconName: 'icon-name-symbolic',
            ...params
        });
        
        // Your initialization
    }
    
    // Your methods
});
```

## Testing

### Manual Testing

Follow the test cases in `docs/TESTING.md`.

### Debugging Tips

1. **Add console.log():**
   ```javascript
   console.log('Debug info:', variable);
   console.error('Error:', error);
   console.warn('Warning:', warning);
   ```

2. **Use Looking Glass:**
   - Alt+F2, type `lg`
   - Errors tab shows JavaScript errors
   - Evaluator tab for running code

3. **Check return values:**
   ```javascript
   const result = await someOperation();
   console.log('Result:', result);
   ```

4. **Monitor specific events:**
   ```javascript
   this._knockerMonitor.on(KnockerEvent.ERROR, (data) => {
       console.log('Error event:', data);
   });
   ```

## Common Development Tasks

### Adding a New Setting

1. **Add to schema:**
   ```xml
   <key name="my-new-setting" type="b">
       <default>true</default>
       <summary>My Setting</summary>
       <description>Description of the setting</description>
   </key>
   ```

2. **Add to preferences:**
   ```javascript
   const mySettingRow = new Adw.SwitchRow({
       title: _('My Setting'),
       subtitle: _('Description'),
   });
   settings.bind('my-new-setting', mySettingRow, 'active',
       Gio.SettingsBindFlags.DEFAULT);
   group.add(mySettingRow);
   ```

3. **Use in extension:**
   ```javascript
   const settings = this._extensionObject.getSettings();
   if (settings.get_boolean('my-new-setting')) {
       // Do something
   }
   ```

4. **Recompile schemas:**
   ```bash
   cd ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
   glib-compile-schemas schemas/
   ```

### Adding a New Menu Item

```javascript
// In knockerQuickSettings.js, in _setupMenu():
const myAction = this.menu.addAction('My Action', () => {
    this._handleMyAction();
});
```

### Adding a New Event Type

1. **Add to KnockerEvent enum:**
   ```javascript
   export const KnockerEvent = {
       // ... existing events
       MY_NEW_EVENT: 'MyNewEvent',
   };
   ```

2. **Handle in _processEntry:**
   ```javascript
   case KnockerEvent.MY_NEW_EVENT:
       // Update state
       this._currentState.myValue = eventData.myValue;
       break;
   ```

3. **Listen in UI:**
   ```javascript
   this._knockerMonitor.on(KnockerEvent.MY_NEW_EVENT, (data) => {
       this._updateUI();
   });
   ```

## Building and Packaging

### Build a Package

```bash
./build.sh
```

This creates `Knocker@fariszr.com.shell-extension.zip`.

### Install from Package

```bash
gnome-extensions install Knocker@fariszr.com.shell-extension.zip
```

## Submitting Changes

### Before Submitting

1. **Test thoroughly**: Run all test cases from `docs/TESTING.md`
2. **Check syntax**: `node --check *.js`
3. **No errors in logs**: Check GNOME Shell logs
4. **Update docs**: If adding features, update documentation
5. **Follow style**: Match existing code style

### Git Workflow

```bash
# Create a branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add my feature"

# Push and create PR
git push origin feature/my-feature
```

### Commit Message Format

```
Short summary (50 chars or less)

Longer description if needed. Explain what and why,
not how. Wrap at 72 characters.

- Can use bullet points
- For multiple changes

Fixes #123
```

## Resources

### GNOME Shell Documentation

- [GJS Guide](https://gitlab.gnome.org/World/javascript/gjs-guide)
- [GJS API Docs](https://gjs-docs.gnome.org/)
- [GNOME Shell Source](https://gitlab.gnome.org/GNOME/gnome-shell)

### Extension Examples

- [GNOME Shell Extensions](https://gitlab.gnome.org/GNOME/gnome-shell-extensions)
- [Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)

### Knocker-CLI

- [Knocker-CLI Repository](https://github.com/FarisZR/Knocker-CLI)
- [Knocker-CLI Logging Docs](https://github.com/FarisZR/knocker-cli/blob/main/docs/logging.md)

## Troubleshooting Development Issues

### Extension Won't Load

1. Check for syntax errors in logs
2. Verify all imports are correct
3. Check metadata.json is valid JSON
4. Ensure schemas are compiled

### Changes Not Taking Effect

1. Reinstall the extension: `./install.sh`
2. Disable and re-enable: `gnome-extensions disable/enable Knocker@fariszr.com`
3. Restart GNOME Shell (X11 only: Alt+F2, 'r')
4. Check that you're editing the right files (not cached versions)

### GSettings Not Working

1. Ensure schema is in `schemas/` directory
2. Compile with: `glib-compile-schemas schemas/`
3. Check schema ID matches in metadata.json and schema file
4. Verify extension is getting settings: `this.getSettings()`

### UI Not Updating

1. Check event listeners are connected
2. Verify monitor is running: check for journalctl process
3. Ensure knocker is logging events
4. Check for errors in _updateUI() method

## Performance Considerations

### Avoid Blocking Operations

- Use async/await for subprocess calls
- Don't block the main thread
- Use GLib.timeout_add for delayed operations

### Clean Up Resources

- Always remove timeouts in destroy()
- Cancel ongoing operations
- Disconnect signal handlers
- Close file streams

### Minimize Log Parsing

- Only parse recent logs on startup
- Use efficient JSON parsing
- Filter events early

## Security Considerations

- Never execute unsanitized user input
- Validate all data from journald
- Use systemd user services (not root)
- Don't store sensitive data in settings

## Future Enhancement Ideas

- Support for multiple knocker profiles
- Historical knock log viewer
- Configurable notification preferences per event type
- Network status integration
- Quick knock from panel icon
- Keyboard shortcuts
