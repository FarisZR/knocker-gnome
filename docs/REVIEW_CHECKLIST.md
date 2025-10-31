# GNOME Shell Extension Review Checklist

This checklist verifies compliance with [GNOME Shell Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).

## ✅ General Guidelines

- [x] No object creation before `enable()` is called
- [x] Objects created in `enable()` are destroyed in `disable()`
- [x] All functionality is properly initialized in `enable()`
- [x] Clean code with consistent indentation and style
- [x] Modern ES6+ features used (classes, async/await)
- [x] ESLint configured for code quality

## ✅ Lifecycle Management

### Initialization (constructor)
- [x] Only static resources in constructor
- [x] No GObject instances created
- [x] No signals connected
- [x] No main loop sources added
- [x] No modifications to GNOME Shell

### Enable
- [x] All objects created here
- [x] All signals connected here
- [x] All main loop sources added here
- [x] Proper error handling for initialization failures

### Disable
- [x] All objects destroyed (checked in `extension.js`, `knockerQuickSettings.js`, `knockerMonitor.js`, `knockerService.js`)
- [x] All signals disconnected (tracked in `_monitorListeners` array)
- [x] All main loop sources removed (timeouts tracked and removed)
- [x] Cancellable operations properly cancelled
- [x] Notification sources destroyed

## ✅ Import Rules

### Extension Process (extension.js, knocker*.js)
- [x] No GTK imports (`Gdk`, `Gtk`, `Adw`)
- [x] Only Shell libraries used (`GLib`, `GObject`, `Gio`)
- [x] GNOME Shell resources used correctly

### Preferences Process (prefs.js)
- [x] No Shell imports (`Clutter`, `Meta`, `St`, `Shell`)
- [x] Only GTK libraries used (`Gtk`, `Adw`, `Gio`)
- [x] Proper separation from extension code

## ✅ Deprecated Modules

- [x] No `ByteArray` usage (using TextDecoder/TextEncoder if needed)
- [x] No `Lang` usage (using ES6 classes and bind())
- [x] No `Mainloop` usage (using GLib functions and setTimeout)

## ✅ Code Quality

- [x] Code is readable and well-structured
- [x] No minified or obfuscated code
- [x] Proper indentation (4 spaces)
- [x] Consistent code style throughout
- [x] Comments where necessary
- [x] No excessive logging

## ✅ External Scripts

- [x] No binary executables included
- [x] No Python/HTML/other scripts (pure GJS)
- [x] Only systemd/knocker-cli commands executed
- [x] Processes spawned safely with Gio.Subprocess
- [x] All processes properly cleaned up

## ✅ Metadata

- [x] Valid JSON format
- [x] Required fields present:
  - [x] `name`
  - [x] `description`
  - [x] `uuid` (format: Knocker@fariszr.com)
  - [x] `shell-version` (array: ["48", "49"])
- [x] Optional fields included:
  - [x] `url` (GitHub repository)
  - [x] `version` (1)
  - [x] `settings-schema`

## ✅ GSettings Schema

- [x] Schema file present in `schemas/`
- [x] Schema compiles without errors (--strict mode)
- [x] Schema ID matches metadata `settings-schema`
- [x] Schema path follows convention `/org/gnome/shell/extensions/knocker/`
- [x] All keys have proper types
- [x] All keys have default values
- [x] All keys have summaries and descriptions

## ✅ File Organization

- [x] No unnecessary files included in package
- [x] No build scripts in package (excluded by build.sh)
- [x] No .po/.pot files
- [x] Only necessary icons included
- [x] Reasonable package size

## ✅ Licensing

- [x] GPL-2.0-or-later license (compatible with GNOME Shell)
- [x] LICENSE file included
- [x] License headers in source files
- [x] SPDX identifier included

## ✅ Documentation

- [x] README with clear description
- [x] Installation instructions
- [x] Usage documentation
- [x] Troubleshooting guide
- [x] Contributing guidelines
- [x] Architecture documentation

## ✅ Code of Conduct Compliance

- [x] No political statements
- [x] No offensive content
- [x] No copyrighted/trademarked content without permission
- [x] Appropriate extension name and description

## ✅ UI Design (Recommendations)

- [x] Follows GNOME HIG where applicable
- [x] Consistent with GNOME desktop style
- [x] Uses standard GNOME icons
- [x] Preferences use Adwaita widgets

## ✅ Testing

- [x] Extension tested on GNOME Shell 48
- [x] Extension tested on GNOME Shell 49 (if available)
- [x] Enable/disable cycle works correctly
- [x] No errors in logs during normal operation
- [x] All features function as expected
- [x] Proper cleanup verified

## ✅ CI/CD

- [x] GitHub Actions workflow for testing
- [x] Automated linting
- [x] Automated schema validation
- [x] Automated syntax checking
- [x] Automated package building
- [x] Release automation

## Summary

**All requirements met**: ✅

The Knocker GNOME Extension fully complies with GNOME Shell Extension Review Guidelines and is ready for submission to extensions.gnome.org.

## Verification Commands

```bash
# Syntax check
for file in *.js; do node --check "$file"; done

# Schema validation
glib-compile-schemas --strict --dry-run schemas/

# Lint
npm install
npm run lint

# Build package
./build.sh

# Test installation
gnome-extensions install Knocker@fariszr.com.shell-extension.zip
gnome-extensions enable Knocker@fariszr.com
```

## Review Notes for Maintainers

- Extension follows all mandatory rules
- No violations of any guidelines
- Clean, modern codebase
- Well-documented
- Comprehensive testing
- Ready for v1.0.0 release
