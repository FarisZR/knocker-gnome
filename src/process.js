import Gio from 'gi://Gio';

export class CommandRunner {
    constructor() {
        this.cancellable = new Gio.Cancellable();
        this._processes = new Set();
    }

    async run(argv) {
        if (this.cancellable.is_cancelled())
            throw new Error('Command runner has been destroyed');
        const process = Gio.Subprocess.new(argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        this._processes.add(process);
        try {
            return await new Promise((resolve, reject) => {
                process.communicate_utf8_async(null, this.cancellable, (proc, result) => {
                    try {
                        const [, stdout, stderr] = proc.communicate_utf8_finish(result);
                        resolve({success: proc.get_successful(), stdout, stderr});
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } finally {
            this._processes.delete(process);
        }
    }

    destroy() {
        this.cancellable.cancel();
        for (const process of this._processes)
            process.force_exit();
        this._processes.clear();
    }
}
