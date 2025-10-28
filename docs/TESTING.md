# Testing Guide

This guide describes how to test the Knocker GNOME extension.

## Prerequisites

Before testing, ensure you have:

1. **GNOME Shell 48 or 49** installed
2. **knocker-cli** installed and configured
3. **knocker.service** systemd user service set up
4. The extension installed and enabled

## Test Environment Setup

### 1. Install the Extension

```bash
cd knocker-gnome
mkdir -p ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
cp -r . ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com/
cd ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
glib-compile-schemas schemas/
gnome-extensions enable Knocker@fariszr.com
```

### 2. Restart GNOME Shell

- **X11**: Press `Alt+F2`, type `r`, press Enter
- **Wayland**: Log out and log back in

### 3. Open Monitoring Tools

In separate terminal windows:

**Terminal 1 - GNOME Shell Logs:**
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

**Terminal 2 - Knocker Service Logs:**
```bash
journalctl --user -u knocker.service -f -o json-pretty
```

**Terminal 3 - Settings Watch:**
```bash
dconf watch /org/gnome/shell/extensions/knocker/
```

## Test Cases

### TC1: Extension Loads Successfully

**Steps:**
1. Enable the extension: `gnome-extensions enable Knocker@fariszr.com`
2. Open Quick Settings (click top-right corner)

**Expected:**
- Extension loads without errors in logs
- Knocker toggle appears in Quick Settings
- No error notifications appear

**Verify:**
- Check gnome-shell logs for errors
- Quick Settings menu shows "Knocker" entry

---

### TC2: Knocker-CLI Not Installed

**Steps:**
1. Temporarily rename knocker: `sudo mv /usr/bin/knocker /usr/bin/knocker.bak` (adjust path as needed)
2. Disable and re-enable extension:
   ```bash
   gnome-extensions disable Knocker@fariszr.com
   gnome-extensions enable Knocker@fariszr.com
   ```

**Expected:**
- Error notification appears: "knocker-cli is not installed. Please install it from: https://github.com/FarisZR/Knocker-CLI"
- Extension does not crash

**Cleanup:**
```bash
sudo mv /usr/bin/knocker.bak /usr/bin/knocker
gnome-extensions disable Knocker@fariszr.com
gnome-extensions enable Knocker@fariszr.com
```

---

### TC3: Service Start/Stop

**Steps:**
1. Ensure service is stopped: `systemctl --user stop knocker.service`
2. Open Quick Settings
3. Click the Knocker toggle to turn it ON
4. Wait 1 second
5. Click the toggle to turn it OFF

**Expected:**
- Toggle turns blue when ON
- Subtitle changes to "Service Active"
- Service starts: `systemctl --user is-active knocker.service` returns "active"
- Toggle turns gray when OFF
- Subtitle changes to "Service Inactive"
- Service stops: `systemctl --user is-active knocker.service` returns "inactive"

**Verify:**
```bash
systemctl --user status knocker.service
```

---

### TC4: Manual Knock Trigger

**Steps:**
1. Ensure service is running
2. Open Quick Settings → Knocker menu
3. Click "Knock Now"
4. Wait for notification

**Expected:**
- Button becomes insensitive (grayed out) for 2 seconds
- "Knock triggered successfully" notification appears
- Knocker logs show `KNOCKER_EVENT=KnockTriggered` with `KNOCKER_TRIGGER_SOURCE=cli`
- If knock succeeds, whitelisted IP updates

**Verify:**
```bash
journalctl --user -u knocker.service -n 20 -o json-pretty | grep KNOCKER_EVENT
```

---

### TC5: Whitelist Display and Countdown

**Steps:**
1. Trigger a successful knock (either manually or wait for scheduled)
2. Open Quick Settings → Knocker menu
3. Observe the IP display
4. Wait 10-15 seconds
5. Re-open the menu

**Expected:**
- Current whitelisted IP is displayed
- Expiry countdown shows (e.g., "expires in 9m 45s")
- Countdown updates when menu is re-opened
- Format adjusts based on time (seconds, minutes, hours, days)

**Verify:**
- Check knocker logs for `KNOCKER_EVENT=WhitelistApplied`
- Confirm KNOCKER_WHITELIST_IP and KNOCKER_EXPIRES_UNIX values

---

### TC6: Next Knock Display

**Setup:**
Ensure knocker.service is running with a scheduled knock configured.

**Steps:**
1. Open Quick Settings → Knocker menu
2. Check "Next knock" line

**Expected:**
- Shows "Next knock in X" with appropriate time format
- Updates when menu is re-opened
- Shows "No scheduled knock" if none is scheduled

**Verify:**
```bash
journalctl --user -u knocker.service -o json | grep KNOCKER_NEXT_AT_UNIX | tail -1
```

---

### TC7: Error Notifications

**Steps:**
1. Open preferences: `gnome-extensions prefs Knocker@fariszr.com`
2. Ensure "Notify on Errors" is enabled
3. Trigger an error (e.g., temporarily block network access or misconfigure knocker)

**Expected:**
- When knocker logs `KNOCKER_EVENT=Error`, notification appears
- Notification shows the error message
- Error is also logged to gnome-shell logs

**Verify:**
```bash
journalctl --user -u knocker.service -o json | grep 'KNOCKER_EVENT.*Error'
```

---

### TC8: Success Notifications

**Steps:**
1. Open preferences
2. Enable "Notify on Successful Knock"
3. Trigger a manual knock that succeeds

