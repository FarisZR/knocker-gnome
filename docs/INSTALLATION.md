# Installation Guide

Complete guide for installing and configuring the Knocker GNOME extension.

## Prerequisites

### 1. GNOME Shell

This extension requires GNOME Shell version 48 or 49.

Check your version:
```bash
gnome-shell --version
```

### 2. Knocker-CLI

The extension requires [Knocker-CLI](https://github.com/FarisZR/Knocker-CLI) to be installed.

**Installation:**

Follow the installation instructions at https://github.com/FarisZR/Knocker-CLI

Verify installation:
```bash
which knocker
knocker --version
```

### 3. Knocker Service Configuration

Set up knocker as a systemd user service. Create `~/.config/systemd/user/knocker.service`:

```ini
[Unit]
Description=Knocker Port Knocking Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/knocker daemon
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

Adjust the `ExecStart` path if knocker is installed elsewhere.

Enable the service (but don't start it yet):
```bash
systemctl --user daemon-reload
systemctl --user enable knocker.service
```

Configure knocker by creating/editing your knocker configuration file (typically `~/.config/knocker/config.toml`). See knocker-cli documentation for details.

## Installation Methods

### Method 1: From Source (Recommended for Development)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/FarisZR/knocker-gnome.git
   cd knocker-gnome
   ```

2. **Install to extensions directory:**
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
   cp -r * ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com/
   ```

3. **Compile the GSettings schema:**
   ```bash
   cd ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
   glib-compile-schemas schemas/
   ```

4. **Enable the extension:**
   ```bash
   gnome-extensions enable Knocker@fariszr.com
   ```

5. **Restart GNOME Shell:**
   - **X11:** Press `Alt+F2`, type `r`, and press Enter
   - **Wayland:** Log out and log back in

### Method 2: Using gnome-extensions Command

If you have a packaged version (.shell-extension.zip):

```bash
gnome-extensions install Knocker@fariszr.com.shell-extension.zip
gnome-extensions enable Knocker@fariszr.com
```

Then restart GNOME Shell as above.

## Post-Installation

### 1. Verify Installation

Check that the extension is installed and enabled:
```bash
gnome-extensions list
gnome-extensions info Knocker@fariszr.com
```

Expected output should show:
```
Name: Knocker
Description: Gnome Extension to manage Knocker-CLI background service and knock status
State: ENABLED
```

### 2. Check for Errors

Monitor GNOME Shell logs for any errors:
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

If the extension loaded successfully, you should see no error messages related to Knocker.

### 3. Verify Quick Settings

1. Click the system menu in the top-right corner
2. You should see a "Knocker" toggle in the Quick Settings panel
3. Click on it to expand the menu

### 4. Configure Preferences (Optional)

Open the extension preferences:
```bash
gnome-extensions prefs Knocker@fariszr.com
```

Or:
1. Open GNOME Extensions app
2. Find "Knocker" in the list
3. Click the settings/gear icon

Available settings:
- **Show Indicator:** Display icon in the panel when service is active
- **Auto-start Service:** Automatically start knocker.service when extension loads
- **Notify on Errors:** Show notifications for service errors
- **Notify on Successful Knock:** Show notifications when knocks succeed

## Verification

### Test Extension Functionality

1. **Start the service:**
   - Open Quick Settings
   - Toggle the Knocker switch to ON
   - The toggle should turn blue and subtitle should show "Service Active"

2. **Check service status:**
   ```bash
   systemctl --user status knocker.service
   ```
   Should show "active (running)"

3. **Trigger a manual knock:**
   - Open the Knocker menu in Quick Settings
   - Click "Knock Now"
   - Wait for success notification

4. **Monitor logs:**
   ```bash
   journalctl --user -u knocker.service -f -o json-pretty
   ```
   You should see JSON-formatted log entries with `KNOCKER_EVENT` fields

## Troubleshooting

### Extension Not Appearing

**Problem:** Extension doesn't show up in Quick Settings

**Solutions:**
1. Verify extension is enabled:
   ```bash
   gnome-extensions enable Knocker@fariszr.com
   ```

2. Check for errors:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell | grep -i knocker
   ```

3. Ensure schemas are compiled:
   ```bash
   ls ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com/schemas/gschemas.compiled
   ```
   
   If missing, compile them:
   ```bash
   cd ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
   glib-compile-schemas schemas/
   ```

4. Restart GNOME Shell

### "knocker-cli is not installed" Error

**Problem:** Extension shows error notification about missing knocker-cli

**Solution:**
1. Install knocker-cli from https://github.com/FarisZR/Knocker-CLI
2. Verify it's in your PATH:
   ```bash
   which knocker
   ```
3. Restart the extension:
   ```bash
   gnome-extensions disable Knocker@fariszr.com
   gnome-extensions enable Knocker@fariszr.com
   ```

### Service Won't Start

**Problem:** Toggle doesn't turn on, or immediately turns back off

**Solutions:**
1. Check if knocker.service exists:
   ```bash
   systemctl --user status knocker.service
   ```

2. Check service configuration:
   ```bash
   systemctl --user cat knocker.service
   ```

3. Try starting manually:
   ```bash
   systemctl --user start knocker.service
   journalctl --user -u knocker.service -n 50
   ```

4. Ensure knocker daemon mode works:
   ```bash
   knocker daemon
   ```
   (Press Ctrl+C to stop)

### No Log Events Showing

**Problem:** UI doesn't update, no whitelist info shown

**Solutions:**
1. Verify knocker is logging to journald:
   ```bash
   journalctl --user -u knocker.service -o json | grep KNOCKER_EVENT
   ```

2. Check if knocker-cli is configured to use structured logging (should be default)

3. Restart the extension

### Schema Errors

**Problem:** Errors about GSettings schema not found

**Solution:**
```bash
cd ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
glib-compile-schemas schemas/
```

Then restart GNOME Shell.

### Preferences Won't Open

**Problem:** Error when clicking Settings or running `gnome-extensions prefs`

**Solutions:**
1. Check for errors:
   ```bash
   journalctl -f -o cat /usr/bin/gjs
   ```

2. Verify prefs.js exists:
   ```bash
   ls ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com/prefs.js
   ```

3. Check for syntax errors in prefs.js

## Uninstallation

To completely remove the extension:

1. **Disable the extension:**
   ```bash
   gnome-extensions disable Knocker@fariszr.com
   ```

2. **Remove the extension directory:**
   ```bash
   rm -rf ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
   ```

3. **Remove settings (optional):**
   ```bash
   dconf reset -f /org/gnome/shell/extensions/knocker/
   ```

4. **Restart GNOME Shell**

Note: This does not uninstall knocker-cli or remove the knocker.service. To remove those:

```bash
# Stop and disable the service
systemctl --user stop knocker.service
systemctl --user disable knocker.service

# Remove service file
rm ~/.config/systemd/user/knocker.service
systemctl --user daemon-reload

# Uninstall knocker-cli (method depends on how you installed it)
```

## Updating

To update the extension:

1. **Pull latest changes:**
   ```bash
   cd knocker-gnome
   git pull
   ```

2. **Copy updated files:**
   ```bash
   cp -r * ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com/
   ```

3. **Recompile schemas if changed:**
   ```bash
   cd ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
   glib-compile-schemas schemas/
   ```

4. **Restart extension:**
   ```bash
   gnome-extensions disable Knocker@fariszr.com
   gnome-extensions enable Knocker@fariszr.com
   ```

5. **Restart GNOME Shell**

## Support

For issues and support:
- Extension: https://github.com/FarisZR/knocker-gnome/issues
- Knocker-CLI: https://github.com/FarisZR/Knocker-CLI/issues

When reporting issues, please include:
- GNOME Shell version (`gnome-shell --version`)
- Extension version (from metadata.json)
- Relevant logs from `journalctl`
- Steps to reproduce the issue
