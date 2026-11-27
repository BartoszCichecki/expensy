// Shared UI pieces: the bottom sheet (all forms live in it), confirm dialog, form submit helper,
// full-screen photo viewer and toast messages.
import { t } from './i18n.js';
import { html, raw } from './html.js';
import { icons } from './icons.js';

// ---------- Dialogs: opening and closing with an animation ----------

const closeRuns = new WeakMap(); // dialog → number of its latest close, so a reopened dialog isn't closed by an older one

/** Opens a modal dialog. The focus goes to the dialog itself (not its first button, the ×), and Esc closes it animated. */
export function showDialog(d) {
  closeRuns.set(d, (closeRuns.get(d) ?? 0) + 1); // cancels a close still animating
  d.classList.remove('closing');
  d.tabIndex = -1;
  d.oncancel = (e) => { e.preventDefault(); closeDialog(d); }; // Esc
  if (!d.open) d.showModal();
  d.focus({ preventScroll: true });
}

/** Plays the dialog's closing animation (.closing in app.css), then closes it — unless it was opened again meanwhile. */
export async function closeDialog(d) {
  if (!d.open || d.classList.contains('closing')) return;
  const run = (closeRuns.get(d) ?? 0) + 1;
  closeRuns.set(d, run);
  d.classList.add('closing');
  await Promise.allSettled(d.getAnimations().map((a) => a.finished)); // none with reduced motion
  if (closeRuns.get(d) !== run) return;
  d.classList.remove('closing');
  d.close();
}

// ---------- Bottom sheet ----------
// There is one <dialog id="sheet"> in index.html; opening a sheet replaces its content.

const sheet = () => document.getElementById('sheet');

/**
 * Shows `content` in the bottom sheet under a title and returns the dialog element.
 * `setup(el)` runs right after rendering, to wire up events. ✕, Esc and tapping outside close it.
 */
export function openSheet(title, content, setup, { fullScreen = false } = {}) {
  const el = sheet();
  el.classList.toggle('full', fullScreen); // phones: the whole screen instead of a bottom sheet
  el.innerHTML = html`
    <div class="sheet-inner">
      <div class="grabber"></div>
      <div class="sheet-head">
        <h2>${title}</h2>
        <button class="icon-btn" type="button" data-close aria-label="${t('common.close')}">${icons.close}</button>
      </div>
      ${content}
    </div>`.s;
  el.querySelector('[data-close]').onclick = closeSheet;
  el.onclick = (e) => { if (e.target === el) closeSheet(); }; // tap on the backdrop
  showDialog(el);
  setup?.(el);
  return el;
}

/** Closes the sheet (animated). Resolves when it's closed, or when another sheet has opened in its place. */
export async function closeSheet() {
  const el = sheet();
  await closeDialog(el);
  if (!el.open) el.innerHTML = '';
}

/** Asks a yes/no question in the sheet. Resolves true (confirmed) or false (cancelled / closed). */
export function confirmSheet({ title, message, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    let confirmed = false;
    const el = openSheet(title, html`
      <p>${message}</p>
      <div class="form-actions">
        <button class="btn" type="button" data-no>${t('common.cancel')}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-yes>${confirmLabel}</button>
      </div>`, (el) => {
      el.querySelector('[data-yes]').onclick = () => { confirmed = true; closeSheet(); };
      el.querySelector('[data-no]').onclick = closeSheet;
    });
    el.addEventListener('close', () => resolve(confirmed), { once: true });
  });
}

// ---------- Forms ----------

/** Shows a message in the form's <p data-error> (or hides it when `message` is empty). */
function showFormError(form, message) {
  const p = form.querySelector('[data-error]');
  if (!p) { if (message) toast(message, null, { error: true }); return; }
  p.textContent = message ?? '';
  p.hidden = !message;
}

/**
 * Handles a form submit: disables the submit button while `action` runs, and shows its error in the form's
 * <p data-error> — or, in a form without one, as an error toast. Returns true if the action succeeded.
 *
 *   form.onsubmit = (e) => submitForm(e, async () => { await api.something(); closeSheet(); });
 */
