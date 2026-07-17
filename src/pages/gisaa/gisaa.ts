import {
    makeGisaaVekselKey,
    saveGisaaVekselInfo,
    parseGisaaRow,
    readGisaaTablesSnapshot,
    saveGisaaTablesSnapshot,
} from '../../utils/gisaa.js';
import { appendStyleElement } from '../../utils/dom.js';
import gisaaStyles from './gisaa.scss';

type GisaaIconType = 'archive' | 'sack';

interface HighlightResult {
    match: string[];
    exclude: string[];
    unknown: string[];
}

interface ApplyHighlightsOptions {
    scrollNorth?: boolean;
}

const GISAA_MATCH_CLASS = 'tm-gisaa-match';
const GISAA_EXCLUDE_CLASS = 'tm-gisaa-exclude';
const GISAA_UNKNOWN_CLASS = 'tm-gisaa-unknown';

export const injectGisaaStyles = (): void => {
    const style = document.createElement('style');
    style.textContent = gisaaStyles;
    appendStyleElement(style);
};

/**
 * Подсвечивает строки в таблицах Запад/Восток: зелёным - подходящие, красным - неподходящие, жёлтым - неизвестные.
 * @param {string} resourceName
 * @param {number} amount - количество ресурсов
 */
export const highlightWestEastRow = (resourceName: string, amount: number): HighlightResult => {
    const blocks = ['#table-block-west', '#table-block-east'];
    const result = { match: [], exclude: [], unknown: [] };
    for (const blockId of blocks) {
        const block = document.querySelector(blockId);
        if (!block) continue;
        const tables = block.querySelectorAll('table');
        for (const table of tables) {
            const header = table.querySelector('th.table__name');
            if (!header) continue;
            // Работаем только с таблицей нужного ресурса
            if (header.textContent.trim() !== resourceName) continue;
            const rows = table.querySelectorAll('.row-table');
            for (const row of rows) {
                const maxCell = row.querySelector('.row__cell-max');
                if (!maxCell) continue;
                const parsedRow = parseGisaaRow(row);
                if (!parsedRow.location) continue;
                if (parsedRow.unknown) {
                    // В таблице неизвестное значение - жёлтым
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_UNKNOWN_CLASS));
                    result.unknown.push(parsedRow.location);
                } else if (parsedRow.amount === amount) {
                    // Подходит - зелёным
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_MATCH_CLASS));
                    result.match.push(parsedRow.location);
                } else {
                    // Не подходит - красным
                    row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_EXCLUDE_CLASS));
                    result.exclude.push(parsedRow.location);
                }
            }
        }
    }
    return result;
};

/**
 * Подсвечивает только запрошенные локации в таблице Север: зелёным подходящие, красным неподходящие, жёлтым если в таблице ?.
 * @param {string[]} locations
 * @param {number} amount - количество ресурсов
 * @param {'archive'|'sack'} iconType
 */
export const highlightNorthRow = (locations: string[], amount: number, iconType: GisaaIconType): HighlightResult => {
    const block = document.querySelector('#table-block-north');
    const result = { match: [], exclude: [], unknown: [] };
    if (!block) return result;
    if (!locations || locations.length === 0) return result;

    const rows = block.querySelectorAll('.row-table');
    for (const row of rows) {
        const nameEl = row.querySelector('.name.fix_size');
        if (!nameEl) continue;
        const rowLocation = nameEl.textContent.trim();

        // Проверяем, входит ли локация в список запрошенных
        const locationMatch = locations.some(loc =>
            rowLocation.toLowerCase().includes(loc.toLowerCase()) ||
            loc.toLowerCase().includes(rowLocation.toLowerCase())
        );

        // Работаем только с запрошенными локациями
        if (!locationMatch) continue;

        const maxCell = row.querySelector('.row__cell-max');
        if (!maxCell) continue;

        const parsedRow = parseGisaaRow(row);
        const rowLabel = parsedRow.location || rowLocation;

        // Сначала проверяем на неизвестное значение
        if (parsedRow.unknown) {
            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_UNKNOWN_CLASS));
            if (rowLabel) result.unknown.push(rowLabel);
            continue;
        }

        // Проверяем, подходит ли по amount и iconType
        let isFullMatch = false;
        if (parsedRow.iconType === iconType && parsedRow.amount === amount) {
            isFullMatch = true;
        }

        if (isFullMatch) {
            // Полностью подходит - зелёным
            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_MATCH_CLASS));
            if (rowLabel) result.match.push(rowLabel);
        } else {
            // Локация та, но amount/type не тот - красным
            row.querySelectorAll('td').forEach(td => td.classList.add(GISAA_EXCLUDE_CLASS));
            row.querySelectorAll('.btn_vote').forEach(btn => btn.classList.add(GISAA_EXCLUDE_CLASS));
            if (rowLabel) result.exclude.push(rowLabel);
        }
    }

    return result;
};

export const saveHighlightResult = (key: string, result: HighlightResult): void => {
    if (!key || !result) return;

    const unique = (values: string[]): string[] => [...new Set((values || []).filter(Boolean))];
    const matches = unique(result.match);
    const unknown = unique(result.unknown);
    const excludes = unique(result.exclude);

    let status = 'unknown';
    if (matches.length) {
        status = 'available';
    } else if (!unknown.length && excludes.length) {
        status = 'unavailable';
    }

    saveGisaaVekselInfo(key, {
        status,
        locations: matches,
        unknownLocations: unknown,
        excludedLocations: excludes,
    });
};

export const applyHighlightsFromUrl = ({ scrollNorth = true }: ApplyHighlightsOptions = {}): void => {
    const snapshot = readGisaaTablesSnapshot();
    saveGisaaTablesSnapshot(snapshot);

    const params = new URLSearchParams(location.search);

    // Западные/восточные ресурсы: ?res=Слиток железа&amount=60
    const res = params.get('res');
    const amount = parseInt(params.get('amount'), 10);
    if (res && amount) {
        const result = highlightWestEastRow(res, amount);
        saveHighlightResult(
            makeGisaaVekselKey({ type: 'blue_salt', resourceName: res, amount }),
            result
        );
    }

    // Северные локации: ?loc=Бездна,Солнечные поля&amount=25&icon=sack
    const locParam = params.get('loc');
    const icon = params.get('icon');
    if (locParam && amount && icon) {
        const locations = locParam.split(',').map(s => s.trim()).filter(Boolean);
        const result = highlightNorthRow(locations, amount, icon as GisaaIconType);
        saveHighlightResult(
            makeGisaaVekselKey({ type: 'north', amount, iconType: icon, locations }),
            result
        );

        // Скроллим к северной таблице
        const northBlock = document.querySelector('#table-block-north');
        if (scrollNorth && northBlock) {
            northBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
};

export const startGisaaResultSync = (): void => {
    setInterval(() => applyHighlightsFromUrl({ scrollNorth: false }), 5000);
};

export function initGisaa(): void {
    injectGisaaStyles();
    // Даём странице время загрузиться
    setTimeout(applyHighlightsFromUrl, 500);
    setTimeout(startGisaaResultSync, 1500);
}
