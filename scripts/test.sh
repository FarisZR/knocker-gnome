#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
while IFS= read -r -d '' file; do
    node --check "$file"
done < <(find extension.js prefs.js src tests -name '*.js' -print0)
glib-compile-schemas --strict --dry-run schemas
node --test tests/*.test.js
gjs -m tests/runtime.js
python3 -m unittest discover -s tests -p 'test_*.py' -v
