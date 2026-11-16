export const KnockerEvent = Object.freeze({
    SERVICE_STATE: 'ServiceState',
    STATUS_SNAPSHOT: 'StatusSnapshot',
    WHITELIST_APPLIED: 'WhitelistApplied',
    WHITELIST_EXPIRED: 'WhitelistExpired',
    NEXT_KNOCK_UPDATED: 'NextKnockUpdated',
    KNOCK_TRIGGERED: 'KnockTriggered',
    ERROR: 'Error',
});

const fields = {
    serviceState: 'SERVICE_STATE',
    version: 'VERSION',
    whitelistIp: 'WHITELIST_IP',
    expiresUnix: 'EXPIRES_UNIX',
    ttlSec: 'TTL_SEC',
    nextAtUnix: 'NEXT_AT_UNIX',
    cadenceSource: 'CADENCE_SOURCE',
    triggerSource: 'TRIGGER_SOURCE',
    result: 'RESULT',
    errorCode: 'ERROR_CODE',
    errorMsg: 'ERROR_MSG',
    context: 'CONTEXT',
};
const numericFields = new Set(['expiresUnix', 'ttlSec', 'nextAtUnix']);
const whitelistFields = ['whitelistIp', 'expiresUnix', 'ttlSec'];
const nextKnockFields = ['nextAtUnix', 'cadenceSource'];
const stateFields = {
    [KnockerEvent.SERVICE_STATE]: ['serviceState', 'version'],
    [KnockerEvent.STATUS_SNAPSHOT]: [...whitelistFields, ...nextKnockFields],
    [KnockerEvent.WHITELIST_APPLIED]: whitelistFields,
    [KnockerEvent.NEXT_KNOCK_UPDATED]: nextKnockFields,
    [KnockerEvent.WHITELIST_EXPIRED]: whitelistFields,
};

export function initialState() {
    return {
        whitelistIp: null, expiresUnix: null, ttlSec: null,
        nextAtUnix: null, cadenceSource: null,
        serviceState: 'stopped', version: null,
    };
}

export function decodeEntry(entry) {
    if (!entry || entry.KNOCKER_SCHEMA_VERSION !== '1' ||
        !Object.values(KnockerEvent).includes(entry.KNOCKER_EVENT))
        return null;

    const data = {event: entry.KNOCKER_EVENT, message: entry.MESSAGE ?? ''};
    for (const [field, suffix] of Object.entries(fields)) {
        const value = entry[`KNOCKER_${suffix}`];
        if (value === undefined)
            continue;
        if (numericFields.has(field)) {
            if (typeof value !== 'string' || !/^\d+$/.test(value) ||
                !Number.isSafeInteger(Number(value)))
                return null;
            data[field] = Number(value);
        } else if (typeof value === 'string') {
            data[field] = value;
        }
    }
    data.timestamp = Number(entry.__REALTIME_TIMESTAMP) / 1000000;
    return data;
}

export function applyEvent(state, data) {
    const next = {...state};
    for (const field of stateFields[data.event] ?? []) {
        next[field] = data.event === KnockerEvent.WHITELIST_EXPIRED
            ? null : data[field] ?? null;
    }
    return next;
}
