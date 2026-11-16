import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

export class Notifications {
    constructor() {
        this._source = null;
        this._destroyed = false;
    }

    show(title, body, error = false) {
        if (this._destroyed)
            return;
        if (!this._source) {
            this._source = new MessageTray.Source({title: 'Knocker', iconName: 'network-server-symbolic'});
            this._source.connect('destroy', () => { this._source = null; });
            Main.messageTray.add(this._source);
        }
        this._source.addNotification(new MessageTray.Notification({
            source: this._source, title, body,
            urgency: error ? MessageTray.Urgency.HIGH : MessageTray.Urgency.NORMAL,
            isTransient: true,
        }));
    }

    destroy() {
        this._destroyed = true;
        this._source?.destroy();
        this._source = null;
    }
}
