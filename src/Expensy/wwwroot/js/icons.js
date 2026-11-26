// Inline SVG icons (stroke style, 24×24), ready to drop into html`` templates: html`${icons.check} Save`.
import { raw } from './html.js';

const icon = (paths) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`);

export const icons = {
  // navigation
  back: icon('<path d="m15 18-6-6 6-6"/>'),
  chevron: icon('<path d="m9 18 6-6-6-6"/>'),
  up: icon('<path d="m18 15-6-6-6 6"/>'),
  down: icon('<path d="m6 9 6 6 6-6"/>'),
  close: icon('<path d="M18 6 6 18M6 6l12 12"/>'),

  // actions
  check: icon('<path d="M20 6 9 17l-5-5"/>'),
  edit: icon('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: icon('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  archive: icon('<path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4"/>'),
  undo: icon('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
  download: icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  backspace: icon('<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM18 9l-6 6M12 9l6 6"/>'),

  // expense details
  clock: icon('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  pin: icon('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
  camera: icon('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>'),
  note: icon('<path d="M4 6h16M4 12h16M4 18h10"/>'),

  // account
  key: icon('<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>'),
  logout: icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  userOff: icon('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 9.5-4.9M17 15l5 5M22 15l-5 5"/>'),

  // filled map pin for the mini map (not stroke style)
  mapPin: raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" fill="currentColor" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="2.6" fill="#fff" stroke="none"/></svg>'),
};
