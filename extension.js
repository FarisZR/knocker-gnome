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

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {KnockerService} from './knockerService.js';
import {KnockerMonitor} from './knockerMonitor.js';
import {KnockerIndicator} from './knockerQuickSettings.js';

export default class KnockerExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._knockerService = null;
        this._knockerMonitor = null;
    }

    enable() {
        // Initialize services
        this._knockerService = new KnockerService();
        this._knockerMonitor = new KnockerMonitor();

        // Check if knocker-cli is installed (async)
        this._knockerService.checkKnockerInstalled().then(isInstalled => {
            if (!isInstalled) {
                this._showKnockerNotInstalledError();
                return;
            }

            // Start monitoring journald logs
            this._knockerMonitor.start();

            // Create and add the indicator
            this._indicator = new KnockerIndicator(this, this._knockerService, this._knockerMonitor);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

            // Auto-start service if enabled in settings
            const settings = this.getSettings();
            if (settings.get_boolean('auto-start-service')) {
                // Wait a bit for the monitor to initialize
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                    this._knockerService.isServiceActive().then(isActive => {
                        if (!isActive) {
                            this._knockerService.startService();
                        }
                    });
                    return GLib.SOURCE_REMOVE;
                });
            }
        }).catch(error => {
            console.error('Failed to initialize Knocker extension:', error);
            this._showKnockerNotInstalledError();
        });
    }

    disable() {
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
    }

    _showKnockerNotInstalledError() {
        Main.notifyError(
            'Knocker Extension',
            'knocker-cli is not installed. Please install it from:\nhttps://github.com/FarisZR/Knocker-CLI'
        );
    }
}
