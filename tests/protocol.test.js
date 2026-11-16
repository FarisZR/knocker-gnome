import assert from 'node:assert/strict';
import test from 'node:test';
import {applyEvent, decodeEntry, initialState} from '../src/knocker/protocol.js';

function event(name, fields = {}) {
    return decodeEntry({
        KNOCKER_EVENT: name, KNOCKER_SCHEMA_VERSION: '1', ...fields,
    });
}

test('a journal session retains scheduling through renewal, then clears only the expired whitelist', () => {
    let state = initialState();
    state = applyEvent(state, event('StatusSnapshot', {
        KNOCKER_WHITELIST_IP: '192.0.2.1', KNOCKER_EXPIRES_UNIX: '200',
        KNOCKER_TTL_SEC: '90', KNOCKER_NEXT_AT_UNIX: '180', KNOCKER_CADENCE_SOURCE: 'ttl',
    }));
    state = applyEvent(state, event('WhitelistApplied', {
        KNOCKER_WHITELIST_IP: '192.0.2.2', KNOCKER_EXPIRES_UNIX: '300', KNOCKER_TTL_SEC: '0',
    }));
    assert.deepEqual(state, {
        whitelistIp: '192.0.2.2', expiresUnix: 300, ttlSec: 0,
        nextAtUnix: 180, cadenceSource: 'ttl', serviceState: 'stopped', version: null,
    });
    const expired = applyEvent(state, event('WhitelistExpired'));
    assert.equal(expired.whitelistIp, null);
    assert.equal(expired.expiresUnix, null);
    assert.equal(expired.ttlSec, null);
    assert.equal(expired.nextAtUnix, 180);
    assert.equal(state.whitelistIp, '192.0.2.2');
});

test('snapshots clear information that is no longer present', () => {
    const old = {...initialState(), whitelistIp: '192.0.2.1', nextAtUnix: 500};
    const state = applyEvent(old, event('StatusSnapshot'));
    assert.equal(state.whitelistIp, null);
    assert.equal(state.nextAtUnix, null);
});

test('unrelated, malformed and unsupported journal records cannot change state', () => {
    for (const entry of [null, {}, {KNOCKER_EVENT: 'Error', KNOCKER_SCHEMA_VERSION: '2'}])
        assert.equal(decodeEntry(entry), null);
    for (const value of ['12seconds', '-1', 'NaN', '9007199254740992', ['20']])
        assert.equal(event('WhitelistApplied', {KNOCKER_EXPIRES_UNIX: value}), null);
});

test('error and trigger events preserve diagnostic fields without resetting state', () => {
    const state = {...initialState(), nextAtUnix: 500};
    const error = event('Error', {KNOCKER_ERROR_MSG: 'Permission denied', MESSAGE: 'Knock failed'});
    assert.equal(error.errorMsg, 'Permission denied');
    assert.equal(error.message, 'Knock failed');
    assert.deepEqual(applyEvent(state, error), state);
    const trigger = event('KnockTriggered', {KNOCKER_TRIGGER_SOURCE: 'manual', KNOCKER_RESULT: 'success'});
    assert.equal(trigger.triggerSource, 'manual');
    assert.equal(trigger.result, 'success');
});
