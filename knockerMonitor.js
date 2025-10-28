/* knockerMonitor.js
 *
 * Monitor journald logs for Knocker events
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const KNOCKER_SCHEMA_VERSION = '1';

export const KnockerEvent = {
    SERVICE_STATE: 'ServiceState',
    STATUS_SNAPSHOT: 'StatusSnapshot',
    WHITELIST_APPLIED: 'WhitelistApplied',
    WHITELIST_EXPIRED: 'WhitelistExpired',
    NEXT_KNOCK_UPDATED: 'NextKnockUpdated',
    KNOCK_TRIGGERED: 'KnockTriggered',
    ERROR: 'Error',
};

export class KnockerMonitor {
    constructor() {
        this._cancellable = new Gio.Cancellable();
        this._currentState = {
            whitelistIp: null,
            expiresUnix: null,
            ttlSec: null,
            nextAtUnix: null,
            serviceState: 'stopped',
            version: null,
        };
        this._eventCallbacks = new Map();
        this._running = false;
    }

    /**
     * Register a callback for a specific event type
     * @param {string} eventType - One of KnockerEvent values
     * @param {Function} callback - Callback function(eventData)
     */
    on(eventType, callback) {
        if (!this._eventCallbacks.has(eventType)) {
            this._eventCallbacks.set(eventType, []);
        }
        this._eventCallbacks.get(eventType).push(callback);
    }

    /**
     * Remove a callback for an event type
     */
    off(eventType, callback) {
        if (this._eventCallbacks.has(eventType)) {
            const callbacks = this._eventCallbacks.get(eventType);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Get current state snapshot
     */
    getState() {
        return {...this._currentState};
    }

    /**
     * Start monitoring journald logs
     */
    async start() {
        if (this._running) {
            return;
        }
        this._running = true;

        // Get initial state snapshot
        await this._fetchInitialState();

        // Start monitoring for new entries
        this._startFollowing();
    }

    /**
     * Stop monitoring
     */
    stop() {
        this._running = false;
        this._cancellable.cancel();
        this._cancellable = new Gio.Cancellable();
    }

    /**
     * Fetch the most recent state from journald
     * @private
     */
    async _fetchInitialState() {
        try {
            // Get last StatusSnapshot event
            const [success, stdout] = await this._execCommand([
                'journalctl',
                '--user',
                '-u', 'knocker.service',
                '-o', 'json',
                '-n', '100',
                '--reverse'
            ]);

            if (!success) {
                return;
            }

            const lines = stdout.trim().split('\n').filter(line => line.length > 0);
            
            // Process entries to build current state
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    this._processEntry(entry);
                } catch (e) {
                    // Skip invalid JSON lines
                }
            }
        } catch (e) {
            console.error('Failed to fetch initial state:', e);
        }
    }

    /**
     * Start following journald logs
     * @private
     */
    _startFollowing() {
        // Use journalctl -f to follow logs
        this._followProcess();
    }

    /**
     * Follow journald logs continuously
     * @private
     */
    async _followProcess() {
        if (!this._running) {
            return;
        }

        try {
            const proc = Gio.Subprocess.new(
                [
                    'journalctl',
                    '--user',
                    '-u', 'knocker.service',
                    '-o', 'json',
                    '-f'
                ],
                Gio.SubprocessFlags.STDOUT_PIPE
            );

            const stdout = proc.get_stdout_pipe();
            const dataStream = new Gio.DataInputStream({
                base_stream: stdout,
                close_base_stream: true,
            });

            this._readLines(dataStream);
        } catch (e) {
            console.error('Failed to start following journald:', e);
            
            // Retry after a delay if still running
            if (this._running) {
                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
                    if (this._running) {
                        this._followProcess();
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    }

    /**
     * Read lines from the data stream
     * @private
     */
    async _readLines(dataStream) {
        while (this._running) {
            try {
                const [line] = await new Promise((resolve, reject) => {
                    dataStream.read_line_async(
                        GLib.PRIORITY_DEFAULT,
                        this._cancellable,
                        (stream, res) => {
                            try {
                                const result = stream.read_line_finish_utf8(res);
                                resolve(result);
                            } catch (e) {
                                reject(e);
                            }
                        }
                    );
                });

                if (line === null) {
                    break; // End of stream
                }

                if (line.length > 0) {
                    try {
                        const entry = JSON.parse(line);
                        this._processEntry(entry);
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            } catch (e) {
                if (!this._running) {
                    break;
                }
                console.error('Error reading journald line:', e);
                break;
            }
        }

        // Restart if still running
        if (this._running) {
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                if (this._running) {
                    this._followProcess();
                }
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    /**
     * Process a journald entry
     * @private
     */
    _processEntry(entry) {
        const event = entry.KNOCKER_EVENT;
        if (!event) {
            return;
        }

        const schemaVersion = entry.KNOCKER_SCHEMA_VERSION;
        if (schemaVersion !== KNOCKER_SCHEMA_VERSION) {
            console.warn('Unknown schema version:', schemaVersion);
        }

        const eventData = this._extractEventData(entry);

        // Update internal state based on event
        switch (event) {
            case KnockerEvent.SERVICE_STATE:
                this._currentState.serviceState = eventData.serviceState || 'unknown';
                this._currentState.version = eventData.version || null;
                break;

            case KnockerEvent.STATUS_SNAPSHOT:
                this._currentState.whitelistIp = eventData.whitelistIp || null;
                this._currentState.expiresUnix = eventData.expiresUnix || null;
                this._currentState.ttlSec = eventData.ttlSec || null;
                this._currentState.nextAtUnix = eventData.nextAtUnix || null;
                break;

            case KnockerEvent.WHITELIST_APPLIED:
                this._currentState.whitelistIp = eventData.whitelistIp || null;
                this._currentState.expiresUnix = eventData.expiresUnix || null;
                this._currentState.ttlSec = eventData.ttlSec || null;
                break;

            case KnockerEvent.WHITELIST_EXPIRED:
                this._currentState.whitelistIp = null;
                this._currentState.expiresUnix = null;
                this._currentState.ttlSec = null;
                break;

            case KnockerEvent.NEXT_KNOCK_UPDATED:
                this._currentState.nextAtUnix = eventData.nextAtUnix || null;
                break;
        }

        // Notify listeners
        this._emit(event, eventData);
    }

    /**
     * Extract event-specific data from journald entry
     * @private
     */
    _extractEventData(entry) {
        const data = {
            event: entry.KNOCKER_EVENT,
            message: entry.MESSAGE || '',
        };

        // Service State fields
        if (entry.KNOCKER_SERVICE_STATE) {
            data.serviceState = entry.KNOCKER_SERVICE_STATE;
        }
        if (entry.KNOCKER_VERSION) {
            data.version = entry.KNOCKER_VERSION;
        }

        // Whitelist fields
        if (entry.KNOCKER_WHITELIST_IP) {
            data.whitelistIp = entry.KNOCKER_WHITELIST_IP;
        }
        if (entry.KNOCKER_EXPIRES_UNIX) {
            data.expiresUnix = parseInt(entry.KNOCKER_EXPIRES_UNIX, 10);
        }
        if (entry.KNOCKER_TTL_SEC) {
            data.ttlSec = parseInt(entry.KNOCKER_TTL_SEC, 10);
        }

        // Next knock fields
        if (entry.KNOCKER_NEXT_AT_UNIX) {
            data.nextAtUnix = parseInt(entry.KNOCKER_NEXT_AT_UNIX, 10);
        }

        // Knock trigger fields
        if (entry.KNOCKER_TRIGGER_SOURCE) {
            data.triggerSource = entry.KNOCKER_TRIGGER_SOURCE;
        }
        if (entry.KNOCKER_RESULT) {
            data.result = entry.KNOCKER_RESULT;
        }

        // Error fields
        if (entry.KNOCKER_ERROR_CODE) {
            data.errorCode = entry.KNOCKER_ERROR_CODE;
        }
        if (entry.KNOCKER_ERROR_MSG) {
            data.errorMsg = entry.KNOCKER_ERROR_MSG;
        }
        if (entry.KNOCKER_CONTEXT) {
            data.context = entry.KNOCKER_CONTEXT;
        }

        // Profile and ports (reserved for future)
        if (entry.KNOCKER_PROFILE) {
            data.profile = entry.KNOCKER_PROFILE;
        }
        if (entry.KNOCKER_PORTS) {
            data.ports = entry.KNOCKER_PORTS;
        }

        return data;
    }

    /**
     * Emit event to registered callbacks
     * @private
     */
    _emit(eventType, data) {
        if (this._eventCallbacks.has(eventType)) {
            const callbacks = this._eventCallbacks.get(eventType);
            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (e) {
                    console.error('Error in event callback:', e);
                }
            }
        }
    }

    /**
     * Execute a command and return result
     * @private
     */
    _execCommand(argv) {
        return new Promise((resolve, reject) => {
            try {
                const proc = Gio.Subprocess.new(
                    argv,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );

                proc.communicate_utf8_async(null, this._cancellable, (proc, res) => {
                    try {
                        const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                        const success = proc.get_successful();
                        resolve([success, stdout || '', stderr || '']);
                    } catch (e) {
                        reject(e);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    destroy() {
        this.stop();
    }
}
