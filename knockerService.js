/* knockerService.js
 *
 * Service management for Knocker systemd service and CLI commands
 */

import Gio from 'gi://Gio';

export class KnockerService {
    constructor() {
        this._cancellable = new Gio.Cancellable();
    }

    /**
     * Check if knocker-cli is installed
     * @returns {Promise<boolean>}
     */
    async checkKnockerInstalled() {
        try {
            const [success, stdout] = await this._execCommand(['which', 'knocker']);
            return success && stdout.trim().length > 0;
        } catch (_err) {
            return false;
        }
    }

    /**
     * Start the knocker.service (user mode)
     * @returns {Promise<boolean>}
     */
    async startService() {
        try {
            const [success] = await this._execCommand(['systemctl', '--user', 'start', 'knocker.service']);
            return success;
        } catch (e) {
            console.error('Failed to start knocker.service:', e);
            return false;
        }
    }

    /**
     * Stop the knocker.service (user mode)
     * @returns {Promise<boolean>}
     */
    async stopService() {
        try {
            const [success] = await this._execCommand(['systemctl', '--user', 'stop', 'knocker.service']);
            return success;
        } catch (e) {
            console.error('Failed to stop knocker.service:', e);
            return false;
        }
    }

    /**
     * Check if knocker.service is active
     * @returns {Promise<boolean>}
     */
    async isServiceActive() {
        try {
            const [success, stdout] = await this._execCommand(['systemctl', '--user', 'is-active', 'knocker.service']);
            return success && stdout.trim() === 'active';
        } catch (_err) {
            return false;
        }
    }

    /**
     * Trigger a manual knock
     * @returns {Promise<boolean>}
     */
    async triggerKnock() {
        try {
            const [success] = await this._execCommand(['knocker', 'knock']);
            return success;
        } catch (e) {
            console.error('Failed to trigger knock:', e);
            return false;
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
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
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
        this._cancellable.cancel();
    }
}