export async function submitForm(event, action) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('[type=submit]');
  if (button?.disabled) return false; // already saving
  showFormError(form, '');
  if (button) button.disabled = true;
  try {
    await action();
    return true;
  } catch (err) {
    showFormError(form, err.message);
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

/**
 * A simple form in the sheet: a list of text/password fields and a submit button.
 *
 *   formSheet({
 *     title, intro?, submitLabel,
 *     fields: [{ name, label, type = 'password', autocomplete, value?, placeholder?, maxlength = 64,
 *                optional?, verbatim?, sameAs? }],
 *       // verbatim: no auto-capitalisation/correction (usernames); sameAs: 'password' → must match that field
 *     onSubmit: async (values) => { ... },  // throw to show an error; the sheet closes on success
 *   })
 */
export function formSheet({ title, intro, fields, submitLabel, onSubmit }) {
  openSheet(title, html`
    <form novalidate>
      ${intro && html`<p class="muted small">${intro}</p>`}
      ${fields.map((f) => html`
        <label class="field">
          <span class="label">${f.label}</span>
          <input class="input" name="${f.name}" type="${f.type ?? 'password'}" autocomplete="${f.autocomplete}"
                 maxlength="${f.maxlength ?? 64}" value="${f.value ?? ''}" placeholder="${f.placeholder ?? ''}"
                 ${f.verbatim && raw('autocapitalize="none" autocorrect="off" spellcheck="false"')}
                 ${!f.optional && raw('required')}>
        </label>`)}
      <p class="error-text" data-error hidden></p>
      <div class="form-actions">
        <button class="btn" type="button" data-cancel>${t('common.cancel')}</button>
        <button class="btn primary" type="submit">${icons.check} ${submitLabel}</button>
      </div>
    </form>`, (el) => {
    el.querySelector('[data-cancel]').onclick = closeSheet;
    el.querySelector('input').focus();
    el.querySelector('form').onsubmit = (e) => submitForm(e, async () => {
      const values = Object.fromEntries(new FormData(e.target));
      for (const f of fields) {
        if (f.sameAs && values[f.name] !== values[f.sameAs]) throw new Error(t('login.passwordsDiffer'));
      }
      await onSubmit(values);
      closeSheet();
    });
  });
}

// ---------- Drop-downs ----------

/**
 * Makes a <select> as wide as its selected option (browsers size it to the longest one), now and after every change.
 * CSS `field-sizing: content` would do this, but Safari doesn't support it yet.
 */
export function fitSelectToValue(select) {
  const fit = () => {
    const style = getComputedStyle(select);
    const context = (fitSelectToValue.canvas ??= document.createElement('canvas')).getContext('2d');
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = select.options[select.selectedIndex]?.text ?? '';
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    select.style.width = `${Math.ceil(context.measureText(text).width + padding)}px`;
  };
  fit();
  select.addEventListener('change', fit);
}

// ---------- Clicks ----------

/**
 * Event delegation: runs the handler whose selector matches the clicked element (or one of its parents),
 * and returns true if one did. The matched element is passed to the handler.
 *
 *   view.onclick = (e) => { handleClick(e.target, { '[data-edit]': (b) => edit(b.dataset.edit), '[data-delete]': remove }); };
 *
 * Note the braces: don't *return* the result from an onclick handler — returning false there cancels the click's
 * default action (links, <details>, downloads stop working).
 */
export function handleClick(target, handlers) {
  for (const [selector, handler] of Object.entries(handlers)) {
    const element = target.closest(selector);
    if (element) {
      handler(element);
      return true;
    }
  }
  return false;
}

// ---------- Photo viewer ----------

/** Full-screen photo; tap anywhere to close. */
export function showPhoto(src) {
  const viewer = document.createElement('dialog');
  viewer.className = 'viewer';
  viewer.innerHTML = html`
    <img src="${src}" alt="${t('form.photo')}">
    <button class="icon-btn" aria-label="${t('common.close')}">${icons.close}</button>`.s;
  viewer.onclick = () => closeDialog(viewer);
  viewer.addEventListener('close', () => viewer.remove());
  document.body.append(viewer);
  showDialog(viewer);
}

// ---------- Toast ----------

let toastTimer;
let toastRun = 0; // which toast is the current one; an older one's fade-out mustn't hide a newer one

/**
 * Short message at the bottom of the screen (errors: red, at the top). `action` adds a button,
 * e.g. { label: 'Undo', run() {...} }. It's a popover, so it shows above an open dialog too.
 */
export function toast(message, action, { error = false } = {}) {
  const el = document.getElementById('toast');
  const run = ++toastRun;
  el.innerHTML = html`<span>${message}</span>${action && html`<button type="button">${action.label}</button>`}`.s;
  el.classList.toggle('error', error);
  el.classList.remove('leaving');
  if (action) el.querySelector('button').onclick = () => { fadeOut(el, run); action.run(); };
  // Showing it again puts it above a dialog that opened since, and replays the slide-in animation.
  if (el.matches(':popover-open')) el.hidePopover();
  el.showPopover();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => fadeOut(el, run), action ? 6000 : 3000);
}

/** Fades the toast out (app.css: .leaving), then hides it — unless a newer toast has replaced it meanwhile. */
async function fadeOut(el, run) {
  el.classList.add('leaving');
  await Promise.all(el.getAnimations().map((a) => a.finished)).catch(() => {}); // none with reduced motion
  if (run === toastRun && el.matches(':popover-open')) el.hidePopover();
}

export const toastError = (err) => toast(err?.message ?? t('common.somethingWrong'), null, { error: true });

// ---------- Text that must fit ----------

const MIN_FONT_PX = 12;
const fittedWidths = new WeakMap(); // element → the width it was last fitted at

/** Shrinks the text of each element (one line, `white-space: nowrap`) until it fits; again whenever its width changes. */
export function fitText(elements) {
  for (const el of elements) fitObserver.observe(el);
}

// Fires when an element appears (e.g. inside a <details> that opens), is resized (rotation) or is removed.
const fitObserver = new ResizeObserver((entries) => {
  for (const { target, contentRect } of entries) {
    if (!target.isConnected) { fitObserver.unobserve(target); continue; }
    if (contentRect.width === 0 || fittedWidths.get(target) === contentRect.width) continue; // hidden, or just taller
    fittedWidths.set(target, contentRect.width);
    target.style.fontSize = ''; // back to the size from the CSS, then shrink 1 px at a time
    let size = parseFloat(getComputedStyle(target).fontSize);
    while (target.scrollWidth > target.clientWidth && size > MIN_FONT_PX) target.style.fontSize = `${--size}px`;
  }
});

