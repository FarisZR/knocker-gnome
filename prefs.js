/* prefs.js
 *
 * Preferences window for Knocker extension
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class KnockerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create a preferences page
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // Appearance group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the appearance of the Knocker indicator'),
        });
        page.add(appearanceGroup);

        // Show indicator toggle
        const showIndicatorRow = new Adw.SwitchRow({
            title: _('Show Indicator'),
            subtitle: _('Show the Knocker icon in the panel when service is active'),
        });
        settings.bind('show-indicator', showIndicatorRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(showIndicatorRow);

        // Service group
        const serviceGroup = new Adw.PreferencesGroup({
            title: _('Service'),
            description: _('Configure knocker.service behavior'),
        });
        page.add(serviceGroup);

        // Auto-start service toggle
        const autoStartRow = new Adw.SwitchRow({
            title: _('Auto-start Service'),
            subtitle: _('Automatically start knocker.service when extension is enabled'),
        });
        settings.bind('auto-start-service', autoStartRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        serviceGroup.add(autoStartRow);

        // Notifications group
        const notificationsGroup = new Adw.PreferencesGroup({
            title: _('Notifications'),
            description: _('Configure when to show notifications'),
        });
        page.add(notificationsGroup);

        // Notify on error toggle
        const notifyErrorRow = new Adw.SwitchRow({
            title: _('Notify on Errors'),
            subtitle: _('Show notifications when the service encounters errors'),
        });
        settings.bind('notification-on-error', notifyErrorRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        notificationsGroup.add(notifyErrorRow);

        // Notify on knock toggle
        const notifyKnockRow = new Adw.SwitchRow({
            title: _('Notify on Successful Knock'),
            subtitle: _('Show notifications when a knock is successfully completed'),
        });
        settings.bind('notification-on-knock', notifyKnockRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        notificationsGroup.add(notifyKnockRow);

        // About group
        const aboutGroup = new Adw.PreferencesGroup({
            title: _('About'),
        });
        page.add(aboutGroup);

        // Links
        const linksRow = new Adw.ActionRow({
            title: _('Knocker CLI'),
        });

        const linkButton = new Gtk.LinkButton({
            label: _('Visit GitHub'),
            uri: 'https://github.com/FarisZR/Knocker-CLI',
            valign: Gtk.Align.CENTER,
        });
        linksRow.add_suffix(linkButton);
        aboutGroup.add(linksRow);

        const extensionRow = new Adw.ActionRow({
            title: _('Extension Source'),
        });

        const extensionButton = new Gtk.LinkButton({
            label: _('Visit GitHub'),
            uri: 'https://github.com/FarisZR/knocker-gnome',
            valign: Gtk.Align.CENTER,
        });
        extensionRow.add_suffix(extensionButton);
        aboutGroup.add(extensionRow);
    }
}
