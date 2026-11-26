// Home screen: total of the current list, expenses grouped by day, and "Settle up".
import { api } from '../api.js';
import { t, tc } from '../i18n.js';
import { html } from '../html.js';
import { icons } from '../icons.js';
import { money, date, dateRange, expensesCount } from '../format.js';
import { openSheet, closeSheet, submitForm, handleClick, toast, toastError } from '../ui.js';
import { openExpense } from '../expense-preview.js';
import { expenseList, sum, emptyState } from './common.js';

export async function renderList(view, rerender) {
  const expenses = await api.expenses(); // newest first
  const oldest = expenses.at(-1);

  view.innerHTML = html`
    <div class="page-head"><h1 class="app-title"><img src="/icons/icon-192.png" alt="">Expensy</h1></div>

    <section class="card hero">
      <div class="label">${t('list.current')}</div>
      <div class="total num">${money(sum(expenses))}</div>
      <div class="meta">
        ${oldest
          ? t('list.since', { count: expensesCount(expenses.length), date: date(oldest.spentAt) })
          : t('list.noExpenses')}
      </div>
      ${oldest && html`
        <div class="actions">
          <button class="btn" type="button" data-settle>${icons.check} ${t('list.settle')}</button>
        </div>`}
    </section>

    ${expenses.length ? expenseList(expenses) : emptyState('🧾', t('list.emptyState'))}`.s;

  view.onclick = (e) => {
    handleClick(e.target, {
      '[data-expense]': (row) => openExpense(expenses.find((x) => x.id === Number(row.dataset.expense)), rerender),
      '[data-settle]': () => openSettleSheet(expenses, rerender),
    });
  };
}

/** "Settle up": moves the whole current list to the archive, with an Undo toast. */
function openSettleSheet(expenses, rerender) {
  const suggestedName = dateRange(expenses.at(-1).spentAt, expenses[0].spentAt);

  openSheet(t('settle.title'), html`
    <form>
      <p>${tc('settle.summary', expenses.length, { amount: money(sum(expenses)) })}</p>
      <label class="field">
        <span class="label">${t('settle.name')}</span>
        <input class="input" name="name" maxlength="100" value="${suggestedName}">
      </label>
      <p class="error-text" data-error hidden></p>
      <div class="form-actions">
        <button class="btn" type="button" data-cancel>${t('common.cancel')}</button>
        <button class="btn primary" type="submit">${icons.check} ${t('settle.confirm')}</button>
      </div>
    </form>`, (el) => {
    el.querySelector('[data-cancel]').onclick = closeSheet;
    el.querySelector('form').onsubmit = (e) => submitForm(e, async () => {
      const settlement = await api.settle(el.querySelector('[name=name]').value);
      closeSheet();
      rerender();
      toast(t('settle.done'), {
        label: t('settle.undo'),
        run: () => api.reopenSettlement(settlement.id).then(rerender, toastError),
      });
    });
  });
}
