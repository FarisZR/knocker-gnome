/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {KnockerService} from './knockerService.js';
import {KnockerMonitor} from './knockerMonitor.js';
import {KnockerIndicator} from './knockerQuickSettings.js';

export default class KnockerExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._knockerService = null;
        this._knockerMonitor = null;
        this._initCancellable = null;
        this._autoStartTimeoutId = null;
    }

    enable() {
        this._initCancellable = new Gio.Cancellable();
        const initCancellable = this._initCancellable;
        this._autoStartTimeoutId = null;

        // Initialize services
        this._knockerService = new KnockerService();
        this._knockerMonitor = new KnockerMonitor();

        const checkAborted = () => {
            if (initCancellable.is_cancelled()) {
                if (this._initCancellable === initCancellable)
                    this._initCancellable = null;
                return 'cancelled';
            }

            if (this._initCancellable !== initCancellable)
                return 'stale';

            return null;
        };

        // Check if knocker-cli is installed (async)
        this._knockerService.checkKnockerInstalled().then(isInstalled => {
            if (checkAborted())
                return;

            if (!isInstalled) {
                this._showKnockerNotInstalledError();
                if (this._initCancellable === initCancellable)
                    this._initCancellable = null;
                return;
            }

            if (checkAborted())
                return;

            // Start monitoring journald logs
            this._knockerMonitor.start();

            if (checkAborted())
                return;

            // Create and add the indicator
            this._indicator = new KnockerIndicator(this, this._knockerService, this._knockerMonitor);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

            if (checkAborted())
                return;

            // Auto-start service if enabled in settings
            const settings = this.getSettings();
            if (settings.get_boolean('auto-start-service')) {
                // Wait a bit for the monitor to initialize
                this._autoStartTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                    const abortReason = checkAborted();
                    if (abortReason) {
                        if (abortReason === 'cancelled')
                            this._autoStartTimeoutId = null;
                        return GLib.SOURCE_REMOVE;
                    }
                    this._knockerService.isServiceActive().then(isActive => {
                        if (checkAborted())
                            return;
                        if (!isActive) {
                            this._knockerService.startService();
                        }
                    });
                    this._autoStartTimeoutId = null;
                    return GLib.SOURCE_REMOVE;
                });
            }

            if (this._initCancellable === initCancellable)
                this._initCancellable = null;
        }).catch(error => {
            if (checkAborted())
                return;
            console.error('Failed to initialize Knocker extension:', error);
            this._showKnockerNotInstalledError();
            if (this._initCancellable === initCancellable)
                this._initCancellable = null;
        });
    }

    disable() {
        // Cancel any pending initialization
        if (this._initCancellable) {
            this._initCancellable.cancel();
        }

        if (this._autoStartTimeoutId) {
            GLib.Source.remove(this._autoStartTimeoutId);
            this._autoStartTimeoutId = null;
        }

        // Clean up monitor
        if (this._knockerMonitor) {
            this._knockerMonitor.destroy();
            this._knockerMonitor = null;
        }

        // Clean up service
        if (this._knockerService) {
            this._knockerService.destroy();
            this._knockerService = null;
        }

        // Clean up indicator
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        
        // Clean up notification source
        if (this._notificationSource) {
            this._notificationSource.destroy();
            this._notificationSource = null;
        }
    }

    _showKnockerNotInstalledError() {
        // Create notification source
        if (!this._notificationSource) {
            this._notificationSource = new MessageTray.Source('Knocker', 'network-server-symbolic');
            this._notificationSource.connect('destroy', () => {
                this._notificationSource = null;
            });
            Main.messageTray.add(this._notificationSource);
        }
        
        const notification = new MessageTray.Notification(
            this._notificationSource,
            'Knocker Extension',
            'knocker-cli is not installed. Please install it from:\nhttps://github.com/FarisZR/Knocker-CLI'
        );
        notification.setUrgency(MessageTray.Urgency.HIGH);
        notification.setTransient(true);
        this._notificationSource.showNotification(notification);
    }
}
