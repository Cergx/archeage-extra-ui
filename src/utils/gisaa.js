import { getMskDateKey, readSharedJson, writeSharedJson } from './storage.js';

/** Shared storage key for saved Gisaa veksel availability. */
export const GISAA_VEKSEL_INFO_KEY = 'tm_aa_gisaa_veksel_info_v1';

/** Shared storage key for saved Gisaa table snapshots. */
export const GISAA_VEKSEL_TABLE_KEY = 'tm_aa_gisaa_veksel_table_v1';

/** @param {*} value Gisaa key part value. */
export const normalizeGisaaPart = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * @param {{ type?: string, resourceName?: string, amount?: number|string, iconType?: string, locations?: *[] }} params Veksel attributes.
 * @returns {string} Stable Gisaa veksel key.
 */
export const makeGisaaVekselKey = ({ type, resourceName, amount, iconType, locations }) => {
    if (type === 'blue_salt') {
        return `blue_salt|${normalizeGisaaPart(resourceName)}|${Number(amount || 0)}`;
    }

    const locKey = (locations || [])
        .map(normalizeGisaaPart)
        .filter(Boolean)
        .sort()
        .join(',');
    return `north|${Number(amount || 0)}|${normalizeGisaaPart(iconType)}|${locKey}`;
};

/**
 * @param {string} key Gisaa veksel key.
 * @param {object} info Veksel availability info.
 */
export const saveGisaaVekselInfo = (key, info) => {
    if (!key || !info) return;
    const all = readSharedJson(GISAA_VEKSEL_INFO_KEY, {});
    all[key] = {
        ...info,
        date: getMskDateKey(),
        updatedAt: Date.now(),
    };
    writeSharedJson(GISAA_VEKSEL_INFO_KEY, all);
};

/**
 * @param {string} key Gisaa veksel key.
 * @returns {object|null} Saved veksel info for today.
 */
export const getSavedGisaaVekselInfo = (key) => {
    if (!key) return null;
    const info = readSharedJson(GISAA_VEKSEL_INFO_KEY, {})?.[key];
    if (!info || info.date !== getMskDateKey()) return null;
    if (info.status !== 'available' && info.status !== 'unavailable') return null;
    return info;
};

/** @returns {object|null} Saved Gisaa tables snapshot for today. */
export const getSavedGisaaTablesSnapshot = () => {
    const snapshot = readSharedJson(GISAA_VEKSEL_TABLE_KEY, null);
    if (!snapshot || snapshot.date !== getMskDateKey()) return null;
    return snapshot;
};

/** @param {*} value Text value to normalize. */
export const cleanGisaaText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

/**
 * @param {Element|null} maxCell Gisaa max cell element.
 * @returns {{ text: string, unknown: boolean, amount: number|null, iconType: string|null }} Parsed max cell data.
 */
export const parseGisaaMaxCell = (maxCell) => {
    const text = cleanGisaaText(maxCell?.textContent);
    const amount = parseInt(text, 10);
    const iconType = maxCell?.querySelector('.fa-archive')
        ? 'archive'
        : maxCell?.querySelector('.fa-sack')
            ? 'sack'
            : null;

    return {
        text,
        unknown: !text || text.includes('?') || !Number.isFinite(amount),
        amount: Number.isFinite(amount) ? amount : null,
        iconType,
    };
};

/**
 * @param {Element} row Gisaa table row element.
 * @returns {{ location: string, text: string, unknown: boolean, amount: number|null, iconType: string|null }} Parsed row data.
 */
export const parseGisaaRow = (row) => {
    const location = cleanGisaaText(row.querySelector('.row__cell-name .name.fix_size, .name.fix_size')?.textContent);
    const max = parseGisaaMaxCell(row.querySelector('.row__cell-max'));
    return { location, ...max };
};

/**
 * @param {Element} table Gisaa table element.
 * @returns {object[]} Parsed table rows with locations.
 */
export const readGisaaTableRows = (table) => (
    Array.from(table.querySelectorAll('.row-table'))
        .map(parseGisaaRow)
        .filter(row => row.location)
);

/** @returns {{ resources: Record<string, object[]>, north: object[] }} Current Gisaa table snapshot. */
export const readGisaaTablesSnapshot = () => {
    const resources = {};

    for (const blockId of ['#table-block-west', '#table-block-east']) {
        const block = document.querySelector(blockId);
        if (!block) continue;

        for (const table of block.querySelectorAll('table')) {
            const resourceName = cleanGisaaText(table.querySelector('th.table__name')?.textContent);
            if (!resourceName) continue;
            resources[resourceName] = [
                ...(resources[resourceName] || []),
                ...readGisaaTableRows(table),
            ];
        }
    }

    const northBlock = document.querySelector('#table-block-north');
    const north = northBlock
        ? Array.from(northBlock.querySelectorAll('.row-table')).map(parseGisaaRow).filter(row => row.location)
        : [];

    return { resources, north };
};

/** @param {object} snapshot Gisaa tables snapshot to save. */
export const saveGisaaTablesSnapshot = (snapshot) => {
    writeSharedJson(GISAA_VEKSEL_TABLE_KEY, {
        date: getMskDateKey(),
        updatedAt: Date.now(),
        ...snapshot,
    });
};
