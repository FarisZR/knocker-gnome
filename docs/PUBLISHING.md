# Publishing Guide

This guide explains how to prepare and submit the Knocker extension to extensions.gnome.org.

## Pre-submission Checklist

### Code Quality ✅
- [x] All JavaScript follows GNOME Shell Extension Guidelines
- [x] No deprecated modules used (ByteArray, Lang, Mainloop)
- [x] ES6+ modern JavaScript features used throughout
- [x] Async/await used for asynchronous operations
- [x] ESLint configured and all files pass linting

### Lifecycle Compliance ✅
- [x] No objects created during initialization (constructor)
- [x] All objects created in `enable()` are destroyed in `disable()`
- [x] All signals connected are disconnected in `disable()`
- [x] All main loop sources are removed in `disable()`
- [x] Proper cancellation handling for async operations

### Library Usage ✅
- [x] No GTK/Gdk/Adw imports in `extension.js`
- [x] No Clutter/Meta/St/Shell imports in `prefs.js`
- [x] Proper separation of extension and preferences code

### Metadata ✅
- [x] Valid `metadata.json` with all required fields
- [x] UUID follows format: `name@domain.tld`
- [x] Shell versions specified correctly (48, 49)
- [x] URL points to GitHub repository
- [x] Version number included

### Schema ✅
- [x] GSettings schema compiles without errors
- [x] Schema ID matches metadata settings-schema
- [x] Schema path follows convention
- [x] All keys have proper types and defaults

### Documentation ✅
- [x] README with clear description and installation
- [x] LICENSE file (GPL-2.0-or-later)
- [x] No excessive or unnecessary files
- [x] All documentation under docs/ directory

### Testing ✅
- [x] Extension tested on target GNOME Shell versions
- [x] All features work as expected
- [x] No errors in logs
- [x] Proper enable/disable cycle
- [x] CI/CD pipeline validates everything

## Building the Submission Package

1. **Update version number** in `metadata.json`:
   ```json
   {
     "version": 1
   }
   ```

2. **Build the package**:
   ```bash
   ./build.sh
   ```

3. **Verify the package**:
   ```bash
   unzip -l Knocker@fariszr.com.shell-extension.zip
   ```

   Should contain:
   - `extension.js`
   - `knockerService.js`
   - `knockerMonitor.js`
   - `knockerQuickSettings.js`
   - `prefs.js`
   - `metadata.json`
   - `stylesheet.css`
   - `schemas/` directory with compiled schema
   - `icons/` directory with icon files

4. **Test the package**:
   ```bash
   gnome-extensions install Knocker@fariszr.com.shell-extension.zip
   gnome-extensions enable Knocker@fariszr.com
   # Restart GNOME Shell and test
   ```

## Submission to extensions.gnome.org

### Create Account
1. Go to https://extensions.gnome.org/accounts/register/
2. Create an account (requires email verification)

### Submit Extension
1. Go to https://extensions.gnome.org/upload/
2. Fill in the form:
   - **Extension file**: Upload the `.shell-extension.zip`
   - **Shell versions**: Select 48 and 49
   - **Screenshot**: Upload a screenshot of the extension in action
   - **Description**: Copy from README.md
   - **URL**: https://github.com/FarisZR/knocker-gnome

3. Submit for review

### Review Process
- Extensions are reviewed by GNOME volunteers
- Review typically takes 1-4 weeks
- You'll receive email notifications about the review status
- Reviewers may request changes before approval

### After Approval
- Extension will be available on extensions.gnome.org
- Users can install it via the website or GNOME Extensions app
- You can upload new versions through the same process

## Updating the Extension

### For New Releases

1. **Update version**:
   - Increment version in `metadata.json`
   - Add entry to `CHANGELOG.md`

2. **Create Git tag**:
   ```bash
   git tag -a v1.1.0 -m "Release version 1.1.0"
   git push origin v1.1.0
   ```

3. **GitHub Actions will**:
   - Build the package automatically
   - Create a GitHub release
   - Attach the `.shell-extension.zip` file

4. **Submit to extensions.gnome.org**:
   - Log in to your account
   - Upload the new version
   - Submit for review

### For Bug Fixes

Same process as new releases, but increment the patch version (e.g., 1.0.0 → 1.0.1).

## Common Review Issues

### Issues to Avoid
- Unused imports
- Objects not destroyed in `disable()`
- Signals not disconnected
- Main loop sources not removed
- Excessive logging
- Including unnecessary files (build scripts, test files)
- Using deprecated modules

### How We've Addressed These
- ✅ CI/CD validates everything automatically
- ✅ ESLint catches unused imports
- ✅ Proper cleanup verified in code review
- ✅ Only necessary files included in package
- ✅ Modern JavaScript throughout

## Support

If you have questions about publishing:
- Check the [GNOME Shell Extensions Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
- Ask in the [GNOME Extensions Matrix room](https://matrix.to/#/#extensions:gnome.org)
- Open an issue on GitHub

## Resources

- [extensions.gnome.org](https://extensions.gnome.org)
- [GJS Guide](https://gjs.guide)
- [GNOME Shell Extensions Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
- [GNOME Human Interface Guidelines](https://developer.gnome.org/hig/)
