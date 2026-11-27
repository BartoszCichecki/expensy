// Add / edit expense form (full screen on phones, a dialog on bigger screens).
import { api } from './api.js';
import { t } from './i18n.js';
import { html } from './html.js';
import { icons } from './icons.js';
import { state, activeCategories, defaultCategory, categoryName } from './state.js';
import { parseAmount, centsToInput, currencySymbol, toLocalInput, money, shortDate, formatRate } from './format.js';
import { openSheet, closeSheet, submitForm, toast, showPhoto } from './ui.js';
import { usesKeypad, keypadHtml, bindKeypad, restrictAmountInput } from './amount-input.js';
import { getLocation, coordinatesText } from './location.js';
import { shrinkImage, MAX_PHOTO_BYTES } from './photos.js';
import { bindMapLinks } from './maps.js';
import { selectableCurrencies, rateToBase, convert } from './exchange.js';

/**
 * Opens the form. Pass an expense to edit it, or nothing to add a new one.
 * `onChange` is called after a successful save.
 */
export function openExpenseForm(expense, onChange) {
  const isNew = !expense;
  const keypad = usesKeypad();

  // Everything the user picks besides the plain inputs.
  const form = {
    categoryIds: new Set(isNew ? [defaultCategory()?.id].filter(Boolean) : expense.categoryIds),
    location: isNew ? { status: 'pending' } : locationOf(expense), // status: pending | ok | error | off
    photo: { existingUrl: expense?.photoUrl ?? null, newBlob: null, newUrl: null, removed: false },
  };

  // Archived categories stay visible only when the edited expense already uses them.
  const categories = [
    ...activeCategories(),
    ...state.categories.filter((c) => c.archived && form.categoryIds.has(c.id)),
  ];

  const el = openSheet(isNew ? t('form.newTitle') : t('form.editTitle'), html`
    <form novalidate>
      <!-- Everything above the keypad; on a full-screen phone form this part scrolls if it doesn't fit -->
      <div class="form-scroll">
        <div class="amount-field">
          <span class="spacer"></span>
          <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="${t('form.amount')}"
                 value="${isNew ? '' : centsToInput(expense.amountCents)}">
          <span class="cur" data-currency>${currencySymbol()}</span>
        </div>
        <div class="conversion" data-conversion hidden></div>

        <div class="field">
          <div class="chips chip-rows" data-categories>
            ${twoRows(categories).map((row) => html`
              <div class="chip-row">
                ${row.map((c) => html`
                  <button type="button" class="chip" data-cat="${c.id}" style="--c:${c.color}">
                    <span>${c.icon}</span>${categoryName(c)}
                  </button>`)}
              </div>`)}
          </div>
        </div>

        <label class="field">
          <textarea class="input note-input" name="note" rows="1" maxlength="500" placeholder="${t('form.note')}">${expense?.note ?? ''}</textarea>
        </label>

        <div class="card details">
          <div class="meta-row">
            ${icons.clock}
            <input type="datetime-local" name="spentAt" aria-label="${t('form.dateTime')}"
                   value="${toLocalInput(expense?.spentAt ?? new Date().toISOString())}">
          </div>
          <div class="meta-row" data-location></div>
          <div class="meta-row">
            ${icons.camera}
            <span class="grow" data-photo-label></span>
            <span data-photo-preview></span>
            <label class="link-btn">
              <span data-photo-action></span>
              <input type="file" accept="image/*" name="photo" hidden>
            </label>
          </div>
        </div>
      </div>

      <!-- no <p data-error>: errors show as a toast, so nothing moves the keypad -->

      ${keypad ? keypadHtml() : html`
        <div class="form-actions">
          <button type="submit" class="btn primary" data-save>${icons.check} ${t('common.save')}</button>
        </div>`}
    </form>`, null, { fullScreen: true });

  const $ = (selector) => el.querySelector(selector);
  const amountInput = $('[name=amount]');
  if (keypad) bindKeypad(el, amountInput);
  else { restrictAmountInput(amountInput); amountInput.focus(); } // wide screens: type the amount straight away
  bindMapLinks($('.sheet-inner'));

  // The note grows with its text (up to a few lines, see .note-input), so longer notes stay readable.
  const note = $('[name=note]');
  const growNote = () => {
    note.style.height = 'auto';
    note.style.height = `${note.scrollHeight + note.offsetHeight - note.clientHeight}px`; // + the borders
  };
  note.addEventListener('input', growNote);
  growNote();

  // ----- categories (any number; tap to select, tap again to unselect) -----

  const renderCategories = () => el.querySelectorAll('[data-cat]').forEach((chip) =>
    chip.classList.toggle('active', form.categoryIds.has(Number(chip.dataset.cat))));

  $('[data-categories]').onclick = (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    const id = Number(chip.dataset.cat);
    if (form.categoryIds.has(id)) form.categoryIds.delete(id); else form.categoryIds.add(id);
    renderCategories();
  };

  // ----- location -----

  let locateRun = 0; // ignores answers that arrive after the user skipped, retried or closed the form

  const renderLocation = () => {
    const row = $('[data-location]');
    if (!row) return; // the sheet was closed meanwhile
    const l = form.location;
    const [text, actions] = {
      pending: () => [t('location.pending'), html`<button type="button" class="link-btn" data-loc="off">${t('location.skip')}</button>`],
      ok: () => [l.place ?? coordinatesText(l.lat, l.lon, l.accuracy), html`
        <button type="button" class="link-btn" data-open-map data-lat="${l.lat}" data-lon="${l.lon}" data-label="${l.place ?? ''}">${t('location.map')}</button>
        <button type="button" class="link-btn danger" data-loc="off" aria-label="${t('location.removeLabel')}">${t('location.remove')}</button>`],
      error: () => [l.message, html`<button type="button" class="link-btn" data-loc="retry">${t('location.retry')}</button>`],
      off: () => [t('location.none'), html`<button type="button" class="link-btn" data-loc="retry">${t('location.add')}</button>`],
    }[l.status]();
    row.innerHTML = html`${icons.pin}<span class="grow ${l.status === 'ok' ? '' : 'muted'}">${text}</span>${actions}`.s;
  };

  const locate = async () => {
    const run = ++locateRun;
    form.location = { status: 'pending' };
    renderLocation();
    try {
      const position = await getLocation();
      if (run !== locateRun) return;
      form.location = { status: 'ok', ...position, place: null };
      renderLocation();
      if (state.settings.geocoding) {
        // Nice to have: if the user saves before this arrives, the server fills the name in later.
        const { place } = await api.geocode(position.lat, position.lon).catch(() => ({ place: null }));
        if (run === locateRun && place) { form.location.place = place; renderLocation(); }
      }
    } catch (err) {
      if (run === locateRun) { form.location = { status: 'error', message: err.message }; renderLocation(); }
    }
  };

  $('[data-location]').onclick = (e) => {
    const action = e.target.closest('[data-loc]')?.dataset.loc;
    if (action === 'off') { locateRun++; form.location = { status: 'off' }; renderLocation(); }
    if (action === 'retry') locate();
  };

  // ----- photo -----

  const renderPhoto = () => {
    const url = form.photo.newUrl ?? form.photo.existingUrl;
    $('[data-photo-action]').textContent = url ? t('form.change') : t('form.add');
    $('[data-photo-label]').textContent = url ? t('form.photo') : t('form.photoOptional');
    // A small thumbnail in the row keeps the form on one screen; tapping it shows the photo full size.
    $('[data-photo-preview]').innerHTML = url ? html`
      <span class="photo-thumb">
        <img src="${url}" alt="${t('form.photoPreview')}">
        <button type="button" class="remove" data-photo-remove aria-label="${t('form.removePhoto')}">${icons.close}</button>
      </span>`.s : '';
  };

  const setNewPhoto = (blob) => {
    if (form.photo.newUrl) URL.revokeObjectURL(form.photo.newUrl);
    form.photo.newBlob = blob;
    form.photo.newUrl = blob ? URL.createObjectURL(blob) : null;
  };

  $('[name=photo]').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const photo = await shrinkImage(file);
    if (photo.size > MAX_PHOTO_BYTES) { e.target.value = ''; return toast(t('form.photoTooLarge')); }
    setNewPhoto(photo);
    renderPhoto();
  };

  $('[data-photo-preview]').onclick = (e) => {
    if (e.target.closest('[data-photo-remove]')) {
      setNewPhoto(null);
      form.photo.existingUrl = null;
      form.photo.removed = true;
      renderPhoto();
    } else if (e.target.tagName === 'IMG') {
      showPhoto(e.target.src);
    }
  };

  // ----- currency: entering the amount in another currency converts it to the app's currency -----

  const base = state.settings.currency;
  let currency = base;
  let conversionRun = 0;
  const rateDay = () => $('[name=spentAt]').value.slice(0, 10) || new Date().toISOString().slice(0, 10);

  const renderConversion = async () => {
    const line = $('[data-conversion]');
    const run = ++conversionRun;
    if (!line || currency === base) { if (line) line.hidden = true; return; }

    let text;
    try {
      const { rate, date } = await rateToBase(currency, rateDay());
      const cents = parseAmount(amountInput.value);
      const rateText = t('form.rate', { from: currency, rate: formatRate(rate), to: base, date: shortDate(date) });
      text = cents ? `≈ ${money(convert(cents, rate))} · ${rateText}` : rateText;
    } catch {
      text = t('form.rateUnavailable', { currency: base });
    }
    if (run !== conversionRun) return; // a newer update is on its way
    line.textContent = text;
    line.hidden = false;
  };

  // Offer a currency picker only if rates are available (see exchange.js).
  selectableCurrencies().then((codes) => {
    const label = $('[data-currency]');
    if (!label || codes.length < 2) return;
    label.innerHTML = html`
      <select name="currency" aria-label="${t('form.currency')}">
        ${codes.map((code) => html`<option value="${code}">${code === base ? currencySymbol() : code}</option>`)}
      </select>`.s;
    $('[name=currency]').onchange = (e) => { currency = e.target.value; renderConversion(); };
  });
  amountInput.addEventListener('input', renderConversion);
  $('[name=spentAt]').addEventListener('change', renderConversion);

  // ----- save -----

  const readPayload = () => {
    const spentAt = $('[name=spentAt]').value;
    const loc = form.location.status === 'ok' ? form.location : null;
    return {
      amountCents: parseAmount(amountInput.value),
      categoryIds: [...form.categoryIds],
      note: $('[name=note]').value.trim() || null,
      spentAt: spentAt ? new Date(spentAt).toISOString() : null,
      latitude: loc?.lat ?? null,
      longitude: loc?.lon ?? null,
      accuracy: loc?.accuracy ?? null,
      place: loc?.place ?? null,
    };
  };

  const savePhoto = async (saved) => {
    try {
      if (form.photo.newBlob) await api.uploadPhoto(saved.id, form.photo.newBlob, form.photo.newBlob.name ?? 'photo.jpg');
      else if (form.photo.removed && expense?.photo) await api.deletePhoto(saved.id);
    } catch (err) {
      toast(t('form.photoFailed', { error: err.message })); // the expense itself is saved
    }
  };

  $('form').onsubmit = (e) => submitForm(e, async () => {
    const payload = readPayload();
    if (!payload.amountCents) throw new Error(t('form.invalidAmount'));
    if (currency !== base) {
      const { rate } = await rateToBase(currency, rateDay()).catch(() => {
        throw new Error(t('form.rateUnavailable', { currency: base }));
      });
      payload.amountCents = convert(payload.amountCents, rate); // only the converted amount is stored
    }

    const saved = isNew ? await api.createExpense(payload) : await api.updateExpense(expense.id, payload);
    await savePhoto(saved);
    closeSheet();
    onChange?.();
    if (isNew) toast(t('form.added'));
  });

  el.addEventListener('close', () => { locateRun++; setNewPhoto(null); }, { once: true });

  // ----- initial state -----

  renderCategories();
  renderPhoto();
  if (isNew) locate(); else renderLocation();
  if (isNew && !keypad) amountInput.focus();
}

/** The form's location state for an existing expense. */
const locationOf = (e) => (e.latitude != null
  ? { status: 'ok', lat: e.latitude, lon: e.longitude, accuracy: e.accuracy, place: e.place }
  : { status: 'off' });

/**
 * Splits the categories into two rows for the sideways-scrolling picker: 1st, 3rd, 5th… on top, 2nd, 4th… below,
 * so the first categories in the list are the ones visible without scrolling.
 */
function twoRows(categories) {
  return [categories.filter((_, i) => i % 2 === 0), categories.filter((_, i) => i % 2 === 1)];
}
