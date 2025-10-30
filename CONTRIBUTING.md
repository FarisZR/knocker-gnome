# Contributing to Knocker GNOME Extension

Thank you for your interest in contributing to the Knocker GNOME Extension!

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/FarisZR/knocker-gnome.git
   cd knocker-gnome
   ```

2. **Install development dependencies**
   ```bash
   npm install
   ```

3. **Install the extension for testing**
   ```bash
   ./install.sh
   gnome-extensions enable Knocker@fariszr.com
   ```

4. **Restart GNOME Shell**
   - X11: Press `Alt+F2`, type `r`, press Enter
   - Wayland: Log out and log back in

## Code Style

This extension follows the [GNOME Shell Extension Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).

### Key Guidelines

- Use ES6+ modern JavaScript features
- Use `async`/`await` for asynchronous operations
- All objects created in `enable()` must be destroyed in `disable()`
- All signal connections must be disconnected in `disable()`
- All main loop sources must be removed in `disable()`
- No GTK imports in `extension.js` (only in `prefs.js`)
- No Clutter/Meta/St imports in `prefs.js` (only in `extension.js`)

### Linting

Run ESLint to check your code:

```bash
npm run lint
```

Fix automatically fixable issues:

```bash
npm run lint:fix
```

### Testing

1. **Syntax check**
   ```bash
   npm test
   ```

2. **Manual testing**
   Follow the test cases in `docs/TESTING.md`

## Making Changes

1. Create a new branch for your changes
2. Make your changes following the code style guidelines
3. Test your changes thoroughly
4. Run the linter and fix any issues
5. Commit with clear, descriptive messages
6. Open a pull request

## Pull Request Guidelines

- Include a clear description of the changes
- Reference any related issues
- Ensure all CI checks pass
- Follow the code review feedback

## Building

Build a distributable package:

```bash
npm run build
# or
./build.sh
```

This creates a `.shell-extension.zip` file suitable for installation or submission to extensions.gnome.org.

## Questions?

If you have questions, feel free to:
- Open an issue on GitHub
- Ask in the GNOME Extensions Matrix room: [#extensions:gnome.org](https://matrix.to/#/#extensions:gnome.org)

## License

By contributing, you agree that your contributions will be licensed under the GPL-2.0-or-later license.
