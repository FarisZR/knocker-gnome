# Release automation

`.github/workflows/build.yml` tests pull requests, pushes to `main`, version tags
(`v*`), published releases and manual runs. One build command creates both bundles,
and real headless GNOME 48–51 integration checks must pass before publication.
Pull requests never publish.

A successful current-main commit publishes an immutable `build-<full SHA>`
prerelease, then moves the `@main` tag and prerelease to that commit. Version tags
(`vMAJOR.MINOR.PATCH`) publish stable releases and become GitHub's latest release.
Main builds are always prereleases and never change that stable default. Both contain:

- `Knocker@fariszr.com.shell-extension.zip` for GNOME review/manual installation
- `knocker-gnome.tar.gz` for Homebrew, containing the UUID directory and compiled schema
- `SHA256SUMS`

The build commit is embedded in metadata. Published bytes are checked after upload,
immutable assets are never replaced, and reruns can complete a partial draft.
The moving `@main` release is drafted while its tag/assets are refreshed, then
published as a prerelease after verification. Its assets are replaced intentionally;
the tap pins the corresponding immutable build URL, so upgrades cannot encounter
a checksum race against those moving downloads. Failed builds
never reach the tap. Delayed main builds check the current head before and after
upload so they cannot move `@main` back to an older build. Workflows serialize publication.

After publication, the notification job dispatches
`FarisZR/homebrew-tap/.github/workflows/sync.yml`. For immediate notification,
configure repository secret `TAP_GITHUB_TOKEN` with a fine-grained token restricted
to that tap repository and Actions write permission. No token is committed or
included in a bundle. Without this optional secret, the tap's existing six-hour
scheduled sync still picks up the latest complete release. It can also be run
manually with `gh workflow run sync.yml --repo FarisZR/homebrew-tap`.

The tap validates the expected asset URL, uploaded state and SHA-256 before rendering
two mutually exclusive packages. `Casks/knocker-gnome.rb` reads the latest stable
release and accepts version tags only. `Casks/knocker-gnome@main.rb` resolves the
`@main` Git ref to its immutable `build-<SHA>` prerelease and uses that commit hash
as Homebrew's version. Stable releases never move the development channel, and
main commits never replace the stable package. The tap CI verifies installation,
reinstallation and removal on Linux x86_64 and ARM64. End users update with
`brew update && brew upgrade --cask knocker-gnome` and log out/in afterward.

To publish a version, update CHANGELOG.md and metadata's positive integer version
when preparing an extensions.gnome.org submission, then push an annotated tag such
as `v1.1.0`. For GNOME review, upload the ZIP from `dist/`; never upload the Homebrew
tarball. Existing GSettings keys and the extension UUID must remain stable.
