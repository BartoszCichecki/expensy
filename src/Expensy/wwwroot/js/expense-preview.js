// Read-only preview of an expense, with explicit Edit and Delete buttons.
// Tapping an expense in a list opens this; Edit switches to the form.
import { api } from './api.js';
import { t } from './i18n.js';
import { html } from './html.js';
import { icons } from './icons.js';
import { state, categoriesOf, categoryName } from './state.js';
import { money, date, time } from './format.js';
import { openSheet, confirmSheet, toast, toastError, showPhoto, fitText } from './ui.js';
import { coordinatesText } from './location.js';
import { miniMap, bindMapLinks } from './maps.js';
import { openExpenseForm } from './expense-form.js';

/** `onChange` is called after the expense was edited, deleted or got its place name filled in. */
export function openExpense(expense, onChange) {
  const e = expense;
  const categories = categoriesOf(e);
  const hasLocation = e.latitude != null;

  openSheet(t('form.viewTitle'), html`
    <div class="preview-amount num">${money(e.amountCents)}</div>
    <div class="card details">
      <div class="meta-row">
        <span class="grow chips">
          ${categories.map((c) => html`<span class="chip active static" style="--c:${c.color}"><span>${c.icon}</span>${categoryName(c)}</span>`)}
        </span>
      </div>
      ${e.note && html`<div class="meta-row">${icons.note}<span class="grow wrap">${e.note}</span></div>`}
      <div class="meta-row">${icons.clock}<span class="grow">${date(e.spentAt)}, ${time(e.spentAt)}</span></div>
      ${hasLocation && html`
        <div class="meta-row">
          ${icons.pin}
          <span class="grow" data-place>${e.place ?? coordinatesText(e.latitude, e.longitude)}</span>
          <button type="button" class="link-btn" data-open-map data-lat="${e.latitude}" data-lon="${e.longitude}" data-label="${e.place ?? ''}">${t('location.map')}</button>
        </div>
        ${state.settings.geocoding && html`<div class="detail-block">${miniMap(e.latitude, e.longitude, e.place)}</div>`}`}
      ${e.photoUrl && html`
        <div class="photo-preview"><img src="${e.photoUrl}" alt="${t('form.photo')}" data-photo></div>`}
    </div>
    <div class="form-actions">
      <button type="button" class="btn danger" data-delete>${icons.trash} ${t('common.delete')}</button>
      <button type="button" class="btn primary" data-edit>${icons.edit} ${t('common.edit')}</button>
    </div>`, (el) => {
    bindMapLinks(el.querySelector('.sheet-inner'));
    fitText([el.querySelector('.preview-amount')]); // a big sum gets a smaller font on narrow phones
    el.querySelector('[data-photo]')?.addEventListener('click', (ev) => showPhoto(ev.target.src));
    el.querySelector('[data-edit]').onclick = () => openExpenseForm(e, onChange);
    el.querySelector('[data-delete]').onclick = () => deleteExpense(e, onChange);

    // An older expense without a place name (saved before the lookup finished, or before geocoding was on).
    if (hasLocation && !e.place && state.settings.geocoding) fillInPlace(el, e, onChange);
  });
}

async function deleteExpense(expense, onChange) {
  const confirmed = await confirmSheet({
    title: t('form.deleteTitle'), message: t('form.deleteMessage'), confirmLabel: t('common.delete'), danger: true,
  });
  if (!confirmed) return openExpense(expense, onChange); // back to the preview
  try {
    await api.deleteExpense(expense.id);
    onChange?.();
    toast(t('form.deleted'));
  } catch (err) { toastError(err); }
}

async function fillInPlace(el, expense, onChange) {
  const { place } = await api.fillPlace(expense.id).catch(() => ({ place: null }));
  const placeText = el.querySelector('[data-place]'); // null if the user moved on to the form meanwhile
  if (!place || !placeText) return;
  expense.place = place;
  placeText.textContent = place;
  el.querySelectorAll('[data-open-map]').forEach((link) => (link.dataset.label = place));
  onChange?.(); // refresh the list behind, so its row shows the place too
}
