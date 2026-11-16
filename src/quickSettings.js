import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {KnockerEvent} from './knocker/protocol.js';

function formatTimestamp(timestamp) {
    return timestamp ? new Date(timestamp * 1000).toLocaleString() : 'N/A';
}

function formatDuration(seconds) {
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor(seconds % 86400 / 3600)}h`;
}

const cadenceLabels = {
    ttl: 'based on TTL',
    ttl_response: 'based on TTL response',
    check_interval: 'based on interval',
};

const KnockerToggle = GObject.registerClass(
    class KnockerToggle extends QuickSettings.QuickMenuToggle {
        _init(extension, settings, service, monitor, notifications) {
            super._init({
                title: 'Knocker', subtitle: 'Service Inactive',
                iconName: 'network-server-symbolic', toggleMode: true,
            });
            this._service = service;
            this._monitor = monitor;
            this._notifications = notifications;
            this._destroyed = false;
            this.menu.setHeader('network-server-symbolic', 'Knocker', 'Port Knocking Service');
            this._ipLabel = new PopupMenu.PopupMenuItem('No active whitelist', {reactive: false, can_focus: false});
            this.menu.addMenuItem(this._ipLabel);
            this._nextKnockLabel = new PopupMenu.PopupMenuItem('No scheduled knock', {reactive: false, can_focus: false});
            this.menu.addMenuItem(this._nextKnockLabel);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._knockButton = this.menu.addAction('Knock Now', () => this._triggerKnock());
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const settingsItem = this.menu.addAction('Settings', () => extension.openPreferences());
            const syncSettings = () => { settingsItem.visible = Main.sessionMode.allowSettings; };
            Main.sessionMode.connectObject('updated', syncSettings, this);
            syncSettings();

            this._unsubscribeService = service.subscribe(state => {
                this.checked = state.active;
                this.subtitle = state.active ? 'Service Active' : 'Service Inactive';
                this.reactive = !state.busy;
            });
            this._unsubscribeMonitor = monitor.subscribe((_state, event) => {
                this._updateStatus();
                if (!event || event.historical)
                    return;
                if (event.event === KnockerEvent.SERVICE_STATE)
                    service.refresh();
                if (event.event === KnockerEvent.WHITELIST_APPLIED && settings.get_boolean('notification-on-knock')) {
                    notifications.show('Knocker',
                        `Whitelisted ${event.whitelistIp} until ${formatTimestamp(event.expiresUnix)}`);
                }
                if (event.event === KnockerEvent.ERROR && settings.get_boolean('notification-on-error'))
                    notifications.show('Knocker Error', event.errorMsg || event.message, true);
            });
            this._countdownId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
                this._updateStatus();
                return GLib.SOURCE_CONTINUE;
            });
            this.connect('clicked', () => this._toggleService());
        }

        async _toggleService() {
            if (this._service.state.busy) {
                this.checked = this._service.state.active;
                return;
            }
            const active = this.checked;
            const success = await this._service.setActive(active);
            if (this._destroyed)
                return;
            if (!success)
                this._notifications.show('Knocker', `Failed to ${active ? 'start' : 'stop'} knocker.service`, true);
        }

        async _triggerKnock() {
            if (!this._knockButton.sensitive)
                return;
            this._knockButton.sensitive = false;
            const success = await this._service.triggerKnock();
            if (this._destroyed)
                return;
            this._knockButton.sensitive = true;
            this._notifications.show('Knocker', success ? 'Knock triggered successfully' : 'Failed to trigger knock', !success);
        }

        _updateStatus() {
            const state = this._monitor.state;
            const now = Math.floor(Date.now() / 1000);
            if (state.whitelistIp && state.expiresUnix) {
                const remaining = state.expiresUnix - now;
                this._ipLabel.label.text = remaining > 0
                    ? `${state.whitelistIp} (expires in ${formatDuration(remaining)})`
                    : `${state.whitelistIp} (expired)`;
            } else {
                this._ipLabel.label.text = 'No active whitelist';
            }
            if (state.nextAtUnix > 0) {
                const remaining = state.nextAtUnix - now;
                const cadence = state.cadenceSource;
                const source = cadence ? ` (${cadenceLabels[cadence] ?? cadence})` : '';
                this._nextKnockLabel.label.text = remaining > 0
                    ? `Next knock in ${formatDuration(remaining)}${source}`
                    : `Next knock: ${formatTimestamp(state.nextAtUnix)}${source}`;
            } else {
                this._nextKnockLabel.label.text = 'No scheduled knock';
            }
        }

        destroy() {
            this._destroyed = true;
            this._unsubscribeService();
            this._unsubscribeMonitor();
            GLib.Source.remove(this._countdownId);
            Main.sessionMode.disconnectObject(this);
            super.destroy();
        }
    });

export const KnockerIndicator = GObject.registerClass(
    class KnockerIndicator extends QuickSettings.SystemIndicator {
        _init(extension, settings, service, monitor, notifications) {
            super._init();
            const indicator = this._addIndicator();
            indicator.icon_name = 'network-server-symbolic';
            const syncVisibility = () => {
                indicator.visible = settings.get_boolean('show-indicator') && service.state.active;
            };
            this._unsubscribeService = service.subscribe(syncVisibility);
            settings.connectObject('changed::show-indicator', syncVisibility, this);
            this._settings = settings;
            this.quickSettingsItems.push(new KnockerToggle(extension, settings, service, monitor, notifications));
        }

        destroy() {
            this._unsubscribeService();
            this._settings.disconnectObject(this);
            this.quickSettingsItems.forEach(item => item.destroy());
            super.destroy();
        }
    });
