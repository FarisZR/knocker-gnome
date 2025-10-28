/* knockerQuickSettings.js
 *
 * Quick Settings toggle for Knocker service
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {KnockerEvent} from './knockerMonitor.js';

export const KnockerToggle = GObject.registerClass(
class KnockerToggle extends QuickSettings.QuickMenuToggle {
    _init(extensionObject, knockerService, knockerMonitor) {
        super._init({
            title: 'Knocker',
            subtitle: 'Service Inactive',
            iconName: 'network-wireless-symbolic',
            toggleMode: true,
        });

        this._extensionObject = extensionObject;
        this._knockerService = knockerService;
        this._knockerMonitor = knockerMonitor;
        this._settings = extensionObject.getSettings();
        this._updateTimeoutId = null;

        // Set up menu
        this._setupMenu();

        // Set up event listeners
        this._setupEventListeners();

        // Initial state check
        this._updateServiceState();

        // Handle toggle changes
        this.connect('clicked', () => this._onToggleClicked());
    }

    _setupMenu() {
        // Add header
        this.menu.setHeader('network-wireless-symbolic', 'Knocker', 'Port Knocking Service');

        // IP and expiry section
        this._whitelistSection = new PopupMenu.PopupMenuSection();
        this._ipLabel = new PopupMenu.PopupMenuItem('No active whitelist', {
            reactive: false,
            can_focus: false,
        });
        this._whitelistSection.addMenuItem(this._ipLabel);
        this.menu.addMenuItem(this._whitelistSection);

        // Next knock section
        this._nextKnockLabel = new PopupMenu.PopupMenuItem('No scheduled knock', {
            reactive: false,
            can_focus: false,
        });
        this.menu.addMenuItem(this._nextKnockLabel);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Manual knock button
        const knockButton = this.menu.addAction('Knock Now', async () => {
            await this._triggerKnock();
        });
        this._knockButton = knockButton;

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings button
        const settingsItem = this.menu.addAction('Settings', () => {
            this._extensionObject.openPreferences();
        });
        settingsItem.visible = Main.sessionMode.allowSettings;
        this.menu._settingsActions[this._extensionObject.uuid] = settingsItem;
    }

    _setupEventListeners() {
        // Monitor service state changes
        this._knockerMonitor.on(KnockerEvent.SERVICE_STATE, (data) => {
            this._updateServiceState();
        });

        // Monitor status snapshots
        this._knockerMonitor.on(KnockerEvent.STATUS_SNAPSHOT, (data) => {
            this._updateUI();
        });

        // Monitor whitelist updates
        this._knockerMonitor.on(KnockerEvent.WHITELIST_APPLIED, (data) => {
            this._updateUI();
            if (this._settings.get_boolean('notification-on-knock')) {
                const expiryTime = this._formatTimestamp(data.expiresUnix);
                Main.notify('Knocker', `Whitelisted ${data.whitelistIp} until ${expiryTime}`);
            }
        });

        this._knockerMonitor.on(KnockerEvent.WHITELIST_EXPIRED, (data) => {
            this._updateUI();
        });

        // Monitor next knock updates
        this._knockerMonitor.on(KnockerEvent.NEXT_KNOCK_UPDATED, (data) => {
            this._updateUI();
        });

        // Monitor errors
        this._knockerMonitor.on(KnockerEvent.ERROR, (data) => {
            if (this._settings.get_boolean('notification-on-error')) {
                Main.notifyError('Knocker Error', data.errorMsg || data.message);
            }
        });

        // Set up periodic UI updates for countdown timers
        this._updateTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._updateUI();
            return GLib.SOURCE_CONTINUE;
        });
    }

    async _updateServiceState() {
        const isActive = await this._knockerService.isServiceActive();
        
        // Update toggle state without triggering the handler
        this.set({checked: isActive});

        // Update subtitle
        if (isActive) {
            this.subtitle = 'Service Active';
        } else {
            this.subtitle = 'Service Inactive';
        }

        // Update UI with current state
        this._updateUI();
    }

    _updateUI() {
        const state = this._knockerMonitor.getState();

        // Update whitelist info
        if (state.whitelistIp && state.expiresUnix) {
            const now = Math.floor(Date.now() / 1000);
            const remaining = state.expiresUnix - now;

            if (remaining > 0) {
                const expiryTime = this._formatTimestamp(state.expiresUnix);
                const remainingStr = this._formatDuration(remaining);
                this._ipLabel.label.text = `${state.whitelistIp} (expires in ${remainingStr})`;
            } else {
                this._ipLabel.label.text = `${state.whitelistIp} (expired)`;
            }
        } else {
            this._ipLabel.label.text = 'No active whitelist';
        }

        // Update next knock info
        if (state.nextAtUnix && state.nextAtUnix > 0) {
            const nextTime = this._formatTimestamp(state.nextAtUnix);
            const now = Math.floor(Date.now() / 1000);
            const timeUntil = state.nextAtUnix - now;
            
            if (timeUntil > 0) {
                const untilStr = this._formatDuration(timeUntil);
                this._nextKnockLabel.label.text = `Next knock in ${untilStr}`;
            } else {
                this._nextKnockLabel.label.text = `Next knock: ${nextTime}`;
            }
        } else {
            this._nextKnockLabel.label.text = 'No scheduled knock';
        }
    }

    async _onToggleClicked() {
        const shouldBeActive = this.checked;

        if (shouldBeActive) {
            const success = await this._knockerService.startService();
            if (!success) {
                // Revert toggle if start failed
                this.set({checked: false});
                Main.notifyError('Knocker', 'Failed to start knocker.service');
            }
        } else {
            const success = await this._knockerService.stopService();
            if (!success) {
                // Revert toggle if stop failed
                this.set({checked: true});
                Main.notifyError('Knocker', 'Failed to stop knocker.service');
            }
        }

        // Update state after a short delay
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._updateServiceState();
            return GLib.SOURCE_REMOVE;
        });
    }

    async _triggerKnock() {
        this._knockButton.sensitive = false;
        
        try {
            const success = await this._knockerService.triggerKnock();
            if (success) {
                Main.notify('Knocker', 'Knock triggered successfully');
            } else {
                Main.notifyError('Knocker', 'Failed to trigger knock');
            }
        } finally {
            // Re-enable button after a short delay
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                this._knockButton.sensitive = true;
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _formatTimestamp(unixTimestamp) {
        if (!unixTimestamp) {
            return 'N/A';
        }

        const date = new Date(unixTimestamp * 1000);
        return date.toLocaleString();
    }

    _formatDuration(seconds) {
        if (seconds < 60) {
            return `${seconds}s`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            return `${mins}m`;
        } else if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${mins}m`;
        } else {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            return `${days}d ${hours}h`;
        }
    }

    destroy() {
        if (this._updateTimeoutId) {
            GLib.Source.remove(this._updateTimeoutId);
            this._updateTimeoutId = null;
        }

        super.destroy();
    }
});

export const KnockerIndicator = GObject.registerClass(
class KnockerIndicator extends QuickSettings.SystemIndicator {
    _init(extensionObject, knockerService, knockerMonitor) {
        super._init();

        this._extensionObject = extensionObject;
        this._settings = extensionObject.getSettings();

        // Create an icon for the indicator
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'network-wireless-symbolic';

        // Bind indicator visibility to settings
        this._settings.bind('show-indicator',
            this._indicator, 'visible',
            0); // Gio.SettingsBindFlags.DEFAULT

        // Add the toggle
        this._toggle = new KnockerToggle(extensionObject, knockerService, knockerMonitor);
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});
