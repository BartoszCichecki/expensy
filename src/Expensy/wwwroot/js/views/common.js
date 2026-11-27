// Building blocks shared by several screens: the expense list grouped by day, the statistics block,
// the empty state and the back link.
import { t } from '../i18n.js';
import { html, raw } from '../html.js';
import { icons } from '../icons.js';
import { fitText } from '../ui.js';
import { state, categoriesOf, categoryNames, categoryName } from '../state.js';
import { money, dayKey, dayLabel, daysBetween, time, shortDate, monthLabel } from '../format.js';

export const sum = (expenses) => expenses.reduce((total, e) => total + e.amountCents, 0);

/** Groups items into a Map by key(item), keeping the original order. */
function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const k = key(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  }
  return groups;
}

// ---------- Expense list ----------

/** Expenses grouped by day, newest first. Rows carry data-expense="<id>" for click handling. */
export function expenseList(expenses) {
  const days = groupBy(expenses, (e) => dayKey(e.spentAt));
  return html`${[...days].map(([day, items]) => html`
    <section class="day">
      <div class="day-head">
        <span>${dayLabel(day)}</span>
        <span class="num">${money(sum(items))}</span>
      </div>
      <div class="list">${items.map(expenseRow)}</div>
    </section>`)}`;
}

function expenseRow(e) {
  const [first] = categoriesOf(e); // its icon and colour represent the expense
  const names = categoryNames(e);
  // Title: the note, or the categories when there's no note. Subtitle: time · categories · place.
  const details = [time(e.spentAt), e.note ? names : null, e.place].filter(Boolean).join(' · ');
  return html`
    <button class="row" type="button" data-expense="${e.id}">
      <span class="cat-icon" style="--c:${first.color}">${first.icon}</span>
      <span class="main">
        <span class="title">${e.note || names}</span>
        <span class="sub">${e.photoUrl && '📷 '}${details}</span>
      </span>
      <span class="amount num">${money(e.amountCents)}</span>
    </button>`;
}

// ---------- Statistics ----------

/** Summary tiles, per-category breakdown and a spending-over-time chart. */
export function statsBlock(expenses, { showTotal = true } = {}) {
  if (expenses.length === 0) return emptyState('📊', t('stats.noData'));

  const total = sum(expenses);
  const oldestFirst = [...expenses].sort((a, b) => a.spentAt.localeCompare(b.spentAt));
  const days = daysBetween(dayKey(oldestFirst[0].spentAt), dayKey(oldestFirst.at(-1).spentAt));
  const biggest = Math.max(...expenses.map((e) => e.amountCents));
  const tile = (label, value, wide = false) =>
    html`<div class="tile ${wide && 'wide'}"><div class="label">${label}</div><div class="value num">${value}</div></div>`;

  return html`
    <div class="tiles">
      ${showTotal && tile(t('stats.total'), money(total), true)}
      ${tile(t('stats.count'), expenses.length)}
      ${tile(t('stats.average'), money(Math.round(total / expenses.length)))}
      ${tile(t('stats.perDay'), money(Math.round(total / days)))}
      ${tile(t('stats.biggest'), money(biggest))}
    </div>
    ${categoryBreakdown(expenses, total)}
    ${timeChart(oldestFirst)}`;
}

/**
 * One bar per category, biggest first. An expense with several categories counts in full in each of them
 * (like tags), so the bars can add up to more than the total — a note says so when that happens.
 */
function categoryBreakdown(expenses, total) {
  const perCategory = new Map(); // category → { cat, cents, count }
  for (const e of expenses) {
    for (const cat of categoriesOf(e)) {
      const row = perCategory.get(cat) ?? { cat, cents: 0, count: 0 };
      row.cents += e.amountCents;
      row.count++;
      perCategory.set(cat, row);
    }
  }
  const rows = [...perCategory.values()].sort((a, b) => b.cents - a.cents);
  const max = rows[0].cents;
  const overlaps = expenses.some((e) => e.categoryIds.length > 1);

  return html`
    <div class="card">
      <h2>${t('stats.categories')}</h2>
      <div class="bars">
        ${rows.map(({ cat, cents, count }) => html`
          <div class="bar-row" style="--c:${cat.color}">
            <span class="ico">${cat.icon}</span>
            <span class="name">${categoryName(cat)} <span class="muted small">· ${count} · ${Math.round((cents / total) * 100)}%</span></span>
            <span class="val num">${money(cents)}</span>
            <div class="track"><div class="fill" style="width:${percent(cents, max)}%"></div></div>
          </div>`)}
      </div>
      ${overlaps && html`<p class="muted small chart-note">${t('stats.multiCategoryNote')}</p>`}
    </div>`;
}

