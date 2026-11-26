// Entering an amount.
//
//  - Phone layout (touch, or narrower than 900 px): our own on-screen keypad with the Save button built in.
//    The system keyboard covers half the form and differs per phone; with the keypad,
//    "amount → category → save" never needs scrolling. Physical keys work on it too.
//  - Wide screens: a normal text field that only lets an amount through.
//
// Both allow up to 9 digits before the decimal separator and 2 after it (the server has the same limit).
import { t } from './i18n.js';
import { html } from './html.js';
import { icons } from './icons.js';
import { decimalSeparator } from './format.js';
import { haptic } from './haptics.js';

const MAX_INTEGER_DIGITS = 9;
const MAX_DECIMALS = 2;

/** Same breakpoint as the sidebar layout in app.css. */
export const usesKeypad = () => matchMedia('(pointer: coarse), (max-width: 899px)').matches;

// ---------- On-screen keypad ----------

/** Keypad markup. It contains the form's submit button (data-save). */
export function keypadHtml() {
  const key = (k, label = k) => html`<button type="button" class="key" data-key="${k}">${label}</button>`;
  return html`
    <div class="keypad" data-keypad>
      ${key('1')}${key('2')}${key('3')}
      <button type="button" class="key" data-key="back" aria-label="${t('keypad.backspace')}">${icons.backspace}</button>
      ${key('4')}${key('5')}${key('6')}
      <button type="submit" class="key save" data-save aria-label="${t('common.save')}">${icons.check}<span>${t('common.save')}</span></button>
      ${key('7')}${key('8')}${key('9')}
      ${key('sep', decimalSeparator)}${key('0')}${key('00')}
    </div>`;
}

/** The amount after pressing key `k` ("0"–"9", "00", "sep" or "back"). */
function pressKey(value, k) {
  if (k === 'back') return value.slice(0, -1);
  if (k === 'sep') return value.includes(decimalSeparator) ? value : (value || '0') + decimalSeparator;

  for (const digit of k) { // "00" = two zeros
    const sepAt = value.indexOf(decimalSeparator);
    const tooManyDecimals = sepAt >= 0 && value.length - sepAt - 1 >= MAX_DECIMALS;
    const tooManyDigits = sepAt < 0 && value.replace(/^0/, '').length >= MAX_INTEGER_DIGITS;
    if (tooManyDecimals || tooManyDigits) break;
    value = value === '0' ? digit : value + digit; // no leading zeros
  }
  return value;
}

/**
 * Connects the keypad inside `sheet` (the dialog) to the read-only amount `input`.
 * While another field (note, date) has the system keyboard open, the keypad steps aside.
 */
export function bindKeypad(sheet, input) {
  const pad = sheet.querySelector('[data-keypad]');
  // Fields that open the system keyboard (the currency picker and the hidden haptics switch don't).
  const isOtherField = (el) => el.matches('input:not([name=amount]):not([switch]), textarea, select:not([name=currency])');
  const setValue = (value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true })); // e.g. the currency conversion listens to this
  };
  const press = (k) => {
    setValue(pressKey(input.value, k));
    haptic(sheet);
  };

  input.readOnly = true;
  input.setAttribute('inputmode', 'none');
  input.addEventListener('click', () => document.activeElement?.blur()); // closes another field's keyboard

  pad.addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]');
    if (key) press(key.dataset.key);
  });
  pad.addEventListener('mousedown', (e) => e.preventDefault()); // keys don't steal focus

  // Long-press on backspace clears the whole amount.
  let holdTimer;
  pad.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('[data-key="back"]')) return;
    holdTimer = setTimeout(() => { setValue(''); haptic(sheet, 20); }, 500);
  });
  for (const type of ['pointerup', 'pointerleave']) pad.addEventListener(type, () => clearTimeout(holdTimer));

  // The listeners below go on the shared dialog, so they're removed when this form closes.
  const off = new AbortController();
  sheet.addEventListener('close', () => off.abort(), { once: true });

  // Physical keyboard: digits, "," / ".", Backspace and Enter (save).
  sheet.addEventListener('keydown', (e) => {
    if (isOtherField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === ',' || e.key === '.') press('sep');
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') sheet.querySelector('form')?.requestSubmit();
    else return;
    e.preventDefault();
  }, { signal: off.signal });

  sheet.addEventListener('focusin', (e) => {
    if (isOtherField(e.target)) pad.classList.add('away');
  }, { signal: off.signal });
  sheet.addEventListener('focusout', () => setTimeout(() => {
    const focused = document.activeElement;
    if (!sheet.contains(focused) || focused === document.body) pad.classList.remove('away');
  }, 50), { signal: off.signal });
}

// ---------- Plain text field (wide screens) ----------

const PARTIAL_AMOUNT = new RegExp(`^\\d{0,${MAX_INTEGER_DIGITS}}([.,]\\d{0,${MAX_DECIMALS}})?$`);

/**
 * Cleans pasted text: "1 234,50 zł" → "1234,50", "1,234.50" → "1234.50", "1,234" → "1234".
 * The last separator is the decimal one — unless more than 2 digits follow it, then it's a thousands separator.
 */
function sanitizeAmount(text) {
  let v = text.replace(/[^\d.,]/g, '');
  const last = Math.max(v.lastIndexOf(','), v.lastIndexOf('.'));
  const isDecimal = last >= 0 && v.length - last - 1 <= MAX_DECIMALS;
  const digitsOnly = (s) => s.replace(/[.,]/g, '');
  v = isDecimal ? digitsOnly(v.slice(0, last)) + v[last] + digitsOnly(v.slice(last + 1)) : digitsOnly(v);

  const [whole, decimals] = v.split(/[.,]/);
  return whole.slice(0, MAX_INTEGER_DIGITS) + (decimals === undefined ? '' : v[whole.length] + decimals.slice(0, MAX_DECIMALS));
}

/**
 * Lets only an amount into a normal <input>: digits and one decimal separator, max 2 decimals.
 * Invalid keystrokes are ignored; pasted text (and dictation, autocomplete...) is cleaned up instead of rejected.
 */
export function restrictAmountInput(input) {
  input.addEventListener('beforeinput', (e) => {
    const isSingleChar = typeof e.data === 'string' && e.data.length === 1;
    if (!e.inputType.startsWith('insert') || !isSingleChar) return; // multi-character inserts: see 'input' below
    const { selectionStart: start, selectionEnd: end, value } = input;
    const next = value.slice(0, start ?? value.length) + e.data + value.slice(end ?? value.length);
    if (!PARTIAL_AMOUNT.test(next)) e.preventDefault();
  });
  input.addEventListener('input', () => {
    if (!PARTIAL_AMOUNT.test(input.value)) input.value = sanitizeAmount(input.value);
  });
}
