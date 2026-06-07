// Userscript globals provided by Tampermonkey/Greasemonkey

/** The page's actual window object (bypasses sandbox). */
declare const unsafeWindow: Window & typeof globalThis;

/** GM_getValue — read a value from userscript storage. */
declare function GM_getValue(key: string): string | undefined;

/** GM_setValue — write a value to userscript storage. */
declare function GM_setValue(key: string, value: string): void;
