#!/usr/bin/env bash
set -euo pipefail
: "${GH_REPO:?GH_REPO is required}"
: "${BUILD_COMMIT:?BUILD_COMMIT is required}"
: "${RELEASE_TAG:?RELEASE_TAG is required}"
cd -- "${1:-dist}"

rolling=false
if [[ "$RELEASE_TAG" == "build-$BUILD_COMMIT" ]]; then
    rolling=true
elif [[ ! "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo 'Stable releases require a vMAJOR.MINOR.PATCH tag.' >&2
    exit 1
fi

is_current() {
    [ "$(gh api "repos/$GH_REPO/commits/main" --jq .sha)" = "$BUILD_COMMIT" ]
}

if $rolling && ! is_current; then
    echo 'A newer main commit exists; skipping publication.'
    exit 0
fi
sha256sum --check SHA256SUMS
assets_dir=$(mktemp -d)
trap 'rm -rf "$assets_dir"' EXIT

verify_release() {
    local tag=$1 directory=$2
    gh release download "$tag" --dir "$directory"
    cmp SHA256SUMS "$directory/SHA256SUMS"
    (cd "$directory" && sha256sum --check SHA256SUMS)
}

if ! gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
    gh release create "$RELEASE_TAG" --target "$BUILD_COMMIT" --draft \
        --prerelease="$rolling" --latest=false \
        --title "Knocker $RELEASE_TAG" \
        --notes "GNOME Shell 48–51. Built from $BUILD_COMMIT."
fi
gh release view "$RELEASE_TAG" --json assets --jq '.assets[].name' > "$assets_dir/existing"
for asset in ./*.zip ./*.tar.gz SHA256SUMS; do
    if ! grep -Fxq "${asset#./}" "$assets_dir/existing"; then
        gh release upload "$RELEASE_TAG" "$asset"
    fi
done
verify_release "$RELEASE_TAG" "$assets_dir/immutable"
gh release edit "$RELEASE_TAG" --draft=false --prerelease="$rolling" --latest=false

if $rolling; then
    if ! is_current; then
        echo 'A newer main commit arrived during upload; leaving @main unchanged.'
        exit 0
    fi
    if gh release view '@main' >/dev/null 2>&1; then
        gh release edit '@main' --draft=true --prerelease --latest=false
    else
        gh release create '@main' --target "$BUILD_COMMIT" --draft --prerelease --latest=false
    fi
    if gh api "repos/$GH_REPO/git/ref/tags/@main" >/dev/null 2>&1; then
        gh api --method PATCH "repos/$GH_REPO/git/refs/tags/@main" \
            -f sha="$BUILD_COMMIT" -F force=true >/dev/null
    else
        gh api --method POST "repos/$GH_REPO/git/refs" \
            -f ref='refs/tags/@main' -f sha="$BUILD_COMMIT" >/dev/null
    fi
    gh release upload '@main' ./*.zip ./*.tar.gz SHA256SUMS --clobber
    verify_release '@main' "$assets_dir/main"
    gh release edit '@main' --target "$BUILD_COMMIT" --draft=false --prerelease --latest=false \
        --title 'Knocker @main' --notes "Development build of main at $BUILD_COMMIT. Install: brew install --cask fariszr/tap/knocker-gnome@main"
else
    gh release edit "$RELEASE_TAG" --latest
fi
echo 'published=true' >> "${GITHUB_OUTPUT:-/dev/null}"
