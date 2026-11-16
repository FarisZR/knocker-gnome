# Repository guidance

Read [architecture](docs/ARCHITECTURE.md) and [development](docs/DEVELOPMENT.md).
The authoritative commands are `npm ci`, `npm run lint`, `npm test`,
`python3 scripts/test-shell.py`, and `./build.sh`. The Shell test isolates all
settings and service commands from the host desktop.

Keep the UUID and existing GSettings keys stable. Preserve the user's Knocker
service and configuration. Own and cancel asynchronous work on disable. Add runtime
modules under src/; packaging includes that tree automatically. Keep settings/UI
contracts independent of journal transport. Never read or expose CLI credentials.

Record structural changes and verification in [the decision log](docs/DECISIONS.md).
