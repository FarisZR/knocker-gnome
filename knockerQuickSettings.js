/* knockerQuickSettings.js
 *
 * Quick Settings toggle for Knocker service
 */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {KnockerEvent} from './knockerMonitor.js';

export const KnockerToggle = GObject.registerClass(
    class KnockerToggle extends QuickSettings.QuickMenuToggle {
        _init(extensionObject, knockerService, knockerMonitor) {
            super._init({
                title: 'Knocker',
                subtitle: 'Service Inactive',
                iconName: 'network-server-symbolic',
                toggleMode: true,
            });

            this._extensionObject = extensionObject;
            this._knockerService = knockerService;
            this._knockerMonitor = knockerMonitor;
            this._settings = extensionObject.getSettings();
            this._updateTimeoutId = null;
            this._updateStateTimeoutId = null;
            this._reenableButtonTimeoutId = null;
            this._monitorListeners = [];

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
            this.menu.setHeader('network-server-symbolic', 'Knocker', 'Port Knocking Service');

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

        _addMonitorListener(event, handler) {
            this._knockerMonitor.on(event, handler);
            this._monitorListeners.push([event, handler]);
        }

        _setupEventListeners() {
        // Monitor service state changes
            const serviceStateHandler = () => {
                this._updateServiceState();
            };
            this._addMonitorListener(KnockerEvent.SERVICE_STATE, serviceStateHandler);

            // Monitor status snapshots
            const statusSnapshotHandler = () => {
                this._updateUI();
            };
            this._addMonitorListener(KnockerEvent.STATUS_SNAPSHOT, statusSnapshotHandler);

            // Monitor whitelist updates
            const whitelistAppliedHandler = data => {
                this._updateUI();
                if (this._settings.get_boolean('notification-on-knock')) {
                    const expiryTime = this._formatTimestamp(data.expiresUnix);
                    this._showNotification('Knocker', `Whitelisted ${data.whitelistIp} until ${expiryTime}`);
                }
            };
            this._addMonitorListener(KnockerEvent.WHITELIST_APPLIED, whitelistAppliedHandler);

            const whitelistExpiredHandler = () => {
                this._updateUI();
            };
            this._addMonitorListener(KnockerEvent.WHITELIST_EXPIRED, whitelistExpiredHandler);

            // Monitor next knock updates
            const nextKnockUpdatedHandler = () => {
                this._updateUI();
            };
            this._addMonitorListener(KnockerEvent.NEXT_KNOCK_UPDATED, nextKnockUpdatedHandler);

            // Monitor errors
            const errorHandler = data => {
                if (this._settings.get_boolean('notification-on-error')) {
                    this._showNotification('Knocker Error', data.errorMsg || data.message, MessageTray.Urgency.HIGH);
                }
            };
            this._addMonitorListener(KnockerEvent.ERROR, errorHandler);

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
                const sourceInfo = state.cadenceSource ? ` (${this._formatCadenceSource(state.cadenceSource)})` : '';

                if (timeUntil > 0) {
                    const untilStr = this._formatDuration(timeUntil);
                    this._nextKnockLabel.label.text = `Next knock in ${untilStr}${sourceInfo}`;
                } else {
                    this._nextKnockLabel.label.text = `Next knock: ${nextTime}${sourceInfo}`;
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
                    this._showNotification('Knocker', 'Failed to start knocker.service', MessageTray.Urgency.HIGH);
                }
            } else {
                const success = await this._knockerService.stopService();
                if (!success) {
                // Revert toggle if stop failed
                    this.set({checked: true});
                    this._showNotification('Knocker', 'Failed to stop knocker.service', MessageTray.Urgency.HIGH);
                }
            }

            // Update state after a short delay
            // Remove any existing timeout before creating a new one
            if (this._updateStateTimeoutId) {
                GLib.source_remove(this._updateStateTimeoutId);
                this._updateStateTimeoutId = null;
            }

            this._updateStateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this._updateStateTimeoutId = null;
                this._updateServiceState();
                return GLib.SOURCE_REMOVE;
            });
        }

        async _triggerKnock() {
            this._knockButton.sensitive = false;

            try {
                const success = await this._knockerService.triggerKnock();
                if (success) {
                    this._showNotification('Knocker', 'Knock triggered successfully');
                } else {
                    this._showNotification('Knocker', 'Failed to trigger knock', MessageTray.Urgency.HIGH);
                }
            } finally {
            // Re-enable button after a short delay
            // Remove any existing timeout before creating a new one
                if (this._reenableButtonTimeoutId) {
                    GLib.source_remove(this._reenableButtonTimeoutId);
                    this._reenableButtonTimeoutId = null;
                }

                this._reenableButtonTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                    this._reenableButtonTimeoutId = null;
                    this._knockButton.sensitive = true;
                    return GLib.SOURCE_REMOVE;
                });
            }
        }

        _showNotification(title, message, urgency = MessageTray.Urgency.NORMAL) {
        // Create notification source if not exists
            if (!this._notificationSource) {
                this._notificationSource = new MessageTray.Source('Knocker', 'network-server-symbolic');
                this._notificationSource.connect('destroy', () => {
                    this._notificationSource = null;
                });
                Main.messageTray.add(this._notificationSource);
            }

            // Create and show notification
            const notification = new MessageTray.Notification(this._notificationSource, title, message);
            notification.setUrgency(urgency);
            notification.setTransient(true);
            this._notificationSource.showNotification(notification);
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

        _formatCadenceSource(cadenceSource) {
            if (!cadenceSource) {
                return '';
            }

            const sourceMap = {
                'ttl': 'based on TTL',
                'ttl_response': 'based on TTL response',
                'check_interval': 'based on interval',
            };

            return sourceMap[cadenceSource] || cadenceSource;
        }

        destroy() {
            if (this._updateTimeoutId) {
                GLib.source_remove(this._updateTimeoutId);
                this._updateTimeoutId = null;
            }

            if (this._updateStateTimeoutId) {
                GLib.source_remove(this._updateStateTimeoutId);
                this._updateStateTimeoutId = null;
            }

            if (this._reenableButtonTimeoutId) {
                GLib.source_remove(this._reenableButtonTimeoutId);
                this._reenableButtonTimeoutId = null;
            }

            for (const [event, handler] of this._monitorListeners) {
                this._knockerMonitor.off(event, handler);
            }
            this._monitorListeners = [];

            // Clean up notification source
            if (this._notificationSource) {
                this._notificationSource.destroy();
                this._notificationSource = null;
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
            this._knockerService = knockerService;
            this._knockerMonitor = knockerMonitor;

            // Create an icon for the indicator
            this._indicator = this._addIndicator();
            this._indicator.icon_name = 'network-server-symbolic';

            // Initially hide the indicator (will be shown when service is active)
            this._indicator.visible = false;

            // Monitor service state to update indicator visibility
            this._setupIndicatorVisibility();

            // Add the toggle
            this._toggle = new KnockerToggle(extensionObject, knockerService, knockerMonitor);
            this.quickSettingsItems.push(this._toggle);
        }

        _setupIndicatorVisibility() {
        // Update visibility based on service state AND settings
            const updateVisibility = async () => {
                const showIndicatorSetting = this._settings.get_boolean('show-indicator');
                const isServiceActive = await this._knockerService.isServiceActive();

                // Only show indicator if both setting is enabled AND service is active
                this._indicator.visible = showIndicatorSetting && isServiceActive;
            };

            // Initial update
            updateVisibility();

            // Watch for settings changes
            this._settingsChangedId = this._settings.connect('changed::show-indicator', () => {
                updateVisibility();
            });

            // Watch for service state changes
            this._serviceStateHandler = () => {
                updateVisibility();
            };
            this._knockerMonitor.on(KnockerEvent.SERVICE_STATE, this._serviceStateHandler);

            // Periodically check service state (in case we miss events)
            this._visibilityCheckId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
                updateVisibility();
                return GLib.SOURCE_CONTINUE;
            });
        }

        destroy() {
            if (this._settingsChangedId) {
                this._settings.disconnect(this._settingsChangedId);
                this._settingsChangedId = null;
            }

            if (this._serviceStateHandler) {
                this._knockerMonitor.off(KnockerEvent.SERVICE_STATE, this._serviceStateHandler);
                this._serviceStateHandler = null;
            }

            if (this._visibilityCheckId) {
                GLib.source_remove(this._visibilityCheckId);
                this._visibilityCheckId = null;
            }

            this.quickSettingsItems.forEach(item => item.destroy());
            super.destroy();
        }
    });
