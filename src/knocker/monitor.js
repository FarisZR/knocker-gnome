import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {applyEvent, decodeEntry, initialState} from './protocol.js';

export class KnockerMonitor {
    constructor() {
        this._cancellable = new Gio.Cancellable();
        this._listeners = new Set();
        this._state = initialState();
        this._process = null;
        this._stream = null;
        this._retryId = null;
        this._cursor = null;
        this._startedAt = GLib.get_real_time() / 1000000;
    }

    get state() {
        return {...this._state};
    }

    subscribe(listener) {
        this._listeners.add(listener);
        listener(this.state, null);
        return () => this._listeners.delete(listener);
    }

    async start() {
        if (this._process || this._cancellable.is_cancelled())
            return;
        try {
            const args = ['journalctl', '--user', '-u', 'knocker.service', '-o', 'json', '--follow'];
            if (this._cursor)
                args.push('--after-cursor', this._cursor);
            else
                args.push('-n', '100');
            this._process = Gio.Subprocess.new(args, Gio.SubprocessFlags.STDOUT_PIPE);
            this._stream = new Gio.DataInputStream({
                base_stream: this._process.get_stdout_pipe(), close_base_stream: true,
            });
            while (!this._cancellable.is_cancelled()) {
                const line = await new Promise((resolve, reject) => {
                    this._stream.read_line_async(GLib.PRIORITY_DEFAULT, this._cancellable, (stream, result) => {
                        try {
                            resolve(stream.read_line_finish_utf8(result)[0]);
                        } catch (error) {
                            reject(error);
                        }
                    });
                });
                if (line === null || this._cancellable.is_cancelled())
                    break;
                this._consume(line);
            }
        } catch (error) {
            if (!this._cancellable.is_cancelled())
                console.error('Knocker journal stream failed:', error);
        } finally {
            this._closeStream();
            if (!this._cancellable.is_cancelled()) {
                // Journald can temporarily be unavailable; avoid a tight respawn loop.
                this._retryId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                    this._retryId = null;
                    this.start();
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    }

    _consume(line) {
        let entry;
        try {
            entry = JSON.parse(line);
            if (entry?.__CURSOR)
                this._cursor = entry.__CURSOR;
        } catch {
            return;
        }
        const data = decodeEntry(entry);
        if (!data)
            return;
        this._state = applyEvent(this._state, data);
        data.historical = !(data.timestamp >= this._startedAt);
        for (const listener of this._listeners) {
            try {
                listener(this.state, data);
            } catch (error) {
                console.error('Knocker journal listener failed:', error);
            }
        }
    }

    _closeStream() {
        if (this._stream)
            this._stream.close(null);
        this._stream = null;
        if (this._process)
            this._process.force_exit();
        this._process = null;
    }

    destroy() {
        this._listeners.clear();
        this._cancellable.cancel();
        if (this._retryId)
            GLib.Source.remove(this._retryId);
        this._retryId = null;
        if (this._process)
            this._process.force_exit();
        // The pending read owns closing its stream in finally.
    }
}
