// Settings → Categories: add, edit, reorder, mark as default, archive, then restore or delete.
import { api } from '../api.js';
import { t } from '../i18n.js';
import { html, attr } from '../html.js';
import { icons } from '../icons.js';
import { emojiButton, emojiGrid, bindEmojiPicker } from '../emoji-picker.js';
import { state, activeCategories, archivedCategories, categoryName } from '../state.js';
import { openSheet, closeSheet, confirmSheet, submitForm, handleClick, toast, toastError } from '../ui.js';

const PALETTE = [
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6',
  '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#64748b', '#94a3b8', '#78716c',
];

export function categoriesSection() {
  const active = activeCategories();
  const archived = archivedCategories();
  const isFirst = (i) => i === 0, isLast = (i) => i === active.length - 1;

  return html`
    <section class="card">
      <h2>${t('settings.categories')}</h2>
      ${active.map((c, i) => html`
        <div class="cat-row">
          <span class="cat-icon" style="--c:${c.color}">${c.icon}</span>
          <span class="name">${categoryName(c)}${c.isDefault && html` <span class="badge">${t('category.default')}</span>`}</span>
          <span class="tools">
            <button class="icon-btn" type="button" data-move="${c.id}" data-by="-1" aria-label="${t('settings.moveUp')}" ${attr('disabled', isFirst(i))}>${icons.up}</button>
            <button class="icon-btn" type="button" data-move="${c.id}" data-by="1" aria-label="${t('settings.moveDown')}" ${attr('disabled', isLast(i))}>${icons.down}</button>
            <button class="icon-btn" type="button" data-edit-category="${c.id}" aria-label="${t('common.edit')}">${icons.edit}</button>
          </span>
        </div>`)}
      <button class="btn block section-button" type="button" data-add-category>${t('settings.addCategory')}</button>
      ${archived.length > 0 && html`
        <details class="archived">
          <summary>${t('settings.archived', { n: archived.length })}</summary>
          ${archived.map((c) => html`
            <div class="cat-row">
              <span class="cat-icon" style="--c:${c.color}">${c.icon}</span>
              <span class="name muted">${categoryName(c)}</span>
              <span class="tools">
                <button class="link-btn" type="button" data-restore-category="${c.id}">${t('common.restore')}</button>
                <button class="link-btn danger" type="button" data-delete-category="${c.id}">${t('common.delete')}</button>
              </span>
            </div>`)}
        </details>`}
    </section>`;
}

const byId = (id) => state.categories.find((c) => c.id === Number(id));

/** Handles clicks inside the section; returns true if the click was ours. */
export const onCategoriesClick = (target, rerender) => handleClick(target, {
  '[data-add-category]': () => categoryForm(null, rerender),
  '[data-edit-category]': (b) => categoryForm(byId(b.dataset.editCategory), rerender),
  '[data-restore-category]': (b) => restore(byId(b.dataset.restoreCategory), rerender),
  '[data-delete-category]': (b) => remove(byId(b.dataset.deleteCategory), rerender),
  '[data-move]': (b) => moveCategory(Number(b.dataset.move), Number(b.dataset.by), rerender),
});

async function moveCategory(id, by, rerender) {
  const ids = activeCategories().map((c) => c.id);
  const from = ids.indexOf(id), to = from + by;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  try { await api.reorderCategories(ids); rerender(); } catch (err) { toastError(err); }
}

async function restore(category, rerender) {
  try {
    await api.restoreCategory(category.id);
    toast(t('category.restored'));
    rerender();
  } catch (err) { toastError(err); }
}

/** Deletes an archived category for good; its expenses lose it, and those left with none show as "Other". */
async function remove(category, rerender) {
  const confirmed = await confirmSheet({
    title: t('category.deleteTitle', { name: categoryName(category) }),
    message: t('category.deleteMessage'),
    confirmLabel: t('common.delete'),
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api.deleteCategory(category.id);
    toast(t('category.deleted'));
    rerender();
  } catch (err) { toastError(err); }
}

async function archive(category, rerender) {
  const confirmed = await confirmSheet({
    title: t('category.archiveTitle', { name: categoryName(category) }),
    message: t('category.archiveMessage'),
    confirmLabel: t('category.archive'),
  });
  if (!confirmed) return;
  try {
    await api.archiveCategory(category.id);
    toast(t('category.archived'));
    rerender();
  } catch (err) { toastError(err); }
}

/** Add (category = null) or edit a category. */
function categoryForm(category, rerender) {
  const isNew = !category;
  const shownName = isNew ? '' : categoryName(category);
  let color = category?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const icon = category?.icon ?? '📦';

  openSheet(isNew ? t('category.newTitle') : t('category.editTitle'), html`
    <form>
      <div class="field-row">
        ${emojiButton(icon, color)}
        <label class="field grow">
          <span class="label">${t('category.name')}</span>
          <input class="input" name="name" maxlength="40" value="${shownName}" required>
        </label>
      </div>
      ${emojiGrid(icon)}
      <div class="field">
        <span class="label">${t('category.color')}</span>
        <div class="swatches">
          ${PALETTE.map((c) => html`<button type="button" class="swatch" data-color="${c}" style="--c:${c}" aria-label="${c}"></button>`)}
        </div>
      </div>
      ${!isNew && html`
        <label class="toggle-row">
          <span><b>${t('category.default')}</b><br><span class="muted small">${t('category.defaultHint')}</span></span>
          <input type="checkbox" name="isDefault" ${attr('checked', category.isDefault)}>
        </label>`}
      <p class="error-text" data-error hidden></p>
      <div class="form-actions">
        ${!isNew && html`<button class="btn" type="button" data-archive>${icons.archive} ${t('category.archive')}</button>`}
        <button class="btn primary" type="submit">${icons.check} ${t('common.save')}</button>
      </div>
    </form>`, (el) => {
    const $ = (selector) => el.querySelector(selector);
    const picker = bindEmojiPicker($('form'));
    const paintSwatches = () => {
      el.querySelectorAll('[data-color]').forEach((s) => s.classList.toggle('active', s.dataset.color === color));
      picker.setColor(color);
    };

    $('.swatches').onclick = (e) => {
      const swatch = e.target.closest('[data-color]');
      if (swatch) { color = swatch.dataset.color; paintSwatches(); }
    };
    $('[data-archive]')?.addEventListener('click', () => archive(category, rerender));

    $('form').onsubmit = (e) => submitForm(e, async () => {
      let name = $('[name=name]').value;
      // A built-in category whose translated name wasn't touched keeps its stored name, so it stays translatable.
      if (category?.key && name.trim() === shownName) name = category.name;
      const body = { name, icon: $('[name=icon]').value, color };

      if (isNew) {
        await api.createCategory(body);
      } else {
        await api.updateCategory(category.id, body);
        const makeDefault = $('[name=isDefault]').checked;
        if (makeDefault !== category.isDefault) await api.setDefaultCategory(makeDefault ? category.id : null);
      }
      closeSheet();
      rerender();
    });

    paintSwatches();
    if (isNew) $('[name=name]').focus();
  });
}
