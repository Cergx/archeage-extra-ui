// ==UserScript==
// @name         ArcheAgeExtraUI
// @namespace    https://archeage.ru/
// @version      4.10.0
// @description  Доработка страниц марафона, корзины и восстановления предметов
// @author       Cergx
// @match        *://archeage.ru/*
// @match        *://gisaa.ru/veksel/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=archeage.ru
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==
(() => {
  let __defProp = Object.defineProperty;
  let __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src/utils.js
  let pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  let pageDocument = pageWindow.document || document;
  let GISAA_VEKSEL_INFO_KEY = "tm_aa_gisaa_veksel_info_v1";
  let GISAA_VEKSEL_TABLE_KEY = "tm_aa_gisaa_veksel_table_v1";
  let TZ = "Europe/Moscow";
  let MSK_OFFSET_HOURS = 3;
  let NOW_MS = null;
  let SERVER_TIME_OFFSET = null;
  let setNowMs = /* @__PURE__ */ __name((value) => {
    NOW_MS = value;
  }, "setNowMs");
  let setServerTimeOffset = /* @__PURE__ */ __name((value) => {
    SERVER_TIME_OFFSET = value;
  }, "setServerTimeOffset");
  let getMskDateKey = /* @__PURE__ */ __name(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(/* @__PURE__ */ new Date());
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }, "getMskDateKey");
  let readSharedJson = /* @__PURE__ */ __name((key, fallback) => {
    try {
      if (typeof GM_getValue === "function") {
        const value = GM_getValue(key);
        return value ? JSON.parse(value) : fallback;
      }
    } catch {
    }
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }, "readSharedJson");
  let writeSharedJson = /* @__PURE__ */ __name((key, value) => {
    const json = JSON.stringify(value);
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(key, json);
        return;
      }
    } catch {
    }
    try {
      localStorage.setItem(key, json);
    } catch {
    }
  }, "writeSharedJson");
  let normalizeGisaaPart = /* @__PURE__ */ __name((value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " "), "normalizeGisaaPart");
  let makeGisaaVekselKey = /* @__PURE__ */ __name(({ type, resourceName, amount, iconType, locations }) => {
    if (type === "blue_salt") {
      return `blue_salt|${normalizeGisaaPart(resourceName)}|${Number(amount || 0)}`;
    }
    const locKey = (locations || []).map(normalizeGisaaPart).filter(Boolean).sort().join(",");
    return `north|${Number(amount || 0)}|${normalizeGisaaPart(iconType)}|${locKey}`;
  }, "makeGisaaVekselKey");
  let saveGisaaVekselInfo = /* @__PURE__ */ __name((key, info) => {
    if (!key || !info) return;
    const all = readSharedJson(GISAA_VEKSEL_INFO_KEY, {});
    all[key] = {
      ...info,
      date: getMskDateKey(),
      updatedAt: Date.now()
    };
    writeSharedJson(GISAA_VEKSEL_INFO_KEY, all);
  }, "saveGisaaVekselInfo");
  let getSavedGisaaVekselInfo = /* @__PURE__ */ __name((key) => {
    if (!key) return null;
    const info = readSharedJson(GISAA_VEKSEL_INFO_KEY, {})?.[key];
    if (!info || info.date !== getMskDateKey()) return null;
    if (info.status !== "available" && info.status !== "unavailable") return null;
    return info;
  }, "getSavedGisaaVekselInfo");
  let getSavedGisaaTablesSnapshot = /* @__PURE__ */ __name(() => {
    const snapshot = readSharedJson(GISAA_VEKSEL_TABLE_KEY, null);
    if (!snapshot || snapshot.date !== getMskDateKey()) return null;
    return snapshot;
  }, "getSavedGisaaTablesSnapshot");
  let cleanGisaaText = /* @__PURE__ */ __name((value) => String(value || "").trim().replace(/\s+/g, " "), "cleanGisaaText");
  let parseGisaaMaxCell = /* @__PURE__ */ __name((maxCell) => {
    const text = cleanGisaaText(maxCell?.textContent);
    const amount = parseInt(text, 10);
    const iconType = maxCell?.querySelector(".fa-archive") ? "archive" : maxCell?.querySelector(".fa-sack") ? "sack" : null;
    return {
      text,
      unknown: !text || text.includes("?") || !Number.isFinite(amount),
      amount: Number.isFinite(amount) ? amount : null,
      iconType
    };
  }, "parseGisaaMaxCell");
  let parseGisaaRow = /* @__PURE__ */ __name((row) => {
    const location2 = cleanGisaaText(row.querySelector(".row__cell-name .name.fix_size, .name.fix_size")?.textContent);
    const max = parseGisaaMaxCell(row.querySelector(".row__cell-max"));
    return { location: location2, ...max };
  }, "parseGisaaRow");
  let readGisaaTableRows = /* @__PURE__ */ __name((table) => Array.from(table.querySelectorAll(".row-table")).map(parseGisaaRow).filter((row) => row.location), "readGisaaTableRows");
  let readGisaaTablesSnapshot = /* @__PURE__ */ __name(() => {
    const resources = {};
    for (const blockId of ["#table-block-west", "#table-block-east"]) {
      const block = document.querySelector(blockId);
      if (!block) continue;
      for (const table of block.querySelectorAll("table")) {
        const resourceName = cleanGisaaText(table.querySelector("th.table__name")?.textContent);
        if (!resourceName) continue;
        resources[resourceName] = [
          ...resources[resourceName] || [],
          ...readGisaaTableRows(table)
        ];
      }
    }
    const northBlock = document.querySelector("#table-block-north");
    const north = northBlock ? Array.from(northBlock.querySelectorAll(".row-table")).map(parseGisaaRow).filter((row) => row.location) : [];
    return { resources, north };
  }, "readGisaaTablesSnapshot");
  let saveGisaaTablesSnapshot = /* @__PURE__ */ __name((snapshot) => {
    writeSharedJson(GISAA_VEKSEL_TABLE_KEY, {
      date: getMskDateKey(),
      updatedAt: Date.now(),
      ...snapshot
    });
  }, "saveGisaaTablesSnapshot");
  let isGisaaSite = location.hostname.includes("gisaa.ru");
  let isArcheageSite = location.hostname.includes("archeage.ru");
  let isCartPage = isArcheageSite && (location.pathname === "/cart" || location.pathname === "/cart/");
  let isItemRestorePage = isArcheageSite && (location.pathname === "/itemrestore" || location.pathname === "/itemrestore/");
  let pad2 = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad2");
  let nowMs = /* @__PURE__ */ __name(() => {
    if (NOW_MS == null) {
      throw new Error("[ArcheAgeExtraUI] NOW_MS is not initialized");
    }
    return NOW_MS;
  }, "nowMs");
  let getNowUnix = /* @__PURE__ */ __name(() => Math.floor(nowMs() / 1e3), "getNowUnix");
  let getMSKDatePartsFromUtcMs = /* @__PURE__ */ __name((utcMs) => {
    const d = new Date(utcMs);
    const fmt = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = fmt.formatToParts(d);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    const m = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    return { y, m, d: day };
  }, "getMSKDatePartsFromUtcMs");
  let formatDMY = /* @__PURE__ */ __name(({ y, m, d }) => `${pad2(d)}.${pad2(m)}.${y}`, "formatDMY");
  let formatTimeMSK = /* @__PURE__ */ __name((unixSec) => {
    if (!unixSec) return "";
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(unixSec * 1e3));
  }, "formatTimeMSK");
  let dayUtcMsFromUnixByTZ = /* @__PURE__ */ __name((unixSec) => {
    const ms = Number(unixSec || 0) * 1e3;
    const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
    return Date.UTC(y, m - 1, d, 0, 0, 0);
  }, "dayUtcMsFromUnixByTZ");
  let getTodayUtcMsByTZ = /* @__PURE__ */ __name(() => {
    const { y, m, d } = getMSKDatePartsFromUtcMs(nowMs());
    return Date.UTC(y, m - 1, d, 0, 0, 0);
  }, "getTodayUtcMsByTZ");
  let addDaysUtcMs = /* @__PURE__ */ __name((dayUtcMs, deltaDays) => dayUtcMs + deltaDays * 864e5, "addDaysUtcMs");
  let getDayBoundsUnix = /* @__PURE__ */ __name((dayUtcMs) => {
    const { y, m, d } = getMSKDatePartsFromUtcMs(dayUtcMs);
    const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - MSK_OFFSET_HOURS * 3600 * 1e3;
    const endMs = startMs + 864e5;
    return { start: Math.floor(startMs / 1e3), end: Math.floor(endMs / 1e3) };
  }, "getDayBoundsUnix");
  let getUnixForDayAtHour = /* @__PURE__ */ __name((dayUtcMs, hourMsk) => {
    const { start } = getDayBoundsUnix(dayUtcMs);
    return start + hourMsk * 3600;
  }, "getUnixForDayAtHour");
  let isSameDayByTZ = /* @__PURE__ */ __name((aUtcMs, bUtcMs) => {
    const a = getMSKDatePartsFromUtcMs(aUtcMs);
    const b = getMSKDatePartsFromUtcMs(bUtcMs);
    return a.y === b.y && a.m === b.m && a.d === b.d;
  }, "isSameDayByTZ");
  let isThursdayByTZ = /* @__PURE__ */ __name((dayUtcMs) => {
    const w = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date(dayUtcMs));
    return w === "Thu";
  }, "isThursdayByTZ");
  let getServerNowMs = /* @__PURE__ */ __name(() => {
    if (SERVER_TIME_OFFSET == null) return Date.now();
    return Date.now() + SERVER_TIME_OFFSET;
  }, "getServerNowMs");
  let initServerTimeOffset = /* @__PURE__ */ __name(() => {
    if (NOW_MS != null && SERVER_TIME_OFFSET == null) {
      SERVER_TIME_OFFSET = NOW_MS - Date.now();
    }
  }, "initServerTimeOffset");
  let syncServerTime = /* @__PURE__ */ __name(async () => {
    if (SERVER_TIME_OFFSET != null) return;
    try {
      const t0 = Date.now();
      const res = await fetch(location.href, { method: "HEAD", credentials: "include", cache: "no-store" });
      const t1 = Date.now();
      const dateHeader = res.headers.get("Date");
      const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
      if (Number.isFinite(parsed)) {
        NOW_MS = parsed + (t1 - t0) / 2;
        SERVER_TIME_OFFSET = NOW_MS - Date.now();
      }
    } catch {
    }
  }, "syncServerTime");
  let getMSKWeekday = /* @__PURE__ */ __name((utcMs) => {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
    const dayStr = fmt.format(new Date(utcMs));
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[dayStr] ?? 1;
  }, "getMSKWeekday");
  let getMSKTimeOfDaySeconds = /* @__PURE__ */ __name((utcMs) => {
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const str = fmt.format(new Date(utcMs));
    const [h, m, s] = str.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  }, "getMSKTimeOfDaySeconds");
  let WEEKDAY_NAMES = { 1: "\u041F\u043D", 2: "\u0412\u0442", 3: "\u0421\u0440", 4: "\u0427\u0442", 5: "\u041F\u0442", 6: "\u0421\u0431", 7: "\u0412\u0441" };
  let parseTime = /* @__PURE__ */ __name((timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return { hours: h, minutes: m };
  }, "parseTime");
  let getSecondsUntilNextEvent = /* @__PURE__ */ __name((events) => {
    if (!events || !events.length) return null;
    const serverNow = getServerNowMs();
    const nowWeekday = getMSKWeekday(serverNow);
    const nowSeconds = getMSKTimeOfDaySeconds(serverNow);
    let minDiff = Infinity;
    for (const event of events) {
      const start = parseTime(event.timeStart);
      const startSeconds = start.hours * 3600 + start.minutes * 60;
      if (event.timeEnd) {
        const end = parseTime(event.timeEnd);
        const endSeconds = end.hours * 3600 + end.minutes * 60;
        const isToday = !event.weekdays || event.weekdays.length === 0 || event.weekdays.includes(nowWeekday);
        if (isToday && nowSeconds >= startSeconds && nowSeconds < endSeconds) {
          return -(endSeconds - nowSeconds);
        }
      }
      if (!event.weekdays || event.weekdays.length === 0) {
        let diff = startSeconds - nowSeconds;
        if (diff <= 0) diff += 24 * 3600;
        if (diff < minDiff) minDiff = diff;
      } else {
        for (const targetWeekday of event.weekdays) {
          let daysUntil = targetWeekday - nowWeekday;
          if (daysUntil < 0) daysUntil += 7;
          let diff = daysUntil * 24 * 3600 + (startSeconds - nowSeconds);
          if (diff <= 0) diff += 7 * 24 * 3600;
          if (diff < minDiff) minDiff = diff;
        }
      }
    }
    return minDiff === Infinity ? null : minDiff;
  }, "getSecondsUntilNextEvent");
  let formatEventTime = /* @__PURE__ */ __name((event) => event.timeEnd ? `${event.timeStart}\u2013${event.timeEnd}` : event.timeStart, "formatEventTime");
  let formatEventsToString = /* @__PURE__ */ __name((events) => {
    if (!events || !events.length) return "";
    const daily = [];
    const withWeekdays = [];
    for (const event of events) {
      if (!event.weekdays || event.weekdays.length === 0) {
        daily.push(formatEventTime(event));
      } else {
        withWeekdays.push(event);
      }
    }
    const parts = [];
    if (daily.length > 0) {
      parts.push(daily.join(" / "));
    }
    for (const event of withWeekdays) {
      const days = event.weekdays.map((d) => WEEKDAY_NAMES[d]).join(", ");
      parts.push(`${days} ${formatEventTime(event)}`);
    }
    return parts.join(" / ");
  }, "formatEventsToString");
  let formatCountdown = /* @__PURE__ */ __name((seconds) => {
    if (seconds == null || seconds < 0) return "";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor(seconds % 86400 / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = seconds % 60;
    if (d > 0) {
      return `${d}\u0434 ${h}\u0447`;
    } else if (h > 0) {
      return `${h}\u0447 ${m}\u043C`;
    } else if (m > 0) {
      return `${m}\u043C ${s}\u0441`;
    } else {
      return `${s}\u0441`;
    }
  }, "formatCountdown");
  let updateCountdownEl = /* @__PURE__ */ __name((el, seconds) => {
    el.classList.remove("tm-countdown--active", "tm-countdown--waiting");
    if (seconds == null) {
      el.textContent = "";
    } else if (seconds <= 0) {
      el.textContent = ` (\u0438\u0434\u0451\u0442, \u0435\u0449\u0451 ${formatCountdown(-seconds)})`;
      el.classList.add("tm-countdown--active");
    } else {
      el.textContent = ` (\u0447\u0435\u0440\u0435\u0437 ${formatCountdown(seconds)})`;
      el.classList.add("tm-countdown--waiting");
    }
  }, "updateCountdownEl");
  let GAME_MIDNIGHT_MSK_SECONDS = 2 * 3600 + 20 * 60;
  let GAME_DAY_REAL_SECONDS = 14400;
  let REAL_TO_GAME_FACTOR = 6;
  let getGameTime = /* @__PURE__ */ __name((serverNowMs) => {
    const d = new Date(serverNowMs);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false
    }).formatToParts(d);
    const h = +parts.find((p) => p.type === "hour").value;
    const m = +parts.find((p) => p.type === "minute").value;
    const s = +parts.find((p) => p.type === "second").value;
    const mskSeconds = h * 3600 + m * 60 + s;
    const realSinceGameMidnight = ((mskSeconds - GAME_MIDNIGHT_MSK_SECONDS) % GAME_DAY_REAL_SECONDS + GAME_DAY_REAL_SECONDS) % GAME_DAY_REAL_SECONDS;
    const gameSeconds = realSinceGameMidnight * REAL_TO_GAME_FACTOR;
    const gh = Math.floor(gameSeconds / 3600) % 24;
    const gm = Math.floor(gameSeconds % 3600 / 60);
    return `${pad2(gh)}:${pad2(gm)}`;
  }, "getGameTime");
  let getTodayWeekdayMonFirst = /* @__PURE__ */ __name(() => {
    return (getMSKWeekday(getServerNowMs()) + 6) % 7;
  }, "getTodayWeekdayMonFirst");
  let formatAvailableWeekdaysStatus = /* @__PURE__ */ __name((weekdays) => {
    if (!weekdays?.length) return "";
    return weekdays.includes(getTodayWeekdayMonFirst()) ? "\u041C\u043E\u0436\u043D\u043E \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0432\u0437\u044F\u0442\u044C" : "\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u043D\u0435\u043B\u044C\u0437\u044F \u0432\u0437\u044F\u0442\u044C";
  }, "formatAvailableWeekdaysStatus");

  // src/gisaa.js
  let GISAA_MATCH_CLASS = "tm-gisaa-match";
  let GISAA_EXCLUDE_CLASS = "tm-gisaa-exclude";
  let GISAA_UNKNOWN_CLASS = "tm-gisaa-unknown";
  let injectGisaaStyles = /* @__PURE__ */ __name(() => {
    const style = document.createElement("style");
    style.textContent = `
        td.${GISAA_MATCH_CLASS} {
            --bs-table-accent-bg: #005f1940;
            background-color: #005f1940 !important;
        }
        td.${GISAA_EXCLUDE_CLASS} {
            --bs-table-accent-bg: #5f000040;
            background-color: #5f000040 !important;
        }
        td.${GISAA_UNKNOWN_CLASS} {
            --bs-table-accent-bg: #5f5f0040;
            background-color: #5f5f0040 !important;
        }
        .btn_vote.${GISAA_EXCLUDE_CLASS} {
            opacity: 0.4;
        }
    `;
    document.head.appendChild(style);
  }, "injectGisaaStyles");
  let highlightWestEastRow = /* @__PURE__ */ __name((resourceName, amount) => {
    const blocks = ["#table-block-west", "#table-block-east"];
    const result = { match: [], exclude: [], unknown: [] };
    for (const blockId of blocks) {
      const block = document.querySelector(blockId);
      if (!block) continue;
      const tables = block.querySelectorAll("table");
      for (const table of tables) {
        const header = table.querySelector("th.table__name");
        if (!header) continue;
        if (header.textContent.trim() !== resourceName) continue;
        const rows = table.querySelectorAll(".row-table");
        for (const row of rows) {
          const maxCell = row.querySelector(".row__cell-max");
          if (!maxCell) continue;
          const parsedRow = parseGisaaRow(row);
          if (!parsedRow.location) continue;
          if (parsedRow.unknown) {
            row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_UNKNOWN_CLASS));
            result.unknown.push(parsedRow.location);
          } else if (parsedRow.amount === amount) {
            row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_MATCH_CLASS));
            result.match.push(parsedRow.location);
          } else {
            row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_EXCLUDE_CLASS));
            result.exclude.push(parsedRow.location);
          }
        }
      }
    }
    return result;
  }, "highlightWestEastRow");
  let highlightNorthRow = /* @__PURE__ */ __name((locations, amount, iconType) => {
    const block = document.querySelector("#table-block-north");
    const result = { match: [], exclude: [], unknown: [] };
    if (!block) return result;
    if (!locations || locations.length === 0) return result;
    const rows = block.querySelectorAll(".row-table");
    for (const row of rows) {
      const nameEl = row.querySelector(".name.fix_size");
      if (!nameEl) continue;
      const rowLocation = nameEl.textContent.trim();
      const locationMatch = locations.some(
        (loc) => rowLocation.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(rowLocation.toLowerCase())
      );
      if (!locationMatch) continue;
      const maxCell = row.querySelector(".row__cell-max");
      if (!maxCell) continue;
      const parsedRow = parseGisaaRow(row);
      const rowLabel = parsedRow.location || rowLocation;
      if (parsedRow.unknown) {
        row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_UNKNOWN_CLASS));
        if (rowLabel) result.unknown.push(rowLabel);
        continue;
      }
      let isFullMatch = false;
      if (parsedRow.iconType === iconType && parsedRow.amount === amount) {
        isFullMatch = true;
      }
      if (isFullMatch) {
        row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_MATCH_CLASS));
        if (rowLabel) result.match.push(rowLabel);
      } else {
        row.querySelectorAll("td").forEach((td) => td.classList.add(GISAA_EXCLUDE_CLASS));
        row.querySelectorAll(".btn_vote").forEach((btn) => btn.classList.add(GISAA_EXCLUDE_CLASS));
        if (rowLabel) result.exclude.push(rowLabel);
      }
    }
    return result;
  }, "highlightNorthRow");
  let saveHighlightResult = /* @__PURE__ */ __name((key, result) => {
    if (!key || !result) return;
    const unique = /* @__PURE__ */ __name((values) => [...new Set((values || []).filter(Boolean))], "unique");
    const matches = unique(result.match);
    const unknown = unique(result.unknown);
    const excludes = unique(result.exclude);
    let status = "unknown";
    if (matches.length) {
      status = "available";
    } else if (!unknown.length && excludes.length) {
      status = "unavailable";
    }
    saveGisaaVekselInfo(key, {
      status,
      locations: matches,
      unknownLocations: unknown,
      excludedLocations: excludes
    });
  }, "saveHighlightResult");
  let applyHighlightsFromUrl = /* @__PURE__ */ __name(({ scrollNorth = true } = {}) => {
    const snapshot = readGisaaTablesSnapshot();
    saveGisaaTablesSnapshot(snapshot);
    const params = new URLSearchParams(location.search);
    const res = params.get("res");
    const amount = parseInt(params.get("amount"), 10);
    if (res && amount) {
      const result = highlightWestEastRow(res, amount);
      saveHighlightResult(
        makeGisaaVekselKey({ type: "blue_salt", resourceName: res, amount }),
        result
      );
    }
    const locParam = params.get("loc");
    const icon = params.get("icon");
    if (locParam && amount && icon) {
      const locations = locParam.split(",").map((s) => s.trim()).filter(Boolean);
      const result = highlightNorthRow(locations, amount, icon);
      saveHighlightResult(
        makeGisaaVekselKey({ type: "north", amount, iconType: icon, locations }),
        result
      );
      const northBlock = document.querySelector("#table-block-north");
      if (scrollNorth && northBlock) {
        northBlock.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, "applyHighlightsFromUrl");
  let startGisaaResultSync = /* @__PURE__ */ __name(() => {
    setInterval(() => applyHighlightsFromUrl({ scrollNorth: false }), 5e3);
  }, "startGisaaResultSync");
  function initGisaa() {
    injectGisaaStyles();
    setTimeout(applyHighlightsFromUrl, 500);
    setTimeout(startGisaaResultSync, 1500);
  }
  __name(initGisaa, "initGisaa");

  // src/data/events.js
  let EVENTS = [
    { code: "ifnir", title: "\u041E\u0431\u043E\u0440\u043E\u043D\u0430 \u0418\u0444\u043D\u0438\u0440\u0430", defaultVisible: true, defaultNotifications: true, schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }], locations: ["\u0418\u0444\u043D\u0438\u0440"], quests: [{ id: 10569, title: "\u041E\u0431\u043E\u0440\u043E\u043D\u0430 \u0418\u0444\u043D\u0438\u0440\u0430" }, { id: 10564, title: "\u041E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u043D\u044B\u0435 \u0443\u0437\u043D\u0438\u0446\u044B \u041D\u0430\u0433\u0430\u0448\u0430\u0440\u0430" }] },
    { code: "lug_guardians", title: "\u041B\u0443\u0433 - \u0411\u0438\u0442\u0432\u0430 \u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u0435\u0439", defaultVisible: true, defaultNotifications: true, schedule: [{ timeStart: "18:00", weekdays: [6, 7] }], locations: ["\u0412\u0435\u043B\u0438\u043A\u0438\u0439 \u043B\u0443\u0433"], quests: [{ id: 11132, title: "\u0411\u0438\u0442\u0432\u0430 \u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u0435\u0439" }, { id: 11096, title: "\u0422\u0443\u0440\u043D\u0438\u0440 \u0432 \u0447\u0435\u0441\u0442\u044C \u041E\u0442\u0446\u0430-\u0421\u043E\u043B\u043D\u0446\u0430" }] },
    { code: "storm_eye", title: "\u041E\u043A\u043E \u0431\u0443\u0440\u0438", schedule: [{ timeStart: "21:00", timeEnd: "22:00", weekdays: [2, 4, 6] }], locations: ["\u0410\u0440\u0445\u0438\u043F\u0435\u043B\u0430\u0433 \u043F\u043E\u0433\u0438\u0431\u0448\u0438\u0445 \u043A\u043E\u0440\u0430\u0431\u043B\u0435\u0439"], quests: [{ id: 6791, title: "\u0411\u0438\u0442\u0432\u0430 \u043D\u0430 \u041E\u043A\u0435 \u0431\u0443\u0440\u0438" }] },
    { code: "storm_eye_sea", title: "\u0413\u0440\u043E\u0437\u0430 \u043D\u0430\u0434 \u043C\u043E\u0440\u0435\u043C", schedule: [{ timeStart: "14:00", timeEnd: "15:00" }, { timeStart: "22:00", timeEnd: "23:00" }], locations: ["\u0410\u0440\u0445\u0438\u043F\u0435\u043B\u0430\u0433 \u043F\u043E\u0433\u0438\u0431\u0448\u0438\u0445 \u043A\u043E\u0440\u0430\u0431\u043B\u0435\u0439"], quests: [{ id: 5765, title: "\u0413\u0440\u043E\u0437\u0430 \u043D\u0430\u0434 \u043C\u043E\u0440\u0435\u043C" }] },
    { code: "carrion", title: "\u041F\u0430\u0434\u0430\u043B\u044C", defaultVisible: true, schedule: [{ timeStart: "10:00" }, { timeStart: "22:00" }] },
    { code: "siege", title: "\u041E\u0441\u0430\u0434\u0430", schedule: [{ timeStart: "21:00", timeEnd: "22:00", weekdays: [3] }] },
    { code: "rift_blood_antallon", title: "\u041A\u0440\u043E\u0432\u0430\u0432\u044B\u0439 (\u0434\u043D\u0435\u0432\u043D\u043E\u0439) \u0440\u0430\u0437\u043B\u043E\u043C - \u0410\u043D\u0442\u0430\u043B\u043B\u043E\u043D/\u042D\u043D\u0448\u0430\u043A\u0430", defaultVisible: true, schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }], locations: ["\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0435 \u043F\u043E\u043B\u044F"], quests: [{ id: 5885, title: "\u0421\u043E\u0432\u0435\u0442\u043D\u0438\u043A \u041A\u0438\u0440\u0438\u043E\u0441\u0430" }] },
    { code: "rift_blood_garron", title: "\u041A\u0440\u043E\u0432\u0430\u0432\u044B\u0439 (\u0434\u043D\u0435\u0432\u043D\u043E\u0439) \u0440\u0430\u0437\u043B\u043E\u043C - \u0413\u0438\u0433\u0430\u043D\u0442\u0441\u043A\u0438\u0439 \u0433\u0430\u0440\u0440\u043E\u043D", defaultVisible: true, schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }], locations: ["\u0418\u043D\u0438\u0441\u0442\u0440\u0430", "\u041F\u043E\u043B\u0443\u043E\u0441\u0442\u0440\u043E\u0432 \u041F\u0430\u0434\u0430\u044E\u0449\u0438\u0445 \u0417\u0432\u0435\u0437\u0434"], quests: [{ id: 2943, title: "\u042D\u043B\u0438\u0442\u043D\u044B\u0435 \u0432\u043E\u0439\u0441\u043A\u0430 \u041A\u0440\u043E\u0432\u0430\u0432\u043E\u0439 \u0430\u0440\u043C\u0438\u0438" }] },
    { code: "rift_ghost", title: "\u041F\u0440\u0438\u0437\u0440\u0430\u0447\u043D\u044B\u0439 (\u043D\u043E\u0447\u043D\u043E\u0439) \u0440\u0430\u0437\u043B\u043E\u043C - \u041F\u0440\u0438\u0437\u0440\u0430\u043A \u042D\u043D\u0448\u0430\u043A\u0438", defaultVisible: true, schedule: [{ timeStart: "02:20", duration: 15 }, { timeStart: "06:20", duration: 15 }, { timeStart: "10:20", duration: 15 }, { timeStart: "14:20", duration: 15 }, { timeStart: "18:20", duration: 15 }, { timeStart: "22:20", duration: 15 }], locations: ["\u0418\u043D\u0438\u0441\u0442\u0440\u0430", "\u041F\u043E\u043B\u0443\u043E\u0441\u0442\u0440\u043E\u0432 \u041F\u0430\u0434\u0430\u044E\u0449\u0438\u0445 \u0417\u0432\u0435\u0437\u0434"], quests: [{ id: 5144, title: "\u0420\u0430\u0437\u0433\u0440\u043E\u043C \u043F\u0440\u0438\u0437\u0440\u0430\u0447\u043D\u043E\u0433\u043E \u043B\u0435\u0433\u0438\u043E\u043D\u0430" }] },
    { code: "rift_phantom", title: "\u0424\u0430\u043D\u0442\u043E\u043C\u044B (\u043B\u0438\u043B\u043E\u0432\u044B\u0439 \u0440\u0430\u0437\u043B\u043E\u043C)", schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }], locations: ["\u0421\u043E\u043A\u0440\u044B\u0442\u0430\u044F \u0434\u043E\u043B\u0438\u043D\u0430", "\u0418\u0440\u0430\u043C\u0438\u0439\u0441\u043A\u0438\u0439 \u0445\u0440\u0435\u0431\u0435\u0442"], quests: [{ id: 11154, title: "\u0411\u043E\u0439 \u0441 \u0442\u0435\u043D\u044C\u044E" }] },
    /* Инстансы - Рейды */
    { code: "dragon_lair", title: "\u041B\u043E\u0433\u043E\u0432\u043E \u0434\u0440\u0430\u043A\u043E\u043D\u0430", defaultVisible: true, schedule: [{ timeStart: "13:20", timeEnd: "14:00" }, { timeStart: "18:20", timeEnd: "19:00" }, { timeStart: "21:20", timeEnd: "22:00" }], locations: ["\u0418\u043D\u0441\u0442\u0430\u043D\u0441\u044B - \u0420\u0435\u0439\u0434\u044B"] },
    { code: "gardum", title: "\u0413\u0430\u0440\u0434\u0443\u043C (\u0423\u0449\u0435\u043B\u044C\u0435 \u043A\u0440\u043E\u0432\u0430\u0432\u043E\u0439 \u0440\u043E\u0441\u044B)", defaultVisible: true, schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }], locations: ["\u0418\u043D\u0441\u0442\u0430\u043D\u0441\u044B - \u0420\u0435\u0439\u0434\u044B"], quests: [{ id: 7935, title: "\u0425\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u044C \u0417\u0432\u0435\u043D\u044F\u0449\u0435\u0433\u043E \u0443\u0449\u0435\u043B\u044C\u044F" }] },
    { code: "iramkand", title: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0434\u0435\u043D\u044C \u0418\u0440\u0430\u043C\u043A\u0430\u043D\u0434\u0430", schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }], locations: ["\u0418\u043D\u0441\u0442\u0430\u043D\u0441\u044B - \u0420\u0435\u0439\u0434\u044B"], quests: [{ id: 9205, title: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0434\u0435\u043D\u044C \u0418\u0440\u0430\u043C\u043A\u0430\u043D\u0434\u0430" }] },
    /* Инстансы - Фракции */
    { code: "daskshir", title: "\u0411\u0438\u0442\u0432\u0430 \u0437\u0430 \u0414\u0430\u0441\u043A\u0448\u0438\u0440", defaultVisible: true, schedule: [{ timeStart: "16:00", timeEnd: "17:00", weekdays: [2, 4, 6] }, { timeStart: "22:30", timeEnd: "23:59", weekdays: [2, 4, 6] }, { timeStart: "19:00", timeEnd: "20:00", weekdays: [1, 3, 5, 7] }], locations: ["\u0418\u043D\u0441\u0442\u0430\u043D\u0441\u044B - \u0424\u0440\u0430\u043A\u0446\u0438\u0438"] },
    { code: "gorge_battle", title: "\u0411\u0438\u0442\u0432\u0430 \u0432 \u0423\u0449\u0435\u043B\u044C\u0435 \u043A\u0440\u043E\u0432\u0430\u0432\u043E\u0439 \u0440\u043E\u0441\u044B", schedule: [{ timeStart: "15:15", timeEnd: "16:00" }, { timeStart: "18:00", timeEnd: "19:00" }, { timeStart: "21:45", timeEnd: "22:30" }], locations: ["\u0418\u043D\u0441\u0442\u0430\u043D\u0441\u044B - \u0424\u0440\u0430\u043A\u0446\u0438\u0438"] },
    { code: "enchanted_ponds", title: "\u0411\u0438\u0442\u0432\u0430 \u0437\u0430 \u0417\u0430\u0447\u0430\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u0443\u0434\u044B", defaultVisible: true, schedule: [{ timeStart: "14:30", timeEnd: "15:15" }, { timeStart: "17:00", timeEnd: "18:00" }, { timeStart: "21:00", timeEnd: "21:45" }], locations: ["\u0418\u043D\u0441\u0442\u0430\u043D\u0441\u044B - \u0424\u0440\u0430\u043A\u0446\u0438\u0438"] },
    /* Мировые боссы */
    { code: "kraken", title: "\u041A\u0440\u0430\u043A\u0435\u043D", schedule: [{ timeStart: "19:30", weekdays: [1, 4, 6] }], locations: ["\u0411\u0435\u0437\u043C\u044F\u0442\u0435\u0436\u043D\u043E\u0435 \u043C\u043E\u0440\u0435"] },
    { code: "kalidis", title: "\u041A\u0430\u043B\u0438\u0434\u0438\u0441", schedule: [{ timeStart: "20:30", weekdays: [1, 5, 6] }], locations: ["\u0422\u0443\u043C\u0430\u043D\u043D\u044B\u0439 \u043F\u0440\u043E\u043B\u0438\u0432"] },
    { code: "leviathan", title: "\u041B\u0435\u0432\u0438\u0430\u0444\u0430\u043D", schedule: [{ timeStart: "20:30", weekdays: [2, 4, 7] }], locations: ["\u0411\u0435\u0437\u043C\u044F\u0442\u0435\u0436\u043D\u043E\u0435 \u043C\u043E\u0440\u0435"] },
    { code: "dolphin", title: "\u041B\u0435\u0442\u0443\u0447\u0438\u0439 \u0434\u0435\u043B\u044C\u0444\u0438\u0435\u0446", schedule: [{ timeStart: "21:00", weekdays: [1, 3, 5, 7] }], locations: ["\u0417\u043E\u043B\u043E\u0442\u043E\u0435 \u043C\u043E\u0440\u0435"] },
    { code: "ashyara_glenn_loreya", title: "\u0410\u0448\u044C\u044F\u0440\u0430/\u0413\u043B\u0435\u043D\u043D/\u041B\u043E\u0440\u0435\u044F", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }], locations: ["\u0411\u0435\u0437\u0434\u043D\u0430", "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0435 \u043F\u043E\u043B\u044F"], quests: [{ id: 5971, title: "\u0427\u0435\u0448\u0443\u044F \u0410\u0448\u044C\u044F\u0440\u044B" }, { id: 5970, title: "\u041A\u043E\u043B\u044C\u0446\u043E \u043A\u0430\u043F\u0438\u0442\u0430\u043D\u0430 \u0413\u043B\u0435\u043D\u043D\u0430" }, { id: 5969, title: "\u041A\u043E\u043B\u044C\u0446\u043E \u041B\u043E\u0440\u0435\u0438" }] },
    { code: "xanatos", title: "\u041A\u0441\u0430\u043D\u0430\u0442\u043E\u0441", schedule: [{ timeStart: "19:30", weekdays: [2, 5, 7] }], locations: ["\u041A\u043B\u0430\u0434\u0431\u0438\u0449\u0435 \u0434\u0440\u0430\u043A\u043E\u043D\u043E\u0432"] },
    { code: "gardens_bosses", title: "\u042D\u043D\u0448\u0430\u043A\u0430/\u041B\u0435\u0440\u043D\u0435\u044F/\u0422\u0430\u0432\u0440\u043E\u0441/\u041C'\u0433\u0435\u0440", schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }], locations: ["\u0421\u0430\u0434\u044B \u043C\u0430\u0442\u0435\u0440\u0438"], quests: [{ id: 10056, title: "\u0421\u0430\u0434\u043E\u0432\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B" }] },
    { code: "gardens_antallon", title: "\u0410\u043D\u0442\u0430\u043B\u043B\u043E\u043D \u0432 \u0441\u0430\u0434\u0430\u0445", schedule: [{ timeStart: "21:30", weekdays: [1, 5, 7] }], locations: ["\u0421\u0430\u0434\u044B \u043C\u0430\u0442\u0435\u0440\u0438"] },
    { code: "altars", title: "\u0411\u0438\u0442\u0432\u0430 \u0437\u0430 \u0430\u043B\u0442\u0430\u0440\u0438", schedule: [{ timeStart: "16:00", timeEnd: "16:30", weekdays: [1, 3, 4, 5, 6] }, { timeStart: "20:00", timeEnd: "20:30", weekdays: [0, 2, 3, 4, 5] }], locations: ["\u041F\u0435\u043F\u0435\u043B\u044C\u043D\u044B\u0435 \u0440\u0430\u0432\u043D\u0438\u043D\u044B"] },
    { code: "fesanix", title: "\u0424\u0435\u0441\u0430\u043D\u0438\u043A\u0441", schedule: [{ timeStart: "22:30", timeEnd: "23:30", weekdays: [2] }], locations: ["\u041F\u0435\u043F\u0435\u043B\u044C\u043D\u044B\u0435 \u0440\u0430\u0432\u043D\u0438\u043D\u044B"] }
  ];

  // src/components/server-clock.js
  let serverClockEl = null;
  let serverClockStylesInjected = false;
  let loadEventVisibility = /* @__PURE__ */ __name(() => JSON.parse(localStorage.getItem("tm_aa_ev_vis") || "{}"), "loadEventVisibility");
  let isEventVisible = /* @__PURE__ */ __name((ev, vis) => ev.code in vis ? vis[ev.code] : !!ev.defaultVisible, "isEventVisible");
  let injectServerClockStyles = /* @__PURE__ */ __name(() => {
    if (serverClockStylesInjected) return;
    serverClockStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = `
            .tm-server-clock {
                position: fixed;
                top: 50%;
                right: 12px;
                transform: translateY(-50%);
                z-index: 9999;
                padding: 6px 12px;
                border-radius: 6px;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                font-size: 13px;
                font-family: monospace;
                color: rgba(255, 255, 255, 0.85);
                max-width: 150px;
                white-space: nowrap;
                user-select: none;
                line-height: 1.4;
                text-decoration: none;
                display: block;
                cursor: pointer;
            }
            .tm-server-clock-event {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 5px;
            }
        `;
    document.head.appendChild(style);
  }, "injectServerClockStyles");
  let getNextVisibleEventInfo = /* @__PURE__ */ __name(() => {
    const visOverrides = loadEventVisibility();
    let bestActive = null;
    let bestUpcoming = null;
    for (const ev of EVENTS) {
      if (!isEventVisible(ev, visOverrides)) continue;
      const sec = getSecondsUntilNextEvent(ev.schedule);
      if (sec == null) continue;
      if (sec < 0) {
        if (!bestActive || sec > bestActive.secondsUntil) {
          bestActive = { title: ev.title, secondsUntil: sec };
        }
      } else {
        if (!bestUpcoming || sec < bestUpcoming.secondsUntil) {
          bestUpcoming = { title: ev.title, secondsUntil: sec };
        }
      }
    }
    return bestActive || bestUpcoming;
  }, "getNextVisibleEventInfo");
  let updateServerClockContent = /* @__PURE__ */ __name(() => {
    if (!serverClockEl) return;
    const serverNow = getServerNowMs();
    const d = new Date(serverNow);
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const mskTime = fmt.format(d);
    const gameTime = getGameTime(serverNow);
    let eventLine = "";
    const nextEv = getNextVisibleEventInfo();
    if (nextEv) {
      if (nextEv.secondsUntil < 0) {
        eventLine = `<div class="tm-server-clock-event">${nextEv.title}</div><span style="color:#4f8">\u0435\u0449\u0451 ${formatCountdown(-nextEv.secondsUntil)}</span>`;
      } else {
        eventLine = `<div class="tm-server-clock-event">${nextEv.title}</div>\u0447\u0435\u0440\u0435\u0437 ${formatCountdown(nextEv.secondsUntil)}`;
      }
    }
    serverClockEl.innerHTML = `\u043C\u0441\u043A: ${mskTime}<br>\u0438\u0433\u0440\u043E\u0432\u043E\u0435: ${gameTime}${eventLine}`;
  }, "updateServerClockContent");
  let initServerClock = /* @__PURE__ */ __name(async (openEventsPopup2, checkEventNotifications2) => {
    await syncServerTime();
    injectServerClockStyles();
    serverClockEl = document.createElement("div");
    serverClockEl.className = "tm-server-clock";
    serverClockEl.addEventListener("click", openEventsPopup2);
    document.body.appendChild(serverClockEl);
    updateServerClockContent();
    setInterval(updateServerClockContent, 1e3);
    if (checkEventNotifications2) setInterval(checkEventNotifications2, 3e4);
    if (checkEventNotifications2) checkEventNotifications2();
  }, "initServerClock");

  // src/data/servers.js
  let SERVERS = {
    1: "\u041B\u0443\u0446\u0438\u0439",
    2: "\u041A\u0438\u043F\u0440\u043E\u0437\u0430",
    3: "\u041C\u0435\u043B\u0438\u0441\u0430\u0440\u0430",
    24: "\u041D\u0435\u0432\u0435\u0440",
    31: "\u0413\u0430\u0440\u0442\u0430\u0440\u0435\u0439\u043D",
    32: "\u041B\u0435\u0432\u0438\u0430\u0444\u0430\u043D",
    33: "\u0410\u0440\u0438\u044F",
    34: "\u0418\u0448\u0442\u0430\u0440",
    35: "\u0425\u0430\u0437\u0435",
    42: "\u041A\u043E\u0440\u0432\u0443\u0441",
    43: "\u041A\u0430\u0438\u043B\u044C",
    44: "\u041D\u0443\u0438",
    45: "\u0424\u0430\u043D\u0435\u043C",
    46: "\u0428\u0430\u0435\u0434\u0430",
    47: "\u0420\u0435\u043D\u0435\u0441\u0441\u0430\u043D\u0441",
    48: "\u041A\u0440\u0430\u043A\u0435\u043D",
    49: "\u0418\u0444\u043D\u0438\u0440",
    51: "\u042D\u0440\u043D\u0430\u0440\u0434",
    52: "\u041C\u043E\u0440\u0444\u0435\u043E\u0441",
    53: "\u041C\u0430\u0440\u043B\u0438",
    54: "\u0410\u0448\u044C\u044F\u0440\u0430",
    55: "\u0413\u043B\u0435\u043D\u043D",
    56: "\u041B\u043E\u0440\u0435\u044F",
    61: "\u041A\u0441\u0430\u043D\u0430\u0442\u043E\u0441",
    62: "\u0422\u0430\u0440\u043E\u043D",
    63: "\u0420\u0435\u0439\u0432\u0435\u043D",
    64: "\u041D\u0430\u0433\u0430\u0448\u0430\u0440",
    65: "\u041C\u0438\u0440\u0430\u0436",
    66: "\u0424\u0435\u0441\u0430\u043D\u0438\u043A\u0441"
  };

  // src/data/items.js
  let CODEX_IMAGES_BASE = "https://archeagecodex.com/images/";
  let LS_KEY_ICON_SEX = "tm_aa_icon_sex";
  let GRADES = [
    /* 0  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade0.png`, title: "\u0411\u0435\u0441\u043F\u043E\u043B\u0435\u0437\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442", color: "#949293" },
    /* 1  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade1.png`, title: "\u041E\u0431\u044B\u0447\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442", color: "#ba976d", cartNamePatterns: [/^обычн(?:ый|ая|ое|ые)\s+/] },
    /* 2  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade2.png`, title: "\u041D\u0435\u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442", color: "#77b064", cartNamePatterns: [/^необычн(?:ый|ая|ое|ые)\s+/] },
    /* 3  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade3.png`, title: "\u0420\u0435\u0434\u043A\u0438\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442", color: "#558fd7", cartNamePatterns: [/^редк(?:ий|ая|ое|ие)\s+/] },
    /* 4  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade4.png`, title: "\u0423\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442", color: "#cb72d8", cartNamePatterns: [/^уникальн(?:ый|ая|ое|ые)\s+/] },
    /* 5  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade5.png`, title: "\u042D\u043F\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442", color: "#d78b06", cartNamePatterns: [/^эпическ(?:ий|ая|ое|ие)\s+/] },
    /* 6  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade6.png`, title: "\u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442", color: "#e17853", cartNamePatterns: [/^легендарн(?:ый|ая|ое|ые)\s+/] },
    /* 7  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade7.png`, title: "\u0420\u0435\u043B\u0438\u043A\u0432\u0438\u044F", color: "#f95252", cartNamePatterns: [/^реликвийн(?:ый|ая|ое|ые)\s+/] },
    /* 8  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade8.png`, title: "\u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u044D\u043F\u043E\u0445\u0438 \u0447\u0443\u0434\u0435\u0441", color: "#cf7d5d", cartNamePatterns: [/\s+эпохи чудес$/] },
    /* 9  */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade9.png`, title: "\u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u044D\u043F\u043E\u0445\u0438 \u0441\u043A\u0430\u0437\u0430\u043D\u0438\u0439", color: "#8fa5ca", cartNamePatterns: [/\s+эпохи сказаний$/] },
    /* 10 */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade10.png`, title: "\u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u044D\u043F\u043E\u0445\u0438 \u043B\u0435\u0433\u0435\u043D\u0434", color: "#bf7900", cartNamePatterns: [/\s+эпохи легенд$/] },
    /* 11 */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade11.png`, title: "\u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u044D\u043F\u043E\u0445\u0438 \u043C\u0438\u0444\u043E\u0432", color: "#c90b0b", cartNamePatterns: [/\s+эпохи мифов$/] },
    /* 12 */
    { overlay: `${CODEX_IMAGES_BASE}icon_grade12.png`, title: "\u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u044D\u043F\u043E\u0445\u0438 \u0414\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u0438", color: "#ae98fe", cartNamePatterns: [/\s+эпохи двенадцати$/] }
  ];
  let ITEM_TYPES = {
    "unidentified": { title: "\u041D\u0435\u043E\u043F\u043E\u0437\u043D\u0430\u043D\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442" },
    "quest": { title: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435" },
    "magical": { title: "\u041C\u0430\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442" },
    "box": { title: "\u042F\u0449\u0438\u043A" },
    "equipment": { title: "\u0421\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u0435" },
    "material": { title: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" },
    "potion": { title: "\u041C\u0438\u043A\u0441\u0442\u0443\u0440\u0430" },
    "other": { title: "\u041F\u0440\u043E\u0447\u0435\u0435" },
    "rareMaterial": { title: "\u0420\u0435\u0434\u043A\u0438\u0439 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" },
    "mount": { title: "\u0415\u0437\u0434\u043E\u0432\u043E\u0439 \u043F\u0438\u0442\u043E\u043C\u0435\u0446" },
    "battlePet": { title: "\u0411\u043E\u0435\u0432\u043E\u0439 \u043F\u0438\u0442\u043E\u043C\u0435\u0446" },
    "lightArmor": { title: "\u041B\u0435\u0433\u043A\u0438\u0439 \u0434\u043E\u0441\u043F\u0435\u0445" },
    "furniture": { title: "\u041F\u0440\u0435\u0434\u043C\u0435\u0442 \u0438\u043D\u0442\u0435\u0440\u044C\u0435\u0440\u0430" },
    "craftItem": { title: "\u0420\u0435\u043C\u0435\u0441\u043B\u0435\u043D\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442" }
  };
  let ITEM_SUB_TYPES = {
    "ingot": { title: "\u0421\u043B\u0438\u0442\u043E\u043A \u043C\u0435\u0442\u0430\u043B\u043B\u0430" },
    "leather": { title: "\u041A\u043E\u0436\u0430" },
    "cloth": { title: "\u0422\u043A\u0430\u043D\u044C" },
    "lumber": { title: "\u0414\u0440\u0435\u0432\u0435\u0441\u0438\u043D\u0430" },
    "costume": { title: "\u041A\u043E\u0441\u0442\u044E\u043C" },
    "cloak": { title: "\u041F\u043B\u0430\u0449" },
    "windInstrument": { title: "\u0414\u0443\u0445\u043E\u0432\u043E\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442" }
  };
  let EQUIPMENT_SUB_TYPES = {
    "helmet": { title: "\u0428\u043B\u0435\u043C" },
    "armor": { title: "\u041D\u0430\u0433\u0440\u0443\u0434\u043D\u0438\u043A" },
    "belt": { title: "\u041F\u043E\u044F\u0441" },
    "bracer": { title: "\u041D\u0430\u0440\u0443\u0447\u0438" },
    "gloves": { title: "\u041F\u0435\u0440\u0447\u0430\u0442\u043A\u0438" },
    "cloak": { title: "\u041F\u043B\u0430\u0449" },
    "pants": { title: "\u041F\u043E\u043D\u043E\u0436\u0438" },
    "boots": { title: "\u041E\u0431\u0443\u0432\u044C" },
    "underwear": { title: "\u041D\u0438\u0436\u043D\u0435\u0435 \u0431\u0435\u043B\u044C\u0451" },
    "necklace": { title: "\u041E\u0436\u0435\u0440\u0435\u043B\u044C\u0435" },
    "earrings": { title: "\u0421\u0435\u0440\u044C\u0433\u0430" },
    "ring": { title: "\u041A\u043E\u043B\u044C\u0446\u043E" },
    "two_handed_weapon": { title: "\u0414\u0432\u0443\u0440\u0443\u0447\u043D\u043E\u0435 \u043E\u0440\u0443\u0436\u0438\u0435" },
    "ranged weapon": { title: "\u041E\u0440\u0443\u0436\u0438\u0435 \u0434\u0430\u043B\u044C\u043D\u0435\u0433\u043E \u0431\u043E\u044F" },
    "instrument": { title: "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442" },
    "weight": { title: "\u0413\u0440\u0443\u0437" },
    "costume": { title: "\u041A\u043E\u0441\u0442\u044E\u043C" }
  };
  let ICON_OVERLAY = {
    "unconfirmed": { icon: "https://archeagecodex.com/items/top_unconfirmed.png" },
    "seal": { icon: "https://archeagecodex.com/items/top_seal_08.png" },
    "quest_y": { icon: "https://archeagecodex.com/items/top_quest_y.png" },
    "quest_cash": { icon: "https://archeagecodex.com/items/top_quest_cash.png" }
  };
  let HERO_LEVEL_ICON = "https://archeagecodex.com/images/icon_hlv.png";
  let MAX_HERO_LEVEL = 70;
  let MAX_LEVEL = 55 + MAX_HERO_LEVEL;
  let CURRENCY_ICONS = {
    gold: "https://archeagecodex.com/items/gold.png",
    silver: "https://archeagecodex.com/items/silver.png",
    bronze: "https://archeagecodex.com/items/bronze.png"
  };
  let snakeToCamel = /* @__PURE__ */ __name((value) => String(value || "").replace(/_([a-z])/g, (_, char) => char.toUpperCase()), "snakeToCamel");
  let formatDurationValue = /* @__PURE__ */ __name((value) => {
    const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours) parts.push(`${hours} \u0447.`);
    if (minutes) parts.push(`${minutes} \u043C.`);
    if (seconds) parts.push(`${seconds} \u0441.`);
    return parts.join(" ") || "0 \u0441.";
  }, "formatDurationValue");
  let ITEM_PLACEHOLDER_FORMATTERS = {
    buffDuration: /* @__PURE__ */ __name((value) => formatDurationValue(value), "buffDuration")
  };
  let decapitalize = /* @__PURE__ */ __name((value) => String(value || "").replace(/^./, (char) => char.toLowerCase()), "decapitalize");
  let getItemPlaceholderValue = /* @__PURE__ */ __name((item, field) => {
    const directValue = item?.[field];
    if (directValue != null) return directValue;
    if (!field.startsWith("buff") || !item?.buff || typeof item.buff !== "object") return null;
    const buffField = decapitalize(field.slice("buff".length));
    return item.buff[buffField] ?? null;
  }, "getItemPlaceholderValue");
  let resolveItemPlaceholders = /* @__PURE__ */ __name((text, item) => String(text || "").replace(/#\{([a-zA-Z0-9_]+)\}/g, (match, rawField) => {
    const field = snakeToCamel(rawField);
    const value = getItemPlaceholderValue(item, field);
    if (value == null) return `<span>(${rawField})</span>`;
    const formatter = ITEM_PLACEHOLDER_FORMATTERS[field];
    return formatter ? formatter(value, item) : String(value);
  }), "resolveItemPlaceholders");
  let parseGameMarkup = /* @__PURE__ */ __name((text, { preserveNewlines = false } = {}) => {
    if (!text) return "";
    const html = text.replace(
      /\|c([\da-fA-F]{2})([\da-fA-F]{6})(.*?)\|r/g,
      (_, alpha, color, inner) => `<span style="color:#${color}${alpha}">${inner}</span>`
    ).replace(
      /\|nc;(.*?)\|r/g,
      (_, inner) => `<span class="inv-nc">${inner}</span>`
    ).replace(
      /\|buffvar;(.*?)\|r/g,
      (_, inner) => `<span class="inv-buffvar">${inner}</span>`
    ).replace(
      /\|nn;(.*?)\|r/g,
      (_, inner) => `<span class="inv-nn">${inner}</span>`
    ).replace(
      /\|nd;(.*?)\|r/g,
      (_, inner) => `<span class="inv-nd">${inner}</span>`
    ).replace(
      /\|ni;(.*?)\|r/g,
      (_, inner) => `<span class="inv-ni">${inner}</span>`
    ).replace(
      /\|nr;(.*?)\|r/g,
      (_, inner) => `<span class="inv-nr">${inner}</span>`
    );
    return preserveNewlines ? html : html.replace(/\n/g, "<br/>");
  }, "parseGameMarkup");
  let hasVisibleTooltipText = /* @__PURE__ */ __name((value) => String(value || "").replace(/\n|<br\s*\/?>/gi, "").trim().length > 0, "hasVisibleTooltipText");
  let cleanDynamicTooltipMarkup = /* @__PURE__ */ __name((value) => {
    if (value == null) return null;
    let result = String(value).replace(/\\+"/g, '"').replace(/\\+'/g, "'").replace(/<br\s*\/?>\s*\n/gi, "<br/>").replace(/^(?:\s|\n|<br\s*\/?>)+/gi, "").replace(/(?:\s|\n|<br\s*\/?>)+$/gi, "");
    return result ? result : null;
  }, "cleanDynamicTooltipMarkup");
  let stripHtmlForMatch = /* @__PURE__ */ __name((value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), "stripHtmlForMatch");
  let CODEX_ITEM_URL = "https://archeagecodex.com/ru/item/";
  let GMRU_CDN_ICONS = "https://aa.cdn.gmru.net/ms/data/game-icons/";
  let ICON_SEX_VALUES = {
    m: { title: "\u041C\u0443\u0436\u0441\u043A\u043E\u0439", field: "iconM" },
    f: { title: "\u0416\u0435\u043D\u0441\u043A\u0438\u0439", field: "iconF" }
  };
  let loadIconSex = /* @__PURE__ */ __name(() => {
    try {
      const sex = localStorage.getItem(LS_KEY_ICON_SEX);
      return ICON_SEX_VALUES[sex] ? sex : "m";
    } catch {
      return "m";
    }
  }, "loadIconSex");
  let saveIconSex = /* @__PURE__ */ __name((sex) => {
    try {
      if (ICON_SEX_VALUES[sex]) {
        localStorage.setItem(LS_KEY_ICON_SEX, sex);
      } else {
        localStorage.removeItem(LS_KEY_ICON_SEX);
      }
    } catch {
    }
  }, "saveIconSex");
  let getItemIconUrlFromParts = /* @__PURE__ */ __name((icon, iconM, iconF) => {
    const sex = loadIconSex();
    const sexIcon = sex === "m" ? iconM || iconF || "m" : iconF || iconM || "f";
    return sexIcon ? icon.replace(/\{sex\}/g, sexIcon) : icon;
  }, "getItemIconUrlFromParts");
  let getItemIconUrl = /* @__PURE__ */ __name((item) => getItemIconUrlFromParts(item?.icon || "", item?.iconM || "", item?.iconF || ""), "getItemIconUrl");
  let ITEMS = Object.fromEntries([
    { id: 8256, type: "material", subType: "cloth", icon: `${GMRU_CDN_ICONS}b855c7909baa6f5c5bd6b7dbfc08b865.png`, grade: 1, name: "\u0422\u043A\u0430\u043D\u044C" },
    // icon_item_0356.png
    { id: 8318, type: "material", subType: "ingot", icon: `${GMRU_CDN_ICONS}9d60cae3016a14b2cfc17a90de8e5f5b.png`, grade: 1, name: "\u0421\u043B\u0438\u0442\u043E\u043A \u0436\u0435\u043B\u0435\u0437\u0430" },
    // icon_item_quest053.png
    { id: 8337, type: "material", subType: "lumber", icon: `${GMRU_CDN_ICONS}92b1e189f64bc8a6b7edf2eb51c73890.png`, grade: 1, name: "\u0423\u043F\u0430\u043A\u043E\u0432\u043A\u0430 \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0434\u0440\u0435\u0432\u0435\u0441\u0438\u043D\u044B", vekselName: "\u0421\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0434\u0440\u0435\u0432\u0435\u0441\u0438\u043D\u0430" },
    // icon_item_0041.png
    { id: 16327, type: "material", subType: "leather", icon: `${GMRU_CDN_ICONS}c4952a5513632f33311717370ca55ca9.png`, grade: 1, name: "\u0421\u044B\u0440\u043E\u043C\u044F\u0442\u043D\u0430\u044F \u043A\u043E\u0436\u0430" },
    // icon_item_0352.png
    { id: 35461, type: "unidentified", overlay: "unconfirmed", vekselType: "sack", icon: `${GMRU_CDN_ICONS}70a2b288662f4e1c5c1c812ad07f34f6.png`, grade: 1, name: "\u041F\u043E\u043B\u043D\u043E\u0432\u0435\u0441\u043D\u044B\u0439 \u043C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u0441\u0435\u0440\u0435\u0431\u0440\u043E\u043C" },
    // icon_item_1839.png
    { id: 40928, type: "unidentified", overlay: "unconfirmed", vekselType: "sack", icon: `${GMRU_CDN_ICONS}d9df620283926e6f4a9ab47ebacf499c.png`, grade: 1, name: "\u0420\u0430\u0441\u0448\u0438\u0442\u044B\u0439 \u0436\u0435\u043C\u0447\u0443\u0433\u043E\u043C \u043A\u043E\u0448\u0435\u043B\u0451\u043A" },
    // icon_item_3101.png
    { id: 42076, type: "unidentified", overlay: "unconfirmed", vekselType: "archive", icon: `${GMRU_CDN_ICONS}66ed119fca00abf78ddf2602ed55e659.png`, grade: 1, name: "\u0420\u0435\u0437\u043D\u043E\u0439 \u0441\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439" },
    // icon_item_3619.png
    { id: 42077, type: "unidentified", overlay: "unconfirmed", vekselType: "archive", icon: `${GMRU_CDN_ICONS}1ddc9b8c6e0d41d83f2d3f9536eb29a4.png`, grade: 1, name: "\u0424\u0435\u0440\u043C\u0435\u0440\u0441\u043A\u0438\u0439 \u0441\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439" },
    // icon_item_3620.png
    { id: 43176, type: "unidentified", overlay: "unconfirmed", vekselType: "sack", icon: `${GMRU_CDN_ICONS}b41e79b64ae0b578499ac6301325f631.png`, grade: 1, name: "\u041A\u043E\u0442\u043E\u043C\u043A\u0430 \u044D\u0444\u0435\u043D\u0441\u043A\u043E\u0433\u043E \u0441\u0442\u0440\u0430\u043D\u043D\u0438\u043A\u0430" },
    // icon_item_3906.png
    { id: 43177, type: "unidentified", overlay: "unconfirmed", vekselType: "archive", icon: `${GMRU_CDN_ICONS}f2d17e3b4d030e91c38e68cd60c0ee69.png`, grade: 1, name: "\u042D\u0444\u0435\u043D\u0441\u043A\u0438\u0439 \u0441\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439" },
    // icon_item_3907.png
    { id: 8000749, type: "quest", overlay: "quest_y", icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 3, name: "\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F \u043D\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u043E: \u0411\u0430\u0440\u0440\u0430\u0433\u0430 \u0411\u0435\u0437\u0443\u043C\u043D\u044B\u0439", description: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u043D\u0438\u0435." },
    // icon_item_2762.png
    { id: 8000751, type: "quest", overlay: "quest_y", icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 5, name: "\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F \u043D\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u043E: \u0438\u0444\u0435\u0440\u0438\u0439\u0446\u044B", description: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u043D\u0438\u0435." },
    { id: 8000752, type: "quest", overlay: "quest_y", icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 6, name: "\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F \u043D\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u043E: \u0418\u0448\u0442\u0430\u0440" },
    { id: 8000753, type: "quest", overlay: "quest_y", icon: `${GMRU_CDN_ICONS}8139603ac380eaa7a6a9f7a0c331a607.png`, grade: 2, name: "\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F \u043D\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u043E: \u043F\u043E\u0432\u0435\u043B\u0438\u0442\u0435\u043B\u044C \u043F\u043E\u0434\u0437\u0435\u043C\u0435\u043B\u044C\u044F" },
    { id: 48894, type: "magical", icon: "https://archeagecodex.com/items/icon_item_4820.png", grade: 10, name: "\u0414\u0440\u0430\u0433\u043E\u0446\u0435\u043D\u043D\u0430\u044F \u044D\u0444\u0435\u043D\u0441\u043A\u0430\u044F \u0441\u0444\u0435\u0440\u0430 \u0431\u0440\u043E\u043D\u043D\u0438\u043A\u0430", description: "\u041F\u0440\u0435\u0434\u043E\u0442\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u043F\u043E\u043D\u0438\u0436\u0435\u043D\u0438\u0435 \u0443\u0440\u043E\u0432\u043D\u044F \u044D\u0444\u0444\u0435\u043A\u0442\u0430 \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0445 \u043A\u0443\u0431\u043E\u0432, \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0433\u043E \u043D\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442. \u041F\u043E\u0432\u044B\u0448\u0430\u0435\u0442 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u0443\u0441\u043F\u0435\u0445\u0430 \u043F\u0440\u0438 \u043F\u043E\u043F\u044B\u0442\u043A\u0435 \u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0445 \u043A\u0443\u0431\u043E\u0432 \u0432 |nc;2|r \u0440\u0430\u0437\u0430.\n\n\u041C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0443\u0440\u043E\u0432\u043D\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u044F |nc;18 \u0438 \u0432\u044B\u0448\u0435|r." },
    { id: 54915, type: "magical", icon: "https://archeagecodex.com/items/icon_item_1695.png", grade: 1, name: "\u0421\u0432\u0438\u0442\u043E\u043A \u0447\u0430\u0440 \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F" },
    { id: 45508, icon: "https://archeagecodex.com/items/icon_item_4212.png", grade: 2, name: "\u0421\u0444\u0435\u0440\u0430 \u0430\u043D\u0438\u043C\u0430\u0433\u0430" },
    { id: 8001565, icon: "https://archeagecodex.com/items/icon_item_3628.png", grade: 1, name: "\u041D\u043E\u0432\u0435\u043D\u044C\u043A\u0430\u044F \u043A\u0438\u0440\u043A\u0430" },
    { id: 8002452, overlay: "unconfirmed", icon: "https://archeagecodex.com/items/icon_item_3349.png", grade: 1, name: "\u0423\u043D\u0438\u0432\u0435\u0440\u0441\u0430\u043B\u044C\u043D\u044B\u0439 \u0430\u043B\u0445\u0438\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B" },
    { id: 8002449, icon: "https://archeagecodex.com/items/charge_wider.png", grade: 1, name: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0443\u043C\u043A\u0430" },
    { id: 47943, type: "potion", icon: "https://archeagecodex.com/items/icon_item_4710.png", grade: 1, name: "\u041D\u0430\u0441\u0442\u043E\u0439\u043A\u0430 \u0443\u0441\u0435\u0440\u0434\u043D\u043E\u0433\u043E \u0440\u0435\u043C\u0435\u0441\u043B\u0435\u043D\u043D\u0438\u043A\u0430" },
    { id: 39424, type: "magical", icon: "https://archeagecodex.com/items/icon_item_3017.png", grade: 1, name: "\u0418\u0440\u0430\u043C\u0438\u0439\u0441\u043A\u0430\u044F \u0433\u0430\u0434\u0430\u043B\u044C\u043D\u0430\u044F \u0440\u0443\u043D\u0430", description: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0437\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u0434\u0438\u043D \u0438\u0437 |nc;\u044D\u0444\u0444\u0435\u043A\u0442\u043E\u0432 \u0441\u0438\u043D\u0442\u0435\u0437\u0430 \u043A\u043E\u0441\u0442\u044E\u043C\u0430, \u044D\u0444\u0435\u043D\u0441\u043A\u043E\u0433\u043E \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u044F, \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u043E\u0433\u043E \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u0442\u0440\u043E\u0444\u0435\u0439\u043D\u043E\u0433\u043E \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u044F \u043C\u0438\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u043E\u0432|r \u0434\u0440\u0443\u0433\u0438\u043C, \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u043C \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u043C \u043E\u0431\u0440\u0430\u0437\u043E\u043C.", useDescription: "\u0420\u0430\u0441\u043F\u0430\u043A\u043E\u0432\u0430\u0442\u044C.\n\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044F Shift, \u0449\u0435\u043B\u043A\u043D\u0438\u0442\u0435 \u043B\u0435\u0432\u043E\u0439 \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \u043C\u044B\u0448\u0438, \u0447\u0442\u043E\u0431\u044B \u0440\u0430\u0441\u043F\u0430\u043A\u043E\u0432\u0430\u0442\u044C \u0432\u0441\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u044D\u0442\u043E\u0433\u043E \u0442\u0438\u043F\u0430, \u043D\u0430\u0445\u043E\u0434\u044F\u0449\u0438\u0435\u0441\u044F \u0432 \u0440\u044E\u043A\u0437\u0430\u043A\u0435." },
    { id: 46180, icon: "https://archeagecodex.com/items/icon_item_1395.png", grade: 3, name: "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0439 \u043D\u0430\u0441\u0442\u043E\u0439" },
    { id: 47130, type: "unidentified", overlay: "unconfirmed", icon: "https://archeagecodex.com/items/icon_item_2679.png", grade: 6, name: "\u0425\u0440\u0443\u0441\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0440\u0443\u043D\u0430", description: "|nd;\u041C\u043E\u0436\u043D\u043E \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043E\u0434\u043D\u0443 \u0438\u0437 \u0445\u0440\u0443\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0445 \u0440\u0443\u043D \u043D\u0430 \u0432\u044B\u0431\u043E\u0440:|r\n- \u0445\u0440\u0443\u0441\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0440\u0443\u043D\u0430 \u0431\u0430\u0433\u0440\u043E\u0432\u043E\u0439 \u043B\u0443\u043D\u044B,\n- \u0445\u0440\u0443\u0441\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0440\u0443\u043D\u0430 \u043E\u0441\u0435\u043D\u043D\u0435\u0439 \u043B\u0443\u043D\u044B,\n- \u0445\u0440\u0443\u0441\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0440\u0443\u043D\u0430 \u043C\u043E\u043B\u043E\u0434\u043E\u0439 \u043B\u0443\u043D\u044B,\n- \u0445\u0440\u0443\u0441\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0440\u0443\u043D\u0430 \u0431\u0435\u0437\u043C\u043E\u043B\u0432\u043D\u043E\u0439 \u043B\u0443\u043D\u044B,\n- \u0445\u0440\u0443\u0441\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0440\u0443\u043D\u0430 \u043A\u043E\u043B\u0434\u043E\u0432\u0441\u043A\u043E\u0439 \u043B\u0443\u043D\u044B." },
    { id: 47104, icon: "https://archeagecodex.com/items/icon_item_4570.png", grade: 2, name: "\u041F\u0430\u0440\u043D\u0438\u043A\u043E\u0432\u044B\u0439 \u043A\u0443\u043F\u043E\u043B" },
    { id: 48903, type: "box", icon: "https://archeagecodex.com/items/icon_item_3282.png", grade: 1, name: "\u041D\u0430\u0431\u043E\u0440 \u0441\u0432\u0435\u0440\u043A\u0430\u044E\u0449\u0438\u0445 \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0445 \u0441\u0444\u0435\u0440" },
    { id: 48474, type: "box", icon: "https://archeagecodex.com/items/icon_item_3275.png", grade: 11, name: "\u0411\u043E\u043B\u044C\u0448\u043E\u0439 \u043D\u0430\u0431\u043E\u0440 \u043C\u0438\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u044D\u0441\u0441\u0435\u043D\u0446\u0438\u0439" },
    { id: 8002297, type: "unidentified", overlay: "seal", icon: "https://archeagecodex.com/items/icon_item_2267.png", grade: 3, name: "\u041A\u043E\u0440\u043E\u043B\u0435\u0432\u0441\u043A\u0438\u0439 \u043B\u0443\u043D\u043D\u044B\u0439 \u0438\u0437\u0443\u043C\u0440\u0443\u0434" },
    { id: 35727, icon: "https://archeagecodex.com/items/icon_item_1982.png", grade: 2, name: "\u0411\u0443\u0440\u043E\u0432\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430" },
    { id: 47082, icon: "https://archeagecodex.com/items/icon_item_3369.png", grade: 1, name: "\u041F\u0430\u0442\u0435\u043D\u0442 \u043D\u0430 \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442\u043D\u043E\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043E" },
    { id: 31892, icon: "https://archeagecodex.com/items/icon_item_1733.png", grade: 1, name: "\u0417\u0435\u043C\u0435\u043B\u044C\u043D\u044B\u0439 \u0432\u0435\u043A\u0441\u0435\u043B\u044C" },
    { id: 55722, icon: "https://archeagecodex.com/items/icon_item_5864.png", grade: 4, name: "\u0418\u0441\u043A\u0443\u0441\u043D\u0430\u044F \u0446\u0438\u0442\u0440\u0438\u043D\u043E\u0432\u0430\u044F \u0433\u0440\u0430\u0432\u0438\u0440\u043E\u0432\u043A\u0430" },
    { id: 48886, icon: "https://archeagecodex.com/items/icon_item_4818.png", grade: 8, name: "\u0421\u0432\u0435\u0440\u043A\u0430\u044E\u0449\u0430\u044F \u044D\u0444\u0435\u043D\u0441\u043A\u0430\u044F \u0441\u0444\u0435\u0440\u0430 \u0431\u0440\u043E\u043D\u043D\u0438\u043A\u0430", description: "\u041F\u0440\u0435\u0434\u043E\u0442\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u043F\u043E\u043D\u0438\u0436\u0435\u043D\u0438\u0435 \u0443\u0440\u043E\u0432\u043D\u044F \u044D\u0444\u0444\u0435\u043A\u0442\u0430 \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0445 \u043A\u0443\u0431\u043E\u0432, \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u0433\u043E \u043D\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442.\n\n\u041C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0443\u0440\u043E\u0432\u043D\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u044F |nc;18 \u0438 \u0432\u044B\u0448\u0435|r." },
    { id: 55723, icon: "https://archeagecodex.com/items/icon_item_5865.png", grade: 4, name: "\u0418\u0441\u043A\u0443\u0441\u043D\u0430\u044F \u0430\u043A\u0432\u0430\u043C\u0430\u0440\u0438\u043D\u043E\u0432\u0430\u044F \u0433\u0440\u0430\u0432\u0438\u0440\u043E\u0432\u043A\u0430" },
    { id: 45747, type: "potion", icon: "https://archeagecodex.com/items/icon_item_4385.png", grade: 5, name: "\u0414\u0440\u0430\u0433\u043E\u0446\u0435\u043D\u043D\u044B\u0439 \u0444\u043B\u0430\u043A\u043E\u043D \u0441 \u0437\u0435\u043B\u044C\u0435\u043C \u043E\u0445\u043E\u0442\u043D\u0438\u043A\u0430" },
    { id: 49270, type: "box", icon: "https://archeagecodex.com/items/icon_item_2273.png", grade: 5, name: "\u041D\u0430\u0431\u043E\u0440 \u0431\u043E\u043B\u044C\u0448\u0438\u0445 \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0445 \u043A\u0443\u0431\u043E\u0432" },
    { id: 45160, type: "potion", icon: "https://archeagecodex.com/items/icon_item_2376.png", grade: 4, name: "\u041D\u0430\u0441\u0442\u043E\u0439\u043A\u0430 \u0441\u043F\u043E\u0440\u044B\u043D\u044C\u0438" },
    { id: 46623, type: "potion", icon: "https://archeagecodex.com/items/icon_item_0986.png", grade: 4, name: "\u041D\u0430\u0441\u0442\u043E\u0439\u043A\u0430 \u043E\u0441\u0442\u0440\u043E\u043B\u0438\u0441\u0442\u0430", buff: { duration: 1800 } },
    { id: 8001268, type: "magical", icon: "https://archeagecodex.com/items/icon_item_1986.png", grade: 1, name: "\u0421\u0432\u0438\u0442\u043E\u043A \u0434\u0435\u043B\u044C\u0444\u0438\u0439\u0441\u043A\u043E\u0439 \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0438", buff: { duration: 3600 } },
    { id: 8001169, type: "magical", icon: "https://archeagecodex.com/items/icon_item_1986.png", grade: 1, name: "\u0421\u0432\u0438\u0442\u043E\u043A \u043E\u043F\u044B\u0442\u0430 V", buff: { duration: 3600 }, isPersonal: true },
    { id: 8001172, type: "magical", icon: "https://archeagecodex.com/items/icon_item_1986.png", grade: 1, name: "\u0421\u0432\u0438\u0442\u043E\u043A \u043E\u043F\u044B\u0442\u0430 VIII", buff: { duration: 3600 }, isPersonal: true },
    { id: 46181, icon: "https://archeagecodex.com/items/icon_item_1396.png", grade: 3, name: "\u041B\u0443\u043D\u043D\u044B\u0439 \u043D\u0430\u0441\u0442\u043E\u0439" },
    { id: 48546, icon: "https://archeagecodex.com/items/icon_item_3595.png", grade: 1, name: "\u041F\u0438\u0441\u044C\u043C\u0435\u043D\u0430 \u0432\u043E\u0439\u043D\u044B" },
    { id: 47655, icon: "https://archeagecodex.com/items/icon_item_4709.png", grade: 4, name: "\u0424\u0438\u043E\u043D\u0430 \u0420\u043E\u0437\u043E\u0432\u044B\u0439 \u041B\u0435\u043F\u0435\u0441\u0442\u043E\u043A" },
    { id: 47581, icon: "https://archeagecodex.com/items/icon_item_4211.png", grade: 3, name: "\u041B\u0438\u043B\u043E\u0432\u043E\u0435 \u044D\u043C\u0430\u043B\u0435\u0432\u043E\u0435 \u0441\u0442\u0435\u043A\u043B\u043E" },
    { id: 47479, icon: "https://archeagecodex.com/items/icon_item_3519.png", grade: 1, name: "\u0418\u043D\u043A\u0440\u0443\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0444\u043B\u0430\u043A\u043E\u043D \u0441 \u0446\u0435\u043B\u0435\u0431\u043D\u044B\u043C \u044D\u043B\u0438\u043A\u0441\u0438\u0440\u043E\u043C" },
    { id: 47480, icon: "https://archeagecodex.com/items/icon_item_3520.png", grade: 1, name: "\u0418\u043D\u043A\u0440\u0443\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0444\u043B\u0430\u043A\u043E\u043D \u0441 \u044D\u043B\u0438\u043A\u0441\u0438\u0440\u043E\u043C \u043C\u0430\u043D\u044B" },
    { id: 8002996, icon: "https://archeagecodex.com/items/icon_item_6002.png", grade: 1, name: "\u041E\u0441\u043A\u043E\u043B\u043E\u043A \u043F\u0440\u0435\u0434\u0435\u043B\u0430", description: "\u042D\u0442\u043E\u0442 \u043E\u0441\u043A\u043E\u043B\u043E\u043A \u2013 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442 \u043E\u0442\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0431\u043E\u0436\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0438\u043B \u0432 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044C\u043D\u043E\u043C \u043C\u0438\u0440\u0435. \u041D\u0430 |ni;\u0441\u0442\u0430\u043D\u043A\u0435 \u0434\u043B\u044F \u0430\u043A\u0445\u0438\u0443\u043C\u0430|r \u0438\u0437 \u0442\u0430\u043A\u0438\u0445 \u0447\u0430\u0441\u0442\u0438\u0446 \u043C\u043E\u0436\u043D\u043E \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u0443\u043C\u0435\u043D\u044B.", price: 100 },
    { id: 8003072, icon: "https://archeagecodex.com/items/icon_item_6002.png", grade: 1, name: "\u041E\u0441\u043A\u043E\u043B\u043E\u043A \u043F\u0440\u0435\u0434\u0435\u043B\u0430" },
    { id: 8001288, icon: "https://archeagecodex.com/items/icon_item_0966.png", grade: 1, name: "\u0426\u0438\u0442\u0440\u0443\u0441\u043E\u0432\u0430\u044F \u043A\u0430\u0440\u0430\u043C\u0435\u043B\u044C\u043A\u0430", buff: { duration: 3600 } },
    { id: 8002649, type: "box", icon: "https://archeagecodex.com/items/icon_item_3259.png", grade: 4, name: "\u041D\u0430\u0431\u043E\u0440 \u043D\u0435\u0432\u0435\u0440\u0438\u043D\u0441\u043A\u0438\u0445 \u0444\u0435\u0439\u0435\u0440\u0432\u0435\u0440\u043A\u043E\u0432" },
    { id: 8000540, icon: "https://archeagecodex.com/items/icon_item_3207.png", grade: 1, name: "\u041F\u0443\u0448\u0438\u0441\u0442\u0430\u044F \u043D\u0435\u0432\u0435\u0440\u0438\u043D\u0441\u043A\u0430\u044F \u0435\u043B\u043E\u0447\u043A\u0430" },
    { id: 49769, icon: "https://archeagecodex.com/items/icon_item_4950.png", grade: 6, name: "\u0417\u0430\u0447\u0430\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0441\u0432\u0438\u0442\u043E\u043A \u043F\u0440\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u044F \u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u044F \u0437\u043D\u0430\u043D\u0438\u0439" },
    { id: 54653, type: "box", icon: "https://archeagecodex.com/items/icon_item_5043.png", grade: 12, name: "\u0421\u0443\u043D\u0434\u0443\u043A \u0441 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u043C \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u0438\u043C \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u0435\u043C" },
    { id: 53515, type: "magical", icon: "https://archeagecodex.com/items/icon_item_5266.png", grade: 2, isPersonal: true, price: 0, reqLevel: 1, name: "\u0417\u0430\u0433\u043E\u0432\u043E\u0440\u0435\u043D\u043D\u0430\u044F \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u0430\u044F \u0440\u0443\u043D\u0430", description: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0437\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u0434\u0438\u043D \u0438\u0437 \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u0432 \u0441\u0438\u043D\u0442\u0435\u0437\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0434\u0440\u0443\u0433\u0438\u043C, \u0432\u044B\u0431\u0440\u0430\u0432 \u043D\u0443\u0436\u043D\u044B\u0439 \u044D\u0444\u0444\u0435\u043A\u0442.\n\n|ni;\u041F\u043E\u0434\u0445\u043E\u0434\u0438\u0442 \u0434\u043B\u044F \u043F\u0440\u043E\u043A\u043B\u044F\u0442\u043E\u0433\u043E, \u0438\u0437\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0433\u043E, \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0438 \u0441\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u043D\u043E\u0433\u043E \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u043E\u0433\u043E \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u044F.|r", useDescription: "\u041F\u0440\u0438\u0441\u0442\u0443\u043F\u0438\u0442\u044C \u043A \u0437\u0430\u043C\u0435\u043D\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u0430.\n\u0420\u0430\u0441\u0445\u043E\u0434 \u043E\u0447\u043A\u043E\u0432 \u0440\u0430\u0431\u043E\u0442\u044B: |nc;50|r." },
    { id: 52207, icon: "https://archeagecodex.com/items/icon_item_3022.png", grade: 1, name: "\u041C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u043C\u0438\u043A\u0441\u0442\u0443\u0440\u0430\u043C\u0438", description: "\u0421\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435:\n- \u0438\u043D\u043A\u0440\u0443\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0444\u043B\u0430\u043A\u043E\u043D \u0441 \u044D\u043B\u0438\u043A\u0441\u0438\u0440\u043E\u043C \u043C\u0430\u043D\u044B (300 \u0448\u0442.),\n- \u0438\u043D\u043A\u0440\u0443\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0444\u043B\u0430\u043A\u043E\u043D \u0441 \u0446\u0435\u043B\u0435\u0431\u043D\u044B\u043C \u044D\u043B\u0438\u043A\u0441\u0438\u0440\u043E\u043C (300 \u0448\u0442.),\n- \u0441\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0439 \u043D\u0430\u0441\u0442\u043E\u0439 (30 \u0448\u0442.),\n- \u043B\u0443\u043D\u043D\u044B\u0439 \u043D\u0430\u0441\u0442\u043E\u0439 (30 \u0448\u0442.)" },
    { id: 51239, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 11, name: "\u0421\u0443\u043D\u0434\u0443\u043A \u0441 \u0438\u0437\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u043C \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u0438\u043C \u043E\u0440\u0443\u0436\u0438\u0435\u043C \u044D\u043F\u043E\u0445\u0438 \u043C\u0438\u0444\u043E\u0432" },
    { id: 51240, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 12, name: "\u0421\u0443\u043D\u0434\u0443\u043A \u0441 \u0438\u0437\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u043C \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u0438\u043C \u043E\u0440\u0443\u0436\u0438\u0435\u043C \u044D\u043F\u043E\u0445\u0438 \u0414\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u0438" },
    { id: 54654, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 12, name: "\u0421\u0443\u043D\u0434\u0443\u043A \u0441 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u043C \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u0438\u043C \u043E\u0440\u0443\u0436\u0438\u0435\u043C \u044D\u043F\u043E\u0445\u0438 \u0414\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u0438" },
    { id: 54655, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 11, name: "\u0421\u0443\u043D\u0434\u0443\u043A \u0441 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u043C\u0438 \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u0438\u043C\u0438 \u0434\u043E\u0441\u043F\u0435\u0445\u0430\u043C\u0438 \u044D\u043F\u043E\u0445\u0438 \u043C\u0438\u0444\u043E\u0432" },
    { id: 47941, type: "box", icon: "https://archeagecodex.com/items/x_mas_gift.png", grade: 10, name: "\u0421\u0443\u043D\u0434\u0443\u043A \u0441 \u043E\u0440\u0443\u0436\u0438\u0435\u043C \u0411\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0438 \u042D\u0440\u043D\u0430\u0440\u0434\u0430 \u044D\u043F\u043E\u0445\u0438 \u043B\u0435\u0433\u0435\u043D\u0434" },
    { id: 51243, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 12, name: "\u0421\u0443\u043D\u0434\u0443\u043A \u0441 \u043C\u0430\u0433\u0438\u0441\u0442\u0435\u0440\u0441\u043A\u0438\u043C \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u0438\u043C \u043E\u0440\u0443\u0436\u0438\u0435\u043C \u044D\u043F\u043E\u0445\u0438 \u0414\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u0438" },
    { id: 55501, type: "box", icon: "https://archeagecodex.com/items/icon_item_5850.png", grade: 6, name: "\u0421\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441 \u043B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u043C \u0443\u043A\u0440\u0430\u0448\u0435\u043D\u0438\u0435\u043C \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F", description: "\u041E\u0442\u043A\u0440\u044B\u0432 \u044D\u0442\u043E\u0442 \u0441\u0443\u043D\u0434\u0443\u0447\u043E\u043A, \u0432\u044B \u0441\u043C\u043E\u0436\u0435\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043E\u0434\u0438\u043D \u0438\u0437 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432:\n- \u043B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u0430\u044F \u0441\u0435\u0440\u044C\u0433\u0430 \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F,\n- \u043B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u043E\u0435 \u043A\u043E\u043B\u044C\u0446\u043E \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F." },
    { id: 51940, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 8, name: "\u0421\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441 \u0446\u0435\u043D\u043D\u044B\u043C \u0443\u043A\u0440\u0430\u0448\u0435\u043D\u0438\u0435\u043C \u044D\u043F\u043E\u0445\u0438 \u0447\u0443\u0434\u0435\u0441" },
    { id: 51236, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 11, name: "\u0421\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441 \u0434\u0440\u0430\u0433\u043E\u0446\u0435\u043D\u043D\u044B\u043C \u0443\u043A\u0440\u0430\u0448\u0435\u043D\u0438\u0435\u043C \u044D\u043F\u043E\u0445\u0438 \u043C\u0438\u0444\u043E\u0432", description: "\u041E\u0442\u043A\u0440\u044B\u0432 \u044D\u0442\u043E\u0442 \u0441\u0443\u043D\u0434\u0443\u0447\u043E\u043A, \u0432\u044B \u0441\u043C\u043E\u0436\u0435\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043E\u0434\u0438\u043D \u0438\u0437 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u044D\u043F\u043E\u0445\u0438 \u043C\u0438\u0444\u043E\u0432:\n- \u043F\u0435\u0440\u0441\u0442\u0435\u043D\u044C \u0447\u0435\u043C\u043F\u0438\u043E\u043D\u0430 \u0414\u043E\u043C\u0430 \u041D\u043E\u0440\u044C\u0435\u0442\u0442,\n- \u0441\u0435\u0440\u044C\u0433\u0430 \u0447\u0435\u043C\u043F\u0438\u043E\u043D\u0430 \u0414\u043E\u043C\u0430 \u041D\u043E\u0440\u044C\u0435\u0442\u0442,\n- \u043E\u0436\u0435\u0440\u0435\u043B\u044C\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u0440\u0443\u0431\u0435\u0436\u0430,\n- \u043E\u0436\u0435\u0440\u0435\u043B\u044C\u0435 \u0434\u043E\u0431\u043B\u0435\u0441\u0442\u0438 \u0432\u043E\u0438\u043D\u0430 XIII \u0440\u0430\u043D\u0433\u0430,\n- \u043E\u0436\u0435\u0440\u0435\u043B\u044C\u0435 \u0434\u043E\u0431\u043B\u0435\u0441\u0442\u0438 \u0446\u0435\u043B\u0438\u0442\u0435\u043B\u044F XIII \u0440\u0430\u043D\u0433\u0430." },
    { id: 55783, type: "box", icon: "https://archeagecodex.com/items/icon_item_2992.png", grade: 5, name: "\u0421\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441 \u0437\u0430\u0447\u0430\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u0433\u0440\u0430\u0432\u0438\u0440\u043E\u0432\u043A\u043E\u0439 \u0434\u043B\u044F \u0443\u043A\u0440\u0430\u0448\u0435\u043D\u0438\u0439" },
    { id: 50924, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth248.png", grade: 2, name: "\u0414\u0438\u0437\u0430\u0439\u043D \u0448\u0438\u0440\u043E\u043A\u043E\u043F\u043E\u043B\u043E\u0439 \u0448\u043B\u044F\u043F\u044B \u0441\u0442\u0440\u0435\u043B\u043A\u0430" },
    { id: 50925, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth519.png", grade: 2, name: "\u0414\u0438\u0437\u0430\u0439\u043D \u0441\u043E\u043B\u043E\u043C\u0435\u043D\u043D\u043E\u0439 \u0448\u043B\u044F\u043F\u044B" },
    { id: 8002486, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_set/nu_{sex}_sk_korean006.png", grade: 1, name: "\u0414\u0438\u0437\u0430\u0439\u043D \u043A\u043E\u0441\u0442\u044E\u043C\u0430 \u0445\u043E\u0443\u0440\u0438 \u044D\u043F\u043E\u0445\u0438 \u0424\u0430\u0440\u0432\u0430\u0442\u0438" },
    { id: 51092, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_set/nu_{sex}_sk_uniform004.png", grade: 2, name: "\u0414\u0438\u0437\u0430\u0439\u043D \u043E\u0434\u0435\u044F\u043D\u0438\u044F \u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u044F \u0441\u0435\u0432\u0435\u0440\u043D\u043E\u0433\u043E \u041C\u0435\u0439\u0440\u0430" },
    { id: 129, type: "magical", icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 1, name: "\u0414\u0435\u043B\u044C\u0444\u0438\u0439\u0441\u043A\u0430\u044F \u0440\u0443\u043D\u0430", description: "\u041D\u0435\u043A\u0430\u0437\u0438\u0441\u0442\u0430\u044F \u0440\u0443\u043D\u0430 \u0438\u0437 \u0441\u0432\u0435\u0442\u043B\u043E\u0433\u043E \u043F\u0435\u0441\u0447\u0430\u043D\u0438\u043A\u0430.", useDescription: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043C\u0433\u043D\u043E\u0432\u0435\u043D\u043D\u043E \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C 200.000 \u043E\u0447\u043A\u043E\u0432 \u043E\u043F\u044B\u0442\u0430.", reqLevel: 50 },
    { id: 8003128, type: "magical", icon: `${GMRU_CDN_ICONS}3afe6571286a8a3f3cfab503f4bb8b00.png`, grade: 10, name: "\u0414\u0435\u043B\u044C\u0444\u0438\u0439\u0441\u043A\u0430\u044F \u0440\u0443\u043D\u0430 \u044D\u043F\u043E\u0445\u0438 \u043B\u0435\u0433\u0435\u043D\u0434", description: "\u0414\u0440\u0435\u0432\u043D\u044F\u044F \u0440\u0443\u043D\u0430, \u043D\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u0430\u044F \u043D\u0435\u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0439 \u043C\u0430\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u0441\u0438\u043B\u043E\u0439.", useDescription: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043C\u0433\u043D\u043E\u0432\u0435\u043D\u043D\u043E \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C 125,000,000 \u043E\u0447\u043A\u043E\u0432 \u043E\u043F\u044B\u0442\u0430.", reqLevel: 91 },
    { id: 55280, type: "box", icon: "https://archeagecodex.com/items/icon_item_2812.png", grade: 6, name: "\u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u0430\u044F \u0440\u0443\u043D\u0430 \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F" },
    { id: 55683, type: "box", icon: "https://archeagecodex.com/items/icon_item_4527.png", grade: 1, name: "\u041C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u043C\u0430\u0433\u0438\u0441\u0442\u0435\u0440\u0438\u044F\u043C\u0438 \u0434\u043B\u044F \u0443\u043A\u0440\u0430\u0448\u0435\u043D\u0438\u0439" },
    { id: 50536, type: "box", icon: "https://archeagecodex.com/items/icon_item_4527.png", grade: 1, name: "\u041C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u043C\u0430\u0433\u0438\u0441\u0442\u0435\u0440\u0438\u044F\u043C\u0438", description: "\u041E\u0442\u043A\u0440\u044B\u0432 \u043C\u0435\u0448\u043E\u0447\u0435\u043A, \u0432\u044B \u0441\u043C\u043E\u0436\u0435\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043E\u0434\u0438\u043D \u0438\u0437 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432:\n- \u043C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u0440\u0443\u0431\u0438\u043D\u043E\u0432\u044B\u043C\u0438 \u043C\u0430\u0433\u0438\u0441\u0442\u0435\u0440\u0438\u044F\u043C\u0438,\n- \u043C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u043A\u0432\u0430\u0440\u0446\u0435\u0432\u044B\u043C\u0438 \u043C\u0430\u0433\u0438\u0441\u0442\u0435\u0440\u0438\u044F\u043C\u0438,\n- \u043C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u0441\u0430\u043F\u0444\u0438\u0440\u043E\u0432\u044B\u043C\u0438 \u043C\u0430\u0433\u0438\u0441\u0442\u0435\u0440\u0438\u044F\u043C\u0438,\n- \u043C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u0438\u0437\u0443\u043C\u0440\u0443\u0434\u043D\u044B\u043C\u0438 \u043C\u0430\u0433\u0438\u0441\u0442\u0435\u0440\u0438\u044F\u043C\u0438,\n- \u043C\u0435\u0448\u043E\u0447\u0435\u043A \u0441 \u044F\u043D\u0442\u0430\u0440\u043D\u044B\u043C\u0438 \u043C\u0430\u0433\u0438\u0441\u0442\u0435\u0440\u0438\u044F\u043C\u0438." },
    { id: 8001148, icon: "https://archeagecodex.com/items/icon_item_3807.png", grade: 2, name: "\u0421\u0442\u0430\u0442\u0443\u044F \xAB\u041E\u0440\u0445\u0438\u0434\u043D\u0430 \u043D\u0430 \u0442\u0440\u043E\u043D\u0435\xBB" },
    { id: 8001203, icon: "https://archeagecodex.com/items/icon_item_3277.png", grade: 1, name: "\u0421\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441 \u0444\u0430\u043C\u0438\u043B\u044C\u043D\u044B\u043C\u0438 \u0446\u0435\u043D\u043D\u043E\u0441\u0442\u044F\u043C\u0438" },
    { id: 54933, icon: "https://archeagecodex.com/items/icon_item_5809.png", grade: 2, name: "\u0417\u0430\u043C\u0435\u0440\u0437\u0448\u0438\u0439 \u043F\u0440\u0443\u0434" },
    { id: 48860, type: "magical", icon: "https://archeagecodex.com/items/icon_item_4002.png", grade: 6, name: "\u0411\u043E\u043B\u044C\u0448\u0430\u044F \u044D\u0444\u0435\u043D\u0441\u043A\u0430\u044F \u0441\u0444\u0435\u0440\u0430 \u043E\u0440\u0443\u0436\u0435\u0439\u043D\u0438\u043A\u0430", description: "\u041F\u043E\u0432\u044B\u0448\u0430\u0435\u0442 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u0443\u0441\u043F\u0435\u0445\u0430 \u043F\u0440\u0438 \u043F\u043E\u043F\u044B\u0442\u043A\u0435 \u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0445 \u043A\u0443\u0431\u043E\u0432 \u0432 |nc;2|r \u0440\u0430\u0437\u0430." },
    { id: 48861, type: "magical", icon: "https://archeagecodex.com/items/icon_item_4816.png", grade: 6, name: "\u0411\u043E\u043B\u044C\u0448\u0430\u044F \u044D\u0444\u0435\u043D\u0441\u043A\u0430\u044F \u0441\u0444\u0435\u0440\u0430 \u0431\u0440\u043E\u043D\u043D\u0438\u043A\u0430", description: "\u041F\u043E\u0432\u044B\u0448\u0430\u0435\u0442 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u0443\u0441\u043F\u0435\u0445\u0430 \u043F\u0440\u0438 \u043F\u043E\u043F\u044B\u0442\u043A\u0435 \u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0445 \u043A\u0443\u0431\u043E\u0432 \u0432 |nc;2|r \u0440\u0430\u0437\u0430." },
    { id: 44359, type: "potion", icon: "https://archeagecodex.com/items/icon_item_3559.png", grade: 1, name: "\u041F\u043E\u0445\u043E\u0434\u043D\u044B\u0439 \u0444\u0438\u0430\u043B \u0441\u043B\u0430\u0432\u044B" },
    { id: 55800, type: "box", icon: "https://archeagecodex.com/items/icon_item_5486.png", grade: 4, name: "\u0421\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0430\u043C\u0438 \u0441\u0443\u0434\u044C\u0431\u044B", description: "\u041E\u0442\u043A\u0440\u044B\u0432 \u044D\u0442\u043E\u0442 \u0441\u0443\u043D\u0434\u0443\u0447\u043E\u043A, \u0432\u044B \u0441\u043C\u043E\u0436\u0435\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043E\u0434\u0438\u043D \u0438\u0437 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432:\n- \u043F\u044B\u043B\u044C \u0441\u0443\u0434\u044C\u0431\u044B (25 \u0448\u0442.),\n- \u0441\u043B\u0438\u0442\u043E\u043A \u0441\u0443\u0434\u044C\u0431\u044B (5 \u0448\u0442.),\n- \u043F\u0440\u0438\u0437\u043C\u0430 \u0441\u0443\u0434\u044C\u0431\u044B." },
    { id: 8002772, type: "box", icon: "https://archeagecodex.com/items/icon_item_5043.png", grade: 5, name: "\u041E\u043A\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0441\u0442\u0430\u043B\u044C\u044E \u044F\u0449\u0438\u043A \u0441 \u0431\u043E\u0435\u0432\u044B\u043C \u043F\u0438\u0442\u043E\u043C\u0446\u0435\u043C", description: "\u0421\u043D\u044F\u0432 \u043F\u0435\u0447\u0430\u0442\u044C, \u0432\u044B \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u0435 \u041A\u0432\u0430\u0434\u0440\u0443\u043C\u0430, \u041C\u0438\u0441\u0442\u0435\u0440\u0438\u043E\u043D\u0430 \u0438\u043B\u0438 \u041C\u0438\u0441\u0442\u0435\u0440\u0438\u043E\u043D\u0430, \u0423\u0436\u0430\u0441\u0430 \u041D\u043E\u0447\u0438 (\u043D\u0430 \u0432\u044B\u0431\u043E\u0440)." },
    { id: 50635, type: "magical", icon: "https://archeagecodex.com/items/icon_item_5058.png", grade: 2, isPersonal: true, name: "\u0417\u0430\u0433\u043E\u0432\u043E\u0440\u0435\u043D\u043D\u0430\u044F \u0433\u0430\u0434\u0430\u043B\u044C\u043D\u0430\u044F \u0440\u0443\u043D\u0430", description: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0437\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u043E\u0434\u0438\u043D \u0438\u0437 \u044D\u0444\u0444\u0435\u043A\u0442\u043E\u0432 \u0441\u0438\u043D\u0442\u0435\u0437\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0434\u0440\u0443\u0433\u0438\u043C, \u0432\u044B\u0431\u0440\u0430\u0432 \u043D\u0443\u0436\u043D\u044B\u0439 \u044D\u0444\u0444\u0435\u043A\u0442.\n\n|ni;\u041F\u043E\u0434\u0445\u043E\u0434\u0438\u0442 \u0434\u043B\u044F \u044D\u0444\u0435\u043D\u0441\u043A\u043E\u0433\u043E \u0438 \u0440\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u043E\u0433\u043E \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u044F; \u0442\u0440\u043E\u0444\u0435\u0435\u0432, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044B\u0445 \u0437\u0430 \u043F\u043E\u0431\u0435\u0434\u0443 \u043D\u0430\u0434 \u043C\u0438\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u043C\u0438 \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u0430\u043C\u0438; \u043E\u0436\u0435\u0440\u0435\u043B\u0438\u0439, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044B\u0445 \u043D\u0430 \u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u043C \u0440\u0443\u0431\u0435\u0436\u0435; \u043F\u0435\u0440\u0441\u0442\u043D\u0435\u0439 \u0433\u043E\u0432\u043E\u0440\u044F\u0449\u0435\u0433\u043E \u0441 \u0434\u0443\u0445\u0430\u043C\u0438; \u0430 \u0442\u0430\u043A\u0436\u0435 \u0434\u043B\u044F \u043A\u043E\u0441\u0442\u044E\u043C\u043E\u0432, \u043F\u043B\u0430\u0449\u0435\u0439 \u0438 \u0443\u043A\u0440\u0430\u0448\u0435\u043D\u0438\u0439 \u0447\u0435\u043C\u043F\u0438\u043E\u043D\u043E\u0432 \u041F\u043E\u0440\u0442-\u0410\u0440\u0433\u0435\u043D\u0442\u043E.|r", useDescription: '\u041F\u0440\u0438\u0441\u0442\u0443\u043F\u0438\u0442\u044C \u043A \u0437\u0430\u043C\u0435\u043D\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u0430.<br>\u0420\u0430\u0441\u0445\u043E\u0434 \u043E\u0447\u043A\u043E\u0432 \u0440\u0430\u0431\u043E\u0442\u044B: <span class="orange_text">50</span>.' },
    { id: 8002769, icon: "https://archeagecodex.com/items/quest/icon_item_quest217.png", grade: 3, isPersonal: true, name: "\u0417\u043D\u0430\u043A \xAB\u041A\u043B\u044E\u0447\u0435\u0432\u0430\u044F \u0444\u0438\u0433\u0443\u0440\u0430\xBB", description: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0442\u0438\u0442\u0443\u043B \xAB\u041A\u043B\u044E\u0447\u0435\u0432\u0430\u044F \u0444\u0438\u0433\u0443\u0440\u0430\xBB.", useDescription: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0442\u0438\u0442\u0443\u043B." },
    { id: 30604, icon: "https://archeagecodex.com/items/icon_item_1643.png", grade: 5, name: "\u041C\u043E\u043D\u0435\u0442\u044B \u0434\u0430\u0440\u0443 x100" },
    { id: 28814, icon: "https://archeagecodex.com/items/icon_item_1643.png", grade: 5, name: "\u041C\u043E\u043D\u0435\u0442\u044B \u0434\u0430\u0440\u0443 x180" },
    { id: 55450, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 7, name: "\u0420\u0435\u043B\u0438\u043A\u0432\u0438\u0439\u043D\u043E\u0435 \u043A\u043E\u043B\u044C\u0446\u043E \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F" },
    { id: 8002410, type: "equipment", subType: "cloak", icon: "https://archeagecodex.com/items/icon_item_0936.png", grade: 5, name: "\u0410\u043B\u044B\u0439 \u0448\u0430\u0440\u0444", description: "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E, \u0432 \u0447\u0435\u043C \u043F\u0440\u0438\u0447\u0438\u043D\u0430, \u043D\u043E \u043A \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0443 \u0432 \u0442\u0430\u043A\u043E\u043C \u0448\u0430\u0440\u0444\u0435 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0438\u0435 \u043F\u043E\u0447\u0435\u043C\u0443-\u0442\u043E \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F \u0441 \u043E\u0441\u043E\u0431\u0435\u043D\u043D\u044B\u043C \u0443\u0432\u0430\u0436\u0435\u043D\u0438\u0435\u043C (\u0438 \u0434\u0430\u0436\u0435 \u0441 \u043D\u0435\u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u043E\u043F\u0430\u0441\u043A\u043E\u0439).\n\n|nc;\u0423\u0441\u0438\u043B\u0438\u0432\u0430\u044E\u0449\u0438\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u044B \u043A\u043E\u0441\u0442\u044E\u043C\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0442 30 \u0434\u043D\u0435\u0439. \u0427\u0442\u043E\u0431\u044B \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0438\u0445 \u0437\u0430\u043D\u043E\u0432\u043E, \u043A\u043E\u0441\u0442\u044E\u043C \u043D\u0443\u0436\u043D\u043E \u043F\u043E\u0441\u0442\u0438\u0440\u0430\u0442\u044C.|r", equipDescription: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u0435\u0440\u0435\u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F +|nc;3|r%\n\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u043B\u0430\u0432\u0430\u043D\u0438\u044F +|nc;3|r%\n\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0437\u0430\u043D\u044F\u0442\u0438\u044F \u0440\u0435\u043C\u0435\u0441\u043B\u043E\u043C |nc;+10%|r\n\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0437\u0430\u043D\u044F\u0442\u0438\u044F \u0436\u0438\u0432\u043E\u0442\u043D\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E\u043C |nc;+10%|r\n\u041E\u043F\u044B\u0442 \u043F\u0440\u0438 \u0437\u0430\u043D\u044F\u0442\u0438\u0438 \u0440\u0435\u043C\u0435\u0441\u043B\u043E\u043C |nc;+10|r%", isEquipDescriptionTemporary: true },
    { id: 34684, type: "equipment", subType: "windInstrument", icon: "https://archeagecodex.com/items/icon_item_ins_s_0051.png", name: "\u0423\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043D\u0430\u044F \u0430\u0440\u0433\u0435\u043D\u0438\u0442\u043E\u0432\u0430\u044F \u043B\u044E\u0442\u043D\u044F" },
    { id: 34685, type: "equipment", subType: "windInstrument", icon: "https://archeagecodex.com/items/icon_item_ins_w_0025.png", name: "\u0423\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043D\u044B\u0439 \u0430\u0440\u0433\u0435\u043D\u0438\u0442\u043E\u0432\u044B\u0439 \u043A\u043B\u0430\u0440\u043D\u0435\u0442" },
    { id: 417, icon: "https://archeagecodex.com/items/icon_item_0418.png", grade: 1, name: "\u0420\u0435\u0434\u043A\u0438\u0439 \u043A\u0430\u043C\u0435\u043D\u044C \u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u0438\u0439", isPersonal: true, description: "\u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u043A\u043D\u0438\u0433\u0438 \u043F\u043E\u0440\u0442\u0430\u043B\u043E\u0432.", price: 0, reqLevel: 1 },
    { id: 52701, icon: "https://archeagecodex.com/items/icon_item_5282.png", grade: 1, name: "\u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B \u0438\u0437\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0430\u043D\u0430\u0434\u0438\u044F", description: "\u042D\u0442\u0438 \u043B\u0438\u043B\u043E\u0432\u044B\u0435 \u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u044B \u2013 \u0434\u043E\u0441\u0442\u043E\u0439\u043D\u043E\u0435 \u043F\u043E\u0434\u043D\u043E\u0448\u0435\u043D\u0438\u0435 \u0434\u0443\u0445\u0430\u043C-\u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u044F\u043C.\n\u041E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0432 \u0440\u044E\u043A\u0437\u0430\u043A\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 \u043F\u044F\u0442\u0438 \u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u043E\u0432. \u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u044B \u0438\u0441\u0447\u0435\u0437\u043D\u0443\u0442 \u0447\u0435\u0440\u0435\u0437 \u043E\u0434\u0438\u043D \u0447\u0430\u0441.", useDescription: "\u041F\u043E\u0434\u043D\u0435\u0441\u0442\u0438 \u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B \u0434\u0443\u0445\u0430\u043C-\u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u044F\u043C \u0443 \u0434\u0440\u0435\u0432\u043D\u0435\u0433\u043E \u0442\u043E\u0442\u0435\u043C\u0430 \u0438\u043B\u0438 \u0443\u0441\u0438\u043B\u0438\u0442\u044C \u043F\u0440\u0438\u0437\u0432\u0430\u043D\u043D\u043E\u0433\u043E \u0434\u0443\u0445\u0430-\u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u044F.", price: 0 },
    { id: 40491, icon: "https://archeagecodex.com/items/icon_item_3090.png", grade: 2, name: "\u0417\u043D\u0430\u043A \u043E\u0442\u0432\u0430\u0433\u0438" },
    { id: 46695, icon: "https://archeagecodex.com/items/icon_item_4557.png", grade: 3, name: "\u0411\u0435\u043B\u043E\u0441\u043D\u0435\u0436\u043D\u044B\u0439 \u043E\u043B\u0435\u043D\u0435\u043D\u043E\u043A" },
    { id: 48521, type: "magical", icon: "https://archeagecodex.com/items/icon_item_2070.png", grade: 5, name: "\u0411\u043E\u043B\u044C\u0448\u043E\u0439 \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0439 \u043A\u0443\u0431 \u043E\u0440\u0443\u0436\u0435\u0439\u043D\u0438\u043A\u0430" },
    { id: 48522, type: "magical", icon: "https://archeagecodex.com/items/icon_item_2069.png", grade: 5, name: "\u0411\u043E\u043B\u044C\u0448\u043E\u0439 \u044D\u0444\u0435\u043D\u0441\u043A\u0438\u0439 \u043A\u0443\u0431 \u0431\u0440\u043E\u043D\u043D\u0438\u043A\u0430" },
    { id: 8002273, type: "box", icon: "https://archeagecodex.com/items/icon_item_1668.png", grade: 1, name: "\u041D\u0430\u0431\u043E\u0440 \u0430\u043D\u0438\u043C\u0430\u0433\u0430" },
    { id: 8002483, type: "box", icon: "https://archeagecodex.com/items/icon_item_3261.png", grade: 1, name: "\u041A\u043E\u0440\u043E\u0431\u043A\u0430 \u0441 \u0431\u0435\u043B\u044C\u0435\u043C \xAB\u041D\u043E\u0447\u0438 \u0410\u043B\u044C-\u0425\u0430\u0440\u0431\u044B\xBB" },
    { id: 45409, type: "unidentified", overlay: "unconfirmed", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth292.png", grade: 2, name: "\u0420\u0430\u043C\u0438\u0430\u043D\u0441\u043A\u043E\u0435 \u043C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u043E\u0435 \u0441\u043D\u0430\u0440\u044F\u0436\u0435\u043D\u0438\u0435" },
    { id: 53586, type: "unidentified", icon: "https://archeagecodex.com/items/icon_item_5144.png", grade: 4, name: "\u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0441\u0443\u043D\u0434\u0443\u0447\u043E\u043A \u0441\u043E \u0437\u043D\u0430\u043A\u0430\u043C\u0438 \u043A\u0443\u043B\u044C\u0442\u0438\u0441\u0442\u043E\u0432" },
    { id: 46151, type: "magical", icon: "https://archeagecodex.com/items/icon_item_4467.png", grade: 3, name: "\u0417\u0430\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043E\u0433\u0440\u0430\u043D\u0449\u0438\u043A\u0430", isPersonal: true },
    { id: 49252, type: "quest", icon: "https://archeagecodex.com/items/icon_item_4878.png", grade: 2, name: "\u041E\u0431\u0440\u0430\u0437\u0446\u044B \u0444\u043B\u043E\u0440\u044B \u0421\u0430\u0434\u0430", isPersonal: true, price: 0, description: "\u041F\u0430\u043A\u0435\u0442\u0438\u043A \u0441 \u043E\u0431\u0440\u0430\u0437\u0446\u0430\u043C\u0438 \u0444\u043B\u043E\u0440\u044B \u0421\u0430\u0434\u0430 \u041C\u0430\u0442\u0435\u0440\u0438." },
    { id: 31151, type: "other", icon: "https://archeagecodex.com/items/x_mas_gift.png", grade: 1, name: "\u041F\u0435\u0440\u0435\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0439 \u043B\u0435\u043D\u0442\u043E\u0447\u043A\u043E\u0439 \u043F\u043E\u0434\u0430\u0440\u043E\u043A", description: "\u041F\u043E\u0445\u043E\u0436\u0435, \u043E\u0434\u0438\u043D \u0438\u0437 \u0441\u043D\u0435\u0433\u043E\u0432\u0438\u043A\u043E\u0432 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u0443\u043A\u0440\u0430\u0448\u0435\u043D\u0438\u044F\u043C\u0438 \u043F\u0440\u0438\u0445\u0432\u0430\u0442\u0438\u043B \u043F\u043E\u0434\u0430\u0440\u043E\u043A \u0438\u0437 \u0442\u0435\u0445, \u0447\u0442\u043E \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u043B \u0440\u0430\u0437\u0434\u0430\u0432\u0430\u0442\u044C \u043D\u0430 \u0443\u043B\u0438\u0446\u0430\u0445 \u0433\u043E\u0440\u043E\u0434\u0430.", useDescription: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0434\u0430\u0440\u043E\u043A.\n\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044F Shift, \u0449\u0435\u043B\u043A\u043D\u0438\u0442\u0435 \u043F\u0440\u0430\u0432\u043E\u0439 \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \u043C\u044B\u0448\u0438, \u0447\u0442\u043E\u0431\u044B \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0432\u0441\u0435 \u043F\u043E\u0434\u0430\u0440\u043A\u0438 \u044D\u0442\u043E\u0433\u043E \u0432\u0438\u0434\u0430 \u043E\u0434\u0438\u043D \u0437\u0430 \u0434\u0440\u0443\u0433\u0438\u043C.", isPersonal: true, price: 0 },
    { id: 28188, type: "rareMaterial", icon: `${GMRU_CDN_ICONS}d2f377e3c3118826089a2caf9e794a50.png`, grade: 3, name: "\u0421\u043F\u043B\u0430\u0432 \u0441\u0442\u0438\u0445\u0438\u0439", description: "\u041C\u043E\u0436\u043D\u043E \u0438\u0437\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E |ni;\u0442\u0438\u0433\u043B\u044F \u0441\u0442\u0438\u0445\u0438\u0439|r.\n\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0432 \u0440\u0435\u043C\u0435\u0441\u043B\u0435.", isPersonal: true, price: 360 },
    { id: 55516, type: "box", icon: "https://archeagecodex.com/items/icon_item_2812.png", grade: 5, name: "\u042D\u043F\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0440\u0443\u043D\u0430 \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F", isPersonal: true },
    { id: 55490, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 8, name: "\u0421\u0435\u0440\u044C\u0433\u0430 \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F \u044D\u043F\u043E\u0445\u0438 \u0447\u0443\u0434\u0435\u0441", isPersonal: true },
    { id: 55255, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 7, name: "\u0420\u0435\u043B\u0438\u043A\u0432\u0438\u0439\u043D\u0430\u044F \u0441\u0435\u0440\u044C\u0433\u0430 \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F", isPersonal: true },
    { id: 52808, type: "unidentified", overlay: "unconfirmed", icon: "https://archeagecodex.com/items/icon_item_teleport.png", grade: 1, name: "\u041A\u043D\u0438\u0433\u0430 \u043F\u043E\u0440\u0442\u0430\u043B\u043E\u0432 (7 \u0434.)", isPersonal: true },
    { id: 34702, type: "equipment", subType: "windInstrument", icon: "https://archeagecodex.com/items/icon_item_ins_w_0049.png", name: "\u0417\u0435\u0440\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0430\u0440\u0433\u0435\u043D\u0438\u0442\u043E\u0432\u044B\u0439 \u043A\u043B\u0430\u0440\u043D\u0435\u0442", buff: { avgRestoreMana: 16 } },
    { id: 51723, type: "mount", icon: "https://archeagecodex.com/items/icon_item_5149.png", grade: 4, name: "\u042F\u0449\u0438\u043A \u0441 \u041C\u0430\u0440\u0443, \u043F\u043E\u043A\u043E\u0440\u0438\u0442\u0435\u043B\u0435\u043C \u043F\u0440\u043E\u0441\u0442\u043E\u0440\u043E\u0432", isPersonal: true },
    { id: 8002771, type: "box", icon: "https://archeagecodex.com/items/icon_item_5043.png", grade: 5, name: "\u041E\u043A\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0441\u0442\u0430\u043B\u044C\u044E \u044F\u0449\u0438\u043A \u0441 \u0433\u043B\u0430\u0439\u0434\u0435\u0440\u043E\u043C", isPersonal: true },
    { id: 39363, type: "battlePet", icon: "https://archeagecodex.com/items/icon_item_2275.png", grade: 1, name: "\u041E\u0441\u0435\u043D\u043D\u0438\u0439 \u041B\u043E\u0441\u043A\u0443\u0442\u0438\u043A" },
    { id: 34972, icon: "https://archeagecodex.com/items/doll_pet_hm_001.png", grade: 1, name: "\u041A\u0440\u0430\u0441\u043D\u044B\u0435 \u043E\u0447\u043A\u0438-\u0441\u0435\u0440\u0434\u0435\u0447\u043A\u0438" },
    { id: 34975, icon: "https://archeagecodex.com/items/doll_pet_bo_001.png", grade: 1, name: "\u041A\u0443\u043B\u0438\u043D\u0430\u0440\u043D\u044B\u0435 \u043F\u0435\u0440\u0447\u0430\u0442\u043A\u0438 \u0432 \u043A\u0440\u0430\u0441\u043D\u044B\u0439 \u0433\u043E\u0440\u043E\u0448\u0435\u043A" },
    { id: 36183, icon: "https://archeagecodex.com/items/doll_pet_ar_007.png", grade: 1, name: "\u041A\u0440\u0430\u0441\u043D\u044B\u0439 \u0437\u0430\u0432\u043E\u0434\u043D\u043E\u0439 \u043A\u043B\u044E\u0447\u0438\u043A" },
    { id: 34981, type: "battlePet", icon: "https://archeagecodex.com/items/icon_item_2720.png", grade: 1, name: "\u0414\u0435\u0442\u0435\u043D\u044B\u0448 \u0413\u0430\u0440\u0442\u0430\u0440\u0435\u0439\u043D" },
    { id: 37018, type: "lightArmor", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth560.png", grade: 3, name: "\u0412\u044F\u0437\u0430\u043D\u0430\u044F \u0448\u0430\u043F\u043E\u0447\u043A\u0430" },
    { id: 49630, type: "furniture", icon: "https://archeagecodex.com/items/icon_item_4862.png", grade: 5, name: "\u0421\u0442\u0430\u0442\u0443\u044D\u0442\u043A\u0430 \xAB\u0410\u0440\u0430\u043D\u0437\u0435\u0431\xBB" },
    { id: 31787, type: "lightArmor", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth550.png", grade: 3, name: "\u041E\u0431\u043E\u0434\u043E\u043A \u0441\u043E \u0441\u043D\u0435\u0433\u043E\u0432\u0438\u0447\u043A\u0430\u043C\u0438" },
    { id: 28242, type: "craftItem", icon: "https://archeagecodex.com/items/icon_item_1243.png", grade: 1, name: "\u041C\u044B\u043B\u043E" },
    { id: 43298, type: "craftItem", icon: "https://archeagecodex.com/items/icon_item_3952.png", grade: 1, name: "\u0422\u0435\u043D\u0435\u0432\u043E\u0439 \u0434\u0435\u043B\u0435\u0446" },
    { id: 8002004, type: "mount", icon: "https://archeagecodex.com/items/icon_item_2774.png", grade: 1, name: "\u041F\u0440\u0438\u0437\u0440\u0430\u0447\u043D\u044B\u0439 \u043A\u043E\u043D\u044C (30 \u0434.)" },
    { id: 8000315, type: "lightArmor", icon: "https://archeagecodex.com/items/costume_cp/nu_f_cp_leather002.png", grade: 1, name: "\u041D\u0430\u043A\u0438\u0434\u043A\u0430 \u0438\u0437 \u0433\u0440\u0438\u0444\u043E\u043D\u044C\u0438\u0445 \u043F\u0435\u0440\u044C\u0435\u0432" },
    { id: 8000127, type: "equipment", subType: "costume", icon: "https://archeagecodex.com/items/costume_set/nu_f_sk_party001.png", grade: 2, name: "\u0411\u0430\u043B\u044C\u043D\u044B\u0439 \u043D\u0430\u0440\u044F\u0434 \u0414\u0432\u0443\u0445 \u041A\u043E\u0440\u043E\u043D" },
    { id: 55495, type: "box", icon: "https://archeagecodex.com/items/icon_item_2375.png", grade: 9, name: "\u041A\u043E\u043B\u044C\u0446\u043E \u0438\u0444\u043D\u0438\u0440\u0441\u043A\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F \u044D\u043F\u043E\u0445\u0438 \u0441\u043A\u0430\u0437\u0430\u043D\u0438\u0439" },
    { id: 33156, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_cloth554.png", name: "\u0412\u0438\u0448\u043D\u0435\u0432\u0430\u044F \u0448\u043B\u044F\u043F\u0430-\u0442\u043E\u0440\u0442" },
    { id: 45373, type: "furniture", icon: "https://archeagecodex.com/items/icon_item_4353.png", grade: 2, name: "\u0424\u043E\u043D\u0442\u0430\u043D \xAB\u041B\u0435\u0441\u043D\u0430\u044F \u0433\u0430\u0440\u043C\u043E\u043D\u0438\u044F\xBB" },
    { id: 8000346, icon: "https://archeagecodex.com/items/icon_item_1360.png", grade: 2, name: "\u0411\u0435\u043B\u0430\u044F \u0441\u0443\u0431\u043C\u0430\u0440\u0438\u043D\u0430 (30 \u0434.)" },
    { id: 8000309, type: "mount", icon: "https://archeagecodex.com/items/icon_item_1502.png", grade: 3, name: "\u0426\u0438\u0440\u043A\u043E\u0432\u043E\u0439 \u043C\u0435\u0434\u0432\u0435\u0434\u044C (\u043D\u0430 30 \u0434\u043D\u0435\u0439)" },
    { id: 31878, type: "furniture", icon: "https://archeagecodex.com/items/icon_item_1670.png", grade: 2, name: "\u041D\u0435\u0432\u0435\u0440\u0438\u043D\u0441\u043A\u0438\u0439 \u043F\u0430\u0442\u0435\u0444\u043E\u043D" },
    { id: 8002069, icon: "https://archeagecodex.com/items/icon_item_moonstone05.png", grade: 1, name: "\u0414\u0430\u0440 \u0436\u0440\u0438\u0446\u044B \u041D\u0443\u0438" },
    { id: 39551, type: "furniture", icon: "https://archeagecodex.com/items/icon_item_2847.png", grade: 2, name: "\u041F\u0435\u0441\u0447\u0430\u043D\u0430\u044F \u0441\u043A\u0443\u043B\u044C\u043F\u0442\u0443\u0440\u0430 \u041F\u043E\u0431\u0435\u0434\u044B" },
    { id: 8000310, icon: "https://archeagecodex.com/items/icon_item_2979.png", grade: 1, name: "\u0416\u0435\u0442\u043E\u043D \u043D\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0443 \u043E\u0440\u0443\u0436\u0438\u044F" },
    { id: 8000311, icon: "https://archeagecodex.com/items/icon_item_2980.png", grade: 1, name: "\u0416\u0435\u0442\u043E\u043D \u043D\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0443 \u0434\u043E\u0441\u043F\u0435\u0445\u043E\u0432" },
    { id: 8000441, icon: "https://archeagecodex.com/items/icon_item_2993.png", grade: 1, name: "\u0418\u0444\u0435\u0440\u0438\u0439\u0441\u043A\u0430\u044F \u043C\u043E\u043D\u0435\u0442\u043A\u0430" },
    { id: 8000442, icon: "https://archeagecodex.com/items/icon_item_2982.png", grade: 1, name: "\u0417\u0430\u043A\u043E\u043B\u0434\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u043C\u043E\u043D\u0435\u0442\u043A\u0430" },
    { id: 45880, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png", name: "\u0414\u0438\u0430\u0434\u0435\u043C\u0430 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u043C\u043D\u0435\u043C\u043E\u043D\u0438\u043A\u0430", isPersonal: true },
    { id: 45881, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0439 \u043A\u0430\u043C\u0437\u043E\u043B \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u043C\u043D\u0435\u043C\u043E\u043D\u0438\u043A\u0430", isPersonal: true },
    { id: 45882, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0435 \u043F\u043E\u043D\u043E\u0436\u0438 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u043C\u043D\u0435\u043C\u043E\u043D\u0438\u043A\u0430", isPersonal: true },
    { id: 45883, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0435 \u043F\u0435\u0440\u0447\u0430\u0442\u043A\u0438 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u043C\u043D\u0435\u043C\u043E\u043D\u0438\u043A\u0430", isPersonal: true },
    { id: 45884, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0435 \u0441\u0430\u043F\u043E\u0433\u0438 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u043C\u043D\u0435\u043C\u043E\u043D\u0438\u043A\u0430", isPersonal: true },
    { id: 45885, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_cloth_0020.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0435 \u043D\u0430\u0440\u0443\u0447\u0438 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u043C\u043D\u0435\u043C\u043E\u043D\u0438\u043A\u0430", isPersonal: true },
    { id: 45886, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_cloth_0021.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0439 \u043F\u043E\u044F\u0441 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u043C\u043D\u0435\u043C\u043E\u043D\u0438\u043A\u0430", isPersonal: true },
    { id: 45991, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_cloth295.png", name: "\u0414\u0438\u0430\u0434\u0435\u043C\u0430 \u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435\u043B\u044F \u0442\u0430\u0439\u043D\u044B\u0445 \u0430\u0440\u0445\u0438\u0432\u043E\u0432", isPersonal: true },
    { id: 45990, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_cloth295.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0439 \u043A\u0430\u043C\u0437\u043E\u043B \u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435\u043B\u044F \u0442\u0430\u0439\u043D\u044B\u0445 \u0430\u0440\u0445\u0438\u0432\u043E\u0432", isPersonal: true },
    { id: 45989, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_cloth295.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0435 \u043F\u043E\u043D\u043E\u0436\u0438 \u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435\u043B\u044F \u0442\u0430\u0439\u043D\u044B\u0445 \u0430\u0440\u0445\u0438\u0432\u043E\u0432", isPersonal: true },
    { id: 45988, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_cloth295.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0435 \u043F\u0435\u0440\u0447\u0430\u0442\u043A\u0438 \u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435\u043B\u044F \u0442\u0430\u0439\u043D\u044B\u0445 \u0430\u0440\u0445\u0438\u0432\u043E\u0432", isPersonal: true },
    { id: 45987, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_cloth295.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0435 \u0441\u0430\u043F\u043E\u0433\u0438 \u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435\u043B\u044F \u0442\u0430\u0439\u043D\u044B\u0445 \u0430\u0440\u0445\u0438\u0432\u043E\u0432", isPersonal: true },
    { id: 45986, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_cloth_0020.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0435 \u043D\u0430\u0440\u0443\u0447\u0438 \u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435\u043B\u044F \u0442\u0430\u0439\u043D\u044B\u0445 \u0430\u0440\u0445\u0438\u0432\u043E\u0432", isPersonal: true },
    { id: 45985, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_cloth_0021.png", name: "\u041C\u0430\u0442\u0435\u0440\u0447\u0430\u0442\u044B\u0439 \u043F\u043E\u044F\u0441 \u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435\u043B\u044F \u0442\u0430\u0439\u043D\u044B\u0445 \u0430\u0440\u0445\u0438\u0432\u043E\u0432", isPersonal: true },
    { id: 45887, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png", name: "\u0424\u0438\u0431\u0443\u043B\u0430 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 45888, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png", name: "\u041A\u043E\u0436\u0430\u043D\u0430\u044F \u043A\u0443\u0440\u0442\u043A\u0430 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 45889, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0435 \u043F\u043E\u043D\u043E\u0436\u0438 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 45890, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0435 \u043F\u0435\u0440\u0447\u0430\u0442\u043A\u0438 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 47047, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0435 \u0441\u0430\u043F\u043E\u0433\u0438 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 47048, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_leather_0020.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0435 \u043D\u0430\u0440\u0443\u0447\u0438 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 47049, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_leather_0021.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0439 \u043F\u043E\u044F\u0441 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 47043, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_{sex}_hm_leather295.png", name: "\u0424\u0438\u0431\u0443\u043B\u0430 \u0443\u043A\u0440\u043E\u0442\u0438\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 47044, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_leather295.png", name: "\u041A\u043E\u0436\u0430\u043D\u0430\u044F \u043A\u0443\u0440\u0442\u043A\u0430 \u0443\u043A\u0440\u043E\u0442\u0438\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 47045, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_leather295.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0435 \u043F\u043E\u043D\u043E\u0436\u0438 \u0443\u043A\u0440\u043E\u0442\u0438\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 47046, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_leather295.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0435 \u043F\u0435\u0440\u0447\u0430\u0442\u043A\u0438 \u0443\u043A\u0440\u043E\u0442\u0438\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 45891, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_leather295.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0435 \u0441\u0430\u043F\u043E\u0433\u0438 \u0443\u043A\u0440\u043E\u0442\u0438\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 45892, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_leather_0020.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0435 \u043D\u0430\u0440\u0443\u0447\u0438 \u0443\u043A\u0440\u043E\u0442\u0438\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 45893, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_leather_0021.png", name: "\u041A\u043E\u0436\u0430\u043D\u044B\u0439 \u043F\u043E\u044F\u0441 \u0443\u043A\u0440\u043E\u0442\u0438\u0442\u0435\u043B\u044F \u0433\u0440\u0438\u043C\u0443\u0430\u0440\u043E\u0432", isPersonal: true },
    { id: 45894, type: "equipment", equipmentSubType: "helmet", icon: "https://archeagecodex.com/items/costume_hm/nu_m_hm_metal295.png", name: "\u041B\u0430\u0442\u043D\u044B\u0439 \u0448\u043B\u0435\u043C \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u0430\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441\u0430", isPersonal: true },
    { id: 45895, type: "equipment", equipmentSubType: "armor", icon: "https://archeagecodex.com/items/costume_ar/nu_{sex}_ar_metal295.png", name: "\u041B\u0430\u0442\u043D\u044B\u0439 \u043D\u0430\u0433\u0440\u0443\u0434\u043D\u0438\u043A \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u0430\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441\u0430", isPersonal: true },
    { id: 45896, type: "equipment", equipmentSubType: "pants", icon: "https://archeagecodex.com/items/costume_pt/nu_{sex}_pt_metal295.png", name: "\u041B\u0430\u0442\u043D\u044B\u0435 \u043F\u043E\u043D\u043E\u0436\u0438 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u0430\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441\u0430", isPersonal: true },
    { id: 45897, type: "equipment", equipmentSubType: "gloves", icon: "https://archeagecodex.com/items/costume_gv/nu_m_gv_metal295.png", name: "\u041B\u0430\u0442\u043D\u044B\u0435 \u043F\u0435\u0440\u0447\u0430\u0442\u043A\u0438 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u0430\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441\u0430", isPersonal: true },
    { id: 45898, type: "equipment", equipmentSubType: "boots", icon: "https://archeagecodex.com/items/costume_bo/nu_{sex}_bo_metal295.png", name: "\u041B\u0430\u0442\u043D\u044B\u0435 \u0441\u0430\u043F\u043E\u0433\u0438 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u0430\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441\u0430", isPersonal: true },
    { id: 45899, type: "equipment", equipmentSubType: "bracer", icon: "https://archeagecodex.com/items/icon_item_arm_metal_0020.png", name: "\u041B\u0430\u0442\u043D\u044B\u0435 \u043D\u0430\u0440\u0443\u0447\u0438 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u0430\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441\u0430", isPersonal: true },
    { id: 45900, type: "equipment", equipmentSubType: "belt", icon: "https://archeagecodex.com/items/icon_item_belt_metal_0021.png", name: "\u041B\u0430\u0442\u043D\u044B\u0439 \u043F\u043E\u044F\u0441 \u044D\u0440\u043D\u0430\u0440\u0434\u0441\u043A\u043E\u0433\u043E \u0430\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441\u0430", isPersonal: true },
    { id: 53522, type: "other", icon: "https://archeagecodex.com/items/quest/icon_item_quest169.png", grade: 2, name: "\u0411\u043E\u043B\u044C\u0448\u043E\u0439 \u0441\u0443\u043D\u0434\u0443\u043A \u041A\u0438\u0440\u0438\u043E\u0441\u0430", description: "\u0421\u0443\u043D\u0434\u0443\u043A \u0441 \u043C\u0435\u0434\u043D\u044B\u043C\u0438 \u0434\u0440\u0430\u043A\u043E\u043D\u0430\u043C\u0438.\n\u0412\u043D\u0443\u0442\u0440\u0438:\n\n- 60-100 \u043C\u0435\u0434\u043D\u044B\u0445 \u0434\u0440\u0430\u043A\u043E\u043D\u043E\u0432.", isPersonal: true },
    { id: 55367, type: "box", icon: "https://archeagecodex.com/items/icon_item_1482.png", grade: 9, name: "\u041B\u0430\u0440\u0435\u0446 \u0441\u043E \u0441\u0432\u0438\u0442\u043A\u0430\u043C\u0438 \u043F\u0440\u043E\u0431\u0443\u0436\u0434\u0435\u043D\u0438\u044F 3 \u0440\u0430\u043D\u0433\u0430" },
    { id: 8000926, type: "other", icon: "https://archeagecodex.com/items/icon_item_3368.png", grade: 1, name: "[1 \u0434\u0435\u043D\u044C] \u041F\u043E\u043A\u0440\u043E\u0432\u0438\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E \u0421\u0438\u043E\u043B\u044C" },
    { id: 51922, type: "box", icon: "https://archeagecodex.com/items/icon_item_4413.png", grade: 2, name: "\u041A\u043E\u0440\u0437\u0438\u043D\u043A\u0430 \u0441 \u0436\u0435\u0442\u043E\u043D\u043E\u043C" },
    { id: 33382, type: "potion", icon: "https://archeagecodex.com/items/icon_item_0843.png", grade: 1, name: "\u0411\u0443\u0442\u044B\u043B\u044C \u0441 \u0438\u043C\u0431\u0438\u0440\u043D\u044B\u043C \u043D\u0430\u043F\u0438\u0442\u043A\u043E\u043C" },
    { id: 8003057, type: "magical", icon: "https://archeagecodex.com/items/icon_item_6009.png", grade: 2, name: "\u041C\u0438\u043C\u043E\u043B\u0435\u0442\u043D\u043E\u0435 \u0431\u043B\u0430\u0433\u043E\u0441\u043B\u043E\u0432\u0435\u043D\u0438\u0435 \u043F\u0440\u0435\u0434\u0435\u043B\u0430" },
    { id: 56010, name: "\u0411\u0435\u043D\u0435\u0434\u0438\u043A\u0442", icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OTdFODYzN0UzRTU2MTFGMTg0NDU4NjRGMEZDN0I0MjYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OTdFODYzN0YzRTU2MTFGMTg0NDU4NjRGMEZDN0I0MjYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5N0U4NjM3QzNFNTYxMUYxODQ0NTg2NEYwRkM3QjQyNiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5N0U4NjM3RDNFNTYxMUYxODQ0NTg2NEYwRkM3QjQyNiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PjAKMw0AABTfSURBVHjaNFlpjBzHdX7d1XfPPTszO7Mnd8ldXhJJUeJK1mVJlm34iJ04dpxECIIgMWLYjg3byJ8gQQzEgRMYQWDHBvwrAezAiYPEcKIocnT5EGVJFEmRIiVyuUvufczdM9N3VVde9Sozy93Z2emqV+9973vf15SeerJeyivFvFwuQDEn5W1im1xXgRDgHOJYCkLwfWnogetKrpf4PkSRFIVSzHjC8DMSBw4AEojPE5ANWSkRvaKYZWJokhIltEujrXDUCsM+Df2EJQlQyhnnlHGWcMqBUU4T8RUnXGGJHDPcmIchhKEU4JIgJTSRiYQbUIrbQxhzGkt4WZJIwMXWsswVLjGMAwPikoTvAU9AkjlIEg+BOTyMWaKAHCXJiFEPGJMSWZZUTqicgAKAF6fnwMtAFtcSAHypYJhpNFIQgIeb4JVMDlSJyLiyRBOMNU1JBBgTHgejlBIJg8anLMIT8aVry4p4JZ6xRIcJ+BLD+GLOgyQJAI/IZS4pGHwiDiBWZzyNIeEEr8WFMTCuJBTiCAKFu4r4GB4kjLiuSLLYU2zPqJTGhHGLY0qJuFDGg2G+4pjhaTgeXSEqkWSViHOIw+Mx5TR5eAQqccyspOCHZCkBTBAuImPlMF78OMUfuChT8CyypMQUkwtKCEp6VMa4HskaAYIB4QM/m+CbaVhMLCzqGHgsZopmZcrlTLYgS3IYeGHgRn4Q+V4UekQzVMOmkpIkaZFxJdwJd8Oo8HKEGqKHYd0x1ZguhrlKBAQTkULcBo8eyCKCBHenMsUKEklBMAmAYASYSFxY/Bb7URj4ucpUY2YuVypZ2ZKWLSiKljAaRyENXG84GnY6nZ2N3fVlzKGeK8qymnBRZMyWjNnhMsGYFDwk7sYgwpzLIMomaoaAV1LMA5UhFOUX6MJ8qJghCRTyLloFXhAN3lCW9akT904cOWbny9gVcRy6XgAa1QjRTFvL5bLjauOYgsH1ttZXrry+ffOaYth6roypZUAUWWYHkaX9hbiSEGNSLLAs8IpYSsj8eBZT+W59cOsEI5UTJtCDsXIsk+htEg4HZm5s/t6Ha4cWsOH7w2EYMgQVIbhTEkYxjUI/jIf+MECSINLYzKHp42ezlfqwtT/qtPRMlmi6jBAjGLwqKRibwHfaE4gEZIHk4EnmMCBEQdoy+DdMBk+bBnMLBy0NMkZjFSrz9z1mFvLuwPH8CAvMVUi7WFRXVCQIcQWmyAR0WSah08Eeqi+emDp6GoHV2ryjm7aqWwTTRDSZICGIXQWNcdH4AhQc05YGRERLQZojEC8Q+zxtaEmAMXI9M1uav+9hyTB6Tg+vyeeKmYxtmAZmHAFJFFVVlEQ3JU2rGVpGYaJ9ZVUFZjDPGqvN3rOk60Z7fUW8aWbSPIk2FvuIQLAUiCjkPmQcpK6UY0ULpvlgKccg9EmapNjzdd2cu+dhZqjOwNGw/1RyfWUliGljZmq8WjGIauhGgswbeBktenFD3uiNiuCNSSHYtT2qHIUb8ydPzS49TiX9zhvnEaSSZghISESgiGK2GAYoC+JDDpAOyExKkfvut4NH+h5jEa2cOiOVbHfgYr8ouhrSZOgNaRRfPv9avVH/4HuXnO7erXduZMvVHyXTP1zDJNfAwk53YU+DKDv+9st3f/9H8+eWlh5+7ND9j62+9gtV1UBRCGcYgagbEXUQtJfChsxVM5hCBTsS/0QEk+KHxHccHYFfaExUj94VUirQqGm5jJm3lB+sGz/ujT00rpQb9Wd3tVdut9vUfFE+9KxXg3xGzlvcNiHbAJ/B5vqourj/5hubr72x39qZWjw+Xm/0dzYlgkzERYmQWGNGGcUH/ohxo8ON/EEE+CWyhrlLX+BsRVSXjp008wUpYhQgitni9Pi/XOo987/b4EivB/IL6/7Vl/eXA/ta+ciWMWZZcsOUKrpUIaRuGk0agzuA6clo8fTh9ttua3N9Y6u2eGyiXG5v3pGJehAHjcVTfEujIqcWplLuw8GIE16UUU4D4jS0SpXCofkojATYgmEpo76yR77zT2+CjEzahPUWdAMwKPieGEm10rRtUMw7F2MUSaMTeGAY4DhQmdSL+drmZVC0tbW1xdNn8xmzub2JbZWGgZwhIqI0wRDJEw8tgchdhBmU/x9a+B1nqdGYyo03cpqq5yv/+mb36Wu9p59fB2QfmYpJWq/A1CTkSqBz2G/DcNjLZ/OGgSutReAgKUch3Fq/L6PfM559PciV3P2xqIMQ3Pfc6akZZ/sOcqOIAylMxHVQOCbPHT1ZqtY13RQEdUBBKZqxF9RC0fdGRw81LrbIy/+2fPv8jiD7rA6VcbjvHsgWYXUDrt+Am5vAY1hZgZsrmJktq3q0WLCJDp4BcfClpcIP31//3IOLl8fPRMDMnFXWyc61N1KxFWF6GBOZwc4XvIi1qtWnM7mCgsgX3c9TGsL1I9nKZgrl8ULh/PWt7/3Hq5ABKIBIhmmgkIPdDrDgS5++/1t/+vFPfPQc9Prgj2B3d73Nf2fwxn8b335j7tmHqw4cuftb3/32E5/47fv2Lp4+98BFtW4q/Mh0I+w1kdxFQDH+EJAQqGBpQPzdx7vdju+lokNSsoXyWA0J9e9/eh12+5AlOAgFVrCau23otL750eOf/fVH7prPL5W7Z2YtkPFIJqxffPLS11rPvXh49NwvHnnzcHHw9oC9vtr966/9+UMkavOJnEGc5g7KyDgOaBweYAd7TWRIpAiU7a01p9+JolBQuJihAlESwmZyZvfOyoWXntvvzUB9CvotwDGNc9AykPUfmbQnS9m//Oa3X3zp5f1m58ThMhx5LwyND/qXZhW4OQR2aeM98U+/ONp6+gOPh2z13rNnw2EPJk/ldSe4fTnWxgTFYa2oyAtGhDx9UDVl9e2rTrcZBb5QxGJioPShVr4Mqn7n4vkgiKBYxQEBqUgU+o6YYFsZud/rjTrNDYwG83rXnHWdZGHH+90zy7MUfvor+P5FqAZ7D4/tVX7j9OiTX9Q18s11Bx58yB1o6kvfoJDBkYDIOShUIkZriiDGld3NtYSh9GCqfFAySGJqFYsQ+7al5uoTsIvRcEDdj7qEEtjcBdCe6YYny7fuPnbMpL1s2Gf1c3CJ/cHki+9N2l95Wv5ROzkAAN2Aj01lvld94usXL0DBnLOT89XH7r35qrX+S5qZZCJBPEm/BE+KU0vKaDRQ8YcqyIilHgI5SjdMS1d8XVOtjFB4GZS8KozakAOYn4Uji7DZ+dtrqx+asjNzj6547FV3avEDY+93fvbMy7Dd5r9P9EfmJhvFyoX1S9Vq5hunCm/mjl1w5cuj6M0Y4MiHljYv8sjFThYTnr0LYiJ0sKrgr2KM8IPpKiXCOpAQqxpECSGhmgNcAuFM+bFjpYWZ6k9yE1CpT0zObG/UntlqQtmGKeuJMf2rDxwfdr7Z3v6tL1f4/fVMY3IeErsxZS1TKg3cpRyZ0qDIld7uflRoZBYebr/1LLdrqQ5KrQMqSVUz7CyZrmTld4WGUEWIE6IowdBBVZzJ5a/uDLcHOCPZxGzhC48stEbsrStbMPCGOj/SqHQnGwsTlaem85+ayuQTatTn1PJd71x6pkf9Hlm9uXujnQ/0pc+jHoyoXzaUxYIadNo3e6P3TeTay5eiROh9xJDod5BVrEuuqBx0uVCuspBBmCqcxIE76q68Uzs8SVGfiBjDxyYM3S4M/Q6M+rDNIRzeqnUKU4279ey5fGHcUvsRhfb67L2Pru/+xc9+8PXDXSwIxI2PHE6MOvVc1OI0yRjKUlnWIsmyS8TIxq4nEZ0JaZpqVTHXZTIxlklNgRDRqV8SCFY0TRruh43T1/Mne8s7YEd3FxQzP5bRUW0PN5wh9EPo9iY4++RC5Wg1NxTySniGwO23RrSpN/bN2Z3yPZmps3biuoHnjfxw5HbaXQukcwszqOSvvPazIPAkWWNCW2PhUoEhK0L+C/yIoYBGRXg5RJXl9/aqZ/+5+jG4cgGkWMhsRRu6oZ2x37Mwx5P189jDknp/jhYh7HluDBL1ggDNKostKTw0M9X3xy1TL2c03w99nFZIyq6P+9Zq1WmsjaaiNY7Rhio8le+C/AKRREehRJeFs0MLFyexwlS0Q2gL2fO1U9DcgeXroKhZg+Ss3MhzB747li08eHyhXmkVTXNhotp03Baq+pTUVEXDhk0kpVzK52KK8EBcCqeAAaFlS6dnSCMPIxTeR/VdT9bs1P2AaPswDsKhMiLY4OSCNj2VdE72LoeqjtLY4wSwg2hPDIocOWnL/TCwFBL7QYcluWz2zMwUyMTlBAsS9QKCTkLTLBNkQ8dJKOYTWl0OqoImgPCUYxAe+HF0mL7niYxbdhCyZDC0cjnhJ9GNoRMWSlCW1yMtLk31xudo45is2qaz6ZjjG6wGowBseSGL60QJizKGqSmYauEEojgJ0JXhxIl8dBxE0VDWYUwYDRUHRTsZgCARHAtxarDQxFEEqkqUjK2P/IjK5A8/90ebG5vL7yybdoaK4ZHiZraUadZOQ30eDh9ZNcqroXuWfvxix4XuENbeMiQ6iMiAhjlVuHrVMNGl4aU+D8RNCc5N25YSgqJGQ+PBWBgESiILxSCUMmr4SBLOkItpTgXdBDEg2LieX+vEyIMf/vRTr/z8Ag6Q7c0mGohypUb+8R/+7PEPPvmTfhYM9cvjw3P1/I/DEmQs8Bxo71DgowjcJJnOqONjY+hAgijEpVHC4bZE9AWa0URFhkX3cPAQHYMFkuHA4+CxcYJyRjlCnpmmmc9k8Ejfve23blz5yAP3bew2r129/sSHfy2XL22srcrl6amTpPv8o9nvTHSLN/7z8xPDP84HcH0ZDwI9GVxxIwMtC2IdtQAVLknWDSyejoWIAKU2E7c0WOL7vut7uHXMGcoCTdhfMdEQxUHghyG1dNMyDFwrjGjO4J99/PR/TT26GqjHFmdbbvLZr/7N733mT/b6gex0HIR+kTdr8e7Vd3aeP//KV84ZR6wQLl564gPH4dgibHsQIgJQwAQxj2zLwmhw3mHtkD/wPRmJ2It39tsYEfY3VhZDd6PIj+KRH4wcvzdwCYQ5HQ/XQ4+hKKoX9k85rz5VUZZLR4tj2Yyq7m/vs8hDs62MnKFerW45g07AC/n85Zu3z9zb/s5v3vWLSe++Q9pfzT/0lGWv/vsL1zR5ujJSYytIfCnle8xU3gDdYNMTuWKp0O97rabTHfpoUHAUTk6MVQq60xs6Q+y4Ecijra0Wetxao6YRLwqHr7x9++SUlPRn8ofuPnH3iThu7Te3fLTSR+cbV6+/vddqjQbDoetiTNlcUeb+4XrxuRdeTbz+333hk9187vwLrxZVli8UEUI45sbHC9WqUcgm6BwdZzeJvBNHpo+fnJuojdm6MTNbNSWHeZ0gcBTCpuul3Z19ZxQ+dO7s/OE6C1wWR6plZTXu7yznswVO6eHjE7du3vz5L18nh2bH3DBwHQzH1xRN9HIcjTfG17f2V9fWIokbEvvUk/fMzkzcWF6vVUszk8WxAjEMT6J96ruh5yK9DEYB9o6qEnfQzhVUTaGXL15s9/rt7hAPvt9s4Zw6cfTI9GTd1M293d3dvc2JWjWIYsLD1v4eVvbc0tn/eea56++sKlbGwpGrII0C2nlUcezO2m0cL6OBb+lG1jIvXb9xe2Nn6eyZ8c98pN9qJZHfHzhOz5OYpCuqnE7ErKXkMtqVy1fbzfZYtRSGvmnZ+WymO/RYlo0GTqVgVAsWjvXhYNgbdnFudlt7XsTy+fJ4XjeszM7GJnISrkWWTi2gbkWDRwQWIxxrBKS9dgcVeNa0EMpI+FFEO519FTx8hbyPoKAoorCL0DRg2xFm4r8oHkMxZpv453KlkS9XEAB2xtQsQ05ZQFXNbMbsd/Y63S5ulQShuBVFw1qlfGRx3mntv/DShWZ3gHM3kDg6P+EMxR0SnGoM9SrSCkkVb8CxxZRQjoNhB38X9zpQ7NogBZQjJ4G4Rai4HEauly+U8oV8a3dNpYMRBk092zZURmwibhqog3gnbrtI4GGkYIgJchnXgQ17HU3jTqe533LEbayYxYq4RyqEfBIiyVHQcfyglMTokGdj2usRzeyhJZUV7C5sWjFDFXG7QuZCROmyinNgNOpe/fnTWtBxnb18QZ2rFjaGbBQIqeOFoW1k97lLs3OV+ftV5EhGQ46n0sQdjYETatKNlfVW38lYpqKGSSTFOkbLlDgKMIeJZKV31FCCo25LZMNErYLzP4rEECV0lMSBhJfqZr5YZEG8fXOZDtbAbcsh5LKSmqlrhZqsK2YSOWbJT5DUqS+kF9FVI/I6SGZCXuA8QekjZ9FfZCR4Z2UH/ZnjMwVNKsEhKP6jACkOtZnMI19BqS3rLsXJkSgqEbfbma+wdHzRUAHIqCbOiM0b1/bWbrW3aE6HiRm5MDnJsxOSlbtNo7UerWp6Vgo001bMiozzRMUqJOGoj6JMwgpiqtHjBP1aY5IG8bjUf+Jo7oGjFaxCqMoYVSL+l0DCvRFAhGH3j9oZU0IM+Lw48iJVjSWiyHGsqHrM4c76+vrKHadJi1k4NJ8t1CftYhnNSxgjdY64F3GFuIodu11N9yxQcOKboCa4M2okPCx35eGwF/a6rc6wOb+62++t337fXdVlBDUPXcePsjjwYhgOHMM0B3HY3FrLm7w0WU7Q0CY7JimNPAX1GyonULzba9tvrnqNLNxzjNSrufnZQzhju73uII6rhrpyZ7tSzi/MzNy+fU0CZX0rvNi/eWZh7FbXnaw36uNVNH6x1+x0m5RkavX5t966cXN1WGvIkmGrGiNPzlNOceR0qjnj9MnDe/s7V95awy6wsjbH9KkWATlnxM32/sZGjzAUh92JHDs1n6uWCQoxx0FK7EZua9Tfl2lsCDPnH1uY5l7v2pWN66vD5XXPi2hWHuDk7/S7JGjqENq2juLDwEGRRIVq+cEHFhZn6rhUw2Zk2oycQdTvx1rSn5+yTy1MzzeKURI4I7/ZDZp9pEF/MAhqlfzsoVoQJK1etDvgt3ajyyvRnsPHy2o2Z++03V9d5VSmqm3dWR9duNbc3O62R+TtDkoXfmKKFHNKRrOmy1lThb7rA9H90NvY3N5pjQK/o/MIZWW7s/Psy63/E2AAOTY7Y/TCa8QAAAAASUVORK5CYII=" },
    { id: 1, type: "", icon: "", grade: 1, name: "" }
  ].map((i) => [i.id, i]));
  let getItemCodexUrl = /* @__PURE__ */ __name((item) => `${CODEX_ITEM_URL}${item.id}/${item.isGradeInferred ? `?grade=${item.grade}` : ""}`, "getItemCodexUrl");

  // src/events.js
  let LS_KEYS = {
    EVENT_VISIBILITY: "tm_aa_ev_vis",
    NOTIFICATIONS: "tm_aa_notifications"
  };
  let CODEX_QUEST_BASE = "https://archeagecodex.com/ru/quest/";
  let loadNotificationState = /* @__PURE__ */ __name(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.NOTIFICATIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          enabled: !!parsed.enabled,
          events: parsed.events || {},
          notified: parsed.notified || {}
        };
      }
    } catch {
    }
    return { enabled: false, events: {}, notified: {} };
  }, "loadNotificationState");
  let saveNotificationState = /* @__PURE__ */ __name((state) => {
    try {
      localStorage.setItem(LS_KEYS.NOTIFICATIONS, JSON.stringify(state));
    } catch {
    }
  }, "saveNotificationState");
  let loadEventVisibility2 = /* @__PURE__ */ __name(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS.EVENT_VISIBILITY)) || {};
    } catch {
      return {};
    }
  }, "loadEventVisibility");
  let saveEventVisibility = /* @__PURE__ */ __name((overrides) => {
    try {
      localStorage.setItem(LS_KEYS.EVENT_VISIBILITY, JSON.stringify(overrides));
    } catch {
    }
  }, "saveEventVisibility");
  let isEventVisible2 = /* @__PURE__ */ __name((ev, overrides) => {
    if (ev.code in overrides) return overrides[ev.code];
    return !!ev.defaultVisible;
  }, "isEventVisible");
  let getMSKDateString = /* @__PURE__ */ __name((utcMs) => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return fmt.format(new Date(utcMs));
  }, "getMSKDateString");
  let cleanOldNotifiedKeys = /* @__PURE__ */ __name((state) => {
    const today = getMSKDateString(getServerNowMs());
    const keys = Object.keys(state.notified);
    let changed = false;
    for (const key of keys) {
      if (!key.startsWith(today)) {
        delete state.notified[key];
        changed = true;
      }
    }
    if (changed) saveNotificationState(state);
  }, "cleanOldNotifiedKeys");
  let showEventNotification = /* @__PURE__ */ __name((ev, entry) => {
    const timeLabel = entry.timeEnd ? `${entry.timeStart}\u2013${entry.timeEnd}` : entry.timeStart;
    const location2 = ev.locations?.length ? ev.locations.join(", ") : "";
    const body = location2 ? `${timeLabel} \u2014 ${location2}` : timeLabel;
    try {
      new Notification(ev.title, { body, icon: "https://aa.cdn.gmru.net/ms/data/old/9d56835cb7de079738b7e95471186c09.png", tag: `aa-ev-${ev.title}-${entry.timeStart}` });
    } catch {
    }
  }, "showEventNotification");
  let checkEventNotifications = /* @__PURE__ */ __name(({ loadNotificationState: loadNotificationState2, saveNotificationState: saveNotificationState2 } = {}) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const state = loadNotificationState2();
    if (!state.enabled) return;
    cleanOldNotifiedKeys(state);
    const visOverrides = loadEventVisibility2();
    const serverNow = getServerNowMs();
    const nowWd = getMSKWeekday(serverNow);
    const nowSec = getMSKTimeOfDaySeconds(serverNow);
    const todayStr = getMSKDateString(serverNow);
    let changed = false;
    for (const ev of EVENTS) {
      const evNotif = ev.code in state.events ? state.events[ev.code] : !!ev.defaultNotifications;
      if (!evNotif) continue;
      if (!isEventVisible2(ev, visOverrides)) continue;
      for (const entry of ev.schedule) {
        const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
        if (!isToday) continue;
        const { hours, minutes } = parseTime(entry.timeStart);
        const startSec = hours * 3600 + minutes * 60;
        const diff = startSec - nowSec;
        if (diff >= 270 && diff <= 330) {
          const key = `${todayStr}_${ev.code}_${entry.timeStart}`;
          if (!state.notified[key]) {
            showEventNotification(ev, entry);
            state.notified[key] = true;
            changed = true;
          }
        }
      }
    }
    if (changed) saveNotificationState2(state);
  }, "checkEventNotifications");
  let eventsPopupStylesInjected = false;
  let injectEventsPopupStyles = /* @__PURE__ */ __name(() => {
    if (eventsPopupStylesInjected) return;
    eventsPopupStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = `
            .tm-popup-overlay {
                position: fixed;
                inset: 0;
                z-index: 10001;
                background: rgba(0,0,0,0.45);
                color: #2D364E;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .tm-popup-panel {
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                font: 14px/1.5 Cambria, Georgia, "Times New Roman", Times, serif;
            }
            .tm-popup-panel--events {
                width: 1000px;
                max-width: 95vw;
            }
            .tm-popup-panel--settings {
                width: 380px;
                max-width: 90vw;
            }
            .tm-popup-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #ddd;
                gap: 8px;
                flex-shrink: 0;
            }
            .tm-popup-title {
                flex: 1;
                font-size: 18px;
                font-weight: bold;
                margin: 0;
            }
            .tm-popup-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 20px;
                padding: 2px 6px;
                border-radius: 4px;
                color: #555;
                line-height: 1;
            }
            .tm-popup-btn:hover {
                background: #eee;
                color: #000;
            }
            .tm-popup-body {
                overflow-y: auto;
                padding: 0;
                flex: 1;
            }
            .tm-popup-body--settings {
                padding: 12px 16px;
            }
            .tm-settings-section {
                margin-bottom: 14px;
            }
            .tm-settings-section:last-child {
                margin-bottom: 0;
            }
            .tm-settings-section-title {
                font-weight: bold;
                margin-bottom: 8px;
            }
            .tm-settings-server-select {
                width: 100%;
                box-sizing: border-box;
                padding: 5px 6px;
                border: 1px solid #bbb;
                border-radius: 4px;
                background: #fff;
                color: #2D364E;
                font: inherit;
            }
            /* Events table */
            .tm-events-table {
                width: 100%;
                border-collapse: collapse;
            }
            .tm-events-table th {
                background: #3d2a5a;
                color: #fff;
                padding: 8px 12px;
                text-align: left;
                font-weight: normal;
                position: sticky;
                top: 0;
                z-index: 1;
                border-bottom: none;
            }
            .tm-events-table td {
                padding: 6px 12px;
                border-bottom: 1px solid #ddd;
                vertical-align: top;
            }
            .tm-events-table tr:nth-child(even) td {
                background: #f5f5f5;
            }
            .tm-events-table tr.tm-event-active td {
                background: #d4edda;
            }
            .tm-events-table tr.tm-event-beyond td {
                opacity: 0.6;
            }
            .tm-events-table .tm-event-time {
                white-space: nowrap;
                font-family: monospace;
                font-size: 13px;
            }
            .tm-event-time details {
                cursor: pointer;
            }
            .tm-event-time summary {
                display: list-item;
            }
            .tm-event-time summary::marker {
                font-size: 10px;
            }
            .tm-event-time .tm-schedule-detail {
                margin-top: 4px;
                padding-left: 18px;
                font-size: 12px;
                color: #555;
                white-space: normal;
            }
            .tm-event-time--active summary {
                color: #155724;
                font-weight: bold;
            }
            .tm-event-time--waiting summary {
                color: #856404;
            }
            .tm-events-table a {
                color: #2a6496;
                text-decoration: none;
            }
            .tm-events-table a:hover {
                text-decoration: underline;
            }
            /* Settings checkboxes */
            .tm-ev-settings-list {
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .tm-ev-settings-list li {
                padding: 4px 0;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .tm-ev-settings-list label {
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }
            .tm-ev-settings-list input[type="checkbox"] {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
            }
            .tm-popup-btn--bell { font-size: 16px; }
            .tm-popup-btn--bell-off { opacity: 0.4; }
            .tm-ev-bell {
                cursor: pointer;
                font-size: 14px;
                padding: 0 4px;
                user-select: none;
                border: none;
                background: none;
                vertical-align: middle;
            }
            .tm-ev-bell--off { opacity: 0.25; }
        `;
    document.head.appendChild(style);
  }, "injectEventsPopupStyles");
  let eventsOverlay = null;
  let eventsInterval = null;
  let settingsOverlay = null;
  let evVisOverrides = null;
  let closeSettingsPopup = /* @__PURE__ */ __name(() => {
    if (settingsOverlay) {
      settingsOverlay.remove();
      settingsOverlay = null;
    }
  }, "closeSettingsPopup");
  let closeEventsPopup = /* @__PURE__ */ __name(() => {
    closeSettingsPopup();
    if (eventsInterval) {
      clearInterval(eventsInterval);
      eventsInterval = null;
    }
    if (eventsOverlay) {
      eventsOverlay.remove();
      eventsOverlay = null;
    }
  }, "closeEventsPopup");
  let openSettingsPopup = /* @__PURE__ */ __name((onChanged, {
    loadVekselServerIdOverride: loadVekselServerIdOverride2,
    saveVekselServerIdOverride: saveVekselServerIdOverride2,
    resolveVekselUrl: resolveVekselUrl2,
    getVekselAutoOptionText: getVekselAutoOptionText2,
    loadNotificationState: loadNotificationState2,
    saveNotificationState: saveNotificationState2,
    updateRenderedItemIcons: updateRenderedItemIcons2 = /* @__PURE__ */ __name(() => {
    }, "updateRenderedItemIcons")
  } = {}) => {
    if (settingsOverlay) {
      closeSettingsPopup();
      return;
    }
    settingsOverlay = document.createElement("div");
    settingsOverlay.className = "tm-popup-overlay";
    settingsOverlay.style.zIndex = "10002";
    settingsOverlay.addEventListener("mousedown", (e) => {
      if (e.target === settingsOverlay) closeSettingsPopup();
    });
    const panel = document.createElement("div");
    panel.className = "tm-popup-panel tm-popup-panel--settings";
    panel.addEventListener("mousedown", (e) => e.stopPropagation());
    const header = document.createElement("div");
    header.className = "tm-popup-header";
    const title = document.createElement("div");
    title.className = "tm-popup-title";
    title.textContent = "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "tm-popup-btn";
    closeBtn.textContent = "\xD7";
    closeBtn.addEventListener("click", closeSettingsPopup);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    const body = document.createElement("div");
    body.className = "tm-popup-body tm-popup-body--settings";
    const serverSection = document.createElement("div");
    serverSection.className = "tm-settings-section";
    const serverTitle = document.createElement("div");
    serverTitle.className = "tm-settings-section-title";
    serverTitle.textContent = "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0435\u0440\u0432\u0435\u0440";
    serverSection.appendChild(serverTitle);
    const serverSelect = document.createElement("select");
    serverSelect.className = "tm-settings-server-select";
    const autoOption = document.createElement("option");
    autoOption.value = "";
    autoOption.dataset.vekselServerAutoOption = "1";
    autoOption.textContent = getVekselAutoOptionText2();
    serverSelect.appendChild(autoOption);
    Object.entries(SERVERS).sort((a, b) => a[1].localeCompare(b[1], "ru")).forEach(([id, name]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      serverSelect.appendChild(option);
    });
    serverSelect.value = loadVekselServerIdOverride2();
    serverSelect.addEventListener("change", () => {
      saveVekselServerIdOverride2(serverSelect.value);
      resolveVekselUrl2();
    });
    serverSection.appendChild(serverSelect);
    body.appendChild(serverSection);
    const sexSection = document.createElement("div");
    sexSection.className = "tm-settings-section";
    const sexTitle = document.createElement("div");
    sexTitle.className = "tm-settings-section-title";
    sexTitle.textContent = "\u041F\u043E\u043B";
    sexSection.appendChild(sexTitle);
    const sexSelect = document.createElement("select");
    sexSelect.className = "tm-settings-server-select";
    Object.entries(ICON_SEX_VALUES).forEach(([value, info]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = info.title;
      sexSelect.appendChild(option);
    });
    sexSelect.value = loadIconSex();
    sexSelect.addEventListener("change", () => {
      saveIconSex(sexSelect.value);
      updateRenderedItemIcons2();
      onChanged();
    });
    sexSection.appendChild(sexSelect);
    body.appendChild(sexSection);
    const eventsSection = document.createElement("div");
    eventsSection.className = "tm-settings-section";
    const eventsTitle = document.createElement("div");
    eventsTitle.className = "tm-settings-section-title";
    eventsTitle.textContent = "\u041E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u043C\u044B\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u044F";
    eventsSection.appendChild(eventsTitle);
    const ul = document.createElement("ul");
    ul.className = "tm-ev-settings-list";
    const notifState = loadNotificationState2();
    for (const ev of EVENTS) {
      const li = document.createElement("li");
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isEventVisible2(ev, evVisOverrides);
      cb.addEventListener("change", () => {
        if (cb.checked === !!ev.defaultVisible) {
          delete evVisOverrides[ev.code];
        } else {
          evVisOverrides[ev.code] = cb.checked;
        }
        saveEventVisibility(evVisOverrides);
        onChanged();
      });
      const span = document.createElement("span");
      span.textContent = ev.title;
      label.appendChild(cb);
      label.appendChild(span);
      li.appendChild(label);
      const bell = document.createElement("button");
      const bellOn = ev.code in notifState.events ? notifState.events[ev.code] : !!ev.defaultNotifications;
      bell.className = "tm-ev-bell" + (bellOn ? "" : " tm-ev-bell--off");
      bell.textContent = "\u{1F514}";
      bell.title = "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u0437\u0430 5 \u043C\u0438\u043D";
      bell.addEventListener("click", () => {
        if (typeof Notification === "undefined") {
          alert("\u0412\u0430\u0448 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F.");
          return;
        }
        const toggle = /* @__PURE__ */ __name(() => {
          const s = loadNotificationState2();
          const wasOn = ev.code in s.events ? s.events[ev.code] : !!ev.defaultNotifications;
          const nowOn = !wasOn;
          if (nowOn === !!ev.defaultNotifications) {
            delete s.events[ev.code];
          } else {
            s.events[ev.code] = nowOn;
          }
          if (nowOn) s.enabled = true;
          saveNotificationState2(s);
          bell.classList.toggle("tm-ev-bell--off", !nowOn);
          const globalBell = document.querySelector(".tm-popup-btn--bell");
          if (globalBell) globalBell.classList.toggle("tm-popup-btn--bell-off", !s.enabled);
        }, "toggle");
        if (Notification.permission === "default") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") toggle();
            else alert("\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.\n\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u0430\u0439\u0442\u0430 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043D\u043E\u0432\u0430.");
          });
          return;
        }
        if (Notification.permission === "denied") {
          alert("\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.\n\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u0430\u0439\u0442\u0430 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043D\u043E\u0432\u0430.");
          return;
        }
        toggle();
      });
      li.appendChild(bell);
      ul.appendChild(li);
    }
    eventsSection.appendChild(ul);
    body.appendChild(eventsSection);
    panel.appendChild(body);
    settingsOverlay.appendChild(panel);
    document.body.appendChild(settingsOverlay);
  }, "openSettingsPopup");
  let openEventsPopup = /* @__PURE__ */ __name(({
    loadVekselServerIdOverride: loadVekselServerIdOverride2,
    saveVekselServerIdOverride: saveVekselServerIdOverride2,
    resolveVekselUrl: resolveVekselUrl2,
    getVekselAutoOptionText: getVekselAutoOptionText2,
    loadNotificationState: loadNotificationState2,
    saveNotificationState: saveNotificationState2,
    updateRenderedItemIcons: updateRenderedItemIcons2 = /* @__PURE__ */ __name(() => {
    }, "updateRenderedItemIcons")
  } = {}) => {
    if (eventsOverlay) {
      closeEventsPopup();
      return;
    }
    injectEventsPopupStyles();
    evVisOverrides = loadEventVisibility2();
    eventsOverlay = document.createElement("div");
    eventsOverlay.className = "tm-popup-overlay";
    eventsOverlay.addEventListener("mousedown", (e) => {
      if (e.target === eventsOverlay) closeEventsPopup();
    });
    const panel = document.createElement("div");
    panel.className = "tm-popup-panel tm-popup-panel--events";
    panel.addEventListener("mousedown", (e) => e.stopPropagation());
    const header = document.createElement("div");
    header.className = "tm-popup-header";
    const title = document.createElement("div");
    title.className = "tm-popup-title";
    title.textContent = "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0439";
    header.appendChild(title);
    const gearBtn = document.createElement("button");
    gearBtn.className = "tm-popup-btn";
    gearBtn.textContent = "\u2699";
    gearBtn.title = "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F";
    gearBtn.addEventListener("click", () => openSettingsPopup(renderTable, {
      loadVekselServerIdOverride: loadVekselServerIdOverride2,
      saveVekselServerIdOverride: saveVekselServerIdOverride2,
      resolveVekselUrl: resolveVekselUrl2,
      getVekselAutoOptionText: getVekselAutoOptionText2,
      loadNotificationState: loadNotificationState2,
      saveNotificationState: saveNotificationState2,
      updateRenderedItemIcons: updateRenderedItemIcons2
    }));
    header.appendChild(gearBtn);
    const bellBtn = document.createElement("button");
    bellBtn.className = "tm-popup-btn tm-popup-btn--bell";
    bellBtn.textContent = "\u{1F514}";
    bellBtn.title = "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430 5 \u043C\u0438\u043D\u0443\u0442 \u0434\u043E \u0441\u043E\u0431\u044B\u0442\u0438\u0439";
    const updateBellStyle = /* @__PURE__ */ __name(() => {
      const s = loadNotificationState2();
      bellBtn.classList.toggle("tm-popup-btn--bell-off", !s.enabled);
    }, "updateBellStyle");
    updateBellStyle();
    bellBtn.addEventListener("click", async () => {
      if (typeof Notification === "undefined") {
        alert("\u0412\u0430\u0448 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F.");
        return;
      }
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "denied") {
        alert("\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430.\n\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0441\u0430\u0439\u0442\u0430 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043D\u043E\u0432\u0430.");
        return;
      }
      const state = loadNotificationState2();
      state.enabled = !state.enabled;
      saveNotificationState2(state);
      updateBellStyle();
    });
    header.appendChild(bellBtn);
    const closeBtn = document.createElement("button");
    closeBtn.className = "tm-popup-btn";
    closeBtn.textContent = "\xD7";
    closeBtn.addEventListener("click", closeEventsPopup);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    const body = document.createElement("div");
    body.className = "tm-popup-body";
    const table = document.createElement("table");
    table.className = "tm-events-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const col of ["\u0412\u0440\u0435\u043C\u044F", "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", "\u041B\u043E\u043A\u0430\u0446\u0438\u0438"]) {
      const th = document.createElement("th");
      th.textContent = col;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    body.appendChild(table);
    panel.appendChild(body);
    eventsOverlay.appendChild(panel);
    document.body.appendChild(eventsOverlay);
    const DAY_SEC = 86400;
    const openDetails = /* @__PURE__ */ new Set();
    const collectOccurrences = /* @__PURE__ */ __name(() => {
      const serverNow = getServerNowMs();
      const nowWd = getMSKWeekday(serverNow);
      const nowSec = getMSKTimeOfDaySeconds(serverNow);
      const within = [];
      const beyond = [];
      for (const ev of EVENTS) {
        if (!isEventVisible2(ev, evVisOverrides)) continue;
        let hasWithin = false;
        let nearest = null;
        for (const entry of ev.schedule) {
          const { hours, minutes } = parseTime(entry.timeStart);
          const startSec = hours * 3600 + minutes * 60;
          const timeStr = entry.timeEnd ? `${entry.timeStart}\u2013${entry.timeEnd}` : entry.timeStart;
          if (entry.timeEnd) {
            const end = parseTime(entry.timeEnd);
            const endSec = end.hours * 3600 + end.minutes * 60;
            const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
            if (isToday && nowSec >= startSec && nowSec < endSec) {
              within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: -(endSec - nowSec), isActive: true, isBeyond: false });
              hasWithin = true;
              continue;
            }
          } else {
            const activeDur = (entry.duration ?? 5) * 60;
            const isToday = !entry.weekdays?.length || entry.weekdays.includes(nowWd);
            if (isToday && nowSec >= startSec && nowSec < startSec + activeDur) {
              within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: 0, isActive: true, isBeyond: false });
              hasWithin = true;
              continue;
            }
          }
          if (!entry.weekdays?.length) {
            let diff = startSec - nowSec;
            if (diff <= 0) diff += DAY_SEC;
            within.push({ ev, evCode: ev.code, label: timeStr, secondsUntil: diff, isActive: false, isBeyond: false });
            hasWithin = true;
          } else {
            let minDiff = Infinity;
            for (const wd of entry.weekdays) {
              let d = wd - nowWd;
              if (d < 0) d += 7;
              let diff = d * DAY_SEC + (startSec - nowSec);
              if (diff <= 0) diff += 7 * DAY_SEC;
              if (diff < minDiff) minDiff = diff;
            }
            const dayName = WEEKDAY_NAMES[getMSKWeekday(serverNow + minDiff * 1e3)];
            const fullLabel = `${dayName} ${timeStr}`;
            if (minDiff <= DAY_SEC) {
              within.push({ ev, evCode: ev.code, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: false });
              hasWithin = true;
            } else if (!nearest || minDiff < nearest.secondsUntil) {
              nearest = { ev, evCode: ev.code, label: fullLabel, secondsUntil: minDiff, isActive: false, isBeyond: true };
            }
          }
        }
        if (!hasWithin && nearest) {
          beyond.push(nearest);
        }
      }
      within.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        if (a.isActive && b.isActive) return b.secondsUntil - a.secondsUntil;
        return a.secondsUntil - b.secondsUntil;
      });
      beyond.sort((a, b) => a.secondsUntil - b.secondsUntil);
      return [...within, ...beyond];
    }, "collectOccurrences");
    const buildScheduleLines = /* @__PURE__ */ __name((schedule) => {
      const lines = [];
      for (const entry of schedule) {
        const time = entry.timeEnd ? `${entry.timeStart}\u2013${entry.timeEnd}` : entry.timeStart;
        if (entry.weekdays?.length) {
          const days = entry.weekdays.map((d) => WEEKDAY_NAMES[d]).join(", ");
          lines.push(`${days} ${time}`);
        } else {
          lines.push(time);
        }
      }
      return lines;
    }, "buildScheduleLines");
    const summaryText = /* @__PURE__ */ __name((occ) => {
      if (occ.isActive && occ.secondsUntil < 0) {
        return `${occ.label} \u2014 \u0435\u0449\u0451 ${formatCountdown(-occ.secondsUntil)}`;
      } else if (occ.isActive) {
        return occ.label;
      } else {
        return `${occ.label} \u2014 \u0447\u0435\u0440\u0435\u0437 ${formatCountdown(occ.secondsUntil)}`;
      }
    }, "summaryText");
    const structureKey = /* @__PURE__ */ __name((occs) => occs.map(
      (o) => `${o.evCode}:${o.label}:${o.isActive}:${o.isBeyond}`
    ).join("|"), "structureKey");
    let lastKey = "";
    let summaryEls = [];
    const renderTable = /* @__PURE__ */ __name(() => {
      const occs = collectOccurrences();
      lastKey = structureKey(occs);
      summaryEls = [];
      const frag = document.createDocumentFragment();
      for (const occ of occs) {
        const key = `${occ.evCode}:${occ.label}`;
        const tr = document.createElement("tr");
        if (occ.isActive) tr.classList.add("tm-event-active");
        if (occ.isBeyond) tr.classList.add("tm-event-beyond");
        const timeTd = document.createElement("td");
        timeTd.className = "tm-event-time";
        if (occ.isActive) timeTd.classList.add("tm-event-time--active");
        else timeTd.classList.add("tm-event-time--waiting");
        const details = document.createElement("details");
        if (openDetails.has(key)) details.open = true;
        details.addEventListener("toggle", () => {
          if (details.open) openDetails.add(key);
          else openDetails.delete(key);
        });
        const summary = document.createElement("summary");
        summary.textContent = summaryText(occ);
        details.appendChild(summary);
        summaryEls.push(summary);
        const schedDiv = document.createElement("div");
        schedDiv.className = "tm-schedule-detail";
        for (const line of buildScheduleLines(occ.ev.schedule)) {
          const div = document.createElement("div");
          div.textContent = line;
          schedDiv.appendChild(div);
        }
        details.appendChild(schedDiv);
        timeTd.appendChild(details);
        tr.appendChild(timeTd);
        const nameTd = document.createElement("td");
        nameTd.textContent = occ.ev.title || "\u2014";
        if (occ.ev.quests?.length) {
          for (const q of occ.ev.quests) {
            const a = document.createElement("a");
            a.href = CODEX_QUEST_BASE + q.id + "/";
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = ` (#${q.id})`;
            nameTd.appendChild(a);
          }
        }
        tr.appendChild(nameTd);
        const locTd = document.createElement("td");
        locTd.textContent = (occ.ev.locations || []).join(", ");
        tr.appendChild(locTd);
        frag.appendChild(tr);
      }
      tbody.textContent = "";
      tbody.appendChild(frag);
    }, "renderTable");
    const tickTable = /* @__PURE__ */ __name(() => {
      const occs = collectOccurrences();
      const key = structureKey(occs);
      if (key !== lastKey) {
        renderTable();
        return;
      }
      for (let i = 0; i < occs.length; i++) {
        summaryEls[i].textContent = summaryText(occs[i]);
      }
    }, "tickTable");
    renderTable();
    eventsInterval = setInterval(tickTable, 1e3);
  }, "openEventsPopup");

  // src/components/select.js
  let makeSelect = /* @__PURE__ */ __name(({ options, selected, onChange }) => {
    const wrapper = document.createElement("div");
    wrapper.className = "itemrestore__select_wrapper";
    const select = document.createElement("select");
    select.className = "itemrestore__filter-grades";
    for (const { value, label } of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      if (String(value) === String(selected)) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => onChange(select.value));
    wrapper.appendChild(select);
    return wrapper;
  }, "makeSelect");
  let renderSelectedItems = /* @__PURE__ */ __name((container, items, { emptyText, onRemove, mapItem }, makeItemIconLink2) => {
    container.innerHTML = "";
    if (items.length === 0) {
      const p = document.createElement("div");
      p.className = "tm-selected-items-help";
      p.textContent = emptyText;
      container.appendChild(p);
      return;
    }
    for (const item of items) {
      const mapped = mapItem(item);
      const entry = document.createElement("div");
      entry.className = "tm-selected-item";
      const nameWrap = document.createElement("div");
      nameWrap.className = "tm-cart-item-name";
      if (mapped.itemBase) {
        const icon = makeItemIconLink2({
          item: mapped.itemBase,
          linked: true,
          size: "small",
          count: mapped.count
        });
        nameWrap.appendChild(icon);
      } else if (mapped.iconUrl) {
        const img = document.createElement("img");
        img.width = 24;
        img.height = 24;
        img.src = mapped.iconUrl;
        nameWrap.appendChild(img);
      }
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = mapped.name || mapped.itemBase.name || "";
      nameWrap.appendChild(title);
      entry.appendChild(nameWrap);
      const delBtn = document.createElement("div");
      delBtn.className = "del_btn";
      delBtn.addEventListener("click", () => onRemove(item));
      entry.appendChild(delBtn);
      container.appendChild(entry);
    }
  }, "renderSelectedItems");

  // src/components/reload-btn.js
  let reloadBtnStylesInjected = false;
  let injectReloadBtnStyles = /* @__PURE__ */ __name(() => {
    if (reloadBtnStylesInjected) return;
    reloadBtnStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = `
            .guild_header2.tm-has-reload {
                display: flex;
                align-items: center;
            }
            .tm-reload-btn {
                width: 22px;
                height: 22px;
                margin-left: 8px;
                padding: 0;
                border: none;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.15);
                color: rgba(255, 255, 255, 0.75);
                font-size: 15px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 150ms ease, color 150ms ease;
                flex-shrink: 0;
            }
            .tm-reload-btn:hover {
                background: rgba(255, 255, 255, 0.25);
                color: #fff;
            }
            .tm-reload-btn:active {
                transform: scale(0.92);
            }
        `;
    document.head.appendChild(style);
  }, "injectReloadBtnStyles");
  let appendReloadBtn = /* @__PURE__ */ __name((header) => {
    injectReloadBtnStyles();
    header.classList.add("tm-has-reload");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tm-reload-btn";
    btn.title = "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443";
    btn.innerHTML = "&#x21bb;";
    btn.addEventListener("click", () => location.reload());
    header.appendChild(btn);
  }, "appendReloadBtn");

  // src/cart.js
  let normalizeCartItemName = /* @__PURE__ */ __name((itemName) => (itemName || "").trim().replace(/\*$/, "").trim().toLowerCase().replace(/\bc\b/g, "\u0441").replace(/\s+/g, " "), "normalizeCartItemName");
  let inferGradeFromCartItemName = /* @__PURE__ */ __name((itemName) => {
    const normalized = normalizeCartItemName(itemName);
    if (!normalized) return null;
    for (let grade = GRADES.length - 1; grade >= 0; grade--) {
      const patterns = GRADES[grade].cartNamePatterns || [];
      if (patterns.some((pattern) => pattern.test(normalized))) return grade;
    }
    return null;
  }, "inferGradeFromCartItemName");
  let CART_GRADE_BY_CAMPAIGN = [
    {
      itemId: [
        45880,
        45881,
        45882,
        45883,
        45884,
        45885,
        45886,
        // эрнардский мнемоник
        45985,
        45986,
        45987,
        45988,
        45989,
        45990,
        45991,
        // смотритель тайных архивов
        45887,
        45888,
        45889,
        45890,
        47047,
        47048,
        47049,
        // заклинатель гримуаров
        47043,
        47044,
        47045,
        47046,
        45891,
        45892,
        45893,
        // укротитель гримуаров
        45894,
        45895,
        45896,
        45897,
        45898,
        45899,
        45900
        // эрнардский архивариус
      ],
      campaign: "\u041C\u0430\u0440\u0430\u0444\u043E\u043D \u0433\u0435\u0440\u043E\u0435\u0432, \u0440\u0443\u0440\u0443",
      grade: 12
    },
    {
      itemId: [34684, 34685],
      // укрепленный аргенитовый кларнет/лютня
      campaign: "\u041D\u0435\u0432\u0435\u0440\u0438\u043D\u0441\u043A\u0438\u0439 \u043C\u0430\u0440\u0430\u0444\u043E\u043D \u0433\u0435\u0440\u043E\u0435\u0432",
      grade: 8
    }
  ];
  let inferGradeFromCartCampaign = /* @__PURE__ */ __name((item, campaign) => {
    const normalizedCampaign = normalizeCartItemName(campaign);
    if (!normalizedCampaign) return null;
    const rule = CART_GRADE_BY_CAMPAIGN.find((entry) => {
      if (!entry.itemId.includes(item.id)) return false;
      const normalizedRuleCampaign = normalizeCartItemName(entry.campaign);
      return normalizedRuleCampaign && normalizedCampaign.includes(normalizedRuleCampaign);
    });
    return rule?.grade ?? null;
  }, "inferGradeFromCartCampaign");
  let stripGradeFromCartItemName = /* @__PURE__ */ __name((itemName) => {
    let normalized = normalizeCartItemName(itemName);
    if (!normalized) return "";
    for (const grade of GRADES) {
      for (const pattern of grade.cartNamePatterns || []) {
        normalized = normalized.replace(pattern, "");
      }
    }
    return normalized.trim();
  }, "stripGradeFromCartItemName");
  let withInferredCartGrade = /* @__PURE__ */ __name((item, itemName, campaign = "") => {
    if (item.grade != null) return item;
    const inferredGrade = inferGradeFromCartItemName(itemName) ?? inferGradeFromCartCampaign(item, campaign);
    return {
      ...item,
      grade: inferredGrade ?? 1,
      ...inferredGrade == null ? {} : { isGradeInferred: true }
    };
  }, "withInferredCartGrade");
  let findItemByName = /* @__PURE__ */ __name((itemName, campaign = "") => {
    const normalized = normalizeCartItemName(itemName);
    const normalizedWithoutGrade = stripGradeFromCartItemName(itemName);
    for (const item of Object.values(ITEMS)) {
      const name = normalizeCartItemName(item.name || "");
      if (name === normalized) return withInferredCartGrade(item, itemName, campaign);
    }
    for (const item of Object.values(ITEMS)) {
      const name = normalizeCartItemName(item.name || "");
      if (name === normalizedWithoutGrade) return withInferredCartGrade(item, itemName, campaign);
    }
    return null;
  }, "findItemByName");
  let parseCartItems = /* @__PURE__ */ __name((layout) => {
    const rows = layout.querySelectorAll(".js-cart-item");
    const items = [];
    for (const row of rows) {
      const checkbox = row.querySelector("input[data-item]");
      if (!checkbox) continue;
      const nameCell = row.querySelector(".js-cart-item-name");
      const title = nameCell?.textContent?.trim() || "";
      const countCell = row.querySelector("td:last-child");
      const countText = (countCell?.textContent?.trim() || "1").replace(/[^\d]/g, "");
      const count = parseInt(countText, 10) || 1;
      const dateCell = row.querySelector("td:first-child");
      const dateStr = dateCell?.textContent?.trim() || "";
      const dp = dateStr.match(/^(\d{2}):(\d{2}):(\d{2})\s+(\d{2})\.(\d{2})\.(\d{4})$/);
      const date = dp ? new Date(+dp[6], +dp[5] - 1, +dp[4], +dp[1], +dp[2], +dp[3]) : new Date(dateStr);
      const itemId = checkbox.getAttribute("data-item") || "";
      const campaignCell = row.querySelector("td:nth-child(3)");
      let campaign = "";
      let timerText = "";
      if (campaignCell) {
        for (const node of campaignCell.childNodes) {
          if (node === checkbox) continue;
          const t = (node.textContent || "").trim();
          if (!t) continue;
          if (t.startsWith("(") && t.includes("\u043C\u0438\u043D.")) {
            timerText = t;
          } else {
            campaign = t;
          }
        }
      }
      const disabled = row.classList.contains("js-disabled");
      items.push({ title, count, date, itemId, campaign, disabled, timerText });
    }
    return items;
  }, "parseCartItems");
  let parseCartCharacters = /* @__PURE__ */ __name((layout) => {
    const labels = layout.querySelectorAll(".char_select label");
    const chars = [];
    for (const label of labels) {
      const radio = label.querySelector('input[name="shard_char"]');
      if (!radio) continue;
      const name = label.querySelector(".name")?.textContent?.trim() || "";
      const server = label.querySelector(".info")?.textContent?.trim() || "";
      const value = radio.value || "";
      const enabled = !radio.disabled;
      if (!enabled) continue;
      chars.push({ name, server, value, enabled });
    }
    return chars;
  }, "parseCartCharacters");
  let makeCartRow = /* @__PURE__ */ __name((cartItem, makeItemIconLink2) => {
    const tr = pageDocument.createElement("tr");
    tr.className = "item";
    if (cartItem.disabled) tr.classList.add("disabled");
    const tdDate = pageDocument.createElement("td");
    tdDate.className = "g\u0441_1";
    const d = cartItem.date;
    const pad = /* @__PURE__ */ __name((n) => n < 10 ? "0" + n : "" + n, "pad");
    tdDate.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    tr.appendChild(tdDate);
    const tdCount = pageDocument.createElement("td");
    tdCount.className = "g\u0441_4";
    tdCount.textContent = cartItem.count > 1 ? `${cartItem.count}\xD7` : "";
    tr.appendChild(tdCount);
    const tdName = pageDocument.createElement("td");
    tdName.className = "g\u0441_2";
    const nameContainer = pageDocument.createElement("div");
    nameContainer.className = "tm-cart-item-name";
    const itemData = findItemByName(cartItem.title, cartItem.campaign);
    if (itemData) {
      const iconEl = makeItemIconLink2({
        item: itemData,
        linked: true,
        size: "small"
      });
      nameContainer.appendChild(iconEl);
    }
    nameContainer.appendChild(pageDocument.createTextNode(cartItem.title));
    tdName.appendChild(nameContainer);
    tr.appendChild(tdName);
    const tdCampaign = pageDocument.createElement("td");
    tdCampaign.className = "g\u0441_3";
    tdCampaign.textContent = cartItem.campaign;
    if (cartItem.disabled && cartItem.timerText) {
      const timer = pageDocument.createElement("span");
      timer.className = "tm-cart-timer";
      timer.textContent = cartItem.timerText;
      tdCampaign.appendChild(timer);
    }
    tr.appendChild(tdCampaign);
    return tr;
  }, "makeCartRow");
  let showCartPopup = /* @__PURE__ */ __name(({ title, body, buttons }) => {
    let src = pageDocument.getElementById("tm_cart_popup_src");
    if (!src) {
      src = pageDocument.createElement("div");
      src.id = "tm_cart_popup_src";
      src.style.display = "none";
      pageDocument.body.appendChild(src);
    }
    src.innerHTML = `
            <div class="main_popup_block">
                <div class="header blue">${title}</div>
                <div class="inner_cont">${body}</div>
                <div class="popup_buttons">
                    ${buttons.map(
      (btn, i) => `<a href="#" class="guild_button1 ${btn.icon}" data-tm-btn="${i}"><em></em>${btn.label}</a>`
    ).join("")}
                </div>
            </div>`;
    pageWindow.popup_open(false, "tm_cart_popup_src");
    const popupBlock = pageDocument.getElementById("popup_block");
    if (popupBlock) {
      popupBlock.querySelectorAll("a[data-tm-btn]").forEach((a) => {
        const btn = buttons[parseInt(a.dataset.tmBtn)];
        a.addEventListener("click", (e) => {
          e.preventDefault();
          pageWindow.popup_close();
          btn.action?.();
        });
      });
    }
  }, "showCartPopup");
  let buildCartUI = /* @__PURE__ */ __name((cartItems, characters, container, origLayout, deps = {}) => {
    void characters;
    const {
      makeItemIconLink: makeItemIconLink2,
      renderSelectedItems: renderSelectedItemsFn = renderSelectedItems,
      appendReloadBtn: appendReloadBtnFn = appendReloadBtn,
      fetchText: fetchText2,
      getUidFromCheckUser: getUidFromCheckUser2
    } = deps;
    container.innerHTML = "";
    const layout = pageDocument.createElement("div");
    layout.className = "cart_layout";
    const form = pageDocument.createElement("form");
    form.id = "cart_items_form";
    form.onsubmit = () => false;
    const selectedIds = /* @__PURE__ */ new Set();
    let selectedChar = "";
    const rowMap = /* @__PURE__ */ new Map();
    const left = pageDocument.createElement("div");
    left.className = "cart_left";
    const leftHeader = pageDocument.createElement("div");
    leftHeader.className = "guild_header2 blue";
    leftHeader.textContent = "\u0421\u043F\u0438\u0441\u043E\u043A \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432";
    appendReloadBtnFn(leftHeader);
    left.appendChild(leftHeader);
    const tableWrapper = pageDocument.createElement("div");
    tableWrapper.className = "guild_tab_wrapper";
    const table = pageDocument.createElement("table");
    table.className = "guild_tab no_lines cart_items";
    table.cellSpacing = "0";
    table.cellPadding = "0";
    const thead = pageDocument.createElement("thead");
    const headerRow = pageDocument.createElement("tr");
    for (const [cls, text] of [["gh_1", "\u0414\u0430\u0442\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F"], ["gh_4", ""], ["gh_2", "\u041F\u0440\u0435\u0434\u043C\u0435\u0442"], ["gh_3", "\u0410\u043A\u0446\u0438\u044F"]]) {
      const th = pageDocument.createElement("th");
      th.className = cls;
      th.textContent = text;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = pageDocument.createElement("tbody");
    for (const cartItem of cartItems) {
      const tr = makeCartRow(cartItem, makeItemIconLink2);
      rowMap.set(cartItem.itemId, tr);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    left.appendChild(tableWrapper);
    const right = pageDocument.createElement("div");
    right.className = "cart_right";
    const selectedHeader = pageDocument.createElement("div");
    selectedHeader.className = "guild_header2 blue";
    selectedHeader.textContent = "\u0421\u043F\u0438\u0441\u043E\u043A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432";
    right.appendChild(selectedHeader);
    const selectedOuter = pageDocument.createElement("div");
    selectedOuter.className = "tm-selected-container";
    const selectedWrap = pageDocument.createElement("div");
    selectedWrap.className = "tm-selected-list";
    selectedOuter.appendChild(selectedWrap);
    right.appendChild(selectedOuter);
    const charsHeader = pageDocument.createElement("div");
    charsHeader.className = "guild_header2 blue";
    charsHeader.textContent = "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430";
    right.appendChild(charsHeader);
    const origCharSelect = origLayout.querySelector(".char_select");
    if (origCharSelect) {
      right.appendChild(origCharSelect);
      origCharSelect.querySelectorAll(".js-char").forEach((label) => {
        const radio = label.querySelector('input[name="shard_char"]');
        if (!radio || radio.disabled) return;
        label.addEventListener("click", () => {
          selectedChar = radio.value;
          radio.checked = true;
          updateTransferBtn();
        });
      });
      (async () => {
        try {
          const uid = await getUidFromCheckUser2();
          const html = await fetchText2(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
          const doc = new DOMParser().parseFromString(html, "text/html");
          const faceMap = /* @__PURE__ */ new Map();
          for (const li of doc.querySelectorAll("li[data-face]")) {
            const name = li.querySelector("strong")?.textContent?.trim();
            const face = li.getAttribute("data-face");
            if (name && face) faceMap.set(name, face);
          }
          origCharSelect.querySelectorAll("label.js-char").forEach((label) => {
            const name = label.querySelector(".name")?.textContent?.trim();
            const face = faceMap.get(name);
            if (!face) return;
            const iconDiv = label.querySelector("div");
            if (!iconDiv) return;
            const img = pageDocument.createElement("img");
            img.className = "tm-char-face";
            img.addEventListener("load", () => {
              img.classList.add("tm-char-face--loaded");
              label.classList.add("tm-char-face-ready");
            }, { once: true });
            img.addEventListener("error", () => {
              img.classList.add("tm-char-face--error");
            });
            img.src = face;
            iconDiv.appendChild(img);
          });
        } catch {
        }
      })();
    }
    const transferBtn = pageDocument.createElement("span");
    transferBtn.className = "guild_button1 ico_done";
    transferBtn.innerHTML = "<em></em>\u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C";
    transferBtn.style.opacity = "0.5";
    transferBtn.style.pointerEvents = "none";
    right.appendChild(pageDocument.createElement("br"));
    right.appendChild(transferBtn);
    form.appendChild(left);
    form.appendChild(right);
    const clear = pageDocument.createElement("div");
    clear.className = "clear";
    form.appendChild(clear);
    layout.appendChild(form);
    container.appendChild(layout);
    const updateTransferBtn = /* @__PURE__ */ __name(() => {
      const enabled = selectedIds.size > 0 && !!selectedChar;
      transferBtn.style.opacity = enabled ? "" : "0.5";
      transferBtn.style.pointerEvents = enabled ? "" : "none";
    }, "updateTransferBtn");
    const renderSelectedList = /* @__PURE__ */ __name(() => {
      const selectedArray = [...selectedIds].map((id) => cartItems.find((i) => i.itemId === id)).filter(Boolean);
      renderSelectedItemsFn(selectedWrap, selectedArray, {
        emptyText: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0438 \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 \u0441\u043B\u0435\u0432\u0430",
        onRemove: /* @__PURE__ */ __name((cartItem) => deselectItem(cartItem.itemId), "onRemove"),
        mapItem: /* @__PURE__ */ __name((cartItem) => {
          const itemData = findItemByName(cartItem.title, cartItem.campaign);
          return {
            iconUrl: "",
            name: !itemData && cartItem.count > 1 ? `${cartItem.title} ${cartItem.count}\xD7` : cartItem.title,
            itemBase: itemData || void 0,
            count: cartItem.count
          };
        }, "mapItem")
      }, makeItemIconLink2);
    }, "renderSelectedList");
    const selectItem = /* @__PURE__ */ __name((id) => {
      selectedIds.add(id);
      const row = rowMap.get(id);
      if (row) row.classList.add("tm-selected");
      renderSelectedList();
      updateTransferBtn();
    }, "selectItem");
    const deselectItem = /* @__PURE__ */ __name((id) => {
      selectedIds.delete(id);
      const row = rowMap.get(id);
      if (row) row.classList.remove("tm-selected");
      renderSelectedList();
      updateTransferBtn();
    }, "deselectItem");
    for (const cartItem of cartItems) {
      if (cartItem.disabled) continue;
      const row = rowMap.get(cartItem.itemId);
      if (!row) continue;
      row.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        if (selectedIds.has(cartItem.itemId)) return;
        selectItem(cartItem.itemId);
      });
    }
    transferBtn.addEventListener("click", () => {
      showCartPopup({
        title: "\u0412\u044B \u0443\u0432\u0435\u0440\u0435\u043D\u044B?",
        body: "<p>\u041F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0431\u0443\u0434\u0443\u0442 \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u044B \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C\u0443 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0443</p>",
        buttons: [
          {
            label: "\u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C",
            icon: "ico_done",
            action: /* @__PURE__ */ __name(async () => {
              const allIds = [...selectedIds];
              const chunks = [];
              for (let i = 0; i < allIds.length; i += 5) {
                chunks.push(allIds.slice(i, i + 5));
              }
              const messages = [];
              const transferred = [];
              try {
                for (const chunk of chunks) {
                  const fd = new FormData();
                  for (const id of chunk) {
                    fd.append(`items[${id}]`, "on");
                  }
                  fd.append("shard_char", selectedChar);
                  const res = await fetch("/dynamic/cart/?a=item_process", {
                    method: "POST",
                    body: fd
                  });
                  const json = await res.json();
                  if (json.result === 1) {
                    transferred.push(...chunk);
                    if (json.msg) messages.push(json.msg);
                  } else {
                    showCartPopup({
                      title: "\u041E\u0448\u0438\u0431\u043A\u0430",
                      body: `<p>${json.msg || "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430"}</p>`,
                      buttons: [{ label: "\u041E\u043A", icon: "ico_done", action: null }]
                    });
                    break;
                  }
                }
                for (const id of transferred) {
                  const row = rowMap.get(id);
                  if (row) row.remove();
                  rowMap.delete(id);
                  selectedIds.delete(id);
                  const idx = cartItems.findIndex((i) => i.itemId === id);
                  if (idx !== -1) cartItems.splice(idx, 1);
                }
                renderSelectedList();
                updateTransferBtn();
                if (messages.length > 0) {
                  const body = messages.flatMap((m) => m.split("&nbsp;")).filter(Boolean).join("<br/>");
                  showCartPopup({
                    title: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0438",
                    body: `<p>${body}</p>`,
                    buttons: [{ label: "\u041E\u043A", icon: "ico_done", action: null }]
                  });
                }
              } catch (e) {
                showCartPopup({
                  title: "\u041E\u0448\u0438\u0431\u043A\u0430",
                  body: `<p>\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441: ${e.message}</p>`,
                  buttons: [{ label: "\u041E\u043A", icon: "ico_done", action: null }]
                });
              }
            }, "action")
          },
          { label: "\u041E\u0442\u043C\u0435\u043D\u0430", icon: "ico_cancel", action: null }
        ]
      });
    });
    renderSelectedList();
  }, "buildCartUI");
  let initCart = /* @__PURE__ */ __name(({
    injectItemIconStyles: injectItemIconStyles2,
    injectSelectedItemsStyles: injectSelectedItemsStyles2,
    injectCartStyles: injectCartStyles2,
    makeItemIconLink: makeItemIconLink2,
    fetchText: fetchText2,
    getUidFromCheckUser: getUidFromCheckUser2
  }) => {
    injectItemIconStyles2();
    injectSelectedItemsStyles2();
    injectCartStyles2();
    injectReloadBtnStyles();
    const cartObserver = new MutationObserver((mutations, obs) => {
      void mutations;
      const layout = pageDocument.querySelector(".cart_layout");
      if (!layout) return;
      obs.disconnect();
      const cartItems = parseCartItems(layout);
      cartItems.sort((a, b) => b.date - a.date);
      const characters = parseCartCharacters(layout);
      const container = pageDocument.getElementById("mr_block_cart");
      if (!container) return;
      buildCartUI(cartItems, characters, container, layout, {
        makeItemIconLink: makeItemIconLink2,
        renderSelectedItems,
        appendReloadBtn,
        fetchText: fetchText2,
        getUidFromCheckUser: getUidFromCheckUser2
      });
    });
    cartObserver.observe(pageDocument.body, { childList: true, subtree: true });
  }, "initCart");

  // src/itemrestore.js
  let IR_URL = {
    grades: "/dynamic/itemrestore/index.php?a=get_item_grades",
    info: "/dynamic/itemrestore/index.php?a=get_restore_info",
    items: "/dynamic/itemrestore/index.php?a=get_user_items",
    restore: "/dynamic/itemrestore/index.php?a=post_restore_items"
  };
  let showItemRestorePopup = /* @__PURE__ */ __name(({ title, body, buttons }) => {
    let src = document.getElementById("tm_ir_popup_src");
    if (!src) {
      src = document.createElement("div");
      src.id = "tm_ir_popup_src";
      src.style.display = "none";
      document.body.appendChild(src);
    }
    src.innerHTML = `
            <div class="main_popup_block">
                <div class="header blue">${title}</div>
                <div class="inner_cont">${body}</div>
                <div class="popup_buttons">
                    ${buttons.map(
      (btn, i) => `<a href="#" class="guild_button1 ${btn.icon}" data-tm-btn="${i}"><em></em>${btn.label}</a>`
    ).join("")}
                </div>
            </div>`;
    pageWindow.popup_open(false, "tm_ir_popup_src");
    const popupBlock = document.getElementById("popup_block");
    if (popupBlock) {
      popupBlock.querySelectorAll("a[data-tm-btn]").forEach((a) => {
        const btn = buttons[parseInt(a.dataset.tmBtn)];
        a.addEventListener("click", (e) => {
          e.preventDefault();
          pageWindow.popup_close();
          btn.action?.();
        });
      });
    }
  }, "showItemRestorePopup");
  let buildItemRestoreUI = /* @__PURE__ */ __name((container, grades, info, items, { makeItemIconLink: makeItemIconLink2 }) => {
    const allItems = items.map((item) => ({ ...item, selected: false }));
    const selectedItems = [];
    let restoredItems = info.restoredByeLastMonth || 0;
    const recoveryLimit = 10;
    const savedPerPage = parseInt(localStorage.getItem("tm_aa_ir_per_page"));
    let itemsPerPage = [10, 20, 30].includes(savedPerPage) ? savedPerPage : savedPerPage === 0 ? 0 : 10;
    let filterGrade = -1;
    let findString = "";
    let activePage = 1;
    let sortAsc = false;
    const mapGrade = /* @__PURE__ */ __name((apiGrade) => {
      const gradeName = getGradeName(apiGrade);
      if (gradeName !== "-") {
        const idx = GRADES.findIndex((g) => g.title === gradeName);
        if (idx !== -1) return idx;
      }
      return parseInt(apiGrade) || 0;
    }, "mapGrade");
    const toItemBase = /* @__PURE__ */ __name((item) => {
      const known = ITEMS[item.type];
      const apiGrade = item.grade != null ? mapGrade(item.grade) : null;
      const inferredGrade = inferGradeFromCartItemName(item.gi_name || known?.name || "");
      const grade = known?.grade ?? apiGrade ?? inferredGrade ?? 1;
      const isGradeInferred = known?.grade == null && apiGrade == null && inferredGrade != null;
      return {
        id: String(item.type || ""),
        icon: item.iconurl || "",
        name: item.gi_name || "",
        description: item.gi_description || "",
        ...known,
        ...item.iconurl ? { icon: item.iconurl } : {},
        ...item.gi_name ? { name: item.gi_name } : {},
        ...item.gi_description ? { description: item.gi_description } : {},
        grade,
        ...isGradeInferred ? { isGradeInferred: true } : {}
      };
    }, "toItemBase");
    const addZero = /* @__PURE__ */ __name((n) => n < 10 ? "0" + n : "" + n, "addZero");
    const formatDate = /* @__PURE__ */ __name((ts) => {
      const dt = new Date(ts);
      return `${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()}`;
    }, "formatDate");
    const formatDateTime = /* @__PURE__ */ __name((ts) => {
      const dt = new Date(ts);
      return `${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()} ${addZero(dt.getHours())}:${addZero(dt.getMinutes())}`;
    }, "formatDateTime");
    const formatDateTimeFull = /* @__PURE__ */ __name((ts) => {
      const dt = new Date(ts);
      return `${addZero(dt.getHours())}:${addZero(dt.getMinutes())}:${addZero(dt.getSeconds())} ${addZero(dt.getDate())}.${addZero(dt.getMonth() + 1)}.${dt.getFullYear()}`;
    }, "formatDateTimeFull");
    const getExpireTime = /* @__PURE__ */ __name((dateStr) => {
      const expire = Date.parse(dateStr);
      const now = Date.now();
      const hoursAll = (expire - now) / (1e3 * 60 * 60);
      const days = Math.floor(hoursAll / 24);
      const hours = Math.round(hoursAll - days * 24);
      return `${days} \u0434. ${hours} \u0447.`;
    }, "getExpireTime");
    const getGradeName = /* @__PURE__ */ __name((id) => {
      const g = grades.find((v) => String(v.id) === String(id));
      return g ? g.name : "-";
    }, "getGradeName");
    const getFilteredItems = /* @__PURE__ */ __name(() => {
      const filtered = allItems.filter((v) => {
        const gradeOk = filterGrade === -1 || String(v.grade) === String(filterGrade);
        const nameOk = !findString || v.gi_name && v.gi_name.toLowerCase().includes(findString.toLowerCase());
        return gradeOk && nameOk;
      });
      const dir = sortAsc ? 1 : -1;
      filtered.sort((a, b) => dir * ((a.deleted || "") > (b.deleted || "") ? 1 : (a.deleted || "") < (b.deleted || "") ? -1 : 0));
      return filtered;
    }, "getFilteredItems");
    const getPageItems = /* @__PURE__ */ __name(() => {
      const filtered = getFilteredItems();
      if (!itemsPerPage) return filtered;
      const start = (activePage - 1) * itemsPerPage;
      const end = Math.min(start + itemsPerPage, filtered.length);
      return filtered.slice(start, end);
    }, "getPageItems");
    const getPagesCount = /* @__PURE__ */ __name(() => itemsPerPage ? Math.ceil(getFilteredItems().length / itemsPerPage) : 1, "getPagesCount");
    const section = document.createElement("section");
    const filterDiv = document.createElement("div");
    filterDiv.className = "itemrestore__filter";
    const gradeTitle = document.createElement("div");
    gradeTitle.className = "itemrestore__filter-title";
    gradeTitle.textContent = "\u041A\u0430\u0447\u0435\u0441\u0442\u0432\u043E";
    filterDiv.appendChild(gradeTitle);
    const gradeOptions = [{ value: -1, label: "\u041D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043E" }, ...grades.map((g) => ({ value: g.id, label: g.name }))];
    const gradeSelectWrapper = makeSelect({
      options: gradeOptions,
      selected: filterGrade,
      onChange: /* @__PURE__ */ __name((val) => {
        filterGrade = parseInt(val);
        activePage = 1;
        renderTable();
      }, "onChange")
    });
    filterDiv.appendChild(gradeSelectWrapper);
    const gradeReset = document.createElement("div");
    gradeReset.className = "itemrestore__grades-reset";
    filterDiv.appendChild(gradeReset);
    const nameTitle = document.createElement("div");
    nameTitle.className = "itemrestore__filter-title";
    nameTitle.textContent = "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435";
    filterDiv.appendChild(nameTitle);
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "itemrestore__input-wrapper";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "itemrestore__filter-name";
    inputWrapper.appendChild(nameInput);
    filterDiv.appendChild(inputWrapper);
    const searchBtn = document.createElement("div");
    searchBtn.className = "itemrestore__search-btn";
    const searchSpan = document.createElement("span");
    searchSpan.textContent = " \u0418\u0441\u043A\u0430\u0442\u044C";
    searchBtn.appendChild(searchSpan);
    filterDiv.appendChild(searchBtn);
    section.appendChild(filterDiv);
    const panelWrapper = document.createElement("div");
    panelWrapper.className = "itemrestore__panel-wrapper";
    const panel = document.createElement("div");
    panel.className = "itemrestore__panel";
    const panelLeft = document.createElement("div");
    panelLeft.className = "itemrestore__panel-left";
    const leftTitle = document.createElement("div");
    leftTitle.className = "guild_header2 green";
    leftTitle.textContent = "\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B";
    appendReloadBtn(leftTitle);
    panelLeft.appendChild(leftTitle);
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "itemrestore__table-wrapper";
    const table = document.createElement("table");
    table.className = "itemrestore__table";
    table.cellSpacing = "0";
    table.cellPadding = "0";
    const headerRow = document.createElement("tr");
    headerRow.className = "itemrestore__table-header";
    const headers = [
      { cls: "n4", text: "" },
      { cls: "n1", text: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" },
      { cls: "n5", text: "\u0414\u043E\xA0\u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F" },
      { cls: "n6", text: "\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436" }
    ];
    const thDate = document.createElement("th");
    thDate.className = "n2 tm-sortable";
    const thDateText = document.createElement("span");
    thDateText.textContent = "\u0423\u0434\u0430\u043B\u0451\u043D";
    const thDateArrow = document.createElement("span");
    thDateArrow.className = "tm-sort-arrow";
    thDateArrow.textContent = sortAsc ? " \u25B2" : " \u25BC";
    thDate.appendChild(thDateText);
    thDate.appendChild(thDateArrow);
    thDate.addEventListener("click", () => {
      sortAsc = !sortAsc;
      thDateArrow.textContent = sortAsc ? " \u25B2" : " \u25BC";
      activePage = 1;
      renderTable();
    });
    headerRow.appendChild(thDate);
    for (const h of headers) {
      const th = document.createElement("th");
      if (h.cls) th.className = h.cls;
      th.textContent = h.text;
      headerRow.appendChild(th);
    }
    const tbody = document.createElement("tbody");
    tbody.appendChild(headerRow);
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    panelLeft.appendChild(tableWrapper);
    const tableFooter = document.createElement("div");
    tableFooter.className = "tm-table-footer";
    const pagination = document.createElement("div");
    pagination.className = "itemrestore__pagintation";
    tableFooter.appendChild(pagination);
    const perPageWrap = makeSelect({
      options: [{ value: 10, label: "10" }, { value: 20, label: "20" }, { value: 30, label: "30" }, { value: 0, label: "\u0412\u0441\u0435" }],
      selected: itemsPerPage,
      onChange: /* @__PURE__ */ __name((val) => {
        itemsPerPage = parseInt(val);
        localStorage.setItem("tm_aa_ir_per_page", itemsPerPage);
        activePage = 1;
        renderTable();
      }, "onChange")
    });
    tableFooter.appendChild(perPageWrap);
    panelLeft.appendChild(tableFooter);
    panel.appendChild(panelLeft);
    const panelRight = document.createElement("div");
    panelRight.className = "itemrestore__panel-right";
    const rightTitle = document.createElement("div");
    rightTitle.className = "guild_header2 green";
    rightTitle.textContent = "\u0421\u043F\u0438\u0441\u043E\u043A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432";
    panelRight.appendChild(rightTitle);
    const selectedContainer = document.createElement("div");
    selectedContainer.className = "tm-selected-container";
    const selectedList = document.createElement("div");
    selectedList.className = "tm-selected-list";
    selectedContainer.appendChild(selectedList);
    panelRight.appendChild(selectedContainer);
    const restoreBtn = document.createElement("div");
    restoreBtn.className = "itemrestore-recovery_btn";
    const restoreBtnSpan = document.createElement("span");
    restoreBtnSpan.textContent = "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C";
    restoreBtn.appendChild(restoreBtnSpan);
    panelRight.appendChild(restoreBtn);
    panel.appendChild(panelRight);
    panelWrapper.appendChild(panel);
    section.appendChild(panelWrapper);
    const infoRestoredP = document.createElement("p");
    const infoDateP = document.createElement("p");
    section.appendChild(infoRestoredP);
    section.appendChild(infoDateP);
    const updateInfoText = /* @__PURE__ */ __name(() => {
      infoRestoredP.textContent = `\u0417\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439 \u043C\u0435\u0441\u044F\u0446 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432: ${restoredItems} \u0438\u0437 ${recoveryLimit} \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u044B\u0445.`;
      infoDateP.textContent = info.lastRestored_at ? `\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435: ${formatDateTime(info.lastRestored_at * 1e3)}` : "";
    }, "updateInfoText");
    updateInfoText();
    container.appendChild(section);
    const renderTable = /* @__PURE__ */ __name(() => {
      const pageItems = getPageItems();
      while (tbody.children.length > 1) tbody.removeChild(tbody.lastChild);
      for (const item of pageItems) {
        const tr = document.createElement("tr");
        if (item.selected) tr.className = "selected";
        const tdDate = document.createElement("td");
        tdDate.className = "n2";
        tdDate.textContent = item.deleted ? formatDateTimeFull(Date.parse(item.deleted)) : "";
        tr.appendChild(tdDate);
        const tdCount = document.createElement("td");
        tdCount.className = "n4";
        tdCount.textContent = parseInt(item.stack) > 1 ? `${item.stack}\xD7` : "";
        tr.appendChild(tdCount);
        const tdName = document.createElement("td");
        tdName.className = "n1";
        const nameWrap = document.createElement("div");
        nameWrap.className = "tm-cart-item-name";
        const itemBase = toItemBase(item);
        nameWrap.appendChild(makeItemIconLink2({
          item: itemBase,
          linked: true,
          size: "small"
        }));
        const nameText = document.createElement("span");
        nameText.textContent = item.gi_name || itemBase.name || "";
        if (item.color) {
          nameText.style.color = `#${item.color}`;
        } else if (itemBase.grade) {
          nameText.style.color = GRADES[itemBase.grade].color;
        }
        nameWrap.appendChild(nameText);
        tdName.appendChild(nameWrap);
        tr.appendChild(tdName);
        const tdExpire = document.createElement("td");
        tdExpire.className = "n5";
        tdExpire.textContent = item.expire ? getExpireTime(item.expire) : "";
        tr.appendChild(tdExpire);
        const tdChar = document.createElement("td");
        tdChar.className = "n6";
        const serverName = SERVERS[item.shard_id] || "";
        tdChar.appendChild(document.createTextNode(item.name || ""));
        if (serverName) {
          const serverSpan = document.createElement("span");
          serverSpan.className = "tm-server-name";
          serverSpan.textContent = ` (${serverName})`;
          tdChar.appendChild(serverSpan);
        }
        tr.appendChild(tdChar);
        tr.addEventListener("click", () => {
          if (!item.selected) {
            selectItem(item);
          }
        });
        tbody.appendChild(tr);
      }
      renderPagination();
    }, "renderTable");
    const renderPagination = /* @__PURE__ */ __name(() => {
      pagination.innerHTML = "";
      const pagesCount = getPagesCount();
      if (pagesCount > 1) {
        const makeNavButton = /* @__PURE__ */ __name((className, label, title, isActive, onClick) => {
          const btn = document.createElement("div");
          btn.className = "itemrestore__pagintation-btn " + className + (isActive ? " active" : "");
          btn.textContent = label;
          btn.title = title;
          btn.addEventListener("click", onClick);
          return btn;
        }, "makeNavButton");
        const makeEllipsis = /* @__PURE__ */ __name(() => {
          const ellipsis = document.createElement("div");
          ellipsis.className = "itemrestore__pagintation-ellipsis";
          ellipsis.textContent = "...";
          return ellipsis;
        }, "makeEllipsis");
        const btnFirst = document.createElement("div");
        btnFirst.className = "itemrestore__pagintation-btn first" + (activePage > 1 ? " active" : "");
        btnFirst.textContent = "\xAB";
        btnFirst.title = "\u041F\u0435\u0440\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430";
        btnFirst.addEventListener("click", () => {
          if (activePage > 1) {
            activePage = 1;
            renderTable();
          }
        });
        pagination.appendChild(btnFirst);
        const btnPrev = document.createElement("div");
        btnPrev.className = "itemrestore__pagintation-btn prev" + (activePage > 1 ? " active" : "");
        btnPrev.textContent = "\u2039";
        btnPrev.title = "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430";
        btnPrev.addEventListener("click", () => {
          if (activePage > 1) {
            activePage--;
            renderTable();
          }
        });
        pagination.appendChild(btnPrev);
        const pagesDiv = document.createElement("div");
        pagesDiv.className = "itemrestore__pagintation-pages";
        const maxVisiblePages = 9;
        let start = Math.max(1, activePage - 4);
        let end = Math.min(pagesCount, activePage + 4);
        if (end - start + 1 < maxVisiblePages) {
          if (start === 1) {
            end = Math.min(pagesCount, start + maxVisiblePages - 1);
          } else if (end === pagesCount) {
            start = Math.max(1, end - maxVisiblePages + 1);
          }
        }
        if (start > 1) pagesDiv.appendChild(makeEllipsis());
        for (let i = start; i <= end; i++) {
          const page = document.createElement("div");
          page.className = "itemrestore__pagintation-page" + (i === activePage ? " active" : "");
          page.textContent = i;
          const pageNum = i;
          page.addEventListener("click", () => {
            activePage = pageNum;
            renderTable();
          });
          pagesDiv.appendChild(page);
        }
        if (end < pagesCount) pagesDiv.appendChild(makeEllipsis());
        pagination.appendChild(pagesDiv);
        const btnNext = makeNavButton(
          "next",
          "\u203A",
          "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430",
          activePage < pagesCount,
          () => {
            if (activePage < pagesCount) {
              activePage++;
              renderTable();
            }
          }
        );
        pagination.appendChild(btnNext);
        const btnLast = makeNavButton(
          "last",
          "\xBB",
          "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430",
          activePage < pagesCount,
          () => {
            if (activePage < pagesCount) {
              activePage = pagesCount;
              renderTable();
            }
          }
        );
        pagination.appendChild(btnLast);
      }
    }, "renderPagination");
    const renderSelected = /* @__PURE__ */ __name(() => {
      renderSelectedItems(selectedList, selectedItems, {
        emptyText: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0434\u043B\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 \u0441\u043B\u0435\u0432\u0430",
        onRemove: /* @__PURE__ */ __name((item) => deselectItem(item), "onRemove"),
        mapItem: /* @__PURE__ */ __name((item) => ({
          iconUrl: item.iconurl || "",
          name: item.gi_name || "",
          itemBase: toItemBase(item)
        }), "mapItem")
      });
      restoreBtn.classList.toggle("active", selectedItems.length > 0);
    }, "renderSelected");
    const selectItem = /* @__PURE__ */ __name((item) => {
      if (item.selected) return;
      if (restoredItems >= recoveryLimit) {
        showItemRestorePopup({
          title: "\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435",
          body: "<p>\u0414\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442 \u043B\u0438\u043C\u0438\u0442 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u0437\u0430 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043C\u0435\u0441\u044F\u0446.</p>",
          buttons: [{ label: "\u041E\u043A", icon: "ico_done", action: null }]
        });
        return;
      }
      if (selectedItems.length + restoredItems >= recoveryLimit) {
        showItemRestorePopup({
          title: "\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435",
          body: "<p>\u0412\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 \u043B\u0438\u043C\u0438\u0442 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F.</p>",
          buttons: [{ label: "\u041E\u043A", icon: "ico_done", action: null }]
        });
        return;
      }
      item.selected = true;
      selectedItems.push(item);
      renderTable();
      renderSelected();
    }, "selectItem");
    const deselectItem = /* @__PURE__ */ __name((item) => {
      if (!item.selected) return;
      item.selected = false;
      const idx = selectedItems.indexOf(item);
      if (idx !== -1) selectedItems.splice(idx, 1);
      renderTable();
      renderSelected();
    }, "deselectItem");
    const restoreItems = /* @__PURE__ */ __name(() => {
      if (selectedItems.length === 0) return;
      showItemRestorePopup({
        title: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432",
        body: `<p>\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B (${selectedItems.length} \u0448\u0442.)?</p>`,
        buttons: [
          {
            label: "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C",
            icon: "ico_done",
            action: /* @__PURE__ */ __name(async () => {
              const ids = selectedItems.map((v) => v.itemid);
              try {
                const res = await fetch(IR_URL.restore, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(ids)
                });
                const json = await res.json();
                if (json && json.success) {
                  let successCount = 0;
                  const results = json.data || {};
                  for (const [id, result] of Object.entries(results)) {
                    if (result.status === "ok") {
                      const allIdx = allItems.findIndex((v) => v.itemid == id);
                      if (allIdx !== -1) allItems.splice(allIdx, 1);
                      const selIdx = selectedItems.findIndex((v) => v.itemid == id);
                      if (selIdx !== -1) selectedItems.splice(selIdx, 1);
                      if (allIdx !== -1 && selIdx !== -1) successCount++;
                    }
                  }
                  restoredItems += successCount;
                  activePage = 1;
                  updateInfoText();
                  renderTable();
                  renderSelected();
                  const resultLines = Object.entries(results).map(([id, r]) => {
                    const item = items.find((v) => v.itemid == id);
                    const name = item ? item.gi_name : id;
                    return `${name}: ${r.status === "ok" ? "\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D" : "\u043E\u0448\u0438\u0431\u043A\u0430"}`;
                  });
                  showItemRestorePopup({
                    title: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442",
                    body: `<p>${resultLines.join("<br>")}</p>`,
                    buttons: [{ label: "\u041E\u043A", icon: "ico_done", action: null }]
                  });
                } else if (json.error) {
                  showItemRestorePopup({
                    title: "\u041E\u0448\u0438\u0431\u043A\u0430",
                    body: `<p>${json.error}</p>`,
                    buttons: [{ label: "\u041E\u043A", icon: "ico_done", action: null }]
                  });
                }
              } catch (e) {
                showItemRestorePopup({
                  title: "\u041E\u0448\u0438\u0431\u043A\u0430",
                  body: `<p>\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438: ${e.message}</p>`,
                  buttons: [{ label: "\u041E\u043A", icon: "ico_done", action: null }]
                });
              }
            }, "action")
          },
          { label: "\u041E\u0442\u043C\u0435\u043D\u0430", icon: "", action: null }
        ]
      });
    }, "restoreItems");
    gradeReset.addEventListener("click", () => {
      if (filterGrade !== -1) activePage = 1;
      filterGrade = -1;
      gradeSelectWrapper.querySelector("select").value = "-1";
      renderTable();
    });
    searchBtn.addEventListener("click", () => {
      findString = nameInput.value.trim();
      activePage = 1;
      renderTable();
    });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        findString = nameInput.value.trim();
        activePage = 1;
        renderTable();
      }
    });
    restoreBtn.addEventListener("click", restoreItems);
    renderTable();
    renderSelected();
  }, "buildItemRestoreUI");
  let injectItemRestoreStyles = /* @__PURE__ */ __name(() => {
    const style = document.createElement("style");
    style.textContent = `
            #block_content {
                overflow: unset;
            }

            .itemrestore__panel-left {
                min-height: 615px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .itemrestore__table-wrapper {
                min-height: unset;
                margin-bottom: auto;
            }

            .itemrestore__panel-right {
                position: sticky;
                top: 0;
                align-self: flex-start;
            }

            .itemrestore__table tr:last-child td {
                border-bottom: 0;
            }

            .itemrestore__table .n2 {
                width: 0%;
            }

            .itemrestore__table .n4 {
                white-space: nowrap;
                width: 0%;
                text-align: right;
                min-width: 24px;
            }

            .itemrestore__table .n5,
            .itemrestore__table .n6 {
                width: 0%;
            }

            .tm-server-name {
                color: #999;
                font-size: 0.85em;
            }

            .tm-sortable {
                cursor: pointer;
                user-select: none;
                white-space: nowrap;
            }

            .tm-table-footer {
                position: sticky;
                bottom: 0;
                background: #fff;
                padding: 10px;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 12px;
                border: 1px solid #e1e1e1;
                border-radius: 8px;
            }

            .itemrestore__pagintation {
                margin: 0;
            }

            .itemrestore__pagintation,
            .itemrestore__pagintation-pages {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .itemrestore__pagintation-btn,
            .itemrestore__pagintation-page,
            .itemrestore__pagintation-ellipsis {
                min-width: 22px;
                height: 22px;
                line-height: 22px;
                text-align: center;
                user-select: none;
            }

            .itemrestore__pagintation-ellipsis {
                color: #777;
            }

        `;
    document.head.appendChild(style);
  }, "injectItemRestoreStyles");
  let initItemRestore = /* @__PURE__ */ __name(({ injectItemIconStyles: injectItemIconStyles2, injectSelectedItemsStyles: injectSelectedItemsStyles2, makeItemIconLink: makeItemIconLink2 }) => {
    injectItemIconStyles2();
    injectSelectedItemsStyles2();
    injectItemRestoreStyles();
    const intercepted = { grades: null, info: null, items: null };
    let interceptedCount = 0;
    const origFetch = pageWindow.fetch.bind(pageWindow);
    pageWindow.fetch = async (...args) => {
      const res = await origFetch(...args);
      const urlStr = typeof args[0] === "string" ? args[0] : String(args[0]?.url || args[0]);
      const path = urlStr.split("?")[0] + "?" + (urlStr.split("?")[1] || "");
      if (urlStr.includes("a=get_item_grades")) {
        intercepted.grades = await res.clone().json();
        interceptedCount++;
      } else if (urlStr.includes("a=get_restore_info")) {
        intercepted.info = await res.clone().json();
        interceptedCount++;
      } else if (urlStr.includes("a=get_user_items")) {
        intercepted.items = await res.clone().json();
        interceptedCount++;
      }
      if (interceptedCount === 3) {
        interceptedCount = -1;
        tryBuild();
      }
      return res;
    };
    const tryBuild = /* @__PURE__ */ __name(() => {
      const app = document.getElementById("app_itemrestore");
      if (!app) return;
      const grades = intercepted.grades?.data || [];
      const info = intercepted.info?.data || {};
      const items = [];
      if (intercepted.items?.data) {
        Object.values(intercepted.items.data).forEach(
          (server) => Object.values(server).forEach((item) => items.push(item))
        );
      }
      app.className = "";
      app.innerHTML = "";
      buildItemRestoreUI(app, grades, info, items, { makeItemIconLink: makeItemIconLink2 });
    }, "tryBuild");
  }, "initItemRestore");

  // src/data/quests.js
  let CODEX_BASE = "https://archeagecodex.com/ru/quest/";
  let ICON_QUEST = "https://archeagecodex.com/images/icon_quest_common.png";
  let ICON_VEKSEL = "https://aa.cdn.gmru.net/ms/data/game-icons/e046763d68cd5d1b2dbd5513fc845e07.png";
  let ICON_VEKSEL_NORTH = "https://aa.cdn.gmru.net/ms/data/game-icons/6a0ac94699b0c4d678470feb07f3fa85.png";
  let ICON_GISAA_OVERLAY = "https://gisaa.ru/img/gisaa.svg?v=1";
  let VEKSEL_BASE = "https://gisaa.ru/veksel/";
  let QUESTS = [
    { marathonId: [8246], id: 10559, title: "\u0427\u0443\u0436\u0438\u0435 \u043A\u043E\u043A\u043E\u043D\u044B", short: "\u0418\u0444\u043D\u0438\u0440 (\u041A\u0430\u043C\u0435\u043D\u043D\u044B\u0435 \u043A\u0440\u044B\u043B\u044C\u044F) - 10 \u043A\u043E\u043A\u043E\u043D\u043E\u0432" },
    { marathonId: [8248, 8804], id: 9142, title: "\u041F\u043B\u043E\u0442\u043D\u0438\u0446\u043A\u0430\u044F \u043D\u0443\u0436\u0434\u0430", short: "", veksel: "blue_salt", slot: { item: ITEMS[8337], count: 60 } },
    { marathonId: [8250, 8806], id: 9318, title: "\u0414\u0435\u0442\u0438 \u041E\u043B\u044C\u0445\u0430", short: '\u041A\u0432\u0435\u0441\u0442 \u043D\u0430 \u0412\u0437\u0440\u043E\u0441\u043B\u043E\u0433\u043E \u043E\u043B\u044C\u0445\u043E\u043D\u0430 (\u043F\u043E\u0440\u0442\u0430\u043B "\u0423\u043A\u0440\u043E\u043C\u043D\u044B\u0439 \u0443\u0442\u0435\u0441")' },
    { marathonId: [8252, 8808], id: 10512, title: "\u041A\u043E\u0442\u043E\u043C\u043A\u0438 \u044D\u0444\u0435\u043D\u0441\u043A\u043E\u0433\u043E \u0441\u0442\u0440\u0430\u043D\u043D\u0438\u043A\u0430 I", short: "", veksel: "north", locations: ["\u0411\u0443\u0445\u0442\u0430 \u041A\u0438\u0442\u043E\u0431\u043E\u0435\u0432", "\u042D\u0444\u0435\u043D'\u0425\u0430\u043B"], slot: { item: ITEMS[43176], count: 20 } },
    { marathonId: [8254, 8810], id: 10513, title: "\u041A\u043E\u0442\u043E\u043C\u043A\u0438 \u044D\u0444\u0435\u043D\u0441\u043A\u043E\u0433\u043E \u0441\u0442\u0440\u0430\u043D\u043D\u0438\u043A\u0430 II", short: "", veksel: "north", locations: ["\u0411\u0443\u0445\u0442\u0430 \u041A\u0438\u0442\u043E\u0431\u043E\u0435\u0432", "\u042D\u0444\u0435\u043D'\u0425\u0430\u043B"], slot: { item: ITEMS[43176], count: 60 } },
    { marathonId: [8256, 8812], id: 9100, title: "\u0421\u0442\u0430\u0440\u044B\u0439 \u0432\u0440\u0430\u0433", short: "\u0411\u0438\u0431\u043B\u0430, 2-\u043E\u0439 \u0431\u043E\u0441\u0441" },
    { marathonId: [8258, 8814], id: 7658, title: "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u044D\u043A\u0437\u043E\u0440\u0446\u0438\u0441\u0442 (\u0433\u0435\u0440\u043E\u0438\u0447.)", short: "" },
    { marathonId: [8260, 8816], id: 6797, title: "\u041E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C \u0434\u043B\u044F \u043C\u043E\u0440\u044F\u043A\u043E\u0432", short: "15 \u0436\u0443\u043A\u043E\u0432/\u043C\u0435\u0434\u0443\u0437 \u0432 \u043C\u043E\u0440\u0435 (\u043D\u0435 \u0437\u0430\u0431\u044B\u0442\u044C \u0441\u0434\u0430\u0442\u044C)" },
    { marathonId: [8262, 8818], id: 8998, title: "\u0411\u0435\u0441\u043A\u043E\u043D\u0435\u0447\u043D\u044B\u0439 \u0431\u043E\u0439", short: "" },
    { marathonId: [8268, 8824], id: 5972, title: "\u0418 \u043D\u0430 \u0434\u0430\u0440\u0443 \u0431\u044B\u0432\u0430\u0435\u0442 \u043F\u0440\u043E\u0440\u0443...", short: "\u0427\u0435\u0448\u0443\u044F \u0410\u0448\u044C\u044F\u0440\u044B, \u041A\u043E\u043B\u044C\u0446\u043E \u041B\u043E\u0440\u0435\u0438, \u041A\u043E\u043B\u044C\u0446\u043E \u0413\u043B\u0435\u043D\u043D\u0430" },
    { marathonId: [8274, 8830], id: 10480, title: "\u0421\u043E\u0441\u0442\u044F\u0437\u0430\u043D\u0438\u0435 \u0441\u043E\u044E\u0437\u043E\u0432 \u0432 \u0410\u043A\u0430\u0434\u0435\u043C\u0438\u0438", short: "" },
    { marathonId: [8282, 8838], id: 7154, title: "\u0422\u0435\u043C\u043D\u0438\u0446\u0430 \u0414\u0430\u0443\u0442\u044B", short: "" },
    { marathonId: [8284, 8840], id: 9137, title: "\u0416\u0435\u043B\u0435\u0437\u043E \u0434\u043B\u044F \u043A\u043E\u0440\u0430\u0431\u0435\u043B\u043E\u0432", short: "", veksel: "blue_salt", slot: { item: ITEMS[8318], count: 60 } },
    { marathonId: [8286, 8842], id: 8000131, title: "\u0412\u0434\u0430\u043B\u0438 \u043E\u0442 \u043E\u0431\u0435\u0437\u0443\u043C\u0435\u0432\u0448\u0435\u0433\u043E \u043C\u0438\u0440\u0430", short: "\u041A\u0432\u0435\u0441\u0442 \u041D\u0443\u0438 \u043D\u0430 500 \u043E\u0447\u043A\u043E\u0432 \u0440\u0430\u0431\u043E\u0442\u044B" },
    { marathonId: [8288, 8844], id: 10508, title: "\u0420\u0430\u0441\u0448\u0438\u0442\u044B\u0435 \u0436\u0435\u043C\u0447\u0443\u0433\u043E\u043C \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0438 I", short: "", veksel: "north", locations: ["\u0411\u0435\u0437\u0434\u043D\u0430", "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0435 \u043F\u043E\u043B\u044F"], slot: { item: ITEMS[40928], count: 25 } },
    { marathonId: [8290, 8846], id: 10509, title: "\u0420\u0430\u0441\u0448\u0438\u0442\u044B\u0435 \u0436\u0435\u043C\u0447\u0443\u0433\u043E\u043C \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0438 II", short: "", veksel: "north", locations: ["\u0411\u0435\u0437\u0434\u043D\u0430", "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0435 \u043F\u043E\u043B\u044F"], slot: { item: ITEMS[40928], count: 75 } },
    { marathonId: [8292, 8848], id: 5092, title: "\u041E\u0442\u043B\u0438\u0447\u043D\u044B\u0435 \u0444\u0438\u0442\u0438\u043B\u0438", short: `<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/261-kvesty-ot-parfyumera-na-dz-vostok-arheidj#porychenie" target="_blank">\u041F\u0430\u0440\u0444\u044E\u043C\u0435\u0440 \u043D\u0430 \u0432\u043E\u0441\u0442\u043E\u043A\u0435</a>` },
    { marathonId: [8294, 8850], id: 7659, title: "\u0422\u0440\u0435\u0431\u0443\u044E\u0442\u0441\u044F \u0440\u0430\u0431\u043E\u0442\u043D\u0438\u043A\u0438 (\u0433\u0435\u0440\u043E\u0438\u0447.)", short: "" },
    { marathonId: [8296, 8852], id: 7817, title: "\u041E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438 \u043E\u043A\u043E\u043B\u044C\u043D\u044B\u0445 \u0434\u043E\u0440\u043E\u0433", short: "" },
    { marathonId: [8298, 8854], id: 8000058, title: "\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F \u043D\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u043E: \u0411\u0430\u0440\u0440\u0430\u0433\u0430 \u0411\u0435\u0437\u0443\u043C\u043D\u044B\u0439", short: "\u041D\u0430\u0433\u0430\u0448\u0430\u0440 (\u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0431\u044B\u0447\u043A\u0430)", slot: { item: ITEMS[8000749] } },
    { marathonId: [8300, 8856], id: 5971, title: "\u0427\u0435\u0448\u0443\u044F \u0410\u0448\u044C\u044F\u0440\u044B", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8314, 8870], id: 10564, title: "\u041E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0435\u043D\u043D\u044B\u0435 \u0443\u0437\u043D\u0438\u0446\u044B \u041D\u0430\u0433\u0430\u0448\u0430\u0440\u0430", short: "\u0418\u0444\u043D\u0438\u0440 - \u0437\u043C\u0435\u044F", schedule: [{ timeStart: "22:00", weekdays: [5] }, { timeStart: "16:00", weekdays: [6] }] },
    { marathonId: [8316, 8872], id: 8000061, title: "\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F \u043D\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u043E: \u0418\u0448\u0442\u0430\u0440", short: "\u0421\u0430\u0434\u044B \u043D\u0430\u0441\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0439 (\u0442\u043E\u043B\u044C\u043A\u043E \u0445\u0430\u0440\u0434)", slot: { item: ITEMS[8000752] } },
    { marathonId: [8318, 8874], id: 9317, title: "\u041E\u0445\u043E\u0442\u0430 \u043D\u0430 \u043A\u0440\u0443\u043F\u043D\u0443\u044E \u0434\u0438\u0447\u044C", short: '\u041A\u0432\u0435\u0441\u0442 \u043D\u0430 \u041A\u043E\u0441\u043C\u0430\u0447\u0430 (\u043F\u043E\u0440\u0442\u0430\u043B "\u0417\u0438\u043C\u043D\u0438\u0439 \u041E\u0447\u0430\u0433")' },
    { marathonId: [8320, 8876], id: 9152, title: "\u041A\u043D\u0438\u0436\u043D\u044B\u0435 \u043E\u0431\u043B\u043E\u0436\u043A\u0438", short: "", veksel: "blue_salt", slot: { item: ITEMS[16327], count: 60 } },
    { marathonId: [8322, 8878], id: 8435, title: "\u0427\u0438\u0441\u0442\u043E\u0442\u0430 \u0438 \u043F\u043E\u0440\u044F\u0434\u043E\u043A", short: '\u041F\u043E\u0440\u0442\u0430\u043B "\u041B\u044F\u0433\u0443\u0448\u0430\u0447\u044C\u0438 \u043F\u0440\u0443\u0434\u044B"' },
    { marathonId: [8324, 8880], id: 10510, title: "\u0424\u0435\u0440\u043C\u0435\u0440\u0441\u043A\u0438\u0435 \u0441\u0443\u043D\u0434\u0443\u0447\u043A\u0438 \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439 I", short: "", veksel: "north", locations: ["\u0411\u0435\u0437\u0434\u043D\u0430", "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0435 \u043F\u043E\u043B\u044F"], slot: { item: ITEMS[42077], count: 8 } },
    { marathonId: [8326, 8882], id: 10511, title: "\u0424\u0435\u0440\u043C\u0435\u0440\u0441\u043A\u0438\u0435 \u0441\u0443\u043D\u0434\u0443\u0447\u043A\u0438 \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439 II", short: "", veksel: "north", locations: ["\u0411\u0435\u0437\u0434\u043D\u0430", "\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0435 \u043F\u043E\u043B\u044F"], slot: { item: ITEMS[42077], count: 25 } },
    { marathonId: [8328, 8884], id: 7657, title: "\u0420\u0430\u0437\u044B\u0441\u043A\u0438\u0432\u0430\u0435\u0442\u0441\u044F: \u041E'\u041A\u0430\u0440\u0444 (\u0433\u0435\u0440\u043E\u0438\u0447.)", short: "" },
    { marathonId: [8330, 8886], id: 7813, title: "\u041F\u0440\u0435\u0433\u0440\u0430\u0434\u0430 \u043D\u0430 \u043F\u0443\u0442\u0438", short: "" },
    { marathonId: [8336, 8892], id: 5144, title: "\u0420\u0430\u0437\u0433\u0440\u043E\u043C \u043F\u0440\u0438\u0437\u0440\u0430\u0447\u043D\u043E\u0433\u043E \u043B\u0435\u0433\u0438\u043E\u043D\u0430", short: "\u041F\u0440\u0438\u0437\u0440\u0430\u0447\u043D\u044B\u0439 (\u043D\u043E\u0447\u043D\u043E\u0439) \u0440\u0430\u0437\u043B\u043E\u043C", schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
    { marathonId: [8338, 8894], id: 5885, title: "\u0421\u043E\u0432\u0435\u0442\u043D\u0438\u043A \u041A\u0438\u0440\u0438\u043E\u0441\u0430", short: "\u0410\u043D\u0442\u0430\u043B\u043B\u043E\u043D \u043D\u0430 \u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0445 \u043F\u043E\u043B\u044F\u0445", schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
    { marathonId: [8340, 8896], id: 8000060, title: "\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F \u043D\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u043E: \u0438\u0444\u0435\u0440\u0438\u0439\u0446\u044B (\u043D\u0438\u0437\u043A., \u043E\u0431\u044B\u0447\u043D.)", short: "\u0421\u0430\u0434\u044B \u043D\u0430\u0441\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0439 (\u0438\u0437\u0438 \u0438\u043B\u0438 \u043D\u043E\u0440\u043C\u0430\u043B)", slot: { item: ITEMS[8000751] } },
    { marathonId: [8346, 8902], id: 10056, title: "\u0421\u0430\u0434\u043E\u0432\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u044B**", short: "\u041A\u0432\u0435\u0441\u0442 \u043C\u043E\u0436\u043D\u043E \u0432\u0437\u044F\u0442\u044C \u0432 \u043B\u044E\u0431\u043E\u0435 \u0432\u0440\u0435\u043C\u044F, \u0431\u043E\u0441\u0441\u044B:", schedule: [{ timeStart: "03:00" }, { timeStart: "07:00" }, { timeStart: "11:00" }, { timeStart: "15:00" }, { timeStart: "19:00" }, { timeStart: "23:00" }] },
    { marathonId: [8348, 8904], id: 11154, title: "\u0411\u043E\u0439 \u0441 \u0442\u0435\u043D\u044C\u044E", short: "\u041B\u0438\u043B\u043E\u0432\u044B\u0439 (\u0430\u0440\u043C\u0438\u044F \u0444\u0430\u043D\u0442\u043E\u043C\u043E\u0432)", schedule: [{ timeStart: "01:50" }, { timeStart: "05:50" }, { timeStart: "09:50" }, { timeStart: "13:50" }, { timeStart: "17:50" }, { timeStart: "21:50" }] },
    { marathonId: [8350, 8906], id: 11227, title: "\u0411\u0438\u043B\u0435\u0442 \u0432 \u043E\u0434\u0438\u043D \u043A\u043E\u043D\u0435\u0446", short: '\u041F\u0440\u0435\u0432\u0440\u0430\u0442\u0438\u0442\u044C\u0441\u044F \u0432 <a href="https://archeagecodex.com/ru/buff/32459/" target="_blank" rel="noopener noreferrer" title="\u041F\u0435\u0440\u0435\u0432\u043E\u043F\u043B\u043E\u0449\u0435\u043D\u0438\u0435 \u0432 \u0434\u0430\u0440\u0443" class="tm-inline-icon"><img src="https://archeagecodex.com/items/icon_skill_buff691.png" alt=""></a>\u0434\u0430\u0440\u0443, \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C <a href="https://archeagecodex.com/ru/item/54615/" target="_blank" rel="noopener noreferrer" title="\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u0443: \u0431\u0438\u043B\u0435\u0442 \u0432 \u043E\u0434\u0438\u043D \u043A\u043E\u043D\u0435\u0446" class="tm-inline-icon tm-inline-icon--graded"><img src="https://archeagecodex.com/items/icon_item_0226.png" alt=""><img src="https://archeagecodex.com/images/icon_grade3.png" alt="" class="tm-inline-icon-grade"></a>, \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u0442\u044C 500 \u041E\u0420 (\u0438\u0434\u0442\u0438 \u0432 \u0434\u0430\u043D\u0436 \u043D\u0435 \u043D\u0430\u0434\u043E)' },
    { marathonId: [8352, 8908], id: 9147, title: "\u0421 \u043C\u0438\u0440\u0443 \u043F\u043E \u043D\u0438\u0442\u043A\u0435", short: "", veksel: "blue_salt", slot: { item: ITEMS[8256], count: 60 } },
    { marathonId: [8354, 8910], id: 8000136, title: "\u0412 \u0433\u0430\u0440\u043C\u043E\u043D\u0438\u0438 \u0441 \u0441\u043E\u0431\u043E\u0439", short: "\u041A\u0432\u0435\u0441\u0442 \u041D\u0443\u0438 \u043D\u0430 2500 \u0440\u0435\u043C\u0435\u0441\u043B\u0435\u043D\u043A\u0438" },
    { marathonId: [8356, 8912], id: 10506, title: "\u0420\u0435\u0437\u043D\u044B\u0435 \u0441\u0443\u043D\u0434\u0443\u0447\u043A\u0438 \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439 I", short: "", veksel: "north", locations: ["\u0417\u0430\u043C\u043E\u043A \u041E\u0448"], slot: { item: ITEMS[42076], count: 10 } },
    { marathonId: [8358, 8914], id: 10507, title: "\u0420\u0435\u0437\u043D\u044B\u0435 \u0441\u0443\u043D\u0434\u0443\u0447\u043A\u0438 \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439 II", short: "", veksel: "north", locations: ["\u0417\u0430\u043C\u043E\u043A \u041E\u0448"], slot: { item: ITEMS[42076], count: 30 } },
    { marathonId: [8360, 8916], id: 5091, title: "\u0412\u0437\u0440\u044B\u0432\u043E\u043E\u043F\u0430\u0441\u043D\u043E\u0435 \u043F\u043E\u0440\u0443\u0447\u0435\u043D\u0438\u0435", short: `<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/260-kvesty-ot-parfyumera-na-dz-v-arheidj#porychenie" target="_blank">\u041F\u0430\u0440\u0444\u044E\u043C\u0435\u0440 \u043D\u0430 \u0437\u0430\u043F\u0430\u0434\u0435</a>` },
    { marathonId: [8362, 8918], id: 9101, title: "\u041D\u0435\u043F\u0440\u0438\u0441\u0442\u0443\u043F\u043D\u0430\u044F \u0431\u0430\u0448\u043D\u044F", short: "\u0411\u0438\u0431\u043B\u0430, 3-\u0438\u0439 \u0431\u043E\u0441\u0441" },
    { marathonId: [8364, 8920], id: 7656, title: "\u0420\u0430\u0437\u044B\u0441\u043A\u0438\u0432\u0430\u0435\u0442\u0441\u044F: \u0410\u043A\u043C\u0438\u0442 (\u0433\u0435\u0440\u043E\u0438\u0447.)", short: "" },
    { marathonId: [8366, 8922], id: 9320, title: "\u0412\u043E\u0439\u043D\u0430 \u0432\u043E \u0438\u043C\u044F \u0441\u043B\u0430\u0432\u044B \u0441\u043E\u044E\u0437\u0430", short: "" },
    { marathonId: [8372, 8928], id: 9297, title: "\u041E\u0440\u0434\u044B \u0417\u0435\u043C\u0435\u043B\u044C \u043F\u043E\u043A\u043E\u044F", short: "", availableWeekdays: [6] },
    { marathonId: [8380, 8936], id: 7815, title: "\u0422\u0440\u0438 \u043D\u043E\u0432\u043E\u0441\u0442\u0438, \u0438 \u0432\u0441\u0435 \u043F\u043B\u043E\u0445\u0438\u0435", short: "\u0418\u0437\u0438/\u043D\u043E\u0440\u043C\u0430\u043B \u0421\u0430\u0434\u044B \u043D\u0430\u0441\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0439" },
    { marathonId: [8382, 8938], id: 10735, title: "\u041F\u0440\u0435\u0434\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C \u0434\u0435\u043C\u043E\u043D\u043E\u0432", short: "\u042D\u043D\u0448\u0430\u043A\u0430 \u043D\u0430 \u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0445 \u043F\u043E\u043B\u044F\u0445", schedule: [{ timeStart: "01:20" }, { timeStart: "05:20" }, { timeStart: "09:20" }, { timeStart: "13:20" }, { timeStart: "17:20" }, { timeStart: "21:20" }] },
    { marathonId: [8388, 8944], id: 9153, title: "\u0420\u0435\u043C\u0435\u0441\u043B\u0435\u043D\u043D\u0430\u044F \u043E\u0434\u0435\u0436\u0434\u0430", short: "", veksel: "blue_salt", slot: { item: ITEMS[16327], count: 100 } },
    { marathonId: [8390, 8946], id: 5062, title: "\u0411\u0435\u0439 \u043C\u0430\u043D\u0434\u0440\u0430\u0433\u043E\u0440\u0443!", short: "" },
    { marathonId: [8392, 8948], id: 10514, title: "\u042D\u0444\u0435\u043D\u0441\u043A\u0438\u0435 \u0441\u0443\u043D\u0434\u0443\u0447\u043A\u0438 \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439 I", short: "", veksel: "north", locations: ["\u0411\u0443\u0445\u0442\u0430 \u041A\u0438\u0442\u043E\u0431\u043E\u0435\u0432", "\u042D\u0444\u0435\u043D'\u0425\u0430\u043B"], slot: { item: ITEMS[43177], count: 7 } },
    { marathonId: [8394, 8950], id: 10515, title: "\u042D\u0444\u0435\u043D\u0441\u043A\u0438\u0435 \u0441\u0443\u043D\u0434\u0443\u0447\u043A\u0438 \u0441\u043E \u0432\u0441\u044F\u043A\u043E\u0439 \u0432\u0441\u044F\u0447\u0438\u043D\u043E\u0439 II", short: "", veksel: "north", locations: ["\u0411\u0443\u0445\u0442\u0430 \u041A\u0438\u0442\u043E\u0431\u043E\u0435\u0432", "\u042D\u0444\u0435\u043D'\u0425\u0430\u043B"], slot: { item: ITEMS[43177], count: 20 } },
    { marathonId: [8396, 8952], id: 7155, title: "\u041E\u0442\u043A\u0440\u043E\u0432\u0435\u043D\u0438\u0435 \u0411\u0435\u0437\u0434\u043D\u044B", short: "\u041D\u0430\u0433\u0430\u0448\u0430\u0440 \u043E\u0431\u044B\u0447\u043A\u0430" },
    { marathonId: [8398, 8954], id: 9398, title: "\u0421\u043E\u0441\u0442\u044F\u0437\u0430\u043D\u0438\u0435 \u0441\u043E\u044E\u0437\u043E\u0432", short: "100 \u043C\u043E\u0431\u043E\u0432 \u043D\u0430 \u041F\u0443\u0441\u0442\u043E\u0448\u0438 \u041A\u043E\u0440\u0432\u0443\u0441\u0430" },
    { marathonId: [8400, 8956], id: 7152, title: "\u041C\u0435\u043C\u043E\u0440\u0438\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043E\u0441\u043A\u0430 (\u0433\u0435\u0440.)", short: "" },
    { marathonId: [8402, 8958], id: 9102, title: "\u0421\u0442\u043E\u043A\u043D\u0438\u0436\u043D\u043E\u0435 \u0447\u0443\u0434\u0438\u0449\u0435", short: "\u0411\u0438\u0431\u043B\u0430, \u0433\u043E\u043B\u0435\u043C" },
    { marathonId: [8404], id: 9205, title: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0434\u0435\u043D\u044C \u0418\u0440\u0430\u043C\u043A\u0430\u043D\u0434\u0430", short: "", schedule: [{ timeStart: "0:40", timeEnd: "1:20" }, { timeStart: "12:00", timeEnd: "12:40" }, { timeStart: "17:00", timeEnd: "17:40" }, { timeStart: "20:00", timeEnd: "20:40" }] },
    { marathonId: [8414, 8972], id: 10952, title: "\u0411\u043E\u0439 \u0441 \xAB\u041B\u0435\u0442\u0443\u0447\u0438\u043C \u0445\u0430\u0440\u043D\u0438\u0439\u0446\u0435\u043C\xBB", short: "" },
    { marathonId: [8422, 8980], id: 10304, title: "\u0422\u0430\u0439\u043D\u044B \u0441\u0432\u044F\u0442\u0438\u043B\u0438\u0449\u0430", short: "" },
    { marathonId: [8424, 8982], id: 9099, title: "\u041E\u0431\u0438\u0442\u0435\u043B\u044C \u0430\u0440\u0445\u0438\u0432\u0430\u0440\u0438\u0443\u0441\u0430", short: "\u0411\u0438\u0431\u043B\u0430, \u043F\u0435\u0440\u0432\u044B\u0439 \u0431\u043E\u0441\u0441" },
    { marathonId: [8426, 8984], id: 9143, title: "\u0420\u0430\u0437 \u0442\u0440\u0430\u043A\u0442\u0438\u0440, \u0434\u0432\u0430 \u0442\u0440\u0430\u043A\u0442\u0438\u0440", short: "", veksel: "blue_salt", slot: { item: ITEMS[8337], count: 100 } },
    { marathonId: [8434, 8992], id: 10504, title: "\u041F\u043E\u043B\u043D\u043E\u0432\u0435\u0441\u043D\u044B\u0435 \u043C\u0435\u0448\u043E\u0447\u043A\u0438 \u0441 \u0441\u0435\u0440\u0435\u0431\u0440\u043E\u043C I", short: "", veksel: "north", locations: ["\u0417\u0430\u043C\u043E\u043A \u041E\u0448"], slot: { item: ITEMS[35461], count: 30 } },
    { marathonId: [8436, 8994], id: 10505, title: "\u041F\u043E\u043B\u043D\u043E\u0432\u0435\u0441\u043D\u044B\u0435 \u043C\u0435\u0448\u043E\u0447\u043A\u0438 \u0441 \u0441\u0435\u0440\u0435\u0431\u0440\u043E\u043C II", short: "", veksel: "north", locations: ["\u0417\u0430\u043C\u043E\u043A \u041E\u0448"], slot: { item: ITEMS[35461], count: 90 } },
    { marathonId: [8438, 8996], id: 8000062, title: "\u041B\u0438\u0446\u0435\u043D\u0437\u0438\u044F \u043D\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u043E: \u043F\u043E\u0432\u0435\u043B\u0438\u0442\u0435\u043B\u044C \u043F\u043E\u0434\u0437\u0435\u043C\u0435\u043B\u044C\u044F (\u0433\u0435\u0440\u043E\u0438\u0447.)", short: "\u0410\u043B\u044C-\u0425\u0430\u0440\u0431\u0430 / \u0424\u0435\u0440\u043C\u0430 / \u041A\u043E\u043B\u044B\u0431\u0435\u043B\u044C / \u0412\u043E\u044E\u0449\u0430\u044F \u0411\u0435\u0437\u0434\u043D\u0430 / \u041A\u043E\u043F\u0438 / \u0410\u0440\u0441\u0435\u043D\u0430\u043B", slot: { item: ITEMS[8000753] } },
    { marathonId: [8448, 9006], id: 2943, title: "\u042D\u043B\u0438\u0442\u043D\u044B\u0435 \u0432\u043E\u0439\u0441\u043A\u0430 \u041A\u0440\u043E\u0432\u0430\u0432\u043E\u0439 \u0430\u0440\u043C\u0438\u0438", short: "\u041A\u0440\u043E\u0432\u0430\u0432\u044B\u0439 (\u0434\u043D\u0435\u0432\u043D\u043E\u0439) \u0440\u0430\u0437\u043B\u043E\u043C - 3-\u044F \u0432\u043E\u043B\u043D\u0430", schedule: [{ timeStart: "00:20" }, { timeStart: "04:20" }, { timeStart: "08:20" }, { timeStart: "12:20" }, { timeStart: "16:20" }, { timeStart: "20:20" }] },
    { marathonId: [8450, 9008], id: 7935, title: "\u0425\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u044C \u0417\u0432\u0435\u043D\u044F\u0449\u0435\u0433\u043E \u0443\u0449\u0435\u043B\u044C\u044F**", short: "\u0413\u0430\u0440\u0434\u0443\u043C", schedule: [{ timeStart: "12:40", timeEnd: "13:20" }, { timeStart: "17:40", timeEnd: "18:20" }, { timeStart: "20:40", timeEnd: "21:20" }] },
    { marathonId: [8452, 9010], id: 7660, title: "\u0413\u0435\u0440\u043E\u0439 \u0441 \u043A\u0440\u0435\u043F\u043A\u0438\u043C \u0440\u0430\u0441\u0441\u0443\u0434\u043A\u043E\u043C (\u0433\u0435\u0440\u043E\u0438\u0447.)", short: "" },
    { marathonId: [8470, 9028], id: 10739, title: "\u041F\u0440\u0438\u0437\u0440\u0430\u0447\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C", short: "\u041F\u0440\u0438\u0437\u0440\u0430\u0447\u043D\u044B\u0439 (\u043D\u043E\u0447\u043D\u043E\u0439) \u0440\u0430\u0437\u043B\u043E\u043C - \u042D\u043D\u0448\u0430\u043A\u0430", schedule: [{ timeStart: "02:20" }, { timeStart: "06:20" }, { timeStart: "10:20" }, { timeStart: "14:20" }, { timeStart: "18:20" }, { timeStart: "22:20" }] },
    { marathonId: [8478, 9030], id: 10423, title: "\u0413\u043E\u043B\u0438\u0430\u0444, \u043C\u0435\u0445\u0430\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0441\u043A\u0430\u0440\u0430\u0431\u0435\u0439", short: "" },
    { marathonId: [8494, 9032], id: 8635, title: "\u0421\u0440\u043E\u0447\u043D\u0430\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0430", short: "" },
    { marathonId: [8496, 9034], id: 9295, title: "\u041E\u0440\u0434\u044B \u0421\u0430\u043B\u044C\u0444\u0438\u043C\u0430\u0440\u0430", short: "", availableWeekdays: [1, 4] },
    { marathonId: [8498, 9036], id: 9294, title: "\u041E\u0440\u0434\u044B \u041D\u0443\u0438\u043C\u0430\u0440\u0430", short: "", availableWeekdays: [0, 3] },
    { marathonId: [8500, 9050], id: 8637, title: "\u0421\u0442\u0430\u0440\u044B\u0439 \u0434\u0440\u0443\u0433 \u2013 \u043D\u043E\u0432\u044B\u0439 \u0432\u0440\u0430\u0433", short: "\u0411\u0443\u0445\u0442\u0430 - \u0416\u0430\u043A\u0430\u0440" },
    { marathonId: [8502, 9040], id: 7327, title: "\u0412\u0437\u0433\u043B\u044F\u0434 \u0441\u043B\u0435\u043F\u0446\u0430", short: "50 \u043C\u043E\u0431\u043E\u0432 (100 \u043E\u0447\u043A\u043E\u0432) \u043D\u0430 \u0421\u0432\u0435\u0440\u043A\u0430\u044E\u0449\u0435\u043C \u043F\u043E\u0431\u0435\u0440\u0435\u0436\u044C\u0435" },
    { marathonId: [8504, 9042], id: 9296, title: "\u041E\u0440\u0434\u044B \u0421\u0430\u043D\u0433\u0435\u043C\u0430\u0440\u0430", short: "", availableWeekdays: [2, 5] },
    { marathonId: [8506, 9044], id: 5969, title: "\u041A\u043E\u043B\u044C\u0446\u043E \u041B\u043E\u0440\u0435\u0438", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8508, 9062], id: 8641, title: "\u041D\u0430\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u043A\u0438\u0440'\u0444\u0435\u0440\u043E\u0432", short: "\u042D\u0444\u0435\u043D - \u0436\u0430\u0431\u0430 (\u0447\u0435\u0440\u0435\u0437 5 \u043C\u0438\u043D\u0443\u0442 \u043F\u043E\u0441\u043B\u0435 \u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u043E\u0439\u043D\u044B)" },
    { marathonId: [8510, 9048], id: 5077, title: "\u0410\u0440\u043E\u043C\u0430\u0442 \u0434\u043B\u044F \u0432\u0430\u0436\u043D\u043E\u0439 \u043E\u0441\u043E\u0431\u044B", short: `\u041F\u0430\u0440\u0444\u044E\u043C\u0435\u0440 (<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/260-kvesty-ot-parfyumera-na-dz-v-arheidj#aroma" target="_blank">\u0437\u0430\u043F\u0430\u0434</a>/<a href="https://archeageon.ru/kvesty/konsortsiuma-sinej-soli/261-kvesty-ot-parfyumera-na-dz-vostok-arheidj#aroma" target="_blank">\u0432\u043E\u0441\u0442\u043E\u043A</a>)` },
    { marathonId: [8512, 9038], id: 8605, title: "\u0411\u0438\u0442\u0432\u0430 \u0432 \u0411\u0443\u0445\u0442\u0435 \u043A\u0438\u0442\u043E\u0431\u043E\u0435\u0432", short: "" },
    { marathonId: [8514, 9052], id: 11096, title: "\u0422\u0443\u0440\u043D\u0438\u0440 \u0432 \u0447\u0435\u0441\u0442\u044C \u041E\u0442\u0446\u0430-\u0421\u043E\u043B\u043D\u0446\u0430", short: "\u041B\u0443\u0433 - \u0411\u0438\u0442\u0432\u0430 \u0445\u0440\u0430\u043D\u0438\u0442\u0435\u043B\u0435\u0439", schedule: [{ timeStart: "18:00", weekdays: [6, 0] }] },
    { marathonId: [8516, 9054], id: 8000129, title: "\u0412\u043E \u0441\u043B\u0430\u0432\u0443 \u041E\u0440\u0445\u0438\u0434\u043D\u044B", short: "" },
    { marathonId: [8518, 9056], id: 1415, title: "\u0421\u0438\u0440\u043E\u0442\u0430", short: "" },
    { marathonId: [8520, 9058], id: 5970, title: "\u041A\u043E\u043B\u044C\u0446\u043E \u043A\u0430\u043F\u0438\u0442\u0430\u043D\u0430 \u0413\u043B\u0435\u043D\u043D\u0430", short: "", schedule: [{ timeStart: "03:20" }, { timeStart: "07:20" }, { timeStart: "11:20" }, { timeStart: "15:20" }, { timeStart: "19:20" }, { timeStart: "23:20" }] },
    { marathonId: [8522, 9060], id: 10188, title: "\u041E\u0431\u0440\u0430\u0437\u0446\u044B \u0444\u043B\u043E\u0440\u044B \u0421\u0430\u0434\u0430", short: "", slot: { item: ITEMS[49252], count: 20 } },
    { marathonId: [8524, 9046], id: 8618, title: "\u0411\u0438\u0442\u0432\u0430 \u0437\u0430 \u042D\u0444\u0435\u043D'\u0425\u0430\u043B", short: "\u042D\u0444\u0435\u043D - \u043C\u043E\u0431\u044B" },
    { marathonId: [9064], id: 8000311, title: "\u041E\u0445\u043E\u0442\u0430 \u043D\u0430 \u043F\u0440\u0438\u0437\u0440\u0430\u043A\u043E\u0432", short: "\u041F\u0440\u0435\u0434\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u043E\u0441\u043A\u043E\u043B\u043A\u043E\u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430" }
  ];
  let normalizeQuestTitleForMatch = /* @__PURE__ */ __name((value) => {
    const roman = /* @__PURE__ */ __name((num) => {
      const map = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"];
      return map[num] || String(num);
    }, "roman");
    return String(value || "").toLowerCase().replace(/ё/g, "\u0435").replace(/(\D)(\d+)$/u, (_, prefix, num) => `${prefix} ${roman(Number(num))}`).replace(/\*+/g, "").replace(/героич/g, "\u0433\u0435\u0440").replace(/[«»"'`´’‘“”()[\]{}.,:;!?\-–—_/\\]+/g, " ").replace(/\s+/g, " ").trim();
  }, "normalizeQuestTitleForMatch");
  let getQuestTitleMatchWords = /* @__PURE__ */ __name((value) => normalizeQuestTitleForMatch(value).split(" ").filter((word) => word.length >= 3 || /^[ivx]+$/.test(word)), "getQuestTitleMatchWords");
  let scoreQuestTitleMatch = /* @__PURE__ */ __name((apiTitle, localTitle) => {
    const apiNorm = normalizeQuestTitleForMatch(apiTitle);
    const localNorm = normalizeQuestTitleForMatch(localTitle);
    if (!apiNorm || !localNorm) return 0;
    if (apiNorm === localNorm) return 1e3;
    if (apiNorm.includes(localNorm) || localNorm.includes(apiNorm)) {
      return Math.min(apiNorm.length, localNorm.length);
    }
    const apiWords = new Set(getQuestTitleMatchWords(apiTitle));
    const commonWords = getQuestTitleMatchWords(localTitle).filter((word) => apiWords.has(word));
    return commonWords.join("").length + commonWords.length * 2;
  }, "scoreQuestTitleMatch");
  let findQuestMetaForMarathonQuest = /* @__PURE__ */ __name((marathonQuest) => {
    const marathonQuestId = Number(marathonQuest?.id || 0);
    if (marathonQuestId) {
      const byId = QUESTS.find((q) => q.marathonId.includes(marathonQuestId));
      if (byId) return byId;
    }
    let bestQuest = null;
    let bestScore = 0;
    for (const quest of QUESTS) {
      const score = scoreQuestTitleMatch(marathonQuest?.title, quest.title);
      if (score > bestScore) {
        bestQuest = quest;
        bestScore = score;
      }
    }
    return bestScore >= 12 ? bestQuest : null;
  }, "findQuestMetaForMarathonQuest");

  // src/marathon/core.js
  let DONE_CLASS = "tm-task-completed";
  let JUST_DONE_CLASS = "tm-task-just-completed";
  let THU_PRE_HOUR = 3;
  let DEFAULT_HOUR = 16;
  let API_INFO_PATH = "/minigames/marathon_of_heroes/api/info";
  let LS_KEYS3 = {
    HIDE_DONE: "tm_aa_hide_done",
    AUTO_CLAIM: "tm_aa_auto_claim",
    QUEST_HISTORY: "tm_aa_qh",
    AUTO_OPEN_BOXES: "tm_aa_auto_open_boxes",
    IR_PER_PAGE: "tm_aa_ir_per_page",
    EVENT_VISIBILITY: "tm_aa_ev_vis",
    VEKSEL_SERVER_ID: "tm_aa_veksel_server_id",
    ICON_SEX: "tm_aa_icon_sex",
    NOTIFICATIONS: "tm_aa_notifications",
    DYNAMIC_TOOLTIPS: "tm_aa_dynamic_tooltips"
  };
  let HISTORY_MAX_ENTRIES = 500;
  let HISTORY_PER_PAGE = 10;
  let DEBUG_PREFIX = "[ArcheAgeExtraUI]";
  let DEBUG_ENABLED = true;
  let debugLog = /* @__PURE__ */ __name((...args) => {
    if (DEBUG_ENABLED) console.log(DEBUG_PREFIX, ...args);
  }, "debugLog");
  let debugWarn = /* @__PURE__ */ __name((...args) => {
    console.warn(DEBUG_PREFIX, ...args);
  }, "debugWarn");
  let DAY_RESET_HOUR = 0;
  let selectedDayUtcMs = null;
  let selectedSegment = "auto";
  let API_INFO_CACHE = null;
  let API_INFO_PROMISE = null;
  let AUTO_REFRESH_INTERVAL_FOCUSED_MS = 3e4;
  let AUTO_REFRESH_INTERVAL_HIDDEN_MS = 18e5;
  let autoRefreshIntervalId = null;
  let isRefreshing = false;
  let previouslyDoneQuestIds = /* @__PURE__ */ new Set();
  let MIN_DAY_UTC_MS = null;
  let MAX_DAY_UTC_MS = null;
  let MIN_SEG = null;
  let MAX_SEG = null;
  let DOM = {
    nav: null,
    label: null,
    prevBtn: null,
    nextBtn: null,
    todayBtn: null,
    hideDoneCheckbox: null,
    refreshLoader: null,
    tasksHeader: null,
    tasksList: null
  };
  let normalizeUrlToPath = /* @__PURE__ */ __name((url) => {
    try {
      return new URL(url, location.href).pathname;
    } catch {
      return String(url || "");
    }
  }, "normalizeUrlToPath");
  let installApiInfoInterceptor = /* @__PURE__ */ __name(() => {
    if (pageWindow.__tmAA_fetchPatched) return;
    pageWindow.__tmAA_fetchPatched = true;
    const origFetch = pageWindow.fetch.bind(pageWindow);
    pageWindow.fetch = async (...args) => {
      const input = args[0];
      const urlStr = typeof input === "string" ? input : input && typeof input === "object" && "url" in input ? input.url : String(input);
      const path = normalizeUrlToPath(urlStr);
      const t0 = Date.now();
      const res = await origFetch(...args);
      const t1 = Date.now();
      if (path === API_INFO_PATH) {
        if (NOW_MS == null) {
          const dateHeader = res.headers.get("Date");
          const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
          if (Number.isFinite(parsed)) {
            const halfRtt = (t1 - t0) / 2;
            setNowMs(parsed + halfRtt);
          }
        }
        if (API_INFO_PROMISE == null) {
          API_INFO_PROMISE = res.clone().json();
          API_INFO_PROMISE.then((json) => {
            API_INFO_CACHE = json;
          }).catch(() => {
          });
        }
      }
      return res;
    };
  }, "installApiInfoInterceptor");
  let toRoman = /* @__PURE__ */ __name((num) => {
    const numerals = [
      ["M", 1e3],
      ["CM", 900],
      ["D", 500],
      ["CD", 400],
      ["C", 100],
      ["XC", 90],
      ["L", 50],
      ["XL", 40],
      ["X", 10],
      ["IX", 9],
      ["V", 5],
      ["IV", 4],
      ["I", 1]
    ];
    let result = "";
    for (const [roman, value] of numerals) {
      while (num >= value) {
        result += roman;
        num -= value;
      }
    }
    return result;
  }, "toRoman");
  let formatQuestTitle = /* @__PURE__ */ __name((title) => {
    if (!title) return "";
    let result = title.replace(/\*+$/, "");
    const match = result.match(/(\s*)(\d+)$/);
    if (match) {
      const num = parseInt(match[2], 10);
      if (num > 0 && num < 100) {
        const roman = toRoman(num);
        result = result.slice(0, -match[0].length) + " " + roman;
      }
    }
    return result.trim();
  }, "formatQuestTitle");
  let getHideDoneDayKey = /* @__PURE__ */ __name(() => {
    const ms = nowMs();
    const shiftedMs = ms - DAY_RESET_HOUR * 3600 * 1e3;
    const { y, m, d } = getMSKDatePartsFromUtcMs(shiftedMs);
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }, "getHideDoneDayKey");
  let loadHideDoneState = /* @__PURE__ */ __name(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS3.HIDE_DONE);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.dayKey !== getHideDoneDayKey()) return false;
      return !!data.checked;
    } catch {
      return false;
    }
  }, "loadHideDoneState");
  let saveHideDoneState = /* @__PURE__ */ __name((checked) => {
    try {
      localStorage.setItem(LS_KEYS3.HIDE_DONE, JSON.stringify({
        checked,
        dayKey: getHideDoneDayKey()
      }));
    } catch {
    }
  }, "saveHideDoneState");
  let loadAllQuestHistory = /* @__PURE__ */ __name(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS3.QUEST_HISTORY)) || {};
    } catch {
      return {};
    }
  }, "loadAllQuestHistory");
  let cachedUid = null;
  let historyCurrentPage = 1;
  let historyEntries = [];
  let mergeQuestHistory = /* @__PURE__ */ __name((quests) => {
    if (!cachedUid) return [];
    const all = loadAllQuestHistory();
    const history = all[cachedUid] || [];
    const existing = new Set(history.map((e) => `${e.code}:${e.completedAt}`));
    for (const q of quests) {
      const t = Number(q.last_complete_time || 0);
      if (!t) continue;
      const key = `${q.code}:${t}`;
      if (existing.has(key)) continue;
      history.push({ code: q.code, completedAt: t });
      existing.add(key);
    }
    history.sort((a, b) => b.completedAt - a.completedAt);
    if (history.length > HISTORY_MAX_ENTRIES) history.length = HISTORY_MAX_ENTRIES;
    try {
      all[cachedUid] = history;
      localStorage.setItem(LS_KEYS3.QUEST_HISTORY, JSON.stringify(all));
    } catch {
    }
    return history;
  }, "mergeQuestHistory");
  let formatDateTimeMSK = /* @__PURE__ */ __name((unixSec) => {
    if (!unixSec) return "";
    const ms = unixSec * 1e3;
    const { y, m, d } = getMSKDatePartsFromUtcMs(ms);
    const time = formatTimeMSK(unixSec);
    return `${pad2(d)}.${pad2(m)}.${y} ${time}`;
  }, "formatDateTimeMSK");
  let renderHistoryTable = /* @__PURE__ */ __name(() => {
    const section = document.querySelector("section.history-events");
    if (!section) return;
    const layout = section.querySelector(".layout");
    if (!layout) return;
    const oldWrap = layout.querySelector(".table__wrap");
    if (oldWrap) oldWrap.remove();
    if (!historyEntries.length) return;
    const totalPages = Math.ceil(historyEntries.length / HISTORY_PER_PAGE);
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    const start = (historyCurrentPage - 1) * HISTORY_PER_PAGE;
    const pageItems = historyEntries.slice(start, start + HISTORY_PER_PAGE);
    const questsMap = API_INFO_CACHE?.data?.quests || {};
    const table = document.createElement("table");
    table.className = "table table--history_events";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>\u0414\u0430\u0442\u0430</th><th>\u0417\u0430\u0434\u0430\u043D\u0438\u0435</th><th>\u041E\u043F\u044B\u0442</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const entry of pageItems) {
      const tr = document.createElement("tr");
      const tdDate = document.createElement("td");
      tdDate.textContent = formatDateTimeMSK(entry.completedAt);
      tr.appendChild(tdDate);
      const tdTitle = document.createElement("td");
      tdTitle.textContent = questsMap[entry.code]?.description || entry.code;
      tr.appendChild(tdTitle);
      const tdReward = document.createElement("td");
      const quest = questsMap[entry.code];
      if (quest) {
        const span = document.createElement("span");
        span.className = "table__status";
        const dots = Math.max(1, getRewardAmount(quest));
        for (let i = 0; i < dots; i++) {
          const dot = document.createElement("div");
          dot.className = "icon-point icon-point--received";
          span.appendChild(dot);
        }
        tdReward.appendChild(span);
      }
      tr.appendChild(tdReward);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const wrap = document.createElement("div");
    wrap.className = "table__wrap";
    wrap.appendChild(table);
    if (totalPages > 1) {
      const ul = document.createElement("ul");
      ul.className = "pagination";
      const makePageItem = /* @__PURE__ */ __name((page, text, className, disabled, onClick) => {
        const li = document.createElement("li");
        li.className = "pagination__item" + (className ? " " + className : "") + (disabled ? " disabled" : "");
        li.textContent = text;
        li.addEventListener("click", () => {
          if (!disabled) onClick(page);
        });
        return li;
      }, "makePageItem");
      const makeEllipsisItem = /* @__PURE__ */ __name(() => {
        const li = document.createElement("li");
        li.className = "pagination__item pagination__item--ellipsis disabled";
        li.textContent = "...";
        return li;
      }, "makeEllipsisItem");
      const maxVisiblePages = 9;
      let firstPage = Math.max(1, historyCurrentPage - 4);
      let lastPage = Math.min(totalPages, historyCurrentPage + 4);
      if (lastPage - firstPage + 1 < maxVisiblePages) {
        if (firstPage === 1) lastPage = Math.min(totalPages, firstPage + maxVisiblePages - 1);
        else if (lastPage === totalPages) firstPage = Math.max(1, lastPage - maxVisiblePages + 1);
      }
      const firstLi = makePageItem(1, "\xAB", "pagination__item--first", historyCurrentPage <= 1, () => {
        historyCurrentPage = 1;
        renderHistoryTable();
      });
      firstLi.title = "\u041F\u0435\u0440\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430";
      ul.appendChild(firstLi);
      const prevLi = document.createElement("li");
      prevLi.className = "pagination__item pagination__item--prev" + (historyCurrentPage <= 1 ? " disabled" : "");
      prevLi.title = "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430";
      prevLi.innerHTML = '<i class="icons-arrow"></i>';
      prevLi.addEventListener("click", () => {
        if (historyCurrentPage > 1) {
          historyCurrentPage--;
          renderHistoryTable();
        }
      });
      ul.appendChild(prevLi);
      if (firstPage > 1) ul.appendChild(makeEllipsisItem());
      for (let p = firstPage; p <= lastPage; p++) {
        const li = document.createElement("li");
        li.className = "pagination__item" + (p === historyCurrentPage ? " active" : "");
        li.textContent = String(p);
        li.addEventListener("click", () => {
          historyCurrentPage = p;
          renderHistoryTable();
        });
        ul.appendChild(li);
      }
      if (lastPage < totalPages) ul.appendChild(makeEllipsisItem());
      const nextLi = document.createElement("li");
      nextLi.className = "pagination__item pagination__item--next" + (historyCurrentPage >= totalPages ? " disabled" : "");
      nextLi.title = "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430";
      nextLi.innerHTML = '<i class="icons-arrow"></i>';
      nextLi.addEventListener("click", () => {
        if (historyCurrentPage < totalPages) {
          historyCurrentPage++;
          renderHistoryTable();
        }
      });
      ul.appendChild(nextLi);
      const lastLi = makePageItem(totalPages, "\xBB", "pagination__item--last", historyCurrentPage >= totalPages, () => {
        historyCurrentPage = totalPages;
        renderHistoryTable();
      });
      lastLi.title = "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430";
      ul.appendChild(lastLi);
      wrap.appendChild(ul);
    }
    layout.appendChild(wrap);
  }, "renderHistoryTable");
  let updateQuestHistory = /* @__PURE__ */ __name(() => {
    if (!API_INFO_CACHE) return;
    try {
      const quests = getQuestsArrayFromInfo(API_INFO_CACHE);
      historyEntries = mergeQuestHistory(quests);
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] updateQuestHistory failed:", e);
    }
    renderHistoryTable();
  }, "updateQuestHistory");
  let slotKey = /* @__PURE__ */ __name((dayUtcMs, segment) => {
    const seg = segment === "pre" ? 0 : segment === "post" ? 2 : 1;
    return dayUtcMs * 10 + seg;
  }, "slotKey");
  let normalizeSegmentForDay = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    if (!isThursdayByTZ(dayUtcMs)) return null;
    if (seg === "pre" || seg === "post" || seg === "auto") return seg;
    return "post";
  }, "normalizeSegmentForDay");
  let effectiveSegment = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    if (!isThursdayByTZ(dayUtcMs)) return null;
    if (seg === "pre" || seg === "post") return seg;
    const todayUtc = getTodayUtcMsByTZ();
    const isToday = isSameDayByTZ(dayUtcMs, todayUtc);
    if (!isToday) return "post";
    const { start } = getDayBoundsUnix(dayUtcMs);
    const cut = start + 9 * 3600;
    return getNowUnix() < cut ? "pre" : "post";
  }, "effectiveSegment");
  let getSlotBoundsUnix = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    const { start, end } = getDayBoundsUnix(dayUtcMs);
    if (!isThursdayByTZ(dayUtcMs)) return { start, end };
    const cut = start + 9 * 3600;
    const s = effectiveSegment(dayUtcMs, seg);
    if (s === "pre") return { start, end: cut };
    return { start: cut, end };
  }, "getSlotBoundsUnix");
  let getPrevSlot = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    const isThu = isThursdayByTZ(dayUtcMs);
    if (isThu) {
      if (seg === "post") return { dayUtcMs, segment: "pre" };
      if (seg === "pre") {
        const prevDay2 = addDaysUtcMs(dayUtcMs, -1);
        return { dayUtcMs: prevDay2, segment: normalizeSegmentForDay(prevDay2, null) };
      }
      return { dayUtcMs, segment: "pre" };
    }
    const prevDay = addDaysUtcMs(dayUtcMs, -1);
    if (isThursdayByTZ(prevDay)) return { dayUtcMs: prevDay, segment: "post" };
    return { dayUtcMs: prevDay, segment: null };
  }, "getPrevSlot");
  let getNextSlot = /* @__PURE__ */ __name((dayUtcMs, seg) => {
    const isThu = isThursdayByTZ(dayUtcMs);
    if (isThu) {
      if (seg === "pre") return { dayUtcMs, segment: "post" };
      if (seg === "post") {
        const nextDay2 = addDaysUtcMs(dayUtcMs, 1);
        return { dayUtcMs: nextDay2, segment: normalizeSegmentForDay(nextDay2, null) };
      }
      return { dayUtcMs, segment: "post" };
    }
    const nextDay = addDaysUtcMs(dayUtcMs, 1);
    if (isThursdayByTZ(nextDay)) return { dayUtcMs: nextDay, segment: "pre" };
    return { dayUtcMs: nextDay, segment: null };
  }, "getNextSlot");
  let clampSelectedDay = /* @__PURE__ */ __name((dayUtcMs, segment) => {
    if (dayUtcMs == null) return { dayUtcMs, segment };
    segment = normalizeSegmentForDay(dayUtcMs, segment);
    const curKey = slotKey(dayUtcMs, segment);
    const minKey = MIN_DAY_UTC_MS != null ? slotKey(MIN_DAY_UTC_MS, MIN_SEG) : null;
    const maxKey = MAX_DAY_UTC_MS != null ? slotKey(MAX_DAY_UTC_MS, MAX_SEG) : null;
    if (minKey != null && curKey < minKey) return { dayUtcMs: MIN_DAY_UTC_MS, segment: MIN_SEG };
    if (maxKey != null && curKey > maxKey) return { dayUtcMs: MAX_DAY_UTC_MS, segment: MAX_SEG };
    segment = normalizeSegmentForDay(dayUtcMs, segment);
    return { dayUtcMs, segment };
  }, "clampSelectedDay");
  let applySlot = /* @__PURE__ */ __name((dayUtcMs, segment) => {
    segment = effectiveSegment(dayUtcMs, segment) ?? segment;
    const c = clampSelectedDay(dayUtcMs, segment);
    selectedDayUtcMs = c.dayUtcMs;
    selectedSegment = c.segment;
  }, "applySlot");
  let isQuestActiveAtUnix = /* @__PURE__ */ __name((q, unix) => {
    const qs = Number(q?.start_time || 0);
    const qe = Number(q?.end_time || 0);
    if (!qs || !qe) return false;
    return qs <= unix && unix < qe;
  }, "isQuestActiveAtUnix");
  let getCompletionTimeInSlot = /* @__PURE__ */ __name((code, dayUtcMs, seg) => {
    const b = getSlotBoundsUnix(dayUtcMs, seg);
    const entry = historyEntries.find((e) => e.code === code && b.start <= e.completedAt && e.completedAt < b.end);
    return entry ? entry.completedAt : 0;
  }, "getCompletionTimeInSlot");
  let getRewardAmount = /* @__PURE__ */ __name((q) => {
    const steps = q?.steps;
    const step1 = steps?.["1"] || steps?.[1];
    const amount = step1?.rewards?.[0]?.value?.amount;
    return Number(amount || 0);
  }, "getRewardAmount");
  let getQuestsArrayFromInfo = /* @__PURE__ */ __name((json) => {
    const quests = json?.data?.quests;
    if (!quests || typeof quests !== "object") throw new Error("api/info: quests not found");
    return Object.values(quests);
  }, "getQuestsArrayFromInfo");
  let debugTime = /* @__PURE__ */ __name((unix) => {
    if (!unix) return null;
    return new Date(unix * 1e3).toISOString();
  }, "debugTime");
  let summarizeQuestForDebug = /* @__PURE__ */ __name((q) => ({
    id: q?.id,
    code: q?.code,
    title: q?.title,
    group: q?.group,
    type: q?.type,
    time_status: q?.time_status,
    start_time: q?.start_time,
    start_iso: debugTime(Number(q?.start_time || 0)),
    end_time: q?.end_time,
    end_iso: debugTime(Number(q?.end_time || 0)),
    progress: q?.progress,
    max_completed_step: q?.max_completed_step,
    reward: getRewardAmount(q),
    known_meta: !!findQuestMetaForMarathonQuest(q)
  }), "summarizeQuestForDebug");
  let renderEmptyTasksDiagnostic = /* @__PURE__ */ __name((listEl, message) => {
    const empty = document.createElement("div");
    empty.className = "tasks__item tm-tasks-empty";
    empty.textContent = message;
    listEl.appendChild(empty);
  }, "renderEmptyTasksDiagnostic");
  let vekselUrlResolved = VEKSEL_BASE;
  let vekselAutoDetectedServerId = "";
  let loadVekselServerIdOverride = /* @__PURE__ */ __name(() => {
    try {
      const id = localStorage.getItem(LS_KEYS3.VEKSEL_SERVER_ID);
      return id && SERVERS[id] ? id : "";
    } catch {
      return "";
    }
  }, "loadVekselServerIdOverride");
  let saveVekselServerIdOverride = /* @__PURE__ */ __name((serverId) => {
    try {
      if (serverId && SERVERS[serverId]) localStorage.setItem(LS_KEYS3.VEKSEL_SERVER_ID, serverId);
      else localStorage.removeItem(LS_KEYS3.VEKSEL_SERVER_ID);
    } catch {
    }
  }, "saveVekselServerIdOverride");
  let getVekselAutoOptionText = /* @__PURE__ */ __name(() => {
    const serverName = SERVERS[vekselAutoDetectedServerId];
    return `\u0410\u0432\u0442\u043E\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435${serverName ? ` (${serverName})` : ""}`;
  }, "getVekselAutoOptionText");
  let updateVekselServerAutoOptionText = /* @__PURE__ */ __name(() => {
    document.querySelectorAll('[data-veksel-server-auto-option="1"]').forEach((option) => {
      option.textContent = getVekselAutoOptionText();
    });
  }, "updateVekselServerAutoOptionText");
  let updateRenderedVekselLinks = /* @__PURE__ */ __name(() => {
    document.querySelectorAll(".tm-veksel-link").forEach((link) => {
      const veksel = link.dataset.veksel;
      let slot = null;
      let locations = null;
      try {
        slot = link.dataset.slot ? JSON.parse(link.dataset.slot) : null;
      } catch {
      }
      try {
        locations = link.dataset.locations ? JSON.parse(link.dataset.locations) : null;
      } catch {
      }
      link.href = buildVekselUrl(veksel, slot, locations);
    });
  }, "updateRenderedVekselLinks");
  let buildVekselUrl = /* @__PURE__ */ __name((veksel, slot, locations) => {
    const isBlueSalt = veksel === "blue_salt";
    const isNorth = veksel === "north";
    if (!isBlueSalt && !isNorth) return vekselUrlResolved;
    let params = null;
    const item = slot?.item;
    if (slot?.count && (item?.vekselName || item?.name)) {
      if (isBlueSalt) params = `res=${encodeURIComponent(item.vekselName || item.name)}&amount=${slot.count}`;
      else if (isNorth) {
        const iconType = item.vekselType || "sack";
        if (locations && locations.length > 0) params = `loc=${encodeURIComponent(locations.join(","))}&amount=${slot.count}&icon=${iconType}`;
        else params = `amount=${slot.count}&icon=${iconType}`;
      }
    }
    if (!params) return vekselUrlResolved;
    const separator = vekselUrlResolved.includes("?") ? "&" : "?";
    return `${vekselUrlResolved}${separator}${params}`;
  }, "buildVekselUrl");
  let getGisaaVekselKeyForQuest = /* @__PURE__ */ __name((veksel, slot, locations) => {
    const item = slot?.item;
    const amount = Number(slot?.count || 0);
    if (!amount || !item) return null;
    if (veksel === "blue_salt" && (item.vekselName || item.name)) {
      return makeGisaaVekselKey({ type: "blue_salt", resourceName: item.vekselName || item.name, amount });
    }
    if (veksel === "north") {
      return makeGisaaVekselKey({ type: "north", amount, iconType: item.vekselType || "sack", locations });
    }
    return null;
  }, "getGisaaVekselKeyForQuest");
  let makeGisaaInfoFromRows = /* @__PURE__ */ __name((rows) => {
    const unique = /* @__PURE__ */ __name((values) => [...new Set((values || []).filter(Boolean))], "unique");
    const matches = unique(rows.filter((row) => row.status === "match").map((row) => row.location));
    const unknown = unique(rows.filter((row) => row.status === "unknown").map((row) => row.location));
    const excludes = unique(rows.filter((row) => row.status === "exclude").map((row) => row.location));
    if (matches.length) return { status: "available", locations: matches, unknownLocations: unknown, excludedLocations: excludes };
    if (!unknown.length && excludes.length) return { status: "unavailable", locations: [], unknownLocations: unknown, excludedLocations: excludes };
    return null;
  }, "makeGisaaInfoFromRows");
  let getGisaaVekselInfoFromSavedTable = /* @__PURE__ */ __name((veksel, slot, locations) => {
    const snapshot = getSavedGisaaTablesSnapshot();
    if (!snapshot) return null;
    const item = slot?.item;
    const amount = Number(slot?.count || 0);
    if (!item || !amount) return null;
    if (veksel === "blue_salt") {
      const resourceName = item.vekselName || item.name;
      const rows = snapshot.resources?.[resourceName];
      if (!rows?.length) return null;
      return makeGisaaInfoFromRows(rows.map((row) => ({
        location: row.location,
        status: row.unknown ? "unknown" : row.amount === amount ? "match" : "exclude"
      })));
    }
    if (veksel === "north") {
      const iconType = item.vekselType || "sack";
      const wantedLocations = locations || [];
      const rows = (snapshot.north || []).filter((row) => wantedLocations.some(
        (loc) => row.location.toLowerCase().includes(loc.toLowerCase()) || loc.toLowerCase().includes(row.location.toLowerCase())
      ));
      if (!rows.length) return null;
      return makeGisaaInfoFromRows(rows.map((row) => ({
        location: row.location,
        status: row.unknown ? "unknown" : row.amount === amount && row.iconType === iconType ? "match" : "exclude"
      })));
    }
    return null;
  }, "getGisaaVekselInfoFromSavedTable");
  let getGisaaVekselInfoForQuest = /* @__PURE__ */ __name((veksel, slot, locations) => getGisaaVekselInfoFromSavedTable(veksel, slot, locations) || getSavedGisaaVekselInfo(getGisaaVekselKeyForQuest(veksel, slot, locations)), "getGisaaVekselInfoForQuest");
  let fetchJson = /* @__PURE__ */ __name(async (url) => {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const json = await res.json();
    const quests = json?.data?.quests;
    debugLog("api/info loaded", {
      state: json?.state,
      hasData: !!json?.data,
      questContainerType: quests == null ? String(quests) : Array.isArray(quests) ? "array" : typeof quests,
      questCount: quests && typeof quests === "object" ? Object.keys(quests).length : 0,
      weekNumber: json?.data?.week_number,
      nextWeekAt: json?.data?.next_week_at,
      serverNowIso: NOW_MS ? new Date(NOW_MS).toISOString() : null,
      sampleQuests: quests && typeof quests === "object" ? Object.values(quests).slice(0, 5).map(summarizeQuestForDebug) : []
    });
    return json;
  }, "fetchJson");
  let fetchText = /* @__PURE__ */ __name(async (url) => {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }, "fetchText");
  let fetchApiInfo = /* @__PURE__ */ __name(async () => {
    const t0 = Date.now();
    const res = await fetch(API_INFO_PATH, { credentials: "include", cache: "no-store" });
    const t1 = Date.now();
    if (!res.ok) throw new Error(`api/info failed: ${res.status}`);
    const dateHeader = res.headers.get("Date");
    const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
    if (Number.isFinite(parsed)) {
      const halfRtt = (t1 - t0) / 2;
      setNowMs(parsed + halfRtt);
    } else if (NOW_MS == null) {
      throw new Error("[ArcheAgeExtraUI] Cannot read server Date header");
    }
    return res.json();
  }, "fetchApiInfo");
  let getApiInfoCached = /* @__PURE__ */ __name(async () => {
    if (API_INFO_CACHE) return API_INFO_CACHE;
    if (API_INFO_PROMISE) {
      try {
        API_INFO_CACHE = await API_INFO_PROMISE;
        return API_INFO_CACHE;
      } catch {
      }
    }
    API_INFO_CACHE = await fetchApiInfo();
    return API_INFO_CACHE;
  }, "getApiInfoCached");
  let getUidFromCheckUser = /* @__PURE__ */ __name(async () => {
    const json = await fetchJson("/dynamic/auth/?a=checkuser");
    const uid = json?.user?.uid;
    if (!uid) throw new Error("uid not found");
    return String(uid);
  }, "getUidFromCheckUser");
  let showRefreshLoader = /* @__PURE__ */ __name(() => {
    if (DOM.refreshLoader) DOM.refreshLoader.classList.add("tm-refresh-loader--active");
  }, "showRefreshLoader");
  let hideRefreshLoader = /* @__PURE__ */ __name(() => {
    if (DOM.refreshLoader) DOM.refreshLoader.classList.remove("tm-refresh-loader--active");
  }, "hideRefreshLoader");
  let API_INFO_DATA_JSON = null;
  let refreshApiInfo = /* @__PURE__ */ __name(async ({ loadAutoClaimState: loadAutoClaimState2 = /* @__PURE__ */ __name(() => false, "loadAutoClaimState"), claimAllLevelRewards: claimAllLevelRewards2 = /* @__PURE__ */ __name(async () => {
  }, "claimAllLevelRewards") } = {}) => {
    if (isRefreshing) return;
    isRefreshing = true;
    showRefreshLoader();
    try {
      const prevDataJson = API_INFO_DATA_JSON;
      API_INFO_CACHE = null;
      API_INFO_PROMISE = null;
      API_INFO_CACHE = await fetchApiInfo();
      if (NOW_MS !== null) {
        setServerTimeOffset(NOW_MS - Date.now());
      }
      const oldSelectedKey = slotKey(selectedDayUtcMs, selectedSegment);
      const newTodayUtc = getTodayUtcMsByTZ();
      const newTodaySegment = effectiveSegment(newTodayUtc, "auto");
      const newTodayKey = slotKey(newTodayUtc, newTodaySegment);
      const dayChanged = oldSelectedKey !== newTodayKey && oldSelectedKey < newTodayKey;
      if (dayChanged) applySlot(newTodayUtc, "auto");
      const newDataJson = JSON.stringify(API_INFO_CACHE?.data);
      API_INFO_DATA_JSON = newDataJson;
      if (newDataJson === prevDataJson && !dayChanged) return;
      updateQuestHistory();
      if (dayChanged) await onSelectedDateChanged();
      else await renderTasksForSelectedDay({ animateNewlyDone: true });
      if (loadAutoClaimState2()) await claimAllLevelRewards2();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] refreshApiInfo failed:", e);
    } finally {
      isRefreshing = false;
      hideRefreshLoader();
    }
  }, "refreshApiInfo");
  let stopAutoRefresh = /* @__PURE__ */ __name(() => {
    if (autoRefreshIntervalId != null) {
      clearInterval(autoRefreshIntervalId);
      autoRefreshIntervalId = null;
    }
  }, "stopAutoRefresh");
  let startAutoRefresh = /* @__PURE__ */ __name((intervalMs) => {
    stopAutoRefresh();
    autoRefreshIntervalId = setInterval(refreshApiInfo, intervalMs);
  }, "startAutoRefresh");
  let restartAutoRefresh = /* @__PURE__ */ __name(() => {
    const interval = document.hidden ? AUTO_REFRESH_INTERVAL_HIDDEN_MS : AUTO_REFRESH_INTERVAL_FOCUSED_MS;
    startAutoRefresh(interval);
  }, "restartAutoRefresh");
  let handleVisibilityChange = /* @__PURE__ */ __name(() => {
    if (document.hidden) startAutoRefresh(AUTO_REFRESH_INTERVAL_HIDDEN_MS);
    else {
      refreshApiInfo();
      startAutoRefresh(AUTO_REFRESH_INTERVAL_FOCUSED_MS);
    }
  }, "handleVisibilityChange");
  let parseServersFromCharListHtml = /* @__PURE__ */ __name((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("li")].map((li) => {
      const spans = li.querySelectorAll("span");
      const last = spans?.[spans.length - 1];
      return last ? last.textContent.trim() : null;
    }).filter(Boolean);
  }, "parseServersFromCharListHtml");
  let pickMainServer = /* @__PURE__ */ __name((servers) => {
    if (!servers.length) return null;
    const counts = /* @__PURE__ */ new Map();
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
  }, "pickMainServer");
  let resolveVekselUrl = /* @__PURE__ */ __name(async () => {
    try {
      const serverIdOverride = loadVekselServerIdOverride();
      if (serverIdOverride) {
        vekselUrlResolved = `${VEKSEL_BASE}${serverIdOverride}`;
        updateRenderedVekselLinks();
        updateVekselServerAutoOptionText();
        return;
      }
      const uid = await getUidFromCheckUser();
      const html = await fetchText(`/dynamic/user/?a=char_list&u=${encodeURIComponent(uid)}`);
      const servers = parseServersFromCharListHtml(html);
      const mainServer = pickMainServer(servers);
      if (!mainServer) {
        vekselAutoDetectedServerId = "";
        vekselUrlResolved = VEKSEL_BASE;
        updateVekselServerAutoOptionText();
        return;
      }
      const vekselId = Object.keys(SERVERS).find((id) => SERVERS[id] === mainServer);
      vekselAutoDetectedServerId = vekselId || "";
      vekselUrlResolved = vekselId ? `${VEKSEL_BASE}${vekselId}` : VEKSEL_BASE;
      updateRenderedVekselLinks();
      updateVekselServerAutoOptionText();
    } catch {
      vekselAutoDetectedServerId = "";
      vekselUrlResolved = VEKSEL_BASE;
      updateVekselServerAutoOptionText();
    }
  }, "resolveVekselUrl");
  let makeVekselIconLink = /* @__PURE__ */ __name(({ href, title, vekselIcon }) => {
    const a = document.createElement("a");
    a.className = "tm-veksel-icon-link";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (title) a.title = title;
    const mainImg = document.createElement("img");
    mainImg.className = "tm-veksel-icon-main";
    mainImg.src = ICON_GISAA_OVERLAY;
    mainImg.alt = "gisaa";
    const badgeImg = document.createElement("img");
    badgeImg.className = "tm-veksel-icon-badge";
    badgeImg.src = vekselIcon;
    badgeImg.alt = "veksel";
    a.appendChild(mainImg);
    a.appendChild(badgeImg);
    return a;
  }, "makeVekselIconLink");
  let makeRewardBlock = /* @__PURE__ */ __name((amount, isDone) => {
    const reward = document.createElement("div");
    reward.className = "tasks__item-reward";
    const name = document.createElement("span");
    name.className = "tasks__item-reward-name";
    name.textContent = "\u041D\u0430\u0433\u0440\u0430\u0434\u0430:";
    reward.appendChild(name);
    const n = Math.max(0, Math.min(20, amount));
    const cls = isDone ? "icon-point--received" : "icon-point--not-received";
    for (let i = 0; i < n; i++) {
      const icon = document.createElement("div");
      icon.className = `icon-point ${cls}`;
      reward.appendChild(icon);
    }
    return reward;
  }, "makeRewardBlock");
  let makeTaskText = /* @__PURE__ */ __name((desc) => {
    const t = document.createElement("div");
    t.className = "tasks__item-text";
    t.textContent = desc || "";
    return t;
  }, "makeTaskText");
  let makeGisaaStatusLine = /* @__PURE__ */ __name((info) => {
    if (!info) return null;
    const line = document.createElement("div");
    line.className = `tm-gisaa-status tm-gisaa-status--${info.status}`;
    if (info.status === "available") {
      const places = (info.locations || []).filter((location2) => !/^copy$/i.test(String(location2).trim())).join(" / ");
      line.textContent = places ? `\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u043C\u043E\u0436\u043D\u043E \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C: ${places}` : "\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u043C\u043E\u0436\u043D\u043E \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C";
    } else if (info.status === "unavailable") line.textContent = "\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u043D\u0435\u043B\u044C\u0437\u044F \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C";
    else return null;
    return line;
  }, "makeGisaaStatusLine");
  let makeLinksRow = /* @__PURE__ */ __name(({ id, short, questTitle, slot, veksel, locations, availableWeekdays, schedule, makeItemIconLink: makeItemIconLink2, makeIconLink: makeIconLink2 }) => {
    const row = document.createElement("div");
    row.className = "tm-links-row";
    const leftPart = document.createElement("div");
    leftPart.className = "tm-links-left";
    const item = slot?.item;
    if (item?.id) {
      const hasIcon = item.icon && item.grade;
      if (hasIcon) leftPart.appendChild(makeItemIconLink2({ item, linked: true, size: "small", count: slot.count }));
      else if (item.name) {
        const nameLink = document.createElement("a");
        nameLink.className = "tm-item-name-link";
        nameLink.href = getItemCodexUrl(item);
        nameLink.target = "_blank";
        nameLink.rel = "noopener noreferrer";
        nameLink.textContent = item.name;
        leftPart.appendChild(nameLink);
      }
    }
    const hasLocations = locations && locations.length > 0;
    const hasShort = !!short;
    const availableWeekdaysStatus = formatAvailableWeekdaysStatus(availableWeekdays);
    const hasAvailableWeekdays = !!availableWeekdaysStatus;
    const hasSchedule = schedule && schedule.length > 0;
    const gisaaInfo = getGisaaVekselInfoForQuest(veksel, slot, locations);
    if (hasLocations || hasShort || hasAvailableWeekdays || hasSchedule || gisaaInfo) {
      const infoWrapper = document.createElement("div");
      infoWrapper.className = "tm-info-wrapper";
      if (hasLocations || hasShort) {
        const infoLine = document.createElement("div");
        infoLine.className = "tm-info-line";
        if (hasLocations) {
          const locEl = document.createElement("span");
          locEl.className = "tm-locations";
          locEl.textContent = locations.join(" / ");
          infoLine.appendChild(locEl);
        }
        if (hasShort) {
          const d = document.createElement("span");
          d.className = "tm-short";
          d.innerHTML = short;
          infoLine.appendChild(d);
        }
        infoWrapper.appendChild(infoLine);
      }
      if (hasAvailableWeekdays) {
        const daysEl = document.createElement("div");
        daysEl.className = "tm-available-days";
        daysEl.textContent = availableWeekdaysStatus;
        infoWrapper.appendChild(daysEl);
      }
      if (hasSchedule) {
        const eventsEl = document.createElement("div");
        eventsEl.className = "tm-events";
        eventsEl.textContent = formatEventsToString(schedule);
        const countdown = document.createElement("span");
        countdown.className = "tm-countdown";
        countdown.dataset.schedule = JSON.stringify(schedule);
        const seconds = getSecondsUntilNextEvent(schedule);
        updateCountdownEl(countdown, seconds);
        eventsEl.appendChild(countdown);
        infoWrapper.appendChild(eventsEl);
      }
      const gisaaStatusLine = makeGisaaStatusLine(gisaaInfo);
      if (gisaaStatusLine) infoWrapper.appendChild(gisaaStatusLine);
      leftPart.appendChild(infoWrapper);
    }
    row.appendChild(leftPart);
    const icons = document.createElement("div");
    icons.className = "tm-icons";
    row.appendChild(icons);
    const codexTitle = questTitle ? `${formatQuestTitle(questTitle)} - ArcheageCodex` : "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0437\u0430\u0434\u0430\u043D\u0438\u0435 \u0432 ArcheageCodex";
    if (id) icons.appendChild(makeIconLink2({ href: `${CODEX_BASE}${id}/`, iconSrc: ICON_QUEST, title: codexTitle, className: "tm-codex-link" }));
    if (veksel === "blue_salt" || veksel === "north") {
      const link = makeVekselIconLink({ href: buildVekselUrl(veksel, slot, locations), title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0442\u0430\u0431\u043B\u0438\u0446\u0443 \u0432\u0435\u043A\u0441\u0435\u043B\u0435\u0439", vekselIcon: veksel === "blue_salt" ? ICON_VEKSEL : ICON_VEKSEL_NORTH });
      link.classList.add("tm-veksel-link");
      link.dataset.veksel = veksel;
      if (slot) link.dataset.slot = JSON.stringify(slot);
      if (locations) link.dataset.locations = JSON.stringify(locations);
      icons.appendChild(link);
    }
    return row;
  }, "makeLinksRow");
  let makeTaskCard = /* @__PURE__ */ __name(({ q, amount, id, short, isDone, showLastDone, completionTime, isToday, slot, veksel, locations, availableWeekdays, schedule, animateCompletion = false, makeItemIconLink: makeItemIconLink2, makeIconLink: makeIconLink2 }) => {
    const card = document.createElement("div");
    card.className = `tasks__item tasks__item--${amount || 1}`;
    if (isDone) {
      card.classList.add(DONE_CLASS);
      if (animateCompletion) {
        card.classList.add(JUST_DONE_CLASS);
        card.addEventListener("animationend", () => {
          card.classList.remove(JUST_DONE_CLASS);
        }, { once: true });
      }
      const done = document.createElement("div");
      done.className = "tasks__item-done";
      const row = document.createElement("div");
      row.className = "tm-done-row";
      const maxStep = Number(q?.max_completed_step || 0);
      const progress = Number(q?.progress || 0);
      const progressEl = document.createElement("span");
      progressEl.className = "tm-done-progress";
      if (maxStep === 0 && isToday) progressEl.textContent = "\u041C\u043E\u0436\u043D\u043E \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E";
      else if (maxStep === 0) progressEl.textContent = "";
      else progressEl.textContent = `${progress}/${maxStep}`;
      row.appendChild(progressEl);
      const checkEl = document.createElement("span");
      checkEl.className = "tm-done-check";
      checkEl.textContent = "\u2714";
      row.appendChild(checkEl);
      done.appendChild(row);
      if (showLastDone) {
        const time = formatTimeMSK(completionTime || 0);
        if (time) {
          const timeEl = document.createElement("span");
          timeEl.className = "tm-done-time";
          timeEl.textContent = time;
          done.appendChild(timeEl);
        }
      }
      card.appendChild(done);
    }
    card.appendChild(makeRewardBlock(amount, isDone));
    card.appendChild(makeTaskText(q.description));
    card.appendChild(makeLinksRow({ id, short, questTitle: q.title, slot, veksel, locations, availableWeekdays, schedule, makeItemIconLink: makeItemIconLink2, makeIconLink: makeIconLink2 }));
    return card;
  }, "makeTaskCard");
  let updateLevelBlock = /* @__PURE__ */ __name((json) => {
    const userInfo = json?.data?.user_info;
    if (!userInfo) return;
    const level = Number(userInfo.level || 1);
    const expTotal = Number(userInfo.exp_total || 0);
    const expForLevel = Number(json?.data?.action_info?.exp_for_level || 10);
    const progress = expTotal - (level - 1) * expForLevel;
    const clampedProgress = Math.max(0, Math.min(expForLevel, progress));
    const levelBlock = document.querySelector(".level");
    if (!levelBlock) return;
    levelBlock.innerHTML = "";
    const levelCurrent = document.createElement("div");
    levelCurrent.className = "level__current";
    const levelCurrentTitle = document.createElement("div");
    levelCurrentTitle.className = "level__current-title";
    levelCurrentTitle.textContent = "\u0412\u0430\u0448 \u0443\u0440\u043E\u0432\u0435\u043D\u044C:";
    levelCurrent.appendChild(levelCurrentTitle);
    const iconLevel = document.createElement("div");
    iconLevel.className = "icon_level";
    const iconLevelText = document.createElement("div");
    iconLevelText.className = "icon_level-text";
    iconLevelText.textContent = String(level);
    iconLevel.appendChild(iconLevelText);
    const iconsStar = document.createElement("div");
    iconsStar.className = "icons-star";
    iconLevel.appendChild(iconsStar);
    levelCurrent.appendChild(iconLevel);
    const iconInfo = document.createElement("div");
    iconInfo.className = "icon-info tooltip-on";
    const tooltipWrap = document.createElement("div");
    tooltipWrap.className = "tooltip-wrap";
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    const tooltipText = document.createElement("div");
    tooltipText.className = "tooltip__text";
    tooltipText.textContent = "\u0412\u044B\u043F\u043E\u043B\u043D\u044F\u0439\u0442\u0435 \u0432\u043D\u0443\u0442\u0440\u0438\u0438\u0433\u0440\u043E\u0432\u044B\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u2014 \u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u0439\u0442\u0435 \u0437\u0430 \u044D\u0442\u043E \u0443\u0440\u043E\u0432\u043D\u0438 \u0432 \u0441\u043E\u0431\u044B\u0442\u0438\u0438 \xAB\u041C\u0430\u0440\u0430\u0444\u043E\u043D \u0433\u0435\u0440\u043E\u0435\u0432\xBB!";
    tooltip.appendChild(tooltipText);
    tooltipWrap.appendChild(tooltip);
    iconInfo.appendChild(tooltipWrap);
    levelCurrent.appendChild(iconInfo);
    levelBlock.appendChild(levelCurrent);
    const levelNext = document.createElement("div");
    levelNext.className = "level__next";
    const levelNextTitle = document.createElement("div");
    levelNextTitle.className = "level__next-title";
    levelNextTitle.textContent = "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u0434\u043E \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E \u0443\u0440\u043E\u0432\u043D\u044F:";
    levelNext.appendChild(levelNextTitle);
    const levelNextList = document.createElement("div");
    levelNextList.className = "level__next-list";
    for (let i = 0; i < expForLevel; i++) {
      const iconPoint = document.createElement("div");
      iconPoint.className = i < clampedProgress ? "icon-point icon-point--received" : "icon-point icon-point--not-received";
      levelNextList.appendChild(iconPoint);
    }
    levelNext.appendChild(levelNextList);
    levelBlock.appendChild(levelNext);
  }, "updateLevelBlock");
  let updateTasksHeader = /* @__PURE__ */ __name((json) => {
    const userInfo = json?.data?.user_info;
    if (!userInfo) return;
    const weekExp = Number(userInfo.week_exp || 0);
    const maxWeekExp = Number(json?.data?.action_info?.increase_max_exp_per_week || 100);
    if (!DOM.tasksHeader || !DOM.tasksHeader.isConnected) DOM.tasksHeader = document.querySelector(".section.tasks .tasks__header");
    if (!DOM.tasksHeader) return;
    let balanceEl = DOM.tasksHeader.querySelector(".tasks__balance");
    if (!balanceEl) {
      balanceEl = document.createElement("div");
      balanceEl.className = "tasks__balance";
      DOM.tasksHeader.appendChild(balanceEl);
    }
    balanceEl.innerHTML = "";
    const label = document.createTextNode(`\u0417\u0430\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E \u0437\u0430 \u044D\u0442\u0443 \u043D\u0435\u0434\u0435\u043B\u044E: ${weekExp} / ${maxWeekExp}`);
    balanceEl.appendChild(label);
    const iconPoint = document.createElement("div");
    iconPoint.className = "icon-point icon-point--received";
    balanceEl.appendChild(iconPoint);
  }, "updateTasksHeader");
  let ensureTasksListEl = /* @__PURE__ */ __name(() => {
    if (!DOM.tasksList || !DOM.tasksList.isConnected) DOM.tasksList = document.querySelector(".section.tasks .tasks__list");
    if (!DOM.tasksList) {
      debugWarn("tasks list element not found", {
        path: location.pathname,
        hasTasksSection: !!document.querySelector(".section.tasks"),
        taskSectionHtml: document.querySelector(".section.tasks")?.outerHTML?.slice(0, 1e3) || null
      });
    }
    return DOM.tasksList;
  }, "ensureTasksListEl");
  let ensureDateNavInHeader = /* @__PURE__ */ __name(() => {
    if (DOM.nav && DOM.nav.isConnected) return DOM.nav;
    if (!DOM.tasksHeader || !DOM.tasksHeader.isConnected) DOM.tasksHeader = document.querySelector(".section.tasks .tasks__header");
    if (!DOM.tasksHeader) return null;
    let nav = DOM.tasksHeader.querySelector(".tm-date-nav");
    if (nav) {
      DOM.nav = nav;
      DOM.label = nav.querySelector(".tm-date-label");
      DOM.prevBtn = nav.querySelector(".tm-date-prev");
      DOM.nextBtn = nav.querySelector(".tm-date-next");
      DOM.todayBtn = nav.querySelector(".tm-date-today");
      return nav;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "tm-nav-wrapper";
    const todayBtn = document.createElement("button");
    todayBtn.className = "tm-date-btn tm-date-today";
    todayBtn.type = "button";
    todayBtn.textContent = "\u0421\u0435\u0433\u043E\u0434\u043D\u044F";
    nav = document.createElement("div");
    nav.className = "tm-date-nav";
    const left = document.createElement("button");
    left.className = "tm-date-btn tm-date-prev";
    left.type = "button";
    left.textContent = "\u2190";
    const right = document.createElement("button");
    right.className = "tm-date-btn tm-date-next";
    right.type = "button";
    right.textContent = "\u2192";
    const label = document.createElement("div");
    label.className = "tm-date-label";
    label.textContent = "...";
    nav.appendChild(left);
    nav.appendChild(label);
    nav.appendChild(right);
    const hideDoneLabel = document.createElement("label");
    hideDoneLabel.className = "tm-hide-done-label";
    const hideDoneCheckbox = document.createElement("input");
    hideDoneCheckbox.type = "checkbox";
    hideDoneCheckbox.className = "tm-hide-done-checkbox";
    const hideDoneText = document.createTextNode(" \u0421\u043A\u0440\u044B\u0442\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u0435");
    hideDoneLabel.appendChild(hideDoneCheckbox);
    hideDoneLabel.appendChild(hideDoneText);
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "tm-refresh-btn";
    refreshBtn.title = "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435";
    refreshBtn.innerHTML = "&#x21bb;";
    DOM.refreshLoader = refreshBtn;
    refreshBtn.addEventListener("click", () => {
      refreshApiInfo();
      restartAutoRefresh();
    });
    wrapper.appendChild(todayBtn);
    wrapper.appendChild(nav);
    wrapper.appendChild(hideDoneLabel);
    wrapper.appendChild(refreshBtn);
    DOM.tasksHeader.insertAdjacentElement("afterbegin", wrapper);
    DOM.nav = nav;
    DOM.label = label;
    DOM.prevBtn = left;
    DOM.nextBtn = right;
    DOM.todayBtn = todayBtn;
    DOM.hideDoneCheckbox = hideDoneCheckbox;
    const savedState = loadHideDoneState();
    hideDoneCheckbox.checked = savedState;
    if (savedState) {
      const listEl = ensureTasksListEl();
      if (listEl) listEl.classList.add("tm-hide-done");
    }
    hideDoneCheckbox.addEventListener("change", () => {
      const listEl = ensureTasksListEl();
      if (listEl) listEl.classList.toggle("tm-hide-done", hideDoneCheckbox.checked);
      saveHideDoneState(hideDoneCheckbox.checked);
    });
    left.addEventListener("click", async () => {
      const prev = getPrevSlot(selectedDayUtcMs, selectedSegment);
      applySlot(prev.dayUtcMs, prev.segment);
      await onSelectedDateChanged();
    });
    right.addEventListener("click", async () => {
      const next = getNextSlot(selectedDayUtcMs, selectedSegment);
      applySlot(next.dayUtcMs, next.segment);
      await onSelectedDateChanged();
    });
    todayBtn.addEventListener("click", async () => {
      applySlot(getTodayUtcMsByTZ(), "auto");
      await onSelectedDateChanged();
    });
    return nav;
  }, "ensureDateNavInHeader");
  let updateDateNavLabel = /* @__PURE__ */ __name(() => {
    if (!DOM.label) return;
    const parts = getMSKDatePartsFromUtcMs(selectedDayUtcMs);
    const dateStr = formatDMY(parts);
    const isThu = isThursdayByTZ(selectedDayUtcMs);
    let suffix = "";
    if (isThu && selectedSegment === "pre") suffix = "\u0434\u043E 09:00";
    else if (isThu && selectedSegment === "post") suffix = "\u043F\u043E\u0441\u043B\u0435 09:00";
    DOM.label.innerHTML = "";
    const dateEl = document.createElement("span");
    dateEl.className = "tm-date-label-date";
    dateEl.textContent = dateStr;
    DOM.label.appendChild(dateEl);
    if (suffix) {
      const suffixEl = document.createElement("span");
      suffixEl.className = "tm-date-label-suffix";
      suffixEl.textContent = suffix;
      DOM.label.appendChild(suffixEl);
    }
    updateDateNavButtons();
  }, "updateDateNavLabel");
  let updateDateNavButtons = /* @__PURE__ */ __name(() => {
    if (!DOM.prevBtn && !DOM.nextBtn) return;
    const curKey = slotKey(selectedDayUtcMs, selectedSegment);
    const minKey = MIN_DAY_UTC_MS != null ? slotKey(MIN_DAY_UTC_MS, MIN_SEG) : null;
    const maxKey = MAX_DAY_UTC_MS != null ? slotKey(MAX_DAY_UTC_MS, MAX_SEG) : null;
    if (DOM.prevBtn) DOM.prevBtn.disabled = minKey != null && curKey <= minKey;
    if (DOM.nextBtn) DOM.nextBtn.disabled = maxKey != null && curKey >= maxKey;
    if (DOM.todayBtn) DOM.todayBtn.disabled = isSameDayByTZ(selectedDayUtcMs, getTodayUtcMsByTZ());
  }, "updateDateNavButtons");
  let onSelectedDateChanged = /* @__PURE__ */ __name(async () => {
    updateDateNavLabel();
    updateDateNavButtons();
    try {
      await renderTasksForSelectedDay();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] renderTasksForSelectedDay failed:", e);
    }
  }, "onSelectedDateChanged");
  let computeThuSegmentsAvailability = /* @__PURE__ */ __name((dayUtcMs, questsArr) => {
    const preUnix = getUnixForDayAtHour(dayUtcMs, THU_PRE_HOUR);
    const postUnix = getUnixForDayAtHour(dayUtcMs, DEFAULT_HOUR);
    const hasPre = questsArr.some((q) => isQuestActiveAtUnix(q, preUnix));
    const hasPost = questsArr.some((q) => isQuestActiveAtUnix(q, postUnix));
    return { hasPre, hasPost };
  }, "computeThuSegmentsAvailability");
  let computeDateBoundsFromApiInfo = /* @__PURE__ */ __name(async () => {
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
    MIN_SEG = null;
    MAX_SEG = null;
    if (MIN_DAY_UTC_MS != null && isThursdayByTZ(MIN_DAY_UTC_MS)) {
      const { hasPre, hasPost } = computeThuSegmentsAvailability(MIN_DAY_UTC_MS, questsArr);
      if (hasPre) MIN_SEG = "pre";
      else if (hasPost) MIN_SEG = "post";
      else MIN_SEG = "post";
    }
    if (MAX_DAY_UTC_MS != null && isThursdayByTZ(MAX_DAY_UTC_MS)) {
      const { hasPre, hasPost } = computeThuSegmentsAvailability(MAX_DAY_UTC_MS, questsArr);
      if (hasPost) MAX_SEG = "post";
      else if (hasPre) MAX_SEG = "pre";
      else MAX_SEG = "pre";
    }
  }, "computeDateBoundsFromApiInfo");
  let taskCardFactories = { makeItemIconLink: null, makeIconLink: null };
  let setTaskCardFactories = /* @__PURE__ */ __name((factories) => {
    taskCardFactories = { ...taskCardFactories, ...factories };
  }, "setTaskCardFactories");
  let renderTasksForSelectedDay = /* @__PURE__ */ __name(async ({ animateNewlyDone = false, makeItemIconLink: makeItemIconLink2 = taskCardFactories.makeItemIconLink, makeIconLink: makeIconLink2 = taskCardFactories.makeIconLink } = {}) => {
    const listEl = ensureTasksListEl();
    if (!listEl) return;
    if (!makeItemIconLink2 || !makeIconLink2) throw new Error("[ArcheAgeExtraUI] makeItemIconLink/makeIconLink are required");
    const json = await getApiInfoCached();
    API_INFO_DATA_JSON = JSON.stringify(json?.data);
    const all = getQuestsArrayFromInfo(json);
    updateLevelBlock(json);
    updateTasksHeader(json);
    const todayUtc = getTodayUtcMsByTZ();
    const isToday = isSameDayByTZ(selectedDayUtcMs, todayUtc);
    const isThu = isThursdayByTZ(selectedDayUtcMs);
    let unixPoint;
    if (isThu && selectedSegment === "pre") unixPoint = getUnixForDayAtHour(selectedDayUtcMs, THU_PRE_HOUR);
    else unixPoint = getUnixForDayAtHour(selectedDayUtcMs, DEFAULT_HOUR);
    const active = all.filter((q) => isQuestActiveAtUnix(q, unixPoint));
    const questMetaByApiQuest = new Map(active.map((q) => [q, findQuestMetaForMarathonQuest(q)]));
    const knownActive = active.filter((q) => questMetaByApiQuest.get(q));
    const unknownActive = active.filter((q) => !questMetaByApiQuest.get(q));
    debugLog("renderTasksForSelectedDay", {
      selectedDayUtcMs,
      selectedSegment,
      unixPoint,
      unixPointIso: debugTime(unixPoint),
      totalQuests: all.length,
      activeQuests: active.length,
      knownActiveQuests: knownActive.length,
      unknownActiveQuests: unknownActive.length,
      minDayIso: MIN_DAY_UTC_MS ? new Date(MIN_DAY_UTC_MS).toISOString() : null,
      maxDayIso: MAX_DAY_UTC_MS ? new Date(MAX_DAY_UTC_MS).toISOString() : null
    });
    if (!active.length) debugWarn("No active quests for selected slot. First API quests:", all.slice(0, 10).map(summarizeQuestForDebug));
    else if (unknownActive.length) debugWarn("Active quests without local QUESTS metadata:", unknownActive.map(summarizeQuestForDebug));
    active.sort((a, b) => {
      const da = getRewardAmount(a);
      const db = getRewardAmount(b);
      if (da !== db) return da - db;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
    listEl.innerHTML = "";
    const currentDoneIds = /* @__PURE__ */ new Set();
    let renderedCount = 0;
    for (const q of active) {
      const questId = Number(q.id);
      const meta = questMetaByApiQuest.get(q);
      const id = meta?.id ? Number(meta.id) : null;
      const short = (meta?.short || "").trim();
      const amount = getRewardAmount(q);
      const completionTime = getCompletionTimeInSlot(q.code, selectedDayUtcMs, selectedSegment);
      const doneInSlot = completionTime > 0;
      if (doneInSlot) currentDoneIds.add(questId);
      const isNewlyDone = animateNewlyDone && doneInSlot && !previouslyDoneQuestIds.has(questId);
      const card = makeTaskCard({
        q,
        amount,
        id,
        short,
        isDone: doneInSlot,
        showLastDone: doneInSlot,
        completionTime,
        isToday,
        slot: meta?.slot || null,
        veksel: meta?.veksel,
        locations: meta?.locations,
        availableWeekdays: meta?.availableWeekdays,
        schedule: meta?.schedule,
        animateCompletion: isNewlyDone,
        makeItemIconLink: makeItemIconLink2,
        makeIconLink: makeIconLink2
      });
      listEl.appendChild(card);
      renderedCount++;
    }
    if (active.length && !renderedCount) renderEmptyTasksDiagnostic(listEl, "ArcheAgeExtraUI: \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u0435\u0441\u0442\u044C \u0432 API, \u043D\u043E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043D\u0435 \u0431\u044B\u043B\u0438 \u043E\u0442\u0440\u0438\u0441\u043E\u0432\u0430\u043D\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u043E\u043D\u0441\u043E\u043B\u044C.");
    else if (!active.length) renderEmptyTasksDiagnostic(listEl, "ArcheAgeExtraUI: \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u0434\u043D\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u043E\u043D\u0441\u043E\u043B\u044C.");
    previouslyDoneQuestIds = currentDoneIds;
  }, "renderTasksForSelectedDay");
  let init = /* @__PURE__ */ __name(async ({
    injectStyles = /* @__PURE__ */ __name(() => {
    }, "injectStyles"),
    startCountdownInterval = /* @__PURE__ */ __name(() => {
    }, "startCountdownInterval"),
    initPrizes: initPrizes2 = /* @__PURE__ */ __name(async () => {
    }, "initPrizes"),
    initAutoOpenBoxesCheckbox: initAutoOpenBoxesCheckbox2 = /* @__PURE__ */ __name(() => {
    }, "initAutoOpenBoxesCheckbox"),
    makeItemIconLink: makeItemIconLink2,
    makeIconLink: makeIconLink2
  } = {}) => {
    if (makeItemIconLink2 || makeIconLink2) setTaskCardFactories({ makeItemIconLink: makeItemIconLink2, makeIconLink: makeIconLink2 });
    installApiInfoInterceptor();
    injectStyles();
    debugLog("init marathon page", {
      path: location.pathname,
      hasTasksSection: !!document.querySelector(".section.tasks"),
      hasTasksHeader: !!document.querySelector(".section.tasks .tasks__header"),
      hasTasksList: !!document.querySelector(".section.tasks .tasks__list")
    });
    try {
      await getApiInfoCached();
    } catch (e) {
      debugWarn("getApiInfoCached failed during init", e);
      return;
    }
    try {
      cachedUid = await getUidFromCheckUser();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] getUidFromCheckUser failed:", e);
    }
    initServerTimeOffset();
    startCountdownInterval();
    ensureDateNavInHeader();
    try {
      await computeDateBoundsFromApiInfo();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] computeDateBoundsFromApiInfo failed:", e);
    }
    applySlot(selectedDayUtcMs || getTodayUtcMsByTZ(), "auto");
    updateQuestHistory();
    try {
      await onSelectedDateChanged();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] renderTasksForSelectedDay failed:", e);
    }
    requestAnimationFrame(() => {
      const el = document.querySelector(".section.tasks .tasks__header");
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 85;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
    resolveVekselUrl();
    try {
      await initPrizes2();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] initPrizes failed:", e);
    }
    try {
      initAutoOpenBoxesCheckbox2();
    } catch (e) {
      console.warn("[ArcheAgeExtraUI] initAutoOpenBoxesCheckbox failed:", e);
    }
    const initialInterval = document.hidden ? AUTO_REFRESH_INTERVAL_HIDDEN_MS : AUTO_REFRESH_INTERVAL_FOCUSED_MS;
    startAutoRefresh(initialInterval);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }, "init");

  // src/marathon/prizes.js
  let LS_KEY_AUTO_CLAIM = "tm_aa_prizes_auto_claim";
  let LS_KEY_AUTO_OPEN_BOXES = "tm_aa_auto_open_boxes";
  let CLAIM_DELAY_MS = 400;
  let loadAutoClaimState = /* @__PURE__ */ __name(() => {
    try {
      return localStorage.getItem(LS_KEY_AUTO_CLAIM) === "true";
    } catch {
      return false;
    }
  }, "loadAutoClaimState");
  let saveAutoClaimState = /* @__PURE__ */ __name((enabled) => {
    try {
      localStorage.setItem(LS_KEY_AUTO_CLAIM, enabled ? "true" : "false");
    } catch {
    }
  }, "saveAutoClaimState");
  let getTargetPrizeLevelFromApi = /* @__PURE__ */ __name(() => {
    const userInfo = API_INFO_CACHE?.data?.user_info;
    if (!userInfo) return 1;
    const currentLevel = userInfo.level || 1;
    const status = userInfo.status || "trial";
    const farmedKey = status === "premium" ? "premium" : "trial";
    const farmedRewards = userInfo.farmed_rewards?.[farmedKey] || [];
    const farmedSet = new Set(farmedRewards.map((x) => parseInt(x, 10)));
    for (let level = 1; level <= currentLevel; level++) {
      if (!farmedSet.has(level)) {
        return level;
      }
    }
    return currentLevel + 1;
  }, "getTargetPrizeLevelFromApi");
  let getPrizesVm = /* @__PURE__ */ __name(() => {
    const el = pageDocument.querySelector(".game__right");
    return el?.__vue__ ?? null;
  }, "getPrizesVm");
  let scrollToFirstRelevantPrize = /* @__PURE__ */ __name(() => {
    const targetLevel = getTargetPrizeLevelFromApi();
    const vm = getPrizesVm();
    if (!vm) return;
    const perPage = vm.per_on_page || 10;
    vm.current_page = Math.floor((targetLevel - 1) / perPage);
  }, "scrollToFirstRelevantPrize");
  let claimAllActivePrizes = /* @__PURE__ */ __name(async () => {
    await claimAllLevelRewards();
  }, "claimAllActivePrizes");
  let getVueStore = /* @__PURE__ */ __name(() => {
    const page = pageDocument.querySelector(".page");
    return page?.parentElement?.__vue__?.$store ?? null;
  }, "getVueStore");
  let farmLevelReward = /* @__PURE__ */ __name((level, isPremium) => {
    const store = getVueStore();
    if (!store) return Promise.reject(new Error("Vue store not found"));
    return new Promise((resolve, reject) => {
      store.dispatch("maininfo/getLevelPrize", {
        level,
        is_premium: isPremium ? 1 : 0,
        callback_success: /* @__PURE__ */ __name((data) => {
          const userInfo = API_INFO_CACHE?.data?.user_info;
          if (userInfo && data?.data?.farmed_rewards) {
            userInfo.farmed_rewards = data.data.farmed_rewards;
          }
          resolve(data);
        }, "callback_success"),
        callback_error: /* @__PURE__ */ __name(() => {
          reject(new Error(`getLevelPrize failed for level=${level}`));
        }, "callback_error")
      });
    });
  }, "farmLevelReward");
  let syncNativeRewardsState = /* @__PURE__ */ __name(() => {
    const store = getVueStore();
    if (!store) return;
    const farmedRewards = API_INFO_CACHE?.data?.user_info?.farmed_rewards;
    if (farmedRewards) {
      store.commit("maininfo/setUserRewards", JSON.parse(JSON.stringify(farmedRewards)));
    }
    store.dispatch("shop/getShopInfo");
    const vm = getPrizesVm();
    if (vm) {
      const page = vm.current_page;
      vm.current_page = -1;
      vm.$nextTick(() => {
        vm.current_page = page;
      });
    }
  }, "syncNativeRewardsState");
  let claimAllLevelRewards = /* @__PURE__ */ __name(async () => {
    const userInfo = API_INFO_CACHE?.data?.user_info;
    if (!userInfo) return;
    if (!getVueStore()) return;
    const currentLevel = userInfo.level || 1;
    const status = userInfo.status || "trial";
    const isPremium = status === "premium";
    const rewardTypes = isPremium ? ["trial", "premium"] : ["trial"];
    let claimed = false;
    for (const type of rewardTypes) {
      const farmed = new Set((userInfo.farmed_rewards?.[type] || []).map(Number));
      for (let level = 1; level <= currentLevel; level++) {
        if (farmed.has(level)) continue;
        try {
          await farmLevelReward(level, type === "premium");
          claimed = true;
          await new Promise((r) => setTimeout(r, CLAIM_DELAY_MS));
        } catch (e) {
          console.warn(`[ArcheAgeExtraUI] claimLevelReward(${level}, ${type}) failed:`, e);
        }
      }
    }
    if (claimed) {
      syncNativeRewardsState();
    }
  }, "claimAllLevelRewards");
  let loadAutoOpenBoxesState = /* @__PURE__ */ __name(() => {
    try {
      return localStorage.getItem(LS_KEY_AUTO_OPEN_BOXES) === "true";
    } catch {
      return false;
    }
  }, "loadAutoOpenBoxesState");
  let saveAutoOpenBoxesState = /* @__PURE__ */ __name((enabled) => {
    try {
      localStorage.setItem(LS_KEY_AUTO_OPEN_BOXES, String(enabled));
    } catch {
    }
  }, "saveAutoOpenBoxesState");
  let getLootboxVm = /* @__PURE__ */ __name(() => {
    const el = pageDocument.querySelector(".lootbox");
    return el?.__vue__ ?? null;
  }, "getLootboxVm");
  let hasPremiumMarathonAccess = /* @__PURE__ */ __name(() => {
    if (API_INFO_CACHE?.data?.user_info?.status === "premium") return true;
    const store = getVueStore();
    return store?.state?.maininfo?.user_info?.status === "premium" || store?.state?.maininfo?.userInfo?.status === "premium" || store?.state?.maininfo?.info?.user_info?.status === "premium";
  }, "hasPremiumMarathonAccess");
  let autoOpenBoxesIntervalId = null;
  let tryOpenNextBox = /* @__PURE__ */ __name(() => {
    if (!loadAutoOpenBoxesState()) return;
    const lootbox = getLootboxVm();
    if (!lootbox || typeof lootbox.openBox !== "function") return;
    if (lootbox.is_show_popup || lootbox.is_button_pushed) return;
    const boxesAvailable = lootbox.getChestNum;
    if (boxesAvailable <= 0 || !hasPremiumMarathonAccess()) return;
    console.log(`[ArcheAgeExtraUI] \u0410\u0432\u0442\u043E\u043E\u0442\u043A\u0440\u044B\u0442\u0438\u0435 \u0441\u0443\u043D\u0434\u0443\u043A\u0430 (\u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C: ${boxesAvailable})`);
    lootbox.openBox();
  }, "tryOpenNextBox");
  let startAutoOpenBoxesInterval = /* @__PURE__ */ __name(() => {
    if (autoOpenBoxesIntervalId != null) return;
    autoOpenBoxesIntervalId = setInterval(tryOpenNextBox, 1e3);
  }, "startAutoOpenBoxesInterval");
  let stopAutoOpenBoxesInterval = /* @__PURE__ */ __name(() => {
    if (autoOpenBoxesIntervalId != null) {
      clearInterval(autoOpenBoxesIntervalId);
      autoOpenBoxesIntervalId = null;
    }
  }, "stopAutoOpenBoxesInterval");
  let initAutoOpenBoxesCheckbox = /* @__PURE__ */ __name(() => {
    const lootboxTitle = document.querySelector(".lootbox__title");
    if (!lootboxTitle) return;
    if (lootboxTitle.querySelector(".tm-auto-open-label")) return;
    const label = document.createElement("label");
    label.className = "tm-auto-open-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "tm-auto-open-checkbox";
    checkbox.checked = loadAutoOpenBoxesState();
    const text = document.createTextNode("\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438");
    label.appendChild(checkbox);
    label.appendChild(text);
    lootboxTitle.appendChild(label);
    checkbox.addEventListener("change", () => {
      saveAutoOpenBoxesState(checkbox.checked);
      if (checkbox.checked) {
        startAutoOpenBoxesInterval();
      } else {
        stopAutoOpenBoxesInterval();
      }
    });
    if (checkbox.checked) {
      startAutoOpenBoxesInterval();
    }
  }, "initAutoOpenBoxesCheckbox");
  let initAutoClaimCheckbox = /* @__PURE__ */ __name(() => {
    const prizesTitle = document.querySelector(".prizes__title");
    if (!prizesTitle) return;
    if (prizesTitle.querySelector(".tm-auto-claim-label")) return;
    const label = document.createElement("label");
    label.className = "tm-auto-claim-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "tm-auto-claim-checkbox";
    checkbox.checked = loadAutoClaimState();
    const text = document.createTextNode(" \u0417\u0430\u0431\u0438\u0440\u0430\u0442\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438");
    label.appendChild(checkbox);
    label.appendChild(text);
    prizesTitle.appendChild(label);
    checkbox.addEventListener("change", async () => {
      saveAutoClaimState(checkbox.checked);
      if (checkbox.checked) {
        await claimAllActivePrizes();
      }
    });
  }, "initAutoClaimCheckbox");
  let initPrizes = /* @__PURE__ */ __name(async () => {
    const prizesWrap = document.querySelector(".prizes__wrap");
    if (!prizesWrap) return;
    initAutoClaimCheckbox();
    scrollToFirstRelevantPrize();
    if (loadAutoClaimState()) {
      await claimAllActivePrizes();
    }
  }, "initPrizes");

  // src/marathon/styles.js
  let DONE_CLASS2 = "tm-task-completed";
  let JUST_DONE_CLASS2 = "tm-task-just-completed";
  let itemIconStylesInjected = false;
  let selectedItemsStylesInjected = false;
  let marathonStylesInjected = false;
  let cartStylesInjected = false;
  let getSystemScale = /* @__PURE__ */ __name(() => window.devicePixelRatio / (window.visualViewport?.scale || 1), "getSystemScale");
  let getItemIconStyles = /* @__PURE__ */ __name(() => {
    const screenScale = getSystemScale();
    return `
            :root { --tm-screen-scale: ${1 / screenScale}; }
            .tm-item-icon {
                position: relative;
                display: inline-block;
                flex-shrink: 0;
            }

            .tm-item-icon--small {
                width: 30px;
                height: 30px;
                font-size: 11.5px;
            }

            .tm-item-icon--medium {
                width: 42px;
                height: 42px;
                font-size: 11.5px;
            }

            .tm-item-icon::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: inherit;
                opacity: 0;
                box-shadow:
                    inset 0 0 12px rgba(255, 255, 255, 0.35),
                    inset 0 0 4px rgba(255, 255, 255, 0.6);
            }

            .tm-item-icon:hover::after {
                opacity: 1;
            }

            .tm-item-icon-img {
                position: relative;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
            }

            .tm-item-icon-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: auto;
            }

            .tm-item-icon-grade {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }

            .tm-item-icon-count {
                position: absolute;
                right: 9%;
                bottom: 12.5%;
                line-height: 0.5;
                letter-spacing: 0.02em;
                color: #fff;
                text-shadow: -1px -2px 2px #000, 1px 1px 2px #000;
                pointer-events: none;
                z-index: 3;
            }

            /* \u0412\u0441\u043F\u043B\u044B\u0432\u0430\u0448\u043A\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 (\u0433\u043B\u043E\u0431\u0430\u043B\u044C\u043D\u0430\u044F, \u0432 body) */
            .tm-item-tooltip {
                display: none;
                position: fixed;
                top: var(--tm-tooltip-top, 0);
                left: var(--tm-tooltip-left, 0);
                z-index: 10000;
                box-sizing: border-box;
                width: 248px;
                padding: 15px 15px 14px;
                background: rgba(0, 8, 24, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.25);
                pointer-events: none;
                white-space: normal;
                font-family: Calibri, Arial, Verdana, Tahoma;
                font-size: 14px;
                line-height: 18px;
                color: #cfd6e0;
                transform: translateX(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: top right;
            }

            .tm-item-tooltip--visible {
                display: block;
            }

            .tm-item-tooltip--right {
                transform: scale(var(--tm-tooltip-scale, 1));
                transform-origin: top left;
            }

            .tm-item-tooltip--bottom {
                transform: translateX(-100%) translateY(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: bottom right;
            }

            .tm-item-tooltip--bottom.tm-item-tooltip--right {
                transform: translateY(-100%) scale(var(--tm-tooltip-scale, 1));
                transform-origin: bottom left;
            }

            .tm-item-tooltip-header {
                display: flex;
                gap: 6px;
                align-items: flex-start;
                padding: 0;
            }

            .tm-item-tooltip-header > .tm-item-icon {
                flex-shrink: 0;
            }

            .tm-item-tooltip-meta {
                display: flex;
                flex-direction: column;
                padding: 6px 0 2px;
            }

            .tm-item-tooltip-type {
                opacity: 0.7;
            }

            .tm-item-tooltip-grade {
            }

            .tm-item-tooltip-name {
                font-size: 16px;
                line-height: 20px;
            }

            .tm-item-tooltip-sep {
                height: 2px;
                margin: 4px 0;
                background: linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0.10));
                -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
                mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
                padding: 0;
            }

            .tm-item-tooltip-req {
                padding: 0 3px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-level {
                display: flex;
                align-items: center;
            }

            .tm-item-tooltip-hero-level-icon {
                width: 16px;
                height: 16px;
                margin: 0 2px;
                flex: 0 0 auto;
            }

            .tm-item-tooltip-stats {
                padding: 0 3px;
                display: flex;
                flex-direction: column;
                gap: 1px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-stat-row {
                display: flex;
                gap: 4px;
            }

            .tm-item-tooltip-stat-value {
                color: #cfd6e0;
                text-align: right;
            }

            .tm-item-tooltip-equipment-subtype {
                padding: 0 3px;
                letter-spacing: 0.03em;
            }

            .tm-item-tooltip-desc {
                padding: 4px 3px 2px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .tm-item-tooltip-use-label {
                color: #888;
            }

            .tm-item-tooltip-use-text {
                color: #4caf50;
            }

            .tm-item-tooltip-price {
                padding: 0 3px;
                display: grid;
                grid-template-columns: min-content 1fr;
                gap: 8px;
            }
            .tm-item-tooltip-price--none {
                display: block;
                color: #d02e2e;
            }
            .tm-item-tooltip-price-value {
                color: #cfd6e0;
                display: inline-flex;
                align-items: center;
                justify-content: flex-end;
                flex-wrap: wrap;
                gap: 4px;
                text-align: right;
            }
            .tm-item-tooltip-price-part {
                display: inline-flex;
                align-items: center;
                gap: 2px;
                white-space: nowrap;
            }
            .tm-item-tooltip-price-icon {
                width: 16px;
                height: 16px;
                flex: 0 0 auto;
            }

            .orange_text,
            .inv-nc,
            .inv-nn,
            .inv-buffvar {
                color: #ff9c27;
            }

            .light_blue_text,
            .inv-nd {
                color: #74b0ca;
            }

            .blue_text,
            .inv-ni {
                color: #27b1c6;
            }

            .red_text,
            .inv-nr {
                color: #de482f;
            }
        `;
  }, "getItemIconStyles");
  let getMarathonStyles = /* @__PURE__ */ __name(() => `
        .${DONE_CLASS2} {
            background-color: #fff0e2bf;
        }

        /* \u0410\u043D\u0438\u043C\u0430\u0446\u0438\u044F "\u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E" */
        @keyframes tm-just-completed-glow {
            0% {
                box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7), inset 0 0 20px rgba(76, 175, 80, 0.3);
                transform: scale(1);
            }
            15% {
                box-shadow: 0 0 25px 8px rgba(76, 175, 80, 0.6), inset 0 0 30px rgba(76, 175, 80, 0.4);
                transform: scale(1.02);
            }
            30% {
                box-shadow: 0 0 35px 12px rgba(255, 215, 0, 0.5), inset 0 0 40px rgba(255, 215, 0, 0.3);
                transform: scale(1.03);
            }
            50% {
                box-shadow: 0 0 20px 6px rgba(76, 175, 80, 0.4), inset 0 0 25px rgba(76, 175, 80, 0.2);
                transform: scale(1.01);
            }
            100% {
                box-shadow: 0 0 0 0 transparent, inset 0 0 0 transparent;
                transform: scale(1);
            }
        }

        @keyframes tm-just-completed-bg {
            0% { background-color: #fff0e2bf; }
            20% { background-color: rgba(76, 175, 80, 0.35); }
            40% { background-color: rgba(255, 215, 0, 0.3); }
            60% { background-color: rgba(76, 175, 80, 0.25); }
            100% { background-color: #fff0e2bf; }
        }

        @keyframes tm-checkmark-pop {
            0% { transform: scale(0) rotate(-45deg); opacity: 0; }
            50% { transform: scale(1.4) rotate(10deg); opacity: 1; }
            70% { transform: scale(0.9) rotate(-5deg); }
            100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        .${JUST_DONE_CLASS2} {
            animation:
                tm-just-completed-glow 2s ease-out forwards,
                tm-just-completed-bg 2s ease-out forwards;
            position: relative;
            z-index: 9;
        }

        .${JUST_DONE_CLASS2} .tm-done-check {
            animation: tm-checkmark-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            animation-delay: 0.2s;
            transform: scale(0);
        }

        .tasks__item {
            overflow: visible;
        }

        .tasks__item-done {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
            pointer-events: none;
            opacity: 0.8;
        }

        .tm-done-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .tm-done-time {
            font-size: 12px;
        }

        .tm-done-progress {
            font-size: 12px;
        }

        .tm-done-check {
            font-size: 14px;
            font-weight: 700;
            line-height: 1;
            color: #3cb45a;
        }

        .tm-links-row {
            margin-top: 6px;
            display: flex;
            gap: 4px;
            justify-content: space-between;
            align-items: center;
            z-index: 1;
        }

        .tm-links-left {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }

        .tm-item-name-link {
            font-size: 12px;
            color: inherit;
            opacity: 0.85;
            text-decoration: none;
        }

        .tm-item-name-link:hover {
            opacity: 1;
            text-decoration: underline;
        }

        .tm-info-wrapper {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .tm-info-line {
            display: flex;
            align-items: baseline;
            gap: 6px;
        }

        .tm-locations {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-short {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-available-days {
            font-size: 12px;
            line-height: 1.25;
            color: #8a6230;
            font-weight: 600;
        }

        .tm-gisaa-status {
            font-size: 12px;
            line-height: 1.25;
            font-weight: 600;
        }

        .tm-gisaa-status--available {
            color: #3f8f3a;
        }

        .tm-gisaa-status--unavailable {
            color: #b04a44;
        }

        .tm-short a {
            color: inherit;
        }

        .tm-events {
            font-size: 12px;
            line-height: 1.25;
            opacity: 0.85;
        }

        .tm-inline-icon {
            display: inline-block;
            position: relative;
            width: 18px;
            height: 18px;
            vertical-align: middle;
            margin: 0 2px;
        }

        .tm-inline-icon img:first-child {
            width: 100%;
            height: 100%;
            display: block;
        }

        .tm-inline-icon-grade {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .tm-countdown {
            font-weight: 500;
            white-space: nowrap;
        }
        .tm-countdown.tm-countdown--active {
            color: #4caf50;
        }
        .tm-countdown.tm-countdown--waiting {
            color: #d02e2e;
        }

        .tm-icons {
            display: flex;
            flex-direction: row-reverse;
            gap: 8px;
            align-items: center;
            flex: 0 0 auto;
        }

        .tm-icon-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            background: rgba(255,255,255,0.06);
            transition: box-shadow 150ms ease, opacity 150ms ease;
        }

        .tm-icon-link:hover {
            transform: translateY(-1px);
        }

        .tm-icon-link img {
            width: 30px;
            display: block;
        }

        .tm-veksel-icon-link {
            position: relative;
            display: inline-block;
            width: 30px;
            height: 30px;
            flex-shrink: 0;
            transition: transform 120ms ease, opacity 120ms ease;
        }

        .tm-veksel-icon-link:hover {
            transform: translateY(-1px);
            opacity: 1;
        }

        .tm-veksel-icon-main {
            width: 100%;
            height: 100%;
            display: block;
        }

        .tm-veksel-icon-badge {
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 18px;
            height: 18px;
            border-radius: 2px;
            background: rgba(0, 0, 0, 0.6);
        }

        .tm-nav-wrapper {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .tm-date-nav {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        @media (max-width: 1300px) {
            .tm-nav-wrapper {
                padding: 0 20px;
            }
        }

        .tm-date-btn {
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255,0.18);
            background: rgba(255, 255, 255, 0.06);
            color: inherit;
            font: inherit;
            font-size: 14px;
            text-transform: uppercase;
        }

        .tm-date-btn:hover {
            background: rgba(255, 255, 255, 0.10);
        }

        .tm-date-label {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 150px;
            text-align: center;
        }

        .tm-date-label-date {
            font-size: 16px;
        }

        .tm-date-label-suffix {
            font-size: 12px;
            opacity: 0.75;
            line-height: 1;
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

        .tm-hide-done-label {
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            font-size: 16px;
        }

        .tm-hide-done-label:hover {
            opacity: 1;
        }

        .tm-hide-done-checkbox {
            cursor: pointer;
        }

        .tm-hide-done .${DONE_CLASS2} {
            display: none;
        }

        .tm-refresh-btn {
            width: 26px;
            height: 26px;
            padding: 0;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.06);
            color: rgba(255, 255, 255, 0.7);
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            transition: background 150ms ease, color 150ms ease, transform 150ms ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .tm-refresh-btn:hover {
            background: rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.95);
        }

        .tm-refresh-btn:active {
            transform: scale(0.92);
        }

        .tm-refresh-loader--active {
            pointer-events: none;
            animation: tm-spin 0.7s linear infinite;
        }

        @keyframes tm-spin {
            to {
                transform: rotate(360deg);
            }
        }

        /* \u0410\u0432\u0442\u043E\u0437\u0430\u0431\u043E\u0440 \u043F\u043E\u0434\u0430\u0440\u043A\u043E\u0432 */
        .prizes__title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        .tm-auto-claim-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: normal;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }

        .tm-auto-claim-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        /* \u0410\u0432\u0442\u043E\u043E\u0442\u043A\u0440\u044B\u0442\u0438\u0435 \u0441\u0443\u043D\u0434\u0443\u043A\u043E\u0432 */
        .lootbox__title {
            gap: 30px;
            flex-wrap: wrap;
        }

        .lootbox__title .icon-info {
            margin-left: 0;
        }

        .tm-auto-open-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            font-weight: normal;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            text-transform: none;
        }

        .tm-auto-open-checkbox {
            width: 16px;
            height: 16px;
            cursor: pointer;
        }

        .pagination__item--ellipsis {
            cursor: default;
            color: #777;
        }
    `, "getMarathonStyles");
  let getCartStyles = /* @__PURE__ */ __name(() => `
        #block_content {
            overflow: unset;
        }

        .cart_right {
            position: sticky;
            top: 0;
        }

        .guild_tab.cart_items .gh_1,
        .guild_tab.cart_items .g\u0441_1 {
            width: 1%;
        }

        .guild_tab.cart_items .gh_2 {
            border-left: none;
            padding-left: 0;
        }

        .guild_tab.cart_items .gh_3 {
            width: 1px;
            min-width: 170px;
            border-right: none;
        }

        .guild_tab.cart_items .gh_4 {
            width: 1%;
        }

        .guild_tab.cart_items .g\u0441_2 {
            border-left: none;
            padding-left: 0;
        }

        .guild_tab.cart_items .g\u0441_4 {
            white-space: nowrap;
            text-align: right;
            border-right: none;
            width: 1%;
        }

        .cart_items .item:hover {
            background: #edf4fa;
        }

        .cart_items .item.disabled:hover {
            background: transparent;
        }

        .cart_items .item.tm-selected {
            display: none;
        }


        .tm-cart-timer {
            display: block;
        }

        .tm-char-face {
            width: 100%;
            height: 100%;
            /*border-radius: 50%;*/
            opacity: 0;
            -webkit-mask-image: linear-gradient(to bottom, transparent, #000 5px, #000 80%, transparent),
                                linear-gradient(to right, transparent, #000 5px, #000 calc(100% - 5px), transparent);
            -webkit-mask-composite: destination-in;
            mask-image: linear-gradient(to bottom, transparent, #000 5px, #000 80%, transparent),
                        linear-gradient(to right, transparent, #000 5px, #000 calc(100% - 5px), transparent);
            mask-composite: intersect;
            filter: brightness(1.1);
            mix-blend-mode: multiply;
        }

        .tm-char-face--loaded {
            opacity: 1;
        }

        .tm-char-face--error {
            opacity: 0;
        }

        .tm-char-face-ready div {
            background: none !important;
        }
    `, "getCartStyles");
  let injectItemIconStyles = /* @__PURE__ */ __name(() => {
    if (itemIconStylesInjected) return;
    itemIconStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = getItemIconStyles();
    document.head.appendChild(style);
  }, "injectItemIconStyles");
  let injectMarathonStyles = /* @__PURE__ */ __name(() => {
    if (marathonStylesInjected) return;
    marathonStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = getMarathonStyles();
    document.head.appendChild(style);
  }, "injectMarathonStyles");
  let injectCartStyles = /* @__PURE__ */ __name(() => {
    if (cartStylesInjected) return;
    cartStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = getCartStyles();
    document.head.appendChild(style);
  }, "injectCartStyles");
  let injectSelectedItemsStyles = /* @__PURE__ */ __name(() => {
    if (selectedItemsStylesInjected) return;
    selectedItemsStylesInjected = true;
    const style = document.createElement("style");
    style.textContent = `
            .tm-selected-container {
                position: relative;
                min-height: 100px;
                padding: 18px 14px 18px 11px;
            }

            .tm-selected-container::before {
                content: '';
                position: absolute;
                left: -1px;
                top: 0;
                bottom: 0;
                width: 100%;
                pointer-events: none;
                background:
                    url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_top.png) left top no-repeat,
                    url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_bottom.png) left bottom no-repeat;
            }

            .tm-selected-list {
                display: flex;
                flex-direction: column;
                min-height: 181px;
                padding: 13px 15px;
                background: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/cart_items_sel_bg.jpg) left bottom no-repeat;
                max-height: 181px;
                overflow: auto;
                position: relative;
            }

            .tm-selected-items-help {
                margin: auto;
                color: #495a6d;
                font: 14px / 16px Cambria, Georgia, "Times New Roman", Times, serif;
                text-align: center;
                cursor: default;
            }

            .tm-selected-item {
                position: relative;
                display: flex;
                align-items: center;
                padding: 2px 36px 2px 0;
                font: 14px / 16px Cambria, Georgia, "Times New Roman", Times, serif;
                border-bottom: 1px solid #d6dde5;
                border-top: 1px solid #d6dde5;
                cursor: default;
                z-index: 1;
            }

            .tm-cart-item-name {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .tm-selected-item .del_btn {
                position: absolute;
                display: block;
                top: 50%;
                margin-top: -12px;
                right: 0;
                width: 25px;
                height: 25px;
                background-image: url(https://aa.cdn.gmru.net/static/aa.mail.ru/img/main/content/itemrestore/icons.png);
                background-repeat: no-repeat;
                background-position: left 0px;
                cursor: pointer;
            }

        `;
    document.head.appendChild(style);
  }, "injectSelectedItemsStyles");

  // src/marathon/tooltip.js
  let LS_KEY_DYNAMIC_TOOLTIPS = "tm_aa_dynamic_tooltips";
  let DEBUG_PREFIX2 = "[ArcheAgeExtraUI]";
  let debugWarn2 = /* @__PURE__ */ __name((...args) => console.warn(DEBUG_PREFIX2, ...args), "debugWarn");
  let ITEM_STORE = /* @__PURE__ */ new Map();
  let globalTooltip = null;
  let dynamicTooltipCache = /* @__PURE__ */ new Map();
  let activeTooltipKey = null;
  let tooltipDomInitialized = false;
  let TOOLTIP_VISIBLE_CLASS = "tm-item-tooltip--visible";
  let TOOLTIP_RIGHT_CLASS = "tm-item-tooltip--right";
  let TOOLTIP_BOTTOM_CLASS = "tm-item-tooltip--bottom";
  let TOOLTIP_WIDTH = 248;
  let getSystemScale2 = /* @__PURE__ */ __name(() => pageWindow.devicePixelRatio / (pageWindow.visualViewport?.scale || 1), "getSystemScale");
  let getTooltipContainer = /* @__PURE__ */ __name(() => {
    if (globalTooltip) return globalTooltip;
    globalTooltip = pageDocument.createElement("div");
    globalTooltip.className = "tm-item-tooltip";
    pageDocument.body.appendChild(globalTooltip);
    return globalTooltip;
  }, "getTooltipContainer");
  let injectTooltipStyles = /* @__PURE__ */ __name(() => {
    if (pageDocument.getElementById("tm-item-tooltip-styles")) return;
    const style = pageDocument.createElement("style");
    style.id = "tm-item-tooltip-styles";
    style.textContent = `
        .tm-item-tooltip {
            display: none;
            position: fixed;
            top: var(--tm-tooltip-top, 0);
            left: var(--tm-tooltip-left, 0);
            z-index: 10000;
            box-sizing: border-box;
            width: 248px;
            padding: 15px 15px 14px;
            background: rgba(0, 8, 24, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.25);
            pointer-events: none;
            white-space: normal;
            font-family: Calibri, Arial, Verdana, Tahoma;
            font-size: 14px;
            line-height: 18px;
            color: #cfd6e0;
            transform: translateX(-100%) scale(var(--tm-tooltip-scale, 1));
            transform-origin: top right;
        }

        .tm-item-tooltip--visible {
            display: block;
        }

        .tm-item-tooltip--right {
            transform: scale(var(--tm-tooltip-scale, 1));
            transform-origin: top left;
        }

        .tm-item-tooltip--bottom {
            transform: translateX(-100%) translateY(-100%) scale(var(--tm-tooltip-scale, 1));
            transform-origin: bottom right;
        }

        .tm-item-tooltip--bottom.tm-item-tooltip--right {
            transform: translateY(-100%) scale(var(--tm-tooltip-scale, 1));
            transform-origin: bottom left;
        }

        .tm-item-tooltip-header {
            display: flex;
            gap: 6px;
            align-items: flex-start;
            padding: 0;
        }

        .tm-item-tooltip-header > .tm-item-icon {
            flex-shrink: 0;
        }

        .tm-item-tooltip-meta {
            display: flex;
            flex-direction: column;
            padding: 6px 0 2px;
        }

        .tm-item-tooltip-type {
            opacity: 0.7;
        }

        .tm-item-tooltip-name {
            font-size: 16px;
            line-height: 20px;
        }

        .tm-item-tooltip-sep {
            height: 2px;
            margin: 4px 0;
            background: linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0.10));
            -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
            mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
            padding: 0;
        }

        .tm-item-tooltip-req {
            padding: 0 3px;
            letter-spacing: 0.03em;
        }

        .tm-item-tooltip-level {
            display: flex;
            align-items: center;
        }

        .tm-item-tooltip-hero-level-icon {
            width: 16px;
            height: 16px;
            margin: 0 2px;
            flex: 0 0 auto;
        }

        .tm-item-tooltip-stats {
            padding: 0 3px;
            display: flex;
            flex-direction: column;
            gap: 1px;
            letter-spacing: 0.03em;
        }

        .tm-item-tooltip-stat-row {
            display: flex;
            gap: 4px;
        }

        .tm-item-tooltip-stat-value {
            color: #cfd6e0;
            text-align: right;
        }

        .tm-item-tooltip-equipment-subtype {
            padding: 0 3px;
            letter-spacing: 0.03em;
        }

        .tm-item-tooltip-desc {
            padding: 4px 3px 2px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .tm-item-tooltip-use-label {
            color: #888;
        }

        .tm-item-tooltip-use-text {
            color: #4caf50;
        }

        .tm-item-tooltip-price {
            padding: 0 3px;
            display: grid;
            grid-template-columns: min-content 1fr;
            gap: 8px;
        }

        .tm-item-tooltip-price--none {
            display: block;
            color: #d02e2e;
        }

        .tm-item-tooltip-price-value {
            color: #cfd6e0;
            display: inline-flex;
            align-items: center;
            justify-content: flex-end;
            flex-wrap: wrap;
            gap: 4px;
            text-align: right;
        }

        .tm-item-tooltip-price-part {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            white-space: nowrap;
        }

        .tm-item-tooltip-price-icon {
            width: 16px;
            height: 16px;
            flex: 0 0 auto;
        }

        .orange_text,
        .inv-nc,
        .inv-nn,
        .inv-buffvar {
            color: #ff9c27;
        }

        .inv-nd {
            color: #d02e2e;
        }

        .inv-ni {
            color: #4caf50;
        }

        .inv-nr {
            color: #b19cff;
        }
    `;
    pageDocument.head.appendChild(style);
  }, "injectTooltipStyles");
  let initTooltipDom = /* @__PURE__ */ __name(() => {
    injectTooltipStyles();
    getTooltipContainer();
  }, "initTooltipDom");
  let resolveItemLevelValue = /* @__PURE__ */ __name((levelValue, isMaxLevel = false) => {
    if (isMaxLevel && Number(levelValue) === 0) return MAX_LEVEL;
    return Number(levelValue);
  }, "resolveItemLevelValue");
  let appendItemLevelValue = /* @__PURE__ */ __name((container, levelValue, isMaxLevel = false) => {
    const level = resolveItemLevelValue(levelValue, isMaxLevel);
    if (Number.isFinite(level) && level > 55) {
      const icon = pageDocument.createElement("img");
      icon.className = "tm-item-tooltip-hero-level-icon";
      icon.src = HERO_LEVEL_ICON;
      icon.alt = "\u0433\u0435\u0440\u043E\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C";
      container.appendChild(icon);
      const value = pageDocument.createElement("span");
      value.className = "inv-nc";
      value.textContent = String(level - 55);
      container.appendChild(value);
    } else {
      container.appendChild(pageDocument.createTextNode(String(levelValue)));
    }
  }, "appendItemLevelValue");
  let makeRequiredLevelLine = /* @__PURE__ */ __name((reqLevel, maxLevel) => {
    const line = pageDocument.createElement("div");
    line.className = "tm-item-tooltip-level";
    line.appendChild(pageDocument.createTextNode("\u0422\u0440\u0435\u0431\u0443\u0435\u043C\u044B\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C: "));
    if (reqLevel != null) appendItemLevelValue(line, reqLevel);
    if (maxLevel != null) {
      line.appendChild(pageDocument.createTextNode("~"));
      appendItemLevelValue(line, maxLevel, true);
    }
    return line;
  }, "makeRequiredLevelLine");
  let formatSpeedStat = /* @__PURE__ */ __name((value) => {
    const str = String(value).trim();
    if (!str.includes(".")) return `${str}.0`;
    const [whole, fraction = ""] = str.split(".");
    return `${whole}.${fraction || "0"}`;
  }, "formatSpeedStat");
  let ITEM_UTILITY_STATS = [
    { field: "speed", label: "\u0421\u043D\u043E\u0440\u043E\u0432\u043A\u0430", format: formatSpeedStat },
    { field: "durability", label: "\u041F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C", format: /* @__PURE__ */ __name((value) => `${value}/${value}`, "format") }
  ];
  let ITEM_COMBAT_STATS = [
    { field: "dps", label: "\u0423\u0440\u043E\u043D", colon: true },
    { field: "armor", label: "\u0417\u0430\u0449\u0438\u0442\u0430", colon: true },
    { field: "magicResistance", label: "\u0421\u043E\u043F\u0440\u043E\u0442\u0438\u0432\u043B\u0435\u043D\u0438\u0435", colon: true },
    { field: "mdps", label: "\u0421\u0438\u043B\u0430 \u0437\u0430\u043A\u043B\u0438\u043D\u0430\u043D\u0438\u0439" },
    { field: "hdps", label: "\u042D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C \u0438\u0441\u0446\u0435\u043B\u0435\u043D\u0438\u044F" },
    { field: "str", label: "\u0421\u0438\u043B\u0430" },
    { field: "dex", label: "\u041B\u043E\u0432\u043A\u043E\u0441\u0442\u044C" },
    { field: "sta", label: "\u0412\u044B\u043D\u043E\u0441\u043B\u0438\u0432\u043E\u0441\u0442\u044C" },
    { field: "int", label: "\u0418\u043D\u0442\u0435\u043B\u043B\u0435\u043A\u0442" },
    { field: "spi", label: "\u041C\u0443\u0434\u0440\u043E\u0441\u0442\u044C" }
  ];
  let isDisplayableItemStatValue = /* @__PURE__ */ __name((value) => {
    if (value == null || value === "") return false;
    const num = Number(value);
    return !Number.isFinite(num) || num !== 0;
  }, "isDisplayableItemStatValue");
  let getItemStatEntries = /* @__PURE__ */ __name((item, stats) => stats.map((stat) => ({ ...stat, value: item[stat.field] })).filter((stat) => isDisplayableItemStatValue(stat.value)), "getItemStatEntries");
  let makeItemStatsSection = /* @__PURE__ */ __name((entries) => {
    const section = pageDocument.createElement("div");
    section.className = "tm-item-tooltip-stats";
    for (const entry of entries) {
      const row = pageDocument.createElement("div");
      row.className = "tm-item-tooltip-stat-row";
      const label = pageDocument.createElement("span");
      label.className = "tm-item-tooltip-stat-label";
      label.textContent = entry.colon ? `${entry.label}:` : entry.label;
      const value = pageDocument.createElement("span");
      value.className = "tm-item-tooltip-stat-value";
      value.textContent = entry.format ? entry.format(entry.value) : String(entry.value);
      row.appendChild(label);
      row.appendChild(value);
      section.appendChild(row);
    }
    return section;
  }, "makeItemStatsSection");
  let appendPricePart = /* @__PURE__ */ __name((container, amount, iconSrc, title) => {
    const part = pageDocument.createElement("span");
    part.className = "tm-item-tooltip-price-part";
    const value = pageDocument.createElement("span");
    value.textContent = String(amount);
    part.appendChild(value);
    const icon = pageDocument.createElement("img");
    icon.className = "tm-item-tooltip-price-icon";
    icon.src = iconSrc;
    icon.alt = title;
    icon.title = title;
    part.appendChild(icon);
    container.appendChild(part);
  }, "appendPricePart");
  let makeItemPriceValue = /* @__PURE__ */ __name((price) => {
    const value = pageDocument.createElement("span");
    value.className = "tm-item-tooltip-price-value";
    const totalBronze = Math.max(0, Math.floor(Number(price) || 0));
    const gold = Math.floor(totalBronze / 1e4);
    const silver = Math.floor(totalBronze % 1e4 / 100);
    const bronze = totalBronze % 100;
    if (gold > 0) appendPricePart(value, gold, CURRENCY_ICONS.gold, "\u0437\u043E\u043B\u043E\u0442\u043E");
    if (silver > 0) appendPricePart(value, silver, CURRENCY_ICONS.silver, "\u0441\u0435\u0440\u0435\u0431\u0440\u043E");
    if (bronze > 0 || totalBronze === 0) appendPricePart(value, bronze, CURRENCY_ICONS.bronze, "\u0431\u0440\u043E\u043D\u0437\u0430");
    return value;
  }, "makeItemPriceValue");
  let getItemDynamicTooltipKey = /* @__PURE__ */ __name((item) => {
    if (item?.id == null || item.id === "") return null;
    const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
    return `${item.id}|${grade}`;
  }, "getItemDynamicTooltipKey");
  let saveDynamicTooltipSnapshot = /* @__PURE__ */ __name((itemId, grade, data) => {
    if (itemId == null || !data) return;
    try {
      const raw = localStorage.getItem(LS_KEY_DYNAMIC_TOOLTIPS);
      const all = raw ? JSON.parse(raw) : {};
      all[String(itemId)] = {
        id: String(itemId),
        grade: String(grade ?? 0),
        updatedAt: Date.now(),
        data
      };
      localStorage.setItem(LS_KEY_DYNAMIC_TOOLTIPS, JSON.stringify(all));
    } catch (e) {
      debugWarn2("Failed to save dynamic tooltip snapshot:", e);
    }
  }, "saveDynamicTooltipSnapshot");
  let dynamicTooltipFieldValue = /* @__PURE__ */ __name((value) => {
    if (value == null) return null;
    const str = String(value).trim();
    return str ? str : null;
  }, "dynamicTooltipFieldValue");
  let dynamicTooltipNumberValue = /* @__PURE__ */ __name((value) => {
    if (value == null || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }, "dynamicTooltipNumberValue");
  let dynamicTooltipStatValue = /* @__PURE__ */ __name((value) => {
    if (value == null || value === "") return null;
    const str = String(value).trim();
    if (!str) return null;
    const num = Number(str);
    return Number.isFinite(num) ? num : str;
  }, "dynamicTooltipStatValue");
  let DYNAMIC_EQUIP_TOOLTIP_PATTERNS = [
    /Здоровье/,
    /Защита/,
    /Сопротивление/,
    /Скорость\s+(?:передвижения|плавания|занятия|сбора)/,
    /Опыт\s+при\s+занятии/,
    /Время\s+применения\s+умений/
  ];
  let isDynamicEquipTooltipPart = /* @__PURE__ */ __name((value) => {
    const text = stripHtmlForMatch(value);
    return DYNAMIC_EQUIP_TOOLTIP_PATTERNS.some((pattern) => pattern.test(text));
  }, "isDynamicEquipTooltipPart");
  let mapDynamicEquipTooltip = /* @__PURE__ */ __name((value) => {
    const raw = dynamicTooltipFieldValue(value);
    if (!raw) return {};
    const parts = raw.split(/<br\s*\/?>/i).map((part) => cleanDynamicTooltipMarkup(part)).filter(Boolean);
    const equipIndex = parts.findIndex(isDynamicEquipTooltipPart);
    if (equipIndex === -1) {
      const useDescription2 = cleanDynamicTooltipMarkup(raw);
      return useDescription2 ? { useDescription: useDescription2 } : {};
    }
    const equipParts = [];
    let nextIndex = equipIndex;
    while (nextIndex < parts.length && isDynamicEquipTooltipPart(parts[nextIndex])) {
      equipParts.push(parts[nextIndex]);
      nextIndex++;
    }
    const result = {
      equipDescription: equipParts.join("<br/>")
    };
    if (equipIndex > 0 && /^Действует\b/i.test(stripHtmlForMatch(parts[equipIndex - 1]))) {
      result.isEquipDescriptionTemporary = true;
    }
    const useDescription = cleanDynamicTooltipMarkup(parts.slice(nextIndex).join("<br/>"));
    if (useDescription) result.useDescription = useDescription;
    return result;
  }, "mapDynamicEquipTooltip");
  let mapDynamicTooltipToItem = /* @__PURE__ */ __name((data) => {
    if (!data || typeof data !== "object") return {};
    const fixedGrade = dynamicTooltipNumberValue(data.fixed_grade);
    const apiGrade = dynamicTooltipNumberValue(data.grade);
    const grade = fixedGrade != null && fixedGrade >= 0 ? fixedGrade : apiGrade;
    const reqLevel = dynamicTooltipNumberValue(data.level_requirement);
    const maxLevel = dynamicTooltipNumberValue(data.level_limit);
    const hasRefund = Object.prototype.hasOwnProperty.call(data, "refund");
    const price = data.refund === null ? null : dynamicTooltipNumberValue(data.refund);
    const description = cleanDynamicTooltipMarkup(data.description);
    const equipTooltipFields = mapDynamicEquipTooltip(data.equip_tooltip);
    const setDescription = cleanDynamicTooltipMarkup(data.set_description);
    return {
      ...dynamicTooltipFieldValue(data.filename) ? { icon: dynamicTooltipFieldValue(data.filename) } : {},
      ...dynamicTooltipFieldValue(data.name) ? { name: dynamicTooltipFieldValue(data.name) } : {},
      ...grade != null && grade >= 0 ? { grade } : {},
      ...description ? { description } : {},
      ...equipTooltipFields,
      ...setDescription ? { equipDescription: setDescription } : {},
      ...dynamicTooltipFieldValue(data.cat_name) ? { apiCategoryTitle: dynamicTooltipFieldValue(data.cat_name) } : {},
      ...reqLevel != null && reqLevel > 0 ? { reqLevel } : {},
      ...maxLevel != null && maxLevel >= 0 ? { maxLevel } : {},
      ...hasRefund && (price !== null || data.refund === null) ? { price } : {},
      ...dynamicTooltipStatValue(data.c_speed) != null ? { speed: dynamicTooltipStatValue(data.c_speed) } : {},
      ...dynamicTooltipStatValue(data.c_durability) != null ? { durability: dynamicTooltipStatValue(data.c_durability) } : {},
      ...dynamicTooltipStatValue(data.c_dps) != null ? { dps: dynamicTooltipStatValue(data.c_dps) } : {},
      ...dynamicTooltipStatValue(data.c_armor) != null ? { armor: dynamicTooltipStatValue(data.c_armor) } : {},
      ...dynamicTooltipStatValue(data.c_magic_resistance) != null ? { magicResistance: dynamicTooltipStatValue(data.c_magic_resistance) } : {},
      ...dynamicTooltipStatValue(data.c_mdps) != null ? { mdps: dynamicTooltipStatValue(data.c_mdps) } : {},
      ...dynamicTooltipStatValue(data.c_hdps) != null ? { hdps: dynamicTooltipStatValue(data.c_hdps) } : {},
      ...dynamicTooltipStatValue(data.c_str) != null ? { str: dynamicTooltipStatValue(data.c_str) } : {},
      ...dynamicTooltipStatValue(data.c_dex) != null ? { dex: dynamicTooltipStatValue(data.c_dex) } : {},
      ...dynamicTooltipStatValue(data.c_sta) != null ? { sta: dynamicTooltipStatValue(data.c_sta) } : {},
      ...dynamicTooltipStatValue(data.c_int) != null ? { int: dynamicTooltipStatValue(data.c_int) } : {},
      ...dynamicTooltipStatValue(data.c_spi) != null ? { spi: dynamicTooltipStatValue(data.c_spi) } : {}
    };
  }, "mapDynamicTooltipToItem");
  let itemHasTooltipField = /* @__PURE__ */ __name((item, field) => field === "price" ? Object.prototype.hasOwnProperty.call(item, field) : item[field] != null && item[field] !== "", "itemHasTooltipField");
  let mergeDynamicTooltipItem = /* @__PURE__ */ __name((item, data) => {
    const apiItem = mapDynamicTooltipToItem(data);
    const merged = { ...item };
    for (const [field, value] of Object.entries(apiItem)) {
      if (field === "buff") {
        merged.buff = { ...value || {}, ...merged.buff || {} };
        continue;
      }
      if (!itemHasTooltipField(merged, field)) merged[field] = value;
    }
    return merged;
  }, "mergeDynamicTooltipItem");
  let fetchDynamicTooltipData = /* @__PURE__ */ __name(async (item) => {
    if (!isArcheageSite) return null;
    const key = getItemDynamicTooltipKey(item);
    if (!key) return null;
    if (dynamicTooltipCache.has(key)) return dynamicTooltipCache.get(key);
    const grade = Number.isFinite(Number(item.grade)) ? Number(item.grade) : 0;
    const promise = fetch(`/dynamic/tooltip/?a=item&id=${encodeURIComponent(item.id)}&g=${encodeURIComponent(grade)}`, {
      credentials: "include",
      cache: "no-store"
    }).then((res) => res.ok ? res.json() : null).then((data2) => {
      if (data2 && typeof data2 === "object") saveDynamicTooltipSnapshot(item.id, grade, data2);
      return data2 && typeof data2 === "object" ? data2 : null;
    }).catch((e) => {
      debugWarn2(`Failed to fetch dynamic tooltip for item ${item.id}:`, e);
      return null;
    });
    dynamicTooltipCache.set(key, promise);
    const data = await promise;
    dynamicTooltipCache.set(key, data);
    return data;
  }, "fetchDynamicTooltipData");
  let makeItemIconLink = /* @__PURE__ */ __name(({ item, linked = false, size = "medium", count, noTooltip = false }) => {
    const icon = pageDocument.createElement(linked ? "a" : "div");
    icon.className = `tm-item-icon tm-item-icon--${size}`;
    if (linked) {
      icon.href = getItemCodexUrl(item);
      icon.target = "_blank";
      icon.rel = "noopener noreferrer";
      icon.addEventListener("click", (e) => e.stopPropagation());
    }
    const itemImg = pageDocument.createElement("img");
    itemImg.className = "tm-item-icon-img";
    itemImg.src = getItemIconUrl(item);
    itemImg.dataset.itemId = item.id;
    itemImg.dataset.iconTemplate = item.icon || "";
    itemImg.dataset.iconM = item.iconM || "";
    itemImg.dataset.iconF = item.iconF || "";
    icon.appendChild(itemImg);
    const overlay = ICON_OVERLAY[item.overlay]?.icon;
    if (overlay) {
      const overlayImg = pageDocument.createElement("img");
      overlayImg.className = "tm-item-icon-overlay";
      overlayImg.src = overlay;
      icon.appendChild(overlayImg);
    }
    const gradeInfo = GRADES[item.grade];
    if (gradeInfo) {
      const gradeImg = pageDocument.createElement("img");
      gradeImg.className = "tm-item-icon-grade";
      gradeImg.src = gradeInfo.overlay;
      gradeImg.alt = gradeInfo.title || "";
      icon.appendChild(gradeImg);
    }
    if (count && count > 1) {
      const countEl = pageDocument.createElement("div");
      countEl.className = "tm-item-icon-count";
      countEl.textContent = count;
      icon.appendChild(countEl);
    }
    if (!noTooltip) {
      icon.addEventListener("mouseenter", () => showTooltip(icon, item));
      icon.addEventListener("mouseleave", hideTooltip);
    }
    return icon;
  }, "makeItemIconLink");
  let populateTooltip = /* @__PURE__ */ __name((item) => {
    const tooltip = getTooltipContainer();
    tooltip.innerHTML = "";
    const gradeInfo = GRADES[item.grade];
    const headerSection = pageDocument.createElement("div");
    headerSection.className = "tm-item-tooltip-header";
    const iconEl = makeItemIconLink({ item, noTooltip: true });
    headerSection.appendChild(iconEl);
    const tipMeta = pageDocument.createElement("div");
    tipMeta.className = "tm-item-tooltip-meta";
    const subTypeInfo = ITEM_SUB_TYPES[item.subType];
    const typeInfo = subTypeInfo || ITEM_TYPES[item.type];
    const typeTitle = typeInfo?.title || item.apiCategoryTitle;
    if (typeTitle) {
      const typeLine = pageDocument.createElement("div");
      typeLine.className = "tm-item-tooltip-type";
      typeLine.textContent = typeTitle;
      tipMeta.appendChild(typeLine);
    }
    if (gradeInfo?.title && !(item.grade === 1 && item.type !== "equipment")) {
      const gradeLine = pageDocument.createElement("div");
      gradeLine.className = "tm-item-tooltip-grade";
      if (gradeInfo.color) gradeLine.style.color = gradeInfo.color;
      gradeLine.textContent = gradeInfo.title;
      tipMeta.appendChild(gradeLine);
    }
    const nameLine = pageDocument.createElement("div");
    nameLine.className = "tm-item-tooltip-name";
    if (gradeInfo?.color) nameLine.style.color = gradeInfo.color;
    nameLine.textContent = item.name || "";
    tipMeta.appendChild(nameLine);
    headerSection.appendChild(tipMeta);
    tooltip.appendChild(headerSection);
    if (item.isPersonal || item.reqLevel != null || item.maxLevel != null) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      const reqSection = pageDocument.createElement("div");
      reqSection.className = "tm-item-tooltip-req";
      if (item.reqLevel != null || item.maxLevel != null) {
        reqSection.appendChild(makeRequiredLevelLine(item.reqLevel, item.maxLevel));
      }
      if (item.isPersonal) {
        const p = pageDocument.createElement("div");
        p.textContent = "\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442";
        reqSection.appendChild(p);
      }
      tooltip.appendChild(reqSection);
    }
    const utilityStatEntries = getItemStatEntries(item, ITEM_UTILITY_STATS);
    if (utilityStatEntries.length) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      tooltip.appendChild(makeItemStatsSection(utilityStatEntries));
    }
    const combatStatEntries = getItemStatEntries(item, ITEM_COMBAT_STATS);
    if (combatStatEntries.length) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      tooltip.appendChild(makeItemStatsSection(combatStatEntries));
    }
    const equipmentSubTypeInfo = EQUIPMENT_SUB_TYPES[item.equipmentSubType];
    if (equipmentSubTypeInfo?.title) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      const equipmentSubTypeSection = pageDocument.createElement("div");
      equipmentSubTypeSection.className = "tm-item-tooltip-equipment-subtype";
      equipmentSubTypeSection.textContent = equipmentSubTypeInfo.title;
      tooltip.appendChild(equipmentSubTypeSection);
    }
    const hasUseDescription = item.useDescription && hasVisibleTooltipText(item.useDescription);
    if (item.description || hasUseDescription || item.equipDescription) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      const descriptionSection = pageDocument.createElement("div");
      descriptionSection.className = "tm-item-tooltip-desc";
      if (item.description) {
        const descText = pageDocument.createElement("div");
        descText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.description, item));
        descriptionSection.appendChild(descText);
      }
      if (hasUseDescription) {
        const useBlock = pageDocument.createElement("div");
        useBlock.className = "tm-item-tooltip-use";
        const useLabel = pageDocument.createElement("div");
        useLabel.className = "tm-item-tooltip-use-label";
        useLabel.textContent = "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435";
        const useText = pageDocument.createElement("div");
        useText.className = "tm-item-tooltip-use-text";
        useText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.useDescription, item));
        useBlock.appendChild(useLabel);
        useBlock.appendChild(useText);
        descriptionSection.appendChild(useBlock);
      }
      if (item.equipDescription) {
        const equipBlock = pageDocument.createElement("div");
        equipBlock.className = "tm-item-tooltip-use";
        const equipLabel = pageDocument.createElement("div");
        equipLabel.className = "tm-item-tooltip-use-label";
        equipLabel.textContent = item.isEquipDescriptionTemporary ? "\u042D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0430 (\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E)" : "\u042D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0430";
        const equipText = pageDocument.createElement("div");
        equipText.className = "tm-item-tooltip-use-text";
        equipText.innerHTML = parseGameMarkup(resolveItemPlaceholders(item.equipDescription, item));
        equipBlock.appendChild(equipLabel);
        equipBlock.appendChild(equipText);
        descriptionSection.appendChild(equipBlock);
      }
      tooltip.appendChild(descriptionSection);
    }
    if (item.price !== void 0) {
      const sep = pageDocument.createElement("div");
      sep.className = "tm-item-tooltip-sep";
      tooltip.appendChild(sep);
      const priceSection = pageDocument.createElement("div");
      priceSection.className = "tm-item-tooltip-price";
      if (item.price === null || Number(item.price) === 0) {
        priceSection.className = "tm-item-tooltip-price tm-item-tooltip-price--none";
        priceSection.textContent = "\u042D\u0442\u043E\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043D\u0435 \u043D\u0443\u0436\u0435\u043D \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430\u043C.";
      } else {
        const label = pageDocument.createElement("span");
        label.textContent = "\u0426\u0435\u043D\u0430\n\u043F\u0440\u043E\u0434\u0430\u0436\u0438:";
        priceSection.appendChild(label);
        priceSection.appendChild(makeItemPriceValue(item.price));
      }
      tooltip.appendChild(priceSection);
    }
  }, "populateTooltip");
  let positionTooltip = /* @__PURE__ */ __name((anchorEl) => {
    const tooltip = getTooltipContainer();
    const rect = anchorEl.getBoundingClientRect();
    const screenScale = getSystemScale2();
    const scale = 1 / screenScale;
    const tooltipLeftEdge = rect.left + 8 - TOOLTIP_WIDTH * scale;
    const showOnRight = tooltipLeftEdge < 0;
    tooltip.classList.add(TOOLTIP_VISIBLE_CLASS);
    tooltip.style.setProperty("--tm-tooltip-scale", `${scale}`);
    const tooltipHeight = tooltip.offsetHeight * scale;
    const showFromBottom = rect.bottom - 8 + tooltipHeight > pageWindow.innerHeight;
    if (showFromBottom) {
      const topEdge = rect.top + 8 - tooltipHeight;
      if (topEdge < 0) {
        tooltip.style.setProperty("--tm-tooltip-top", "0px");
        tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
      } else {
        tooltip.style.setProperty("--tm-tooltip-top", `${rect.top + 8}px`);
        tooltip.classList.add(TOOLTIP_BOTTOM_CLASS);
      }
    } else {
      tooltip.style.setProperty("--tm-tooltip-top", `${rect.bottom - 8}px`);
      tooltip.classList.remove(TOOLTIP_BOTTOM_CLASS);
    }
    if (showOnRight) {
      tooltip.style.setProperty("--tm-tooltip-left", `${rect.right - 8}px`);
      tooltip.classList.add(TOOLTIP_RIGHT_CLASS);
    } else {
      tooltip.style.setProperty("--tm-tooltip-left", `${rect.left + 8}px`);
      tooltip.classList.remove(TOOLTIP_RIGHT_CLASS);
    }
  }, "positionTooltip");
  let showTooltip = /* @__PURE__ */ __name((anchorEl, item) => {
    initTooltipDom();
    const tooltipKey = getItemDynamicTooltipKey(item) || `${Date.now()}:${Math.random()}`;
    activeTooltipKey = tooltipKey;
    populateTooltip(item);
    positionTooltip(anchorEl);
    fetchDynamicTooltipData(item).then((data) => {
      if (!data || activeTooltipKey !== tooltipKey) return;
      populateTooltip(mergeDynamicTooltipItem(item, data));
      positionTooltip(anchorEl);
    });
  }, "showTooltip");
  let hideTooltip = /* @__PURE__ */ __name(() => {
    activeTooltipKey = null;
    if (globalTooltip) {
      globalTooltip.classList.remove(TOOLTIP_VISIBLE_CLASS, TOOLTIP_RIGHT_CLASS, TOOLTIP_BOTTOM_CLASS);
    }
  }, "hideTooltip");
  let getDelegatedTooltipItem = /* @__PURE__ */ __name((target) => {
    const icon = target?.closest?.(".tm-item-icon[data-item-id], [data-tm-tooltip-item-id], [data-item-id]");
    const itemId = icon?.dataset?.tmTooltipItemId || icon?.dataset?.itemId;
    if (!itemId) return null;
    const item = ITEM_STORE.get(String(itemId)) || ITEM_STORE.get(Number(itemId)) || ITEMS[itemId];
    return item ? { icon, item } : null;
  }, "getDelegatedTooltipItem");
  let initTooltips = /* @__PURE__ */ __name(() => {
    initTooltipDom();
    if (tooltipDomInitialized) return;
    tooltipDomInitialized = true;
    pageDocument.addEventListener("mouseover", (event) => {
      const found = getDelegatedTooltipItem(event.target);
      if (!found || found.icon.contains(event.relatedTarget)) return;
      showTooltip(found.icon, found.item);
    });
    pageDocument.addEventListener("mouseout", (event) => {
      const found = getDelegatedTooltipItem(event.target);
      if (!found || found.icon.contains(event.relatedTarget)) return;
      hideTooltip();
    });
  }, "initTooltips");

  // src/components/item-icon.js
  let makeIconLink = /* @__PURE__ */ __name(({ href, iconSrc, title, className }) => {
    const a = document.createElement("a");
    a.className = `tm-icon-link ${className || ""}`.trim();
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = title;
    const img = document.createElement("img");
    img.src = iconSrc;
    img.alt = title;
    a.appendChild(img);
    return a;
  }, "makeIconLink");
  let updateRenderedItemIcons = /* @__PURE__ */ __name(() => {
    document.querySelectorAll(".tm-item-icon-img[data-icon-template]").forEach((img) => {
      img.src = getItemIconUrlFromParts(
        img.dataset.iconTemplate || "",
        img.dataset.iconM || "",
        img.dataset.iconF || ""
      );
    });
  }, "updateRenderedItemIcons");

  // src/main.js
  if (isGisaaSite) {
    initGisaa();
  }
  if (!isArcheageSite) {
  } else {
    const injectStyles = /* @__PURE__ */ __name(() => {
      injectItemIconStyles();
      injectMarathonStyles();
    }, "injectStyles");
    const startCountdownInterval = /* @__PURE__ */ __name(() => {
      setInterval(() => {
        document.querySelectorAll(".tm-countdown").forEach((el) => {
          const remaining = parseInt(el.dataset.remaining || "0", 10);
          if (remaining > 0) {
            el.dataset.remaining = String(remaining - 1);
          }
          updateCountdownEl(el, remaining - 1);
        });
      }, 1e3);
    }, "startCountdownInterval");
    const openEventsPopupWithDeps = /* @__PURE__ */ __name(() => openEventsPopup({
      loadVekselServerIdOverride,
      saveVekselServerIdOverride,
      resolveVekselUrl,
      getVekselAutoOptionText,
      loadNotificationState,
      saveNotificationState,
      updateRenderedItemIcons
    }), "openEventsPopupWithDeps");
    const checkEventNotificationsWithDeps = /* @__PURE__ */ __name(() => checkEventNotifications({
      loadNotificationState,
      saveNotificationState
    }), "checkEventNotificationsWithDeps");
    initServerClock(openEventsPopupWithDeps, checkEventNotificationsWithDeps);
    if (isCartPage) {
      const startCart = /* @__PURE__ */ __name(() => initCart({
        injectItemIconStyles,
        injectSelectedItemsStyles,
        injectCartStyles,
        makeItemIconLink,
        fetchText,
        getUidFromCheckUser
      }), "startCart");
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startCart);
      } else {
        startCart();
      }
    } else if (isItemRestorePage) {
      initItemRestore({
        injectItemIconStyles,
        injectSelectedItemsStyles,
        makeItemIconLink
      });
    } else if (location.pathname.startsWith("/promo/marathon")) {
      const observer = new MutationObserver(() => {
        if (document.querySelector(".section.tasks")) {
          observer.disconnect();
          init({
            injectStyles,
            startCountdownInterval,
            initPrizes,
            initAutoOpenBoxesCheckbox,
            makeItemIconLink,
            makeIconLink
          });
          initTooltips();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        if (!document.querySelector(".section.tasks")) {
          debugWarn("marathon tasks section did not appear after 10s", {
            path: location.pathname,
            sections: [...document.querySelectorAll("section, .section")].slice(0, 20).map((el) => ({
              tag: el.tagName,
              className: el.className,
              id: el.id,
              text: el.textContent?.trim().slice(0, 120)
            }))
          });
        }
      }, 1e4);
    }
  }
})();
