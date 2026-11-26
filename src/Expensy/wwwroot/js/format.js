// Formatting and parsing of money and dates, in the app's language (see i18n.js `locale`).
import { t, tc, locale } from './i18n.js';

// ---------- Money ----------

let currency = 'PLN';
/** Called once the settings are loaded (state.js). */
export const setCurrency = (code) => (currency = code);

const moneyFormat = () => new Intl.NumberFormat(locale, { style: 'currency', currency });

/** 1250 → "12,50 zł" / "PLN 12.50". */
export const money = (cents) => moneyFormat().format(cents / 100);

/** "zł", "€", "PLN"... — shown next to the amount field. */
export const currencySymbol = () =>
  moneyFormat().formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;

/** Decimal separator of the app language: "," in Polish, "." in English. */
export const decimalSeparator =
  new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';

/**
 * What the user typed → cents, or null if it isn't a positive amount.
 * Accepts "12,50", "12.5", "1 200", "1,200.50", "1.200,50": when both "," and "." appear,
 * the first one is a thousands separator. In English, "1,200" means twelve hundred.
 */
export function parseAmount(text) {
  let clean = String(text).replace(/[\s ']/g, '');
  const lastComma = clean.lastIndexOf(','), lastDot = clean.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const thousands = lastComma < lastDot ? ',' : '.';
    clean = clean.split(thousands).join('');
  } else if (lastComma >= 0 && decimalSeparator === '.' && /^\d{1,3}(,\d{3})+$/.test(clean)) {
    clean = clean.replaceAll(',', '');
  }
  clean = clean.replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const cents = Math.round(parseFloat(clean) * 100);
  return cents > 0 ? cents : null;
}

/** Cents → text for the amount field: 1250 → "12,50" (pl) / "12.50" (en); whole amounts without decimals. */
export const centsToInput = (cents) =>
  (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)).replace('.', decimalSeparator);

export const expensesCount = (n) => tc('count.expenses', n);

/** Exchange rate for display: 4.4838 → "4,4838" (pl). */
export const formatRate = (rate) => new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(rate);

// ---------- Dates ----------
// The API sends ISO-8601 UTC timestamps; everything here shows them in the device's time zone.

const MS_PER_DAY = 864e5;
const dayKeyFormat = new Intl.DateTimeFormat('sv-SE'); // "2026-11-26" — Swedish locale happens to use ISO dates

/** Local calendar day of a timestamp, "yyyy-mm-dd" — used to group expenses by day. */
export const dayKey = (iso) => dayKeyFormat.format(new Date(iso));

/** Whole days between two day keys, inclusive ("2026-11-01" → "2026-11-03" = 3). */
export const daysBetween = (fromKey, toKey) =>
  Math.round((new Date(toKey + 'T12:00:00') - new Date(fromKey + 'T12:00:00')) / MS_PER_DAY) + 1;

/** Heading for a day group: "Today", "Yesterday", "Monday 24 November". */
export function dayLabel(key) {
  if (key === dayKey(new Date().toISOString())) return t('date.today');
  if (key === dayKey(new Date(Date.now() - MS_PER_DAY).toISOString())) return t('date.yesterday');
  const d = new Date(key + 'T12:00:00');
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' });
}

/** "18:42" */
export const time = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
/** "26 Nov 2026" */
export const date = (iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
/** "26 Nov" */
export const shortDate = (iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
/** "Nov 2026" — for a "yyyy-mm" month key */
export const monthLabel = (monthKey) =>
  new Date(monthKey + '-01T12:00:00').toLocaleDateString(locale, { month: 'short', year: 'numeric' });

/** "3 Nov – 26 Nov 2026", or a single date when both are on the same day. */
export const dateRange = (fromIso, toIso) =>
  shortDate(fromIso) === shortDate(toIso) ? date(fromIso) : `${shortDate(fromIso)} – ${date(toIso)}`;

/** Timestamp → value for <input type="datetime-local"> (local time, minutes). */
export function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
