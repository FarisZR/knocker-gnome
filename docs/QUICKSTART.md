# Quick Start Guide

Get up and running with the Knocker GNOME extension in 5 minutes.

## Prerequisites

Before you begin, make sure you have:

1. ✅ GNOME Shell 48 or 49
2. ✅ [Knocker-CLI](https://github.com/FarisZR/Knocker-CLI) installed
3. ✅ Knocker configured and working

**Check your setup:**
```bash
# Check GNOME Shell version
gnome-shell --version

# Check if knocker-cli is installed
which knocker
knocker --version
```

## Installation (3 steps)

### Step 1: Clone the Repository
```bash
git clone https://github.com/FarisZR/knocker-gnome.git
cd knocker-gnome
```

### Step 2: Run the Install Script
```bash
./install.sh
```

This will:
- Copy files to your extensions directory
- Compile the GSettings schema
- Show you the next steps

### Step 3: Enable the Extension
```bash
gnome-extensions enable Knocker@fariszr.com
```

### Step 4: Restart GNOME Shell

**On X11:**
1. Press `Alt+F2`
2. Type `r`
3. Press `Enter`

**On Wayland:**
- Log out and log back in

## First Use

### 1. Open Quick Settings

Click the system menu in the top-right corner of your screen.

You should see a **Knocker** toggle in the Quick Settings panel.

### 2. Start the Service

Click the Knocker toggle to turn it **ON**.

- The toggle will turn **blue** when active
- The subtitle will show "Service Active"

### 3. Test Manual Knock

1. Click on the Knocker toggle to expand the menu
2. Click **"Knock Now"**
3. Wait for the success notification

You should see:
- A notification confirming the knock
- Your whitelisted IP displayed in the menu
- An expiry countdown

## What You'll See

### In the Quick Settings Menu

```
┌─────────────────────────────────┐
│ Knocker            [ON] (blue)  │  ← Service toggle
│ Service Active                  │
├─────────────────────────────────┤
│ 203.0.113.42 (expires in 9m)   │  ← Current whitelist
│ Next knock in 55m               │  ← Next scheduled knock
├─────────────────────────────────┤
│ Knock Now                       │  ← Manual trigger
├─────────────────────────────────┤
│ Settings                        │  ← Preferences
└─────────────────────────────────┘
```

## Configuration (Optional)

Open the preferences:
```bash
gnome-extensions prefs Knocker@fariszr.com
```

Available settings:
- **Show Indicator**: Display icon in panel when service is active
- **Auto-start Service**: Start service when extension loads
- **Notify on Errors**: Get notifications for errors
- **Notify on Successful Knock**: Get notifications for successful knocks

## Common Usage

### Start/Stop the Service

Just toggle the switch in Quick Settings!

- **ON** (blue) = Service running
- **OFF** (gray) = Service stopped

### Trigger a Knock Manually

1. Open Quick Settings
2. Click on Knocker to expand
3. Click "Knock Now"

Perfect for when you need immediate access.

### Check Your Current Status

Open the Knocker menu to see:
- Current whitelisted IP
- Time until expiry
- Next scheduled knock

## Troubleshooting

### Extension Doesn't Appear

**Check if it's enabled:**
```bash
gnome-extensions list | grep Knocker
```

**If not listed, reinstall:**
```bash
./install.sh
gnome-extensions enable Knocker@fariszr.com
```

### Error: "knocker-cli is not installed"

Install knocker-cli from https://github.com/FarisZR/Knocker-CLI

Then restart the extension:
```bash
gnome-extensions disable Knocker@fariszr.com
gnome-extensions enable Knocker@fariszr.com
```

### Service Won't Start

**Check if knocker.service exists:**
```bash
systemctl --user status knocker.service
```

**If not found, create it** - see the [Installation Guide](docs/INSTALLATION.md) for details.

### UI Not Updating

**Check if knocker is running:**
```bash
systemctl --user is-active knocker.service
```

**Check knocker logs:**
```bash
journalctl --user -u knocker.service -n 20
```

## Next Steps

- 📖 Read the full [README](README.md) for detailed features
- 🔧 See [Installation Guide](docs/INSTALLATION.md) for advanced setup
- 🐛 Run [Test Cases](docs/TESTING.md) to verify everything works
- 👨‍💻 Check [Development Guide](docs/DEVELOPMENT.md) to contribute

## Getting Help

- **Issues**: https://github.com/FarisZR/knocker-gnome/issues
- **Knocker-CLI**: https://github.com/FarisZR/Knocker-CLI

## Uninstall

To remove the extension:

```bash
gnome-extensions disable Knocker@fariszr.com
rm -rf ~/.local/share/gnome-shell/extensions/Knocker@fariszr.com
```

Restart GNOME Shell.

---

**That's it!** You now have the Knocker extension running. Enjoy easy port knocking from your GNOME desktop! 🎉
