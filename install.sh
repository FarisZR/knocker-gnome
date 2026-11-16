#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
"$repo_dir/build.sh"
uuid=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["uuid"])' "$repo_dir/metadata.json")
gnome-extensions install --force "$repo_dir/dist/$uuid.shell-extension.zip"
printf 'Installed %s. Log out and back in, then run:\n  gnome-extensions enable %s\n' "$uuid" "$uuid"
