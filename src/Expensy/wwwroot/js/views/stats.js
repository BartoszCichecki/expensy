// Statistics of the user's expenses: the current list, or everything ever recorded.
import { api } from '../api.js';
import { t } from '../i18n.js';
import { html } from '../html.js';
import { statsBlock, bindChart } from './common.js';

let period = 'current'; // 'current' | 'all' — remembered while the app is open

export async function renderStats(view) {
  const expenses = await api.expenses(period === 'all' ? 'all' : undefined);
  const tab = (value, label) =>
    html`<button type="button" data-period="${value}" class="${period === value && 'active'}">${label}</button>`;

  view.innerHTML = html`
    <div class="page-head"><h1>${t('stats.title')}</h1></div>
    <div class="segmented" role="tablist">
      ${tab('current', t('stats.current'))}
      ${tab('all', t('stats.all'))}
    </div>
    ${statsBlock(expenses)}`.s;

  bindChart(view);
  view.onclick = (e) => {
    const chosen = e.target.closest('[data-period]')?.dataset.period;
    if (chosen && chosen !== period) {
      period = chosen;
      renderStats(view);
    }
  };
}
