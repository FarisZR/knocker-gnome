import GLib from 'gi://GLib';
import {CommandRunner} from '../process.js';

function findKnocker() {
    const candidates = [
        GLib.find_program_in_path('knocker'),
        '/home/linuxbrew/.linuxbrew/bin/knocker',
        GLib.build_filenamev([GLib.get_home_dir(), '.linuxbrew', 'bin', 'knocker']),
    ];
    return candidates.find(path => path && GLib.file_test(path, GLib.FileTest.IS_EXECUTABLE));
}

export class KnockerService {
    constructor() {
        this._runner = new CommandRunner();
        this._executable = findKnocker();
        this._listeners = new Set();
        this._state = {active: false, busy: false};
        this._refresh = null;
        this._pollId = null;
    }

    get installed() {
        return Boolean(this._executable);
    }

    get state() {
        return {...this._state};
    }

    subscribe(listener) {
        this._listeners.add(listener);
        listener(this.state);
        return () => this._listeners.delete(listener);
    }

    _update(changes) {
        if (this._runner.cancellable.is_cancelled())
            return;
        Object.assign(this._state, changes);
        for (const listener of this._listeners)
            listener(this.state);
    }

    async start() {
        await this.refresh();
        if (this._runner.cancellable.is_cancelled())
            return;
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this.refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    refresh() {
        if (!this._refresh) {
            this._refresh = this._command(['systemctl', '--user', 'is-active', 'knocker.service'])
                .then(result => this._update({active: result.success && result.stdout.trim() === 'active'}))
                .finally(() => { this._refresh = null; });
        }
        return this._refresh;
    }

    async setActive(active) {
        if (this._state.busy)
            return false;
        this._update({busy: true});
        try {
            const result = await this._command([
                'systemctl', '--user', active ? 'start' : 'stop', 'knocker.service',
            ]);
            // A poll started before systemctl must not overwrite the confirmed result.
            await this._refresh;
            await this.refresh();
            return result.success;
        } finally {
            this._update({busy: false});
        }
    }

    async triggerKnock() {
        return (await this._command([this._executable, 'knock'])).success;
    }

    async _command(argv) {
        try {
            const result = await this._runner.run(argv);
            if (!result.success && argv[2] !== 'is-active')
                console.error(`Command failed: ${argv.join(' ')}: ${result.stderr.trim()}`);
            return result;
        } catch (error) {
            if (!this._runner.cancellable.is_cancelled())
                console.error('Knocker command failed:', error);
            return {success: false, stdout: '', stderr: ''};
        }
    }

    destroy() {
        this._listeners.clear();
        if (this._pollId)
            GLib.Source.remove(this._pollId);
        this._pollId = null;
        this._runner.destroy();
    }
}
