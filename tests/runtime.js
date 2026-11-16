import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import System from 'system';
import {CommandRunner} from '../src/process.js';
import {KnockerService} from '../src/knocker/service.js';
import {KnockerMonitor} from '../src/knocker/monitor.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

function delay(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

const temporary = GLib.dir_make_tmp('knocker-runtime-XXXXXX');
function write(name, text, executable = false) {
    const path = `${temporary}/${name}`;
    GLib.file_set_contents(path, text);
    if (executable)
        Gio.File.new_for_path(path).set_attribute_uint32('unix::mode', 0o755, Gio.FileQueryInfoFlags.NONE, null);
}

async function main() {
    const runner = new CommandRunner();
    const result = await runner.run(['/bin/sh', '-c', 'printf output; printf diagnostic >&2; exit 7']);
    assert(!result.success && result.stdout === 'output' && result.stderr === 'diagnostic', 'Command result lost output or failure');
    const pending = runner.run(['/bin/sleep', '60']).then(() => false, () => true);
    runner.destroy();
    assert(await pending, 'Destroy must cancel pending commands');

    write('systemctl', `#!/bin/sh
case "$2" in
is-active) if [ -f "$KNOCKER_TEST_DIR/active" ]; then echo active; else echo inactive; exit 3; fi ;;
start) if [ -f "$KNOCKER_TEST_DIR/fail" ]; then exit 1; fi; touch "$KNOCKER_TEST_DIR/active" ;;
stop) rm -f "$KNOCKER_TEST_DIR/active" ;;
esac
`, true);
    write('knocker', '#!/bin/sh\nprintf knock > "$KNOCKER_TEST_DIR/knocked"\n', true);
    const oldPath = GLib.getenv('PATH');
    GLib.setenv('PATH', `${temporary}:${oldPath}`, true);
    GLib.setenv('KNOCKER_TEST_DIR', temporary, true);
    const service = new KnockerService();
    const states = [];
    const unsubscribe = service.subscribe(state => states.push(state));
    assert(service.installed, 'CLI on PATH was not found');
    await service.start();
    assert(!service.state.active, 'Stopped unit must be inactive');
    assert(await service.setActive(true), 'Start failed');
    assert(service.state.active && !service.state.busy, 'Start must publish confirmed active state without a delay');
    assert(states.some(state => state.busy), 'Pending service action was never published');
    await service.setActive(false);
    assert(!service.state.active, 'Stop must publish inactive state');
    write('fail', '');
    assert(!await service.setActive(true) && !service.state.active, 'Failed start must restore confirmed inactive state');
    assert(await service.triggerKnock(), 'Manual knock failed');
    assert(GLib.file_test(`${temporary}/knocked`, GLib.FileTest.EXISTS), 'Manual knock did not invoke the discovered executable');
    unsubscribe();
    const pendingRefresh = service.refresh();
    const count = states.length;
    service.destroy();
    await pendingRefresh;
    assert(states.length === count, 'Service notified after destruction');

    const now = GLib.get_real_time();
    const record = (event, timestamp, cursor, fields) => JSON.stringify({
        KNOCKER_EVENT: event, KNOCKER_SCHEMA_VERSION: '1',
        __REALTIME_TIMESTAMP: String(timestamp), __CURSOR: cursor, ...fields,
    });
    write('journal', [
        'malformed input',
        record('StatusSnapshot', now - 60000000, 'old', {KNOCKER_WHITELIST_IP: '192.0.2.1', KNOCKER_EXPIRES_UNIX: '200'}),
        record('WhitelistApplied', now + 1000000, 'new', {KNOCKER_WHITELIST_IP: '192.0.2.2', KNOCKER_EXPIRES_UNIX: '300'}),
    ].join('\n') + '\n');
    write('journalctl', '#!/bin/sh\necho $$ > "$KNOCKER_TEST_DIR/journal-pid"\ncat "$KNOCKER_TEST_DIR/journal"\nexec /bin/sleep 60\n', true);
    const monitor = new KnockerMonitor();
    const events = [];
    monitor.subscribe((_state, event) => { if (event) events.push(event); });
    const following = monitor.start();
    for (let attempt = 0; attempt < 100 && events.length < 2; attempt++)
        await delay(10);
    assert(events.length === 2, 'Journal history and live events were not delivered');
    assert(events[0].historical && !events[1].historical, 'Historical entries must not produce live notifications');
    assert(monitor.state.whitelistIp === '192.0.2.2', 'Latest journal state did not win');
    const pid = new TextDecoder().decode(GLib.file_get_contents(`${temporary}/journal-pid`)[1]).trim();
    monitor.destroy();
    await following;
    const checker = new CommandRunner();
    assert(!(await checker.run(['/bin/kill', '-0', pid])).success, 'Journal process survived destruction');
    checker.destroy();
    GLib.setenv('PATH', oldPath, true);
    print('GJS runtime checks passed: service commands, cancellation, journal replay and cleanup');
}

try {
    await main();
} catch (error) {
    console.error(error);
    System.exit(1);
} finally {
    const cleanup = new CommandRunner();
    await cleanup.run(['/bin/rm', '-rf', temporary]);
    cleanup.destroy();
}
