// ==UserScript==
// @name         ArcheAge Marathon – today completed tasks UI fix (MSK)
// @namespace    https://archeage.ru/
// @version      1.1
// @description  Подсветка выполненных задач по last_complete_time + иконки + done-блок + нормальная навигация (МСК)
// @match        *://archeage.ru/promo/marathon/
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const DONE_CLASS = 'tm-task-completed';
    const TZ = 'Europe/Moscow';

    // ===== date navigation state =====
    const MSK_OFFSET_HOURS_FALLBACK = 3; // MSK без DST, но пусть будет фолбэк
    let selectedDayUtcMs = null; // храним "день" как UTC-полночь дня в TZ
    let selectedSegment = 'auto';
    // 'auto' | 'pre' | 'post' | null
    // null = обычный день (не четверг)
    // auto = “сегодня” по текущему времени (кнопка Сегодня)

    let API_INFO_CACHE = null; // json from api/info

    let NOW_MS = null; // server time snapshot in ms (fixed once)

    let MIN_DAY_UTC_MS = null;
    let MAX_DAY_UTC_MS = null;

    // сегменты границ (чтобы “первый четверг pre пустой” не показывать)
    let MIN_SEG = null; // null|pre|post
    let MAX_SEG = null; // null|pre|post


    function normalizeUrlToPath(url) {
        try {
            return new URL(url, location.href).pathname;
        } catch {
            return String(url || '');
        }
    }

    const API_INFO_PATH = '/minigames/marathon_of_heroes/api/info';

    function installApiInfoInterceptor() {
        // чтобы не поставить дважды
        if (window.__tmAA_fetchPatched) return;
        window.__tmAA_fetchPatched = true;

        const origFetch = window.fetch.bind(window);

        window.fetch = async (...args) => {
            const input = args[0];
            const init = args[1];

            const urlStr =
                typeof input === 'string' ? input :
                    (input && typeof input === 'object' && 'url' in input) ? input.url :
                        String(input);

            const path = normalizeUrlToPath(urlStr);

            const res = await origFetch(...args);

            if (path === API_INFO_PATH) {
                // 1) фиксируем NOW_MS из Date заголовка (один раз)
                if (NOW_MS == null) {
                    const dateHeader = res.headers.get('Date');
                    const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
                    if (Number.isFinite(parsed)) NOW_MS = parsed;
                }

                // 2) кешируем JSON (один раз)
                // Важно: читаем clone(), чтобы не "съесть" body для оригинального кода страницы
                if (API_INFO_CACHE == null) {
                    res.clone().json()
                        .then((json) => { API_INFO_CACHE = json; })
                        .catch(() => { /* игнор */ });
                }
            }

            return res;
        };
    }

    installApiInfoInterceptor();


    function pad2(n) { return String(n).padStart(2, '0'); }

    function getMSKDatePartsFromUtcMs(utcMs) {
        const d = new Date(utcMs);
        const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
        const parts = fmt.formatToParts(d);
        const y = Number(parts.find(p => p.type === 'year')?.value);
        const m = Number(parts.find(p => p.type === 'month')?.value);
        const day = Number(parts.find(p => p.type === 'day')?.value);
        return { y, m, d: day };
    }

    function formatDMY({ y, m, d }) {
        return `${pad2(d)}.${pad2(m)}.${y}`;
    }

    function dayUtcMsFromUnixByTZ(unixSec) {
        const ms = Number(unixSec || 0) * 1000;
        const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
        return Date.UTC(y, m - 1, d, 0, 0, 0);
    }

    function getTodayUtcMsByTZ() {
        const { y, m, d } = getMSKDatePartsFromUtcMs(nowMs());
        return Date.UTC(y, m - 1, d, 0, 0, 0);
    }

    function addDaysUtcMs(dayUtcMs, deltaDays) {
        return dayUtcMs + deltaDays * 86400000;
    }

    function getDayBoundsUnix(dayUtcMs) {
        const { y, m, d } = getMSKDatePartsFromUtcMs(dayUtcMs);
        // 00:00 MSK -> UTC = 00:00 UTC - 3h
        const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - MSK_OFFSET_HOURS_FALLBACK * 3600 * 1000;
        const endMs = startMs + 86400000;
        return { start: Math.floor(startMs / 1000), end: Math.floor(endMs / 1000) };
    }

    const THU_PRE_HOUR = 3;   // 03:00 МСК (контрольная точка “до профработ”)
    const DEFAULT_HOUR = 16;  // 16:00 МСК (контрольная точка “после”)

    function nowMs() {
        if (NOW_MS == null) {
            throw new Error('[AA Marathon] NOW_MS is not initialized yet (server time missing)');
        }
        return NOW_MS;
    }

    function getUnixForDayAtHour(dayUtcMs, hourMsk) {
        const { start } = getDayBoundsUnix(dayUtcMs); // 00:00 МСК в unix
        return start + hourMsk * 3600;
    }

    function getNowUnix() {
        return Math.floor(nowMs() / 1000);
    }

    function isQuestActiveAtUnix(q, unix) {
        const qs = Number(q?.start_time || 0);
        const qe = Number(q?.end_time || 0);
        if (!qs || !qe) return false;
        return qs <= unix && unix < qe;
    }

    function isSameDayByTZ(aUtcMs, bUtcMs) {
        const a = getMSKDatePartsFromUtcMs(aUtcMs);
        const b = getMSKDatePartsFromUtcMs(bUtcMs);
        return a.y === b.y && a.m === b.m && a.d === b.d;
    }

    function isThursdayByTZ(dayUtcMs) {
        const w = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' })
            .format(new Date(dayUtcMs));
        return w === 'Thu';
    }

    // для clamping’а: четверг имеет 2 позиции: pre и post
    function slotKey(dayUtcMs, segment) {
        const seg = segment === 'pre' ? 0 : segment === 'post' ? 2 : 1;
        return dayUtcMs * 10 + seg;
    }

    function normalizeSegmentForDay(dayUtcMs, seg) {
        if (!isThursdayByTZ(dayUtcMs)) return null;
        if (seg === 'pre' || seg === 'post' || seg === 'auto') return seg;
        return 'post';
    }

    function effectiveSegment(dayUtcMs, seg) {
        // auto используем только для “сегодня”.
        // Если вдруг авто попало на не-сегодня — считаем как post (логичнее).
        if (!isThursdayByTZ(dayUtcMs)) return null;
        if (seg === 'pre' || seg === 'post') return seg;

        const todayUtc = getTodayUtcMsByTZ();
        const isToday = isSameDayByTZ(dayUtcMs, todayUtc);
        if (!isToday) return 'post';

        const { start } = getDayBoundsUnix(dayUtcMs);
        const cut = start + 9 * 3600;
        const now = getNowUnix();
        return now < cut ? 'pre' : 'post';
    }

    function getSlotBoundsUnix(dayUtcMs, seg) {
        const { start, end } = getDayBoundsUnix(dayUtcMs);
        if (!isThursdayByTZ(dayUtcMs)) return { start, end };

        const cut = start + 9 * 3600;
        const s = effectiveSegment(dayUtcMs, seg);

        if (s === 'pre') return { start, end: cut };
        return { start: cut, end };
    }

    function formatTimeMSK(unixSec) {
        if (!unixSec) return '';
        const d = new Date(unixSec * 1000);
        // 14:33
        return new Intl.DateTimeFormat('ru-RU', {
            timeZone: TZ,
            hour: '2-digit',
            minute: '2-digit',
        }).format(d);
    }

    function isDoneInSelectedSlot(q, dayUtcMs, seg) {
        const t = Number(q?.last_complete_time || 0);
        if (!t) return false;
        const b = getSlotBoundsUnix(dayUtcMs, seg);
        return b.start <= t && t < b.end;
    }

    function getRewardAmount(q) {
        const steps = q?.steps;
        const step1 = steps?.['1'] || steps?.[1];
        const amount = step1?.rewards?.[0]?.value?.amount;
        return Number(amount || 0);
    }

    function ensureTasksListEl() {
        return document.querySelector('.section.tasks .tasks__list');
    }

    function ensureDateNavInHeader() {
        const header = document.querySelector('.section.tasks .tasks__header');
        if (!header) return null;

        let nav = header.querySelector('.tm-date-nav');
        if (nav) return nav;

        nav = document.createElement('div');
        nav.className = 'tm-date-nav';

        const left = document.createElement('button');
        left.className = 'tm-date-btn tm-date-prev';
        left.type = 'button';
        left.textContent = '←';

        const right = document.createElement('button');
        right.className = 'tm-date-btn tm-date-next';
        right.type = 'button';
        right.textContent = '→';

        const todayBtn = document.createElement('button');
        todayBtn.className = 'tm-date-btn tm-date-today';
        todayBtn.type = 'button';
        todayBtn.textContent = 'Сегодня';

        const label = document.createElement('div');
        label.className = 'tm-date-label';
        label.textContent = '...';

        nav.appendChild(left);
        nav.appendChild(label);
        nav.appendChild(right);
        nav.appendChild(todayBtn);

        header.insertAdjacentElement('afterbegin', nav);

        left.addEventListener('click', async () => {
            const todayUtc = getTodayUtcMsByTZ();
            const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);

            // единственный разрешённый "назад": сегодня-четверг post -> pre
            if (isToday && isThursdayByTZ(selectedDayUtcMs) && selectedSegment === 'post') {
                selectedSegment = 'pre';
                const c0 = clampSelectedDay(selectedDayUtcMs, selectedSegment);
                selectedDayUtcMs = c0.dayUtcMs;
                selectedSegment = c0.segment;
                await onSelectedDateChanged();
                return;
            }

            // иначе: обычный prev-slot, но без ухода в прошлые дни
            const prev = getPrevSlot(selectedDayUtcMs, selectedSegment);

            // сначала клампим по "не прошлое"
            const np = clampNotPast(prev.dayUtcMs, prev.segment);

            // потом по min/max эвента
            const c = clampSelectedDay(np.dayUtcMs, np.segment);

            selectedDayUtcMs = c.dayUtcMs;
            selectedSegment = c.segment;

            await onSelectedDateChanged();
        });

        right.addEventListener('click', async () => {
            const next = getNextSlot(selectedDayUtcMs, selectedSegment);
            const c = clampSelectedDay(next.dayUtcMs, next.segment);
            selectedDayUtcMs = c.dayUtcMs;
            selectedSegment = c.segment;
            await onSelectedDateChanged();
        });

        todayBtn.addEventListener('click', async () => {
            selectedDayUtcMs = getTodayUtcMsByTZ();
            selectedSegment = 'auto';
            const c = clampSelectedDay(selectedDayUtcMs, selectedSegment);
            selectedDayUtcMs = c.dayUtcMs;
            selectedSegment = c.segment;
            await onSelectedDateChanged();
        });

        return nav;
    }

    function updateDateNavLabel() {
        const nav = document.querySelector('.tm-date-nav');
        if (!nav) return;
        const label = nav.querySelector('.tm-date-label');
        if (!label) return;

        const parts = getMSKDatePartsFromUtcMs(selectedDayUtcMs);
        const dateStr = formatDMY(parts);

        const todayUtc = getTodayUtcMsByTZ();
        const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);
        const isThu = isThursdayByTZ(selectedDayUtcMs);

        let suffix = '';
        if (isToday && selectedSegment === 'auto') {
            suffix = ' (сейчас)';
        } else if (isThu && selectedSegment === 'pre') {
            suffix = ' (до 09:00)';
        } else if (isThu && selectedSegment === 'post') {
            suffix = ' (после 09:00)';
        }

        label.textContent = dateStr + suffix;

        updateDateNavButtons();
    }

    async function onSelectedDateChanged() {
        updateDateNavLabel();
        updateDateNavButtons();
        try {
            await renderTasksForSelectedDay();
        } catch (e) {
            console.warn('[AA Marathon] renderTasksForSelectedDay failed:', e);
        }
    }

    // ====== Codex / veksel links (оставил как у тебя) ======
    const CODEX_BASE = 'https://archeagecodex.com/ru/quest/';
    const ICON_QUEST = 'https://archeagecodex.com/images/icon_quest_common.png';
    const ICON_VEKSEL = 'https://archeagecodex.com/items/icon_item_3493.png';

    const VEKSEL_OFFICIAL_IDS = new Set([8426, 8388, 8352, 8320, 8284, 8248]);
    const VEKSEL_BASE = 'https://gisaa.ru/veksel/';
    const SERVER_TO_VEKSEL_ID = {
        'Ифнир': 49,
        'Корвус': 42,
        'Ксанатос': 61,
        'Луций': 1,
        'Мираж': 65,
        'Нагашар': 64,
        'Рейвен': 63,
        'Тарон': 62,
        'Фанем': 45,
        'Фесаникс': 66,
        'Шаеда': 46,
    };

    let VEkselUrlResolved = VEKSEL_BASE;

    async function fetchJson(url) {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.json();
    }

    async function fetchText(url) {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.text();
    }

    async function getUidFromCheckUser() {
        const json = await fetchJson('/dynamic/auth/?a=checkuser');
        const uid = json?.user?.uid;
        if (!uid) throw new Error('uid not found in checkuser response');
        return String(uid);
    }

    function parseServersFromCharListHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const lis = [...doc.querySelectorAll('li')];

        const servers = lis
            .map(li => {
                const spans = li.querySelectorAll('span');
                const last = spans?.[spans.length - 1];
                return last ? last.textContent.trim() : null;
            })
            .filter(Boolean);

        return servers;
    }

    function pickMainServer(servers) {
        if (!servers.length) return null;

        const counts = new Map();
        const order = [];
        for (const s of servers) {
            if (!counts.has(s)) order.push(s);
            counts.set(s, (counts.get(s) || 0) + 1);
        }

        let best = null;
        let bestCount = -1;

        for (const s of order) {
            const c = counts.get(s);
            if (c > bestCount) {
                best = s;
                bestCount = c;
            }
        }

        return best;
    }

    async function resolveVekselUrl() {
        try {
            const uid = await getUidFromCheckUser();
            const html = await fetchText(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
            const servers = parseServersFromCharListHtml(html);
            const mainServer = pickMainServer(servers);

            if (!mainServer) {
                VEkselUrlResolved = VEKSEL_BASE;
                return VEkselUrlResolved;
            }

            const vekselId = SERVER_TO_VEKSEL_ID[mainServer];
            VEkselUrlResolved = vekselId ? `${VEKSEL_BASE}${vekselId}` : VEKSEL_BASE;
            return VEkselUrlResolved;
        } catch (e) {
            VEkselUrlResolved = VEKSEL_BASE;
            return VEkselUrlResolved;
        }
    }

    function makeIconLink({ href, iconSrc, title, className }) {
        const a = document.createElement('a');
        a.className = `tm-icon-link ${className || ''}`.trim();
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = title;

        const img = document.createElement('img');
        img.src = iconSrc;
        img.alt = title;

        a.appendChild(img);
        return a;
    }

    // ===== QUEST_META_BY_OFFICIAL_ID: оставляю как у тебя (не меняю) =====
    const QUEST_META_BY_OFFICIAL_ID = {
        "8246": {
            "codexId": 10559,
            "short": ""
        },
        "8248": {
            "codexId": 9142,
            "short": ""
        },
        "8250": {
            "codexId": 9318,
            "short": ""
        },
        "8252": {
            "codexId": 10512,
            "short": ""
        },
        "8254": {
            "codexId": 10512,
            "short": ""
        },
        "8256": {
            "codexId": 9100,
            "short": ""
        },
        "8258": {
            "codexId": 7658,
            "short": ""
        },
        "8260": {
            "codexId": 6797,
            "short": ""
        },
        "8262": {
            "codexId": 8998,
            "short": ""
        },
        "8268": {
            "codexId": 5972,
            "short": ""
        },
        "8274": {
            "codexId": 10480,
            "short": ""
        },
        "8282": {
            "codexId": 7154,
            "short": ""
        },
        "8284": {
            "codexId": 9137,
            "short": "Вексель за 60 железных слитков"
        },
        "8286": {
            "codexId": 8000131,
            "short": "Квест Нуи на 500 очков работы"
        },
        "8288": {
            "codexId": 10508,
            "short": ""
        },
        "8290": {
            "codexId": 10509,
            "short": ""
        },
        "8292": {
            "codexId": 5092,
            "short": ""
        },
        "8294": {
            "codexId": 7659,
            "short": ""
        },
        "8296": {
            "codexId": 7817,
            "short": ""
        },
        "8298": {
            "codexId": 8000058,
            "short": "Лицуха в Нагашар (только обычка)"
        },
        "8300": {
            "codexId": 5971,
            "short": ""
        },
        "8314": {
            "codexId": 10564,
            "short": ""
        },
        "8316": {
            "codexId": 8000061,
            "short": ""
        },
        "8318": {
            "codexId": 9317,
            "short": "Квест на Космача"
        },
        "8320": {
            "codexId": 9152,
            "short": "Вексель за 60 кожи"
        },
        "8322": {
            "codexId": 8435,
            "short": 'Портал "Лягушачьи пруды"'
        },
        "8324": {
            "codexId": 10510,
            "short": ""
        },
        "8326": {
            "codexId": 10510,
            "short": ""
        },
        "8328": {
            "codexId": 7657,
            "short": ""
        },
        "8330": {
            "codexId": 7813,
            "short": ""
        },
        "8336": {
            "codexId": 5144,
            "short": ""
        },
        "8338": {
            "codexId": 5885,
            "short": "Анталлон на Солнечных полях"
        },
        "8340": {
            "codexId": 8000060,
            "short": 'Изи Сады наслаждений с лицухой'
        },
        "8346": {
            "codexId": 10056,
            "short": ""
        },
        "8348": {
            "codexId": 11154,
            "short": "Лиловый (армия фантомов)"
        },
        "8350": {
            "codexId": 11227,
            "short": "Превратиться в руру и получить билет (в данж идти необязательно)"
        },
        "8352": {
            "codexId": 9147,
            "short": "Вексель за 60 ткани"
        },
        "8354": {
            "codexId": 8000136,
            "short": "Квест Нуи на 2500 ремесленки"
        },
        "8356": {
            "codexId": 10506,
            "short": ""
        },
        "8358": {
            "codexId": 10506,
            "short": ""
        },
        "8360": {
            "codexId": 5091,
            "short": ""
        },
        "8362": {
            "codexId": 9101,
            "short": "Библа, 3-ий босс"
        },
        "8364": {
            "codexId": 7656,
            "short": ""
        },
        "8366": {
            "codexId": 9320,
            "short": ""
        },
        "8372": {
            "codexId": 9297,
            "short": ""
        },
        "8380": {
            "codexId": 7815,
            "short": "Изи Сады наслаждений"
        },
        "8382": {
            "codexId": 10735,
            "short": "Эншака на Солнечных полях"
        },
        "8388": {
            "codexId": 9153,
            "short": "Вексель за 100 кожи"
        },
        "8390": {
            "codexId": 5062,
            "short": ""
        },
        "8392": {
            "codexId": 10514,
            "short": ""
        },
        "8394": {
            "codexId": 10514,
            "short": ""
        },
        "8396": {
            "codexId": 7155,
            "short": "Нагашар обычка"
        },
        "8398": {
            "codexId": 9398,
            "short": "100 мобов"
        },
        "8400": {
            "codexId": 7152,
            "short": ""
        },
        "8402": {
            "codexId": 9102,
            "short": "Библа, последний босс"
        },
        "8404": {
            "codexId": 9205,
            "short": ""
        },
        "8414": {
            "codexId": 10952,
            "short": ""
        },
        "8422": {
            "codexId": 10304,
            "short": ""
        },
        "8424": {
            "codexId": 9099,
            "short": "Библа, первый босс"
        },
        "8426": {
            "codexId": 9143,
            "short": "Вексель за 100 досок"
        },
        "8434": {
            "codexId": 10504,
            "short": ""
        },
        "8436": {
            "codexId": 10504,
            "short": ""
        },
        "8438": {
            "codexId": 8000062,
            "short": "Аль-Харба / Ферма Хадира / Колыбель разрушений / Воющая Бездна / Копи пронизывающего ветра / Арсенал Сожженной крепости"
        },
        "8448": {
            "codexId": 2943,
            "short": "Кровавый (дневной) разлом - 3-я волна"
        },
        "8450": {
            "codexId": 7935,
            "short": ""
        },
        "8452": {
            "codexId": 7660,
            "short": ""
        },
        "8470": {
            "codexId": 10739,
            "short": "Призрачный (ночной) разлом - Эншака"
        },
        "8478": {
            "codexId": 10423,
            "short": ""
        },
        "8494": {
            "codexId": 8635,
            "short": ""
        },
        "8496": {
            "codexId": 9295,
            "short": ""
        },
        "8498": {
            "codexId": 9294,
            "short": ""
        },
        "8500": {
            "codexId": 8637,
            "short": ""
        },
        "8502": {
            "codexId": 7327,
            "short": ""
        },
        "8504": {
            "codexId": 9296,
            "short": ""
        },
        "8506": {
            "codexId": 5969,
            "short": ""
        },
        "8508": {
            "codexId": 8641,
            "short": ""
        },
        "8510": {
            "codexId": 5077,
            "short": ""
        },
        "8512": {
            "codexId": 8605,
            "short": ""
        },
        "8514": {
            "codexId": 11096,
            "short": "Луг"
        },
        "8516": {
            "codexId": 8000129,
            "short": ""
        },
        "8518": {
            "codexId": 1415,
            "short": ""
        },
        "8520": {
            "codexId": 5970,
            "short": ""
        },
        "8522": {
            "codexId": 10188,
            "short": ""
        },
        "8524": {
            "codexId": 8618,
            "short": ""
        }
    };

    // ===== cards =====
    function makeRewardBlock(amount, isDone) {
        const reward = document.createElement('div');
        reward.className = 'tasks__item-reward';

        const name = document.createElement('span');
        name.className = 'tasks__item-reward-name';
        name.textContent = 'Награда:';
        reward.appendChild(name);

        const n = Math.max(0, Math.min(20, amount));
        const cls = isDone ? 'icon-point--received' : 'icon-point--not-received';

        for (let i = 0; i < n; i++) {
            const icon = document.createElement('div');
            icon.className = `icon-point ${cls}`;
            reward.appendChild(icon);
        }

        return reward;
    }

    function makeTaskText(desc) {
        const t = document.createElement('div');
        t.className = 'tasks__item-text';
        t.textContent = desc || '';
        return t;
    }

    function makeLinksRow({ codexId, officialId, short }) {
        const row = document.createElement('div');
        row.className = 'tm-links-row';

        if (short) {
            const d = document.createElement('div');
            d.className = 'tm-short';
            d.textContent = short;
            row.appendChild(d);
        }

        const icons = document.createElement('div');
        icons.className = 'tm-icons';
        row.appendChild(icons);

        icons.appendChild(makeIconLink({
            href: `${CODEX_BASE}${codexId}/`,
            iconSrc: ICON_QUEST,
            title: 'Открыть задание в ArcheageCodex',
            className: 'tm-codex-link',
        }));

        if (typeof officialId === 'number' && VEKSEL_OFFICIAL_IDS.has(officialId)) {
            icons.appendChild(makeIconLink({
                href: VEkselUrlResolved,
                iconSrc: ICON_VEKSEL,
                title: 'Открыть таблицу векселей',
                className: 'tm-veksel-link',
            }));
        }

        return row;
    }

    function makeTaskCard({ q, amount, codexId, officialId, short, isDone, showLastDone }) {
        const item = document.createElement('div');
        item.className = `tasks__item tasks__item--${amount || 1}`;

        if (isDone) {
            item.classList.add(DONE_CLASS);

            const done = document.createElement('div');
            done.className = 'tasks__item-done';

            // время последнего выполнения (только время), если нужно показывать
            if (showLastDone) {
                const t = Number(q?.last_complete_time || 0);
                const time = formatTimeMSK(t);
                if (time) {
                    const timeEl = document.createElement('span');
                    timeEl.className = 'tm-done-time';
                    timeEl.textContent = time;
                    done.appendChild(timeEl);
                }
            }

            item.appendChild(done);
        }

        item.appendChild(makeRewardBlock(amount, isDone));
        item.appendChild(makeTaskText(q.description));

        item.appendChild(makeLinksRow({ codexId, officialId, short }));

        return item;
    }

    async function fetchApiInfo() {
        const res = await fetch('/minigames/marathon_of_heroes/api/info', {
            credentials: 'include',
            cache: 'no-store',
        });
        if (!res.ok) throw new Error(`api/info failed: ${res.status} ${res.statusText}`);

        // Фиксируем "сейчас" один раз: только серверное время, без локальных часов
        if (NOW_MS == null) {
            const dateHeader = res.headers.get('Date');
            const parsed = dateHeader ? Date.parse(dateHeader) : NaN;

            if (!Number.isFinite(parsed)) {
                // принципиально НЕ фолбэчим на Date.now(), как ты просил
                throw new Error('[AA Marathon] Cannot read server Date header (NOW_MS not set).');
            }

            NOW_MS = parsed;
        }

        return res.json();
    }


    async function getApiInfoCached() {
        if (API_INFO_CACHE) return API_INFO_CACHE;
        API_INFO_CACHE = await fetchApiInfo();
        return API_INFO_CACHE;
    }

    function getQuestsArrayFromInfo(json) {
        const quests = json?.data?.quests;
        if (!quests || typeof quests !== 'object') throw new Error('api/info: json.data.quests not found');
        return Object.values(quests);
    }

    function computeThuSegmentsAvailability(dayUtcMs, questsArr) {
        // pre = активен в 03:00
        const preUnix = getUnixForDayAtHour(dayUtcMs, THU_PRE_HOUR);
        const postUnix = getUnixForDayAtHour(dayUtcMs, DEFAULT_HOUR);
        const hasPre = questsArr.some(q => isQuestActiveAtUnix(q, preUnix));
        const hasPost = questsArr.some(q => isQuestActiveAtUnix(q, postUnix));
        return { hasPre, hasPost };
    }

    async function computeDateBoundsFromApiInfo() {
        if (MIN_DAY_UTC_MS != null && MAX_DAY_UTC_MS != null) return;

        const json = await getApiInfoCached();
        const questsArr = getQuestsArrayFromInfo(json);

        let minStart = Infinity;
        let maxEnd = -Infinity;

        for (const q of questsArr) {
            const s = Number(q?.start_time || 0);
            const e = Number(q?.end_time || 0);
            if (!s || !e) continue;
            if (s < minStart) minStart = s;
            if (e > maxEnd) maxEnd = e;
        }

        if (!isFinite(minStart) || !isFinite(maxEnd)) {
            MIN_DAY_UTC_MS = null;
            MAX_DAY_UTC_MS = null;
            MIN_SEG = null;
            MAX_SEG = null;
            return;
        }

        MIN_DAY_UTC_MS = dayUtcMsFromUnixByTZ(minStart);
        MAX_DAY_UTC_MS = dayUtcMsFromUnixByTZ(maxEnd - 1);

        // определяем сегменты-границы
        MIN_SEG = null;
        MAX_SEG = null;

        if (MIN_DAY_UTC_MS != null && isThursdayByTZ(MIN_DAY_UTC_MS)) {
            const { hasPre, hasPost } = computeThuSegmentsAvailability(MIN_DAY_UTC_MS, questsArr);
            // если pre пустой — не показываем как самый первый
            if (hasPre) MIN_SEG = 'pre';
            else if (hasPost) MIN_SEG = 'post';
            else MIN_SEG = 'post'; // на всякий (не должно быть)
        }

        if (MAX_DAY_UTC_MS != null && isThursdayByTZ(MAX_DAY_UTC_MS)) {
            const { hasPre, hasPost } = computeThuSegmentsAvailability(MAX_DAY_UTC_MS, questsArr);
            // если post пустой — последним делаем pre
            if (hasPost) MAX_SEG = 'post';
            else if (hasPre) MAX_SEG = 'pre';
            else MAX_SEG = 'pre';
        }

        const c = clampSelectedDay(selectedDayUtcMs, selectedSegment);
        selectedDayUtcMs = c.dayUtcMs;
        selectedSegment = c.segment;
    }

    function clampNotPast(dayUtcMs, segment) {
        const todayUtc = getTodayUtcMsByTZ();

        // если пытаемся уйти в прошлый день — возвращаем на сегодня
        if (dayUtcMs < todayUtc) {
            dayUtcMs = todayUtc;

            // на сегодня: если четверг — оставляем post (по умолчанию),
            // но если был auto — оставим auto
            if (isThursdayByTZ(dayUtcMs)) {
                segment = (segment === 'auto') ? 'auto' : 'post';
            } else {
                segment = 'auto';
            }
        }

        return { dayUtcMs, segment };
    }


    function clampSelectedDay(dayUtcMs, segment) {
        if (dayUtcMs == null) return { dayUtcMs, segment };

        segment = normalizeSegmentForDay(dayUtcMs, segment);

        const curKey = slotKey(dayUtcMs, segment);

        const minKey = MIN_DAY_UTC_MS != null ? slotKey(MIN_DAY_UTC_MS, MIN_SEG) : null;
        const maxKey = MAX_DAY_UTC_MS != null ? slotKey(MAX_DAY_UTC_MS, MAX_SEG) : null;

        if (minKey != null && curKey < minKey) return { dayUtcMs: MIN_DAY_UTC_MS, segment: MIN_SEG };
        if (maxKey != null && curKey > maxKey) return { dayUtcMs: MAX_DAY_UTC_MS, segment: MAX_SEG };

        // ещё раз нормализуем сегмент на текущий день (чтобы на обычном дне не было pre/post)
        segment = normalizeSegmentForDay(dayUtcMs, segment);
        return { dayUtcMs, segment };
    }

    function updateDateNavButtons() {
        const nav = document.querySelector('.tm-date-nav');
        if (!nav) return;

        const prev = nav.querySelector('.tm-date-prev');
        const next = nav.querySelector('.tm-date-next');

        const curKey = slotKey(selectedDayUtcMs, selectedSegment);
        const minKey = MIN_DAY_UTC_MS != null ? slotKey(MIN_DAY_UTC_MS, MIN_SEG) : null;
        const maxKey = MAX_DAY_UTC_MS != null ? slotKey(MAX_DAY_UTC_MS, MAX_SEG) : null;

        if (prev) {
            const todayUtc = getTodayUtcMsByTZ();
            const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);

            // на сегодня-четверг, когда мы на post — назад разрешаем (в pre)
            const allowBackWithinTodayThu = isToday && isThursdayByTZ(selectedDayUtcMs) && selectedSegment === 'post';

            // в остальных случаях запрещаем "назад", если это увело бы в прошлое
            // (и плюс учитываем minKey, если он сильнее)
            const notPastBlock = isToday && !allowBackWithinTodayThu;

            prev.disabled =
                (minKey != null && curKey <= minKey) ||
                notPastBlock;
        }
        if (next) next.disabled = (maxKey != null) && (curKey >= maxKey);
    }

    function getPrevSlot(dayUtcMs, seg) {
        const isThu = isThursdayByTZ(dayUtcMs);

        if (isThu) {
            if (seg === 'post') return { dayUtcMs, segment: 'pre' };
            if (seg === 'pre') {
                const prevDay = addDaysUtcMs(dayUtcMs, -1);
                return { dayUtcMs: prevDay, segment: normalizeSegmentForDay(prevDay, null) };
            }
            // auto на чт трактуем как post
            return { dayUtcMs, segment: 'pre' };
        }

        const prevDay = addDaysUtcMs(dayUtcMs, -1);
        if (isThursdayByTZ(prevDay)) return { dayUtcMs: prevDay, segment: 'post' };
        return { dayUtcMs: prevDay, segment: null };
    }

    function getNextSlot(dayUtcMs, seg) {
        const isThu = isThursdayByTZ(dayUtcMs);

        if (isThu) {
            if (seg === 'pre') return { dayUtcMs, segment: 'post' };
            if (seg === 'post') {
                const nextDay = addDaysUtcMs(dayUtcMs, +1);
                return { dayUtcMs: nextDay, segment: normalizeSegmentForDay(nextDay, null) };
            }
            // auto на чт трактуем как pre
            return { dayUtcMs, segment: 'post' };
        }

        const nextDay = addDaysUtcMs(dayUtcMs, +1);
        if (isThursdayByTZ(nextDay)) return { dayUtcMs: nextDay, segment: 'pre' };
        return { dayUtcMs: nextDay, segment: null };
    }

    async function renderTasksForSelectedDay() {
        const listEl = ensureTasksListEl();
        if (!listEl) return;

        const json = await getApiInfoCached();
        const all = getQuestsArrayFromInfo(json);

        const todayUtc = getTodayUtcMsByTZ();
        const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);
        const isThu = isThursdayByTZ(selectedDayUtcMs);

        // выбираем “контрольную точку” для списка активных квестов
        let unixPoint;

        if (isToday && selectedSegment === 'auto') {
            unixPoint = getNowUnix(); // сегодня = сейчас
        } else if (isThu && selectedSegment === 'pre') {
            unixPoint = getUnixForDayAtHour(selectedDayUtcMs, THU_PRE_HOUR); // четверг до 09
        } else if (isThu && selectedSegment === 'post') {
            unixPoint = getUnixForDayAtHour(selectedDayUtcMs, DEFAULT_HOUR); // четверг после
        } else {
            unixPoint = getUnixForDayAtHour(selectedDayUtcMs, DEFAULT_HOUR); // обычный день
        }

        const active = all.filter(q => isQuestActiveAtUnix(q, unixPoint));

        active.sort((a, b) => {
            const da = getRewardAmount(a);
            const db = getRewardAmount(b);
            if (da !== db) return da - db;
            return Number(a?.id || 0) - Number(b?.id || 0);
        });

        listEl.innerHTML = '';

        for (const q of active) {
            const officialId = Number(q.id);
            const meta = QUEST_META_BY_OFFICIAL_ID?.[officialId] || QUEST_META_BY_OFFICIAL_ID?.[String(officialId)];
            if (!meta?.codexId) continue;

            const codexId = Number(meta.codexId);
            const short = (meta.short || '').trim();
            const amount = getRewardAmount(q);

            const doneInSlot = isDoneInSelectedSlot(q, selectedDayUtcMs, selectedSegment);

            const card = makeTaskCard({
                q,
                amount,
                codexId,
                officialId,
                short,
                isDone: doneInSlot,
                showLastDone: doneInSlot, // показываем “последнее выполнение” только если попало в выбранный день/сегмент
            });

            listEl.appendChild(card);
        }
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
      .${DONE_CLASS} {
        opacity: 0.6;
      }

