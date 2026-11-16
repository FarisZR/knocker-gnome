import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

function delay(milliseconds) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

export default class ShellTest extends Extension {
    enable() {
        this._run().then(() => {
            console.log('KNOCKER_SHELL_TEST_PASS');
            global.context.terminate();
        }).catch(error => {
            console.error(`KNOCKER_SHELL_TEST_FAIL: ${error.stack}`);
            global.context.terminate();
        });
    }

    disable() {
    }

    async _run() {
        let extension;
        for (let attempt = 0; attempt < 100; attempt++) {
            extension = Main.extensionManager.lookup('Knocker@fariszr.com')?.stateObj;
            if (extension?._session?.service.state.active)
                break;
            await delay(50);
        }
        assert(extension?._session?.service.state.active, 'Auto-start did not complete');
        const session = extension._session;
        const toggle = session.indicator.quickSettingsItems[0];
        assert(toggle.checked && toggle.subtitle === 'Service Active', 'Toggle did not reflect auto-start');
        assert(session.indicator.visible, 'Panel icon did not reflect auto-start');
        assert(!session.notifications._source, 'Startup unexpectedly notified');

        toggle.checked = false;
        const stop = toggle._toggleService();
        toggle.checked = true;
        await toggle._toggleService();
        await stop;
        assert(!toggle.checked && !session.indicator.visible, 'Toggle and indicator disagree after stop');
        assert(!session.notifications._source, 'Repeated activation produced a failure notification');

        await toggle._triggerKnock();
        assert(toggle._knockButton.sensitive, 'Knock control did not recover on completion');
        assert(session.notifications._source.notifications.length > 0, 'Notification API did not accept the manual-knock notification');
        session.notifications.show('Test error', 'Simulated service failure', true);

        const settings = extension.getSettings();
        settings.set_boolean('show-indicator', false);
        toggle.checked = true;
        await toggle._toggleService();
        assert(toggle.checked && !session.indicator.visible, 'Show-indicator preference was ignored');
        settings.set_boolean('show-indicator', true);
        assert(session.indicator.visible, 'Indicator did not restore after preference update');

        await session.service.setActive(false);
        const pending = session.service.refresh();
        extension.disable();
        extension.enable();
        const userStart = extension._session.service.setActive(true);
        await pending;
        await userStart;
        await delay(100);
        assert(extension._session !== session && extension._session.service.state.active,
            'Disable/re-enable failed or old initialization replaced the new session');
        assert(!extension._session.notifications._source, 'Auto-start conflicted with an in-flight user action');
        extension.disable();
    }
}
