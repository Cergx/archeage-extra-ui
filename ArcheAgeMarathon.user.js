// ==UserScript==
// @name         ArcheAge Marathon – today completed tasks UI fix (MSK)
// @namespace    https://archeage.ru/
// @version      0.9
// @description  Подсветка выполненных сегодня заданий + иконки + done-блок + возврат истории на 1 страницу
// @match        https://archeage.ru/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    const DONE_CLASS = 'tm-task-completed';
    const TZ = 'Europe/Moscow';

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    let TITLE_TO_SHORT = null;

    const CODEX_BASE = 'https://archeagecodex.com/ru/quest/';
    const ICON_QUEST = 'https://archeagecodex.com/images/icon_quest_common.png';
    const ICON_VEKSEL = 'https://archeagecodex.com/items/icon_item_3493.png';

    const VEKSEL_URL = 'https://gisaa.ru/veksel/';

// officialId, для которых нужна доп. ссылка на таблицу векселей
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

    let VEkselUrlResolved = VEKSEL_BASE; // будет конкретный /veksel/<id> или базовый /veksel/

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

        // сервер — это последний span внутри li
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

        // частоты + порядок появления
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
                console.log('[AA Marathon] Main server: (none), using base:', VEkselUrlResolved);
                return VEkselUrlResolved;
            }

            const vekselId = SERVER_TO_VEKSEL_ID[mainServer];
            VEkselUrlResolved = vekselId ? `${VEKSEL_BASE}${vekselId}` : VEKSEL_BASE;

            console.log('[AA Marathon] Main server:', mainServer, '=>', VEkselUrlResolved);
            return VEkselUrlResolved;
        } catch (e) {
            VEkselUrlResolved = VEKSEL_BASE;
            console.warn('[AA Marathon] Failed to resolve main server, using base:', VEkselUrlResolved, e);
            return VEkselUrlResolved;
        }
    }

// будет заполняться автоматически: key(title) -> officialId
    let TITLE_TO_OFFICIAL_ID = null;

