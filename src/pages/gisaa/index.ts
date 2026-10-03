import { initGisaa } from './gisaa.js';

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGisaa, { once: true });
else initGisaa();
