// Entry point: decides between setup / login / the app, routes between screens, registers the service worker.
//
// Screens (hash routes): #/ list · #/stats · #/archive · #/archive/<id> · #/settings
// Special: #/add opens the "new expense" form (home-screen shortcut, see manifest.webmanifest).
import { api, setUnauthorizedHandler } from './api.js';
import { t, translateDocument } from './i18n.js';
import { html } from './html.js';
import { state, loadSettings, loadCategories } from './state.js';
import { closeSheet, toastError } from './ui.js';
import { clearPhotoCache } from './photos.js';
import { openExpenseForm } from './expense-form.js';
import { showSetup, showLogin } from './views/auth.js';
import { renderList } from './views/list.js';
import { renderStats } from './views/stats.js';
import { renderArchive, renderSettlement } from './views/archive.js';
import { renderSettings } from './views/settings.js';

// No zooming, like a native app. index.html and app.css already ask for that, but Safari on iPhone ignores
// those for pinching, so its own pinch gesture events are cancelled too.
for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault());

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
const addButton = document.getElementById('fab'); // big "Add expense" button (phone layout)

const routes = [
  { pattern: /^#?\/?$/, tab: 'list', render: () => renderList(view, route) },
  { pattern: /^#\/stats$/, tab: 'stats', render: () => renderStats(view) },
  { pattern: /^#\/archive$/, tab: 'archive', render: () => renderArchive(view) },
  { pattern: /^#\/archive\/(\d+)$/, tab: 'archive', render: ([, id]) => renderSettlement(view, Number(id), route) },
  { pattern: /^#\/settings$/, tab: 'settings', render: () => renderSettings(view) },
];

/** Renders the screen for the current URL hash. */
async function route() {
  if (location.hash === '#/add') {
    history.replaceState(null, '', '#/');
    addExpense();
  }

  const hash = location.hash || '#/';
  const match = routes.map((r) => ({ ...r, params: hash.match(r.pattern) })).find((r) => r.params) ?? { ...routes[0], params: [] };

  tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === match.tab));
  addButton.hidden = match.tab !== 'list'; // the big Add button belongs to the list screen only
  try {
    await match.render(match.params);
  } catch (err) {
    if (err.status !== 401) showError(err); // 401 → the login screen is already shown
  }
}

function showError(err) {
  view.innerHTML = html`
    <div class="empty">
      <div class="big">⚠️</div>${err.message}<br><br>
      <button class="btn" type="button" data-reload>${t('common.reload')}</button>
    </div>`.s;
  view.onclick = (e) => { if (e.target.closest('[data-reload]')) location.reload(); };
}

function addExpense() {
  openExpenseForm(null, () => {
    if ((location.hash || '#/') === '#/') route(); else location.hash = '#/'; // show the list with the new expense
  });
}

// ---------- Login state ----------

/** Logged in: load shared data and show the app. */
async function start(user) {
  state.user = user;
  try {
    await Promise.all([loadSettings(), loadCategories()]);
  } catch (err) {
    if (err.status !== 401) toastError(err);
    return;
  }
  tabs.hidden = addButton.hidden = false;
  window.onhashchange = route;
  route();
}

/** Not logged in (or the session ended): hide the app and show `screen` (login or setup). */
function signedOut(screen) {
  closeSheet();
  state.user = null;
  tabs.hidden = addButton.hidden = true;
  screen(view, start);
}

// ---------- Boot ----------

translateDocument();
addButton.onclick = addExpense;
document.getElementById('nav-add').onclick = addExpense; // same button in the desktop sidebar

// The session ended (logged out elsewhere, deactivated, password reset): also drop cached photos.
setUnauthorizedHandler(() => { clearPhotoCache(); signedOut(showLogin); });

try {
  const session = await api.session();
  state.version = session.version;
  if (session.setupRequired) signedOut(showSetup);
  else if (!session.user) signedOut(showLogin);
  else start(session.user);
} catch (err) {
  view.innerHTML = html`<div class="empty"><div class="big">📡</div>${err.message}</div>`.s;
}

// Refresh when the app comes back to the foreground (data may have changed on another device).
document.addEventListener('visibilitychange', () => {
  const sheetOpen = document.getElementById('sheet').open;
  if (document.visibilityState === 'visible' && state.user && !sheetOpen) route();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is optional */ });
