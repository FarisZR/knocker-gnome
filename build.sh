#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec python3 "$repo_dir/scripts/package.py" "${1:-$repo_dir/dist}" "${BUILD_COMMIT:-}"