/** Bar height/width in %, at least 2% so small values stay visible. */
const percent = (value, max) => Math.max(2, (value / max) * 100).toFixed(1);

const CHART_DAYS_LIMIT = 62; // longer periods are shown per month

/** Spending per day (or per month for long periods). Tap a bar to see its value (see bindStats). */
function timeChart(oldestFirst) {
  const firstDay = dayKey(oldestFirst[0].spentAt);
  const lastDay = dayKey(oldestFirst.at(-1).spentAt);
  const span = daysBetween(firstDay, lastDay);
  if (span < 2) return '';

  const byMonth = span > CHART_DAYS_LIMIT;
  const bucketOf = (day) => (byMonth ? day.slice(0, 7) : day); // "2026-11" or "2026-11-26"
  const label = (bucket) => (byMonth ? monthLabel(bucket) : shortDate(bucket + 'T12:00:00'));

  // Every day/month in the range gets a bar, also the ones without spending.
  const buckets = new Map();
  for (const d = new Date(firstDay + 'T12:00:00'); dayKey(d.toISOString()) <= lastDay; d.setDate(d.getDate() + 1)) {
    buckets.set(bucketOf(dayKey(d.toISOString())), 0);
  }
  for (const e of oldestFirst) {
    const bucket = bucketOf(dayKey(e.spentAt));
    buckets.set(bucket, buckets.get(bucket) + e.amountCents);
  }

  const bars = [...buckets];
  const max = Math.max(...bars.map(([, cents]) => cents));

  return html`
    <div class="card">
      <h2>${byMonth ? t('stats.monthly') : t('stats.daily')}</h2>
      <div class="chart-info muted" data-chart-info>${t('stats.tapHint')}</div>
      <div class="chart" data-chart>
        ${bars.map(([bucket, cents]) => html`
          <div class="col ${!cents && 'zero'}" data-info="${label(bucket)}: ${money(cents)}" title="${label(bucket)}: ${money(cents)}">
            <div class="b" style="height:${cents ? percent(cents, max) : 1}%"></div>
          </div>`)}
      </div>
      <div class="chart-axis"><span>${label(bars[0][0])}</span><span>${label(bars.at(-1)[0])}</span></div>
    </div>`;
}

/** Wires up what statsBlock() rendered: big amounts shrink to fit their tile, chart bars show their value when tapped. */
export function bindStats(root) {
  fitText(root.querySelectorAll('.tile .value'));
  root.querySelectorAll('[data-chart]').forEach((chart) => {
    const info = chart.parentElement.querySelector('[data-chart-info]');
    chart.onclick = (e) => {
      const bar = e.target.closest('[data-info]');
      if (!bar) return;
      chart.querySelector('.sel')?.classList.remove('sel');
      bar.classList.add('sel');
      info.textContent = bar.dataset.info;
      info.classList.remove('muted');
    };
  });
}

// ---------- Small pieces ----------

/** "Expensy v1.0 / Made with ❤️ in 🇵🇱 & 🇩🇰" — at the bottom of Settings and of the login screen. */
export const appFooter = (extraClass = '') =>
  html`<p class="muted small app-footer ${extraClass}">Expensy v${state.version}<br>${t('settings.madeWith')}</p>`;

export const backLink = (href, label) => html`<a class="back" href="${href}">${icons.back}${label}</a>`;

/** Big emoji + message; `text` may contain trusted HTML from the translations (e.g. <br>). */
export const emptyState = (emoji, text) => html`<div class="empty"><div class="big">${emoji}</div>${raw(text)}</div>`;
