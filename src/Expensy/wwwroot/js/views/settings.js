// Settings screen: account, preferences, categories and users (both admin only), export, install hint.
// The bigger sections live in account.js, categories.js and users.js.
// Categories and the currency are shared by everyone, so only the admin can change them.
import { api } from '../api.js';
import { t, LANGUAGES, getLanguagePreference, setLanguagePreference } from '../i18n.js';
import { html, raw, attr } from '../html.js';
import { icons } from '../icons.js';
import { state, loadCategories, loadSettings, loadUsers } from '../state.js';
import { toast, toastError, fitSelectToValue } from '../ui.js';
import { isApplePlatform, getMapsPreference, setMapsPreference } from '../maps.js';
import { accountSection, onAccountClick } from './account.js';
import { categoriesSection, onCategoriesClick } from './categories.js';
import { usersSection, onUsersClick } from './users.js';
import { appFooter } from './common.js';

export async function renderSettings(view) {
  await Promise.all([loadCategories(), state.user.isAdmin && loadUsers()]);
  const rerender = () => renderSettings(view);
  const isInstalled = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  view.innerHTML = html`
    <div class="page-head"><h1>${t('settings.title')}</h1></div>
    ${accountSection()}
    ${preferencesSection()}
    ${state.user.isAdmin && categoriesSection()}
    ${state.user.isAdmin && usersSection()}
    <section class="card">
      <h2>${t('settings.data')}</h2>
      <a class="btn block" href="${api.exportUrl('all')}" download>${icons.download} ${t('settings.exportAll')}</a>
    </section>
    ${!isInstalled && html`
      <section class="card">
        <h2>${t('settings.install')}</h2>
        <p class="small">${raw(t('settings.installHelp'))}</p>
      </section>`}
    ${appFooter()}`.s;

  bindPreferences(view);
  view.onclick = (e) => {
    onAccountClick(e.target, rerender) || onCategoriesClick(e.target, rerender) || onUsersClick(e.target, rerender);
  };
}

// ---------- Preferences: language (per device), maps app (per device, Apple only), currency (shared) ----------

function preferencesSection() {
  const select = (name, label, options, current) => html`
    <div class="setting">
      <span>${label}</span>
      <select class="input" name="${name}">
        ${options.map(([value, text]) => html`<option value="${value}" ${attr('selected', value === current)}>${text}</option>`)}
      </select>
    </div>`;

  return html`
    <section class="card">
      ${select('language', t('settings.language'),
        [['auto', t('settings.languageAuto')], ...Object.entries(LANGUAGES).map(([code, l]) => [code, l.name])],
        getLanguagePreference())}
      ${isApplePlatform() && select('mapsApp', t('maps.setting'),
        ['ask', 'apple', 'google'].map((app) => [app, t(`maps.${app}`)]),
        getMapsPreference())}
      ${state.user.isAdmin
        ? select('currency', t('settings.currency'), state.settings.currencies.map((code) => [code, code]), state.settings.currency)
        : html`<div class="setting"><span>${t('settings.currency')}</span><span class="muted">${state.settings.currency}</span></div>`}
    </section>`;
}

function bindPreferences(view) {
  view.querySelectorAll('select').forEach(fitSelectToValue);

  view.querySelector('[name=language]').onchange = (e) => {
    setLanguagePreference(e.target.value);
    location.reload(); // every text is rendered in the language chosen at startup
  };

  view.querySelector('[name=mapsApp]')?.addEventListener('change', (e) => setMapsPreference(e.target.value));

  const currency = view.querySelector('[name=currency]'); // admin only
  if (currency) currency.onchange = async (e) => {
    try {
      await api.saveSettings({ currency: e.target.value });
      await loadSettings();
      toast(t('settings.currencySaved', { currency: e.target.value }));
    } catch (err) { toastError(err); }
  };
}
