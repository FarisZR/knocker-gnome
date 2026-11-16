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

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {KnockerService} from './src/knocker/service.js';
import {KnockerMonitor} from './src/knocker/monitor.js';
import {KnockerIndicator} from './src/quickSettings.js';
import {Notifications} from './src/notifications.js';

export default class KnockerExtension extends Extension {
    enable() {
        const service = new KnockerService();
        const notifications = new Notifications();
        const session = {service, notifications, monitor: null, indicator: null};
        this._session = session;

        if (!service.installed) {
            notifications.show('Knocker Extension',
                'knocker-cli is not installed. Run: brew install --cask fariszr/tap/knocker-cli', true);
            return;
        }

        const settings = this.getSettings();
        session.monitor = new KnockerMonitor();
        session.indicator = new KnockerIndicator(this, settings, service, session.monitor, notifications);
        Main.panel.statusArea.quickSettings.addExternalIndicator(session.indicator);
        session.monitor.start();
        service.start().then(async () => {
            if (this._session !== session)
                return;
            if (settings.get_boolean('auto-start-service') && !service.state.active && !service.state.busy) {
                const success = await service.setActive(true);
                if (!success && this._session === session)
                    notifications.show('Knocker', 'Failed to start knocker.service', true);
            }
        }).catch(error => {
            if (this._session === session) {
                console.error('Failed to initialize Knocker:', error);
                notifications.show('Knocker', 'Failed to initialize the service', true);
            }
        });
    }

    disable() {
        const session = this._session;
        this._session = null;
        if (!session)
            return;
        session.indicator?.destroy();
        session.monitor?.destroy();
        session.service.destroy();
        session.notifications.destroy();
    }
}