// твоя готовая мапа officialId -> codexId (вставь сюда полностью)
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
            "short": ""
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
            "short": ""
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
            "short": ""
        },
        "8320": {
            "codexId": 9152,
            "short": ""
        },
        "8322": {
            "codexId": 8435,
            "short": ""
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
            "short": ""
        },
        "8340": {
            "codexId": 8000060,
            "short": ""
        },
        "8346": {
            "codexId": 10056,
            "short": ""
        },
        "8348": {
            "codexId": 11154,
            "short": ""
        },
        "8350": {
            "codexId": 11227,
            "short": ""
        },
        "8352": {
            "codexId": 9147,
            "short": ""
        },
        "8354": {
            "codexId": 8000136,
            "short": ""
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
            "short": ""
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
            "short": ""
        },
        "8382": {
            "codexId": 10735,
            "short": ""
        },
        "8388": {
            "codexId": 9153,
            "short": ""
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
            "short": ""
        },
        "8398": {
            "codexId": 9398,
            "short": ""
        },
        "8400": {
            "codexId": 7152,
            "short": ""
        },
        "8402": {
            "codexId": 9102,
            "short": ""
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
            "short": ""
        },
        "8426": {
            "codexId": 9143,
            "short": ""
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
            "short": ""
        },
        "8448": {
            "codexId": 2943,
            "short": ""
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
            "short": ""
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
            "short": ""
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


// будет заполняться автоматически
    let TITLE_TO_CODEX = null;

    function normalizeTitle(s) {
        return (s ?? '')
            .toString()
            .toLowerCase()
            .replace(/\*\*/g, '')
            .replace(/[«»"“”]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function extractQuotedTitle(text) {
        const m = (text ?? '').match(/«(.+?)»/);
        return m ? m[1].trim() : null;
    }

    async function buildTitleToCodexMapFromApiInfo() {
        const res = await fetch('/minigames/marathon_of_heroes/api/info', {
            credentials: 'include',
            cache: 'no-store',
        });
        if (!res.ok) throw new Error(`api/info failed: ${res.status} ${res.statusText}`);

        const json = await res.json();
        const quests = json?.data?.quests;
        if (!quests || typeof quests !== 'object') throw new Error('api/info: json.data.quests not found');

        const mapCodex = {};
        const mapOfficial = {};
        const mapShort = {};

        for (const q of Object.values(quests)) {
            if (!q || typeof q.id !== 'number') continue;

            const meta = QUEST_META_BY_OFFICIAL_ID[q.id];
            if (!meta?.codexId) continue;

            const codexId = meta.codexId;
            const short = (meta.short || '').trim();

            const keys = [
                extractQuotedTitle(q.description),
                extractQuotedTitle(q.title),
                q.title,
            ]
                .filter(Boolean)
                .map(normalizeTitle);

            for (const k of keys) {
                if (!mapCodex[k]) mapCodex[k] = codexId;
                if (!mapOfficial[k]) mapOfficial[k] = q.id;
                if (short && !mapShort[k]) mapShort[k] = short;
            }
        }

        return { titleToCodex: mapCodex, titleToOfficial: mapOfficial, titleToShort: mapShort };
    }


    function resolveKeyFromTaskText(rawText) {
        const text = (rawText ?? '').toString();

        // 1) если есть «…» — используем как раньше
        const quoted = extractQuotedTitle(text);
        if (quoted) {
            const k = normalizeTitle(quoted);
            if (TITLE_TO_CODEX?.[k]) return k;
        }

        // 2) пробуем вытащить “название” из типовых формулировок
        // Примеры:
        // - "Выполнить лицензию на убийство: Иштар (....)"
        // - "Выполнить задание Темница Дауты (....)"  (если вдруг без кавычек)
        let m = text.match(/Выполнить\s+лицензию\s+на\s+убийство:\s*([^(.\n]+)/i);
        if (m?.[1]) {
            const candidate = `Лицензия на убийство: ${m[1].trim()}`;
            const k = normalizeTitle(candidate);
            if (TITLE_TO_CODEX?.[k]) return k;

            // иногда в api/title может быть только имя (редко, но пусть будет)
            const k2 = normalizeTitle(m[1].trim());
            if (TITLE_TO_CODEX?.[k2]) return k2;
        }

        m = text.match(/Выполнить\s+задание\s+([^(.\n]+)/i);
        if (m?.[1]) {
            const k = normalizeTitle(m[1].trim());
            if (TITLE_TO_CODEX?.[k]) return k;
        }

        // 3) последний шанс: contains-match по всем ключам
        // (работает для случаев, когда в тексте есть точное название, но окружено описанием)
        const hay = normalizeTitle(text);
        const keys = TITLE_TO_CODEX ? Object.keys(TITLE_TO_CODEX) : [];
        for (const k of keys) {
            if (k && hay.includes(k)) return k;
        }

        return null;
    }

    function ensureLinksRow(afterTextEl) {
        let row = afterTextEl.parentElement?.querySelector(':scope > .tm-links-row');
        if (row) return row;

        row = document.createElement('div');
        row.className = 'tm-links-row';

        const icons = document.createElement('div');
        icons.className = 'tm-icons';
        row.appendChild(icons);

        afterTextEl.insertAdjacentElement('afterend', row);
        return row;
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

    function linkifyTaskText(taskEl) {
        const textEl = taskEl.querySelector('.tasks__item-text');
        if (!textEl) return;

        // чтобы не дублировать (проверяем наличие нашей строки ссылок)
        const existingRow = taskEl.querySelector(':scope > .tm-links-row');
        if (existingRow) return;

        const key = resolveKeyFromTaskText(textEl.textContent);
        if (!key) return;

        const codexId = TITLE_TO_CODEX?.[key];
        if (!codexId) return;

        const officialId = TITLE_TO_OFFICIAL_ID?.[key];

        const row = ensureLinksRow(textEl);
        const short = TITLE_TO_SHORT?.[key];
        if (short && !row.querySelector('.tm-short')) {
            const d = document.createElement('div');
            d.className = 'tm-short';
            d.textContent = short;
            row.insertBefore(d, row.querySelector('.tm-icons'));
        }

        const icons = row.querySelector('.tm-icons');

// квест
        icons.appendChild(makeIconLink({
            href: `${CODEX_BASE}${codexId}/`,
            iconSrc: ICON_QUEST,
            title: 'Открыть задание в ArcheageCodex',
            className: 'tm-codex-link',
        }));

// векселя
        if (typeof officialId === 'number' && VEKSEL_OFFICIAL_IDS.has(officialId)) {
            icons.appendChild(makeIconLink({
                href: VEkselUrlResolved,
                iconSrc: ICON_VEKSEL,
                title: 'Открыть таблицу векселей',
                className: 'tm-veksel-link',
            }));
        }
    }


    function linkifyAllTasksInList() {
        document
            .querySelectorAll('.section.tasks .tasks__item')
            .forEach(task => linkifyTaskText(task));
    }

    /* ================= utils ================= */

    function getTodayMSK() {
        return new Intl.DateTimeFormat('ru-RU', {
            timeZone: TZ,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date());
    }

    function extractTitle(text) {
        const m = text.match(/«(.+?)»/);
        return m ? m[1].trim().toLowerCase() : null;
    }

    /* ================= styles ================= */

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
      .${DONE_CLASS} {
        opacity: 0.6;
      }

      .${DONE_CLASS}::after {
        content: "✔";
        position: absolute;
        top: 8px;
        right: 12px;
          font-size: 18px;
        font-weight: 700;
        color: #3cb45a;
        pointer-events: none;
      }

  .tm-links-row {
    margin-top: 6px;
    display: flex;
    gap: 8px;
    align-items: center;
    opacity: 0.9;
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
    `;
        document.head.appendChild(style);
    }

    /* ================= history ================= */

    function collectTodayFromPage(today, out) {
        document
            .querySelectorAll('.section.history-events tbody tr')
            .forEach(tr => {
                const date = tr.children[0]?.textContent.trim();
                const text = tr.children[1]?.textContent;

                if (date !== today || !text) return;

                const title = extractTitle(text);
                if (title) out.add(title);
            });
    }

    async function collectTodayFromAllPages() {
        const today = getTodayMSK();
        const completed = new Set();

        const pagination = document.querySelector('.section.history-events .pagination');

        if (!pagination) {
            collectTodayFromPage(today, completed);
            return completed;
        }

        const pages = [...pagination.querySelectorAll('.pagination__item')]
            .filter(li =>
                !li.classList.contains('pagination__item--prev') &&
                !li.classList.contains('pagination__item--next')
            );

        // На всякий случай: гарантируем старт с 1 страницы
        // (если вдруг пользователь был на 3-й)
        if (pages[0] && !pages[0].classList.contains('active')) {
            pages[0].click();
            await sleep(450);
        }

        for (const page of pages) {
            // не кликаем повторно по активной — меньше лишних перерисовок
            if (!page.classList.contains('active')) {
                page.click();
                await sleep(450);
            }
            collectTodayFromPage(today, completed);
        }

        // ===== ДОБАВЛЕНО: вернуть историю на 1 страницу =====
        if (pages[0] && !pages[0].classList.contains('active')) {
            pages[0].click();
            await sleep(450);
        }
        // ===================================================

        return completed;
    }

    /* ================= tasks ================= */

    function insertDoneBlock(task) {
        if (task.querySelector('.tasks__item-done')) return;

        const reward = task.querySelector('.tasks__item-reward');
        if (!reward) return;

        const done = document.createElement('div');
        done.className = 'tasks__item-done';

        reward.before(done);
    }

    function replaceRewardIcons(task) {
        task.querySelectorAll('.icon-point--not-received')
            .forEach(icon => {
                icon.classList.remove('icon-point--not-received');
                icon.classList.add('icon-point--received');
            });
    }

    function markTaskAsDone(task) {
        task.classList.add(DONE_CLASS);
        insertDoneBlock(task);
        replaceRewardIcons(task);
    }

    function highlightTasks(completedTitles) {
        document
            .querySelectorAll('.section.tasks .tasks__item')
            .forEach(task => {
                const textEl = task.querySelector('.tasks__item-text');
                if (!textEl) return;

                const title = extractTitle(textEl.textContent);
                if (title && completedTitles.has(title)) {
                    markTaskAsDone(task);
                }
            });
    }

    /* ================= init ================= */

    async function init() {
        injectStyles();

        // 0) вычисляем ссылку на векселя по главному серверу
        await resolveVekselUrl();

        // 1) строим мапу для ссылок на codex
        try {
            const built = await buildTitleToCodexMapFromApiInfo();
            TITLE_TO_CODEX = built.titleToCodex;
            TITLE_TO_OFFICIAL_ID = built.titleToOfficial;
            TITLE_TO_SHORT = built.titleToShort;

            console.log('[AA Marathon] TITLE_TO_CODEX size:', Object.keys(TITLE_TO_CODEX).length);
        } catch (e) {
            console.warn('[AA Marathon] Failed to build TITLE_TO_CODEX:', e);
            TITLE_TO_CODEX = {};
            TITLE_TO_OFFICIAL_ID = {};
            TITLE_TO_SHORT = {};
        }

        await resolveVekselUrl();

        // 2) линковка ВСЕХ заданий (вне зависимости от выполненности)
        linkifyAllTasksInList();

        // 3) подсветка “выполнено сегодня” как и было
        const completedToday = await collectTodayFromAllPages();
        highlightTasks(completedToday);

        console.log('[AA Marathon]', 'completed today (MSK):', [...completedToday]);
    }


    const observer = new MutationObserver(() => {
        if (
            document.querySelector('.section.tasks') &&
            document.querySelector('.section.history-events')
        ) {
            observer.disconnect();
            init();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
