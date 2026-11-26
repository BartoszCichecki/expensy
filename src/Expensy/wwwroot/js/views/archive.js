// Archive: the list of settled lists, and the page of a single settlement.
import { api } from '../api.js';
import { t, tc } from '../i18n.js';
import { html } from '../html.js';
import { icons } from '../icons.js';
import { money, date, shortDate, expensesCount } from '../format.js';
import { openSheet, closeSheet, confirmSheet, submitForm, handleClick, toast, toastError } from '../ui.js';
import { openExpense } from '../expense-preview.js';
import { expenseList, statsBlock, bindChart, backLink, emptyState } from './common.js';

/** "3 Nov – 26 Nov" — when the settlement's expenses were made. */
const spentRange = (s) =>
  shortDate(s.firstSpentAt) === shortDate(s.lastSpentAt)
    ? shortDate(s.firstSpentAt)
    : `${shortDate(s.firstSpentAt)} – ${shortDate(s.lastSpentAt)}`;

export async function renderArchive(view) {
  const settlements = await api.settlements();
  const grandTotal = settlements.reduce((total, s) => total + s.totalCents, 0);

  view.innerHTML = html`
    <div class="page-head"><h1>${t('archive.title')}</h1></div>
    ${settlements.length === 0 ? emptyState('🗄️', t('archive.emptyState')) : html`
      <p class="muted small page-summary">
        ${t('archive.summary', { count: tc('count.settlements', settlements.length), amount: money(grandTotal) })}
      </p>
      <div class="list">
        ${settlements.map((s) => html`
          <a class="row settle-row" href="#/archive/${s.id}">
            <span class="cat-icon">🧾</span>
            <span class="main">
              <span class="title">${s.name}</span>
              <span class="sub">${t('archive.settledOn', { date: date(s.settledAt) })} · ${expensesCount(s.count)}</span>
            </span>
            <span class="amount num">${money(s.totalCents)}</span>
            <span class="chev">${icons.chevron}</span>
          </a>`)}
      </div>`}`.s;
  view.onclick = null;
}

export async function renderSettlement(view, id, rerender) {
  const [settlement, expenses] = await Promise.all([api.settlement(id), api.expenses(id)]);

  view.innerHTML = html`
    ${backLink('#/archive', t('archive.title'))}
    <div class="page-head">
      <h1 class="settlement-name">${settlement.name}</h1>
      <button class="icon-btn" type="button" data-rename aria-label="${t('archive.rename')}">${icons.edit}</button>
    </div>

    <section class="card hero">
      <div class="label">${t('archive.settledOn', { date: date(settlement.settledAt) })}</div>
      <div class="total num">${money(settlement.totalCents)}</div>
      <div class="meta">${expensesCount(settlement.count)}${settlement.firstSpentAt && ` · ${spentRange(settlement)}`}</div>
      <div class="actions">
        <a class="btn" href="${api.exportUrl(id)}" download>${icons.download} CSV</a>
        <button class="btn" type="button" data-reopen>${icons.undo} ${t('common.restore')}</button>
        <button class="btn danger" type="button" data-delete>${icons.trash} ${t('common.delete')}</button>
      </div>
    </section>

    ${expenses.length > 0 && html`
      <details class="card collapsible">
        <summary>${t('archive.showStats')}</summary>
        <div class="collapsible-body">${statsBlock(expenses, { showTotal: false })}</div>
      </details>
      ${expenseList(expenses)}`}`.s;

  bindChart(view);
  view.onclick = (e) => {
    handleClick(e.target, {
      '[data-expense]': (row) => openExpense(expenses.find((x) => x.id === Number(row.dataset.expense)), rerender),
      '[data-rename]': () => renameSheet(settlement, rerender),
      '[data-reopen]': () => reopen(settlement),
      '[data-delete]': () => remove(settlement),
    });
  };
}

/** Moves the settlement's expenses back to the current list. */
async function reopen(settlement) {
  const confirmed = await confirmSheet({
    title: t('archive.reopenTitle'),
    message: tc('archive.reopenMessage', settlement.count),
    confirmLabel: t('common.restore'),
  });
  if (!confirmed) return;
  try {
    await api.reopenSettlement(settlement.id);
    toast(t('archive.reopened'));
    location.hash = '#/';
  } catch (err) { toastError(err); }
}

/** Deletes the settlement with its expenses and photos, for good. */
async function remove(settlement) {
  const confirmed = await confirmSheet({
    title: t('archive.deleteTitle'),
    message: t('archive.deleteMessage', { name: settlement.name, count: expensesCount(settlement.count) }),
    confirmLabel: t('archive.deleteConfirm'),
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api.deleteSettlement(settlement.id);
    toast(t('archive.deleted'));
    location.hash = '#/archive';
  } catch (err) { toastError(err); }
}

function renameSheet(settlement, rerender) {
  openSheet(t('archive.rename'), html`
    <form>
      <label class="field"><input class="input" name="name" maxlength="100" value="${settlement.name}" required></label>
      <p class="error-text" data-error hidden></p>
      <div class="form-actions"><button class="btn primary" type="submit">${t('common.save')}</button></div>
    </form>`, (el) => {
    const input = el.querySelector('[name=name]');
    input.focus();
    el.querySelector('form').onsubmit = (e) => submitForm(e, async () => {
      await api.renameSettlement(settlement.id, input.value);
      closeSheet();
      rerender();
    });
  });
}
