#!/usr/bin/env bash
set -euo pipefail
: "${GH_REPO:?GH_REPO is required}"
: "${BUILD_COMMIT:?BUILD_COMMIT is required}"
: "${RELEASE_TAG:?RELEASE_TAG is required}"
cd -- "${1:-dist}"

is_current() {
    if [ "$RELEASE_TAG" != "build-$BUILD_COMMIT" ]; then
        return 0
    fi
    [ "$(gh api "repos/$GH_REPO/commits/main" --jq .sha)" = "$BUILD_COMMIT" ]
}

if ! is_current; then
    echo 'A newer main commit exists; skipping publication.'
    exit 0
fi
sha256sum --check SHA256SUMS
if ! gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
    gh release create "$RELEASE_TAG" --target "$BUILD_COMMIT" --draft \
        --title "Knocker $RELEASE_TAG" \
        --notes "GNOME Shell 48–51. Install: brew install --cask fariszr/tap/knocker-gnome. Built from $BUILD_COMMIT."
fi
assets_dir=$(mktemp -d)
trap 'rm -rf "$assets_dir"' EXIT
gh release view "$RELEASE_TAG" --json assets --jq '.assets[].name' > "$assets_dir/existing"
for asset in ./*.zip ./*.tar.gz SHA256SUMS; do
    if ! grep -Fxq "${asset#./}" "$assets_dir/existing"; then
        gh release upload "$RELEASE_TAG" "$asset"
    fi
done
gh release download "$RELEASE_TAG" --dir "$assets_dir/download"
cmp SHA256SUMS "$assets_dir/download/SHA256SUMS"
(cd "$assets_dir/download" && sha256sum --check SHA256SUMS)
gh release edit "$RELEASE_TAG" --draft=false --latest=false
if ! is_current; then
    echo 'A newer main commit arrived during upload; leaving this release non-latest.'
    exit 0
fi
gh release edit "$RELEASE_TAG" --latest
echo 'published=true' >> "${GITHUB_OUTPUT:-/dev/null}"