/* done-блок: прибит к верх-право, внутри тоже верх-право */

.tasks__item-done {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 6px;

  /* чтобы не мешал кликам по карточке */
  pointer-events: none;
}

/* время */
.tm-done-time {
  font-size: 12px;
  line-height: 1.2;
  opacity: 0.9;
}

/* галочка-псевдоэлемент */
.tasks__item-done::after {
  content: "✔";
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  color: #3cb45a;
}

      .tm-links-row {
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        opacity: 0.95;
      }

      .tm-short {
        font-size: 12px;
        line-height: 1.25;
        opacity: 0.85;
      }

      .tm-icons {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .tm-icon-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        background: rgba(255,255,255,0.06);
        transition: transform 120ms ease, opacity 120ms ease;
      }

      .tm-icon-link:hover {
        transform: translateY(-1px);
        opacity: 1;
      }

      .tm-icon-link img {
        width: 30px;
        display: block;
      }

      .tm-date-nav {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      @media (max-width: 1300px) {
        .tm-date-nav {
          padding: 0 20px;
        }
      }

      .tm-date-btn {
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.06);
        color: inherit;
        font: inherit;
      }

      .tm-date-btn:hover {
        background: rgba(255,255,255,0.10);
      }

      .tm-date-label {
        min-width: 250px;
        text-align: center;
        opacity: 0.95;
      }

      .tasks__header {
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 16px;
      }

      .tm-date-btn:disabled {
        opacity: 0.35;
        cursor: default;
      }
    `;
        document.head.appendChild(style);
    }

    async function init() {
        injectStyles();
        await resolveVekselUrl();

        // 1) сначала получаем api/info, чтобы зафиксировать NOW_MS (серверное время)
        try {
            await getApiInfoCached();
        } catch (e) {
            console.warn(e);
            return; // без времени не продолжаем
        }

        // 2) теперь можно безопасно вычислять "сегодня"
        if (!selectedDayUtcMs) selectedDayUtcMs = getTodayUtcMsByTZ();

        ensureDateNavInHeader();
        updateDateNavLabel();
        updateDateNavButtons();

        try {
            await computeDateBoundsFromApiInfo();
        } catch (e) {
            console.warn('[AA Marathon] computeDateBoundsFromApiInfo failed:', e);
        }

        try {
            await renderTasksForSelectedDay();
        } catch (e) {
            console.warn('[AA Marathon] renderTasksForSelectedDay failed:', e);
        }
    }

    const observer = new MutationObserver(() => {
        if (document.querySelector('.section.tasks')) {
            observer.disconnect();
            init();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