**Expected:**
- Notification appears: "Whitelisted X.X.X.X until [time]"
- Notification includes IP and expiry time

---

### TC9: Preferences Window

**Steps:**
1. Open preferences: `gnome-extensions prefs Knocker@fariszr.com`
2. Toggle each setting
3. Observe changes in dconf watch terminal

**Expected:**
- Preferences window opens without errors
- All toggles work smoothly
- Links to GitHub repositories are clickable
- Changes are saved to dconf immediately

**Settings to test:**
- Show Indicator
- Auto-start Service
- Notify on Errors
- Notify on Successful Knock

**Verify:**
```bash
dconf read /org/gnome/shell/extensions/knocker/show-indicator
dconf read /org/gnome/shell/extensions/knocker/auto-start-service
dconf read /org/gnome/shell/extensions/knocker/notification-on-error
dconf read /org/gnome/shell/extensions/knocker/notification-on-knock
```

---

### TC10: Auto-start Service

**Steps:**
1. Open preferences
2. Enable "Auto-start Service"
3. Stop the service: `systemctl --user stop knocker.service`
4. Disable extension: `gnome-extensions disable Knocker@fariszr.com`
5. Enable extension: `gnome-extensions enable Knocker@fariszr.com`
6. Wait 2 seconds
7. Check service status

**Expected:**
- Service automatically starts
- `systemctl --user is-active knocker.service` returns "active"

---

### TC11: Panel Indicator Visibility

**Steps:**
1. Open preferences
2. Disable "Show Indicator"
3. Look at the top panel
4. Enable "Show Indicator"
5. Look at the top panel again

**Expected:**
- When disabled, no Knocker icon in panel (even when service is active)
- When enabled and service is active, icon appears in panel

---

### TC12: Service State Monitoring

**Steps:**
1. Start the service via Quick Settings
2. In a terminal, stop the service: `systemctl --user stop knocker.service`
3. Wait 1-2 seconds
4. Open Quick Settings

**Expected:**
- Toggle automatically updates to OFF position
- Subtitle changes to "Service Inactive"

---

### TC13: Extension Disable/Enable Cycle

**Steps:**
1. Start the service via extension
2. Disable extension: `gnome-extensions disable Knocker@fariszr.com`
3. Check gnome-shell logs for cleanup messages
4. Re-enable: `gnome-extensions enable Knocker@fariszr.com`

**Expected:**
- No errors during disable
- No errors during enable
- Service state persists (doesn't auto-stop on disable)
- Extension re-initializes correctly

---

### TC14: Long-running Stability

**Steps:**
1. Enable extension
2. Start service
3. Leave running for several hours
4. Periodically check Quick Settings menu

**Expected:**
- Extension continues to work
- UI updates remain accurate
- No memory leaks in gnome-shell process
- Log monitoring continues without interruption

**Verify:**
```bash
# Check for any errors
journalctl -f -o cat /usr/bin/gnome-shell | grep -i error

# Monitor memory (optional)
watch -n 5 'ps aux | grep gnome-shell | grep -v grep'
```

---

## Debugging Tips

### Check Extension Status
```bash
gnome-extensions info Knocker@fariszr.com
```

### View All Logs
```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

### Test Service Manually
```bash
systemctl --user start knocker.service
systemctl --user status knocker.service
journalctl --user -u knocker.service -f
```

### Test Knocker CLI
```bash
knocker knock
```

### Inspect Current State
```bash
# View recent knocker events
journalctl --user -u knocker.service -o json | jq 'select(.KNOCKER_EVENT != null) | {event: .KNOCKER_EVENT, ip: .KNOCKER_WHITELIST_IP, next: .KNOCKER_NEXT_AT_UNIX}'
```

### Reset Extension Settings
```bash
dconf reset -f /org/gnome/shell/extensions/knocker/
```

### Reload Extension
```bash
gnome-extensions disable Knocker@fariszr.com && gnome-extensions enable Knocker@fariszr.com
```

## Common Issues

### Extension doesn't load
- Check for syntax errors: `journalctl -f -o cat /usr/bin/gnome-shell | grep -i error`
- Verify schema is compiled: `ls schemas/gschemas.compiled`
- Check GNOME Shell version compatibility

### Service won't start
- Verify knocker.service exists: `systemctl --user status knocker.service`
- Check service is enabled: `systemctl --user is-enabled knocker.service`
- Review service logs: `journalctl --user -u knocker.service`

### UI doesn't update
- Check monitor is running (look for journalctl process)
- Verify journald logs are being generated
- Check for exceptions in gnome-shell logs

## Test Checklist

Use this checklist for complete testing:

- [ ] TC1: Extension loads successfully
- [ ] TC2: Handles missing knocker-cli
- [ ] TC3: Service start/stop works
- [ ] TC4: Manual knock triggers correctly
- [ ] TC5: Whitelist display updates
- [ ] TC6: Next knock display updates
- [ ] TC7: Error notifications work
- [ ] TC8: Success notifications work
- [ ] TC9: Preferences save correctly
- [ ] TC10: Auto-start works
- [ ] TC11: Panel indicator toggles
- [ ] TC12: Service state monitoring works
- [ ] TC13: Enable/disable cycle works
- [ ] TC14: Long-running stability confirmed

## Reporting Issues

When reporting issues, include:
1. GNOME Shell version: `gnome-shell --version`
2. Extension version from metadata.json
3. Relevant logs from gnome-shell and knocker.service
4. Steps to reproduce
5. Expected vs actual behavior
