// The Expensy API. Every function returns the parsed JSON response (or null for "204 No Content")
// and throws an ApiError with a message that's ready to show to the user.
import { t, has, lang } from './i18n.js';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status; // HTTP status, 0 = no connection
  }
}

let onUnauthorized = () => {};
/** `handler` runs whenever the session turns out to be gone (logged out elsewhere, deactivated...). */
export const setUnauthorizedHandler = (handler) => (onUnauthorized = handler);

async function request(method, url, body) {
  // The X-Expensy header proves the request comes from our own page; the server rejects
  // state-changing requests without it (CSRF protection).
  const options = { method, headers: { 'X-Expensy': '1' }, credentials: 'same-origin' };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError(t('errors.network'), 0);
  }

  // 401 means "not logged in" — except for the login itself, where it means "wrong password".
  if (response.status === 401 && url !== '/api/login') {
    onUnauthorized();
    throw new ApiError(t('errors.reauth'), 401);
  }
  if (!response.ok) throw new ApiError(await errorMessage(response), response.status);
  return response.status === 204 ? null : response.json();
}

/** The API sends { error: "English message", code: "machine_code" }; we show the translation of the code. */
async function errorMessage(response) {
  if (response.status === 413) return t('errors.tooLarge');
  if (response.status === 429) return t('errors.tooMany');
  try {
    const { error, code } = await response.json();
    return code && has(`errors.${code}`) ? t(`errors.${code}`) : error;
  } catch {
    return t('errors.server', { status: response.status });
  }
}

const get = (url) => request('GET', url);
const post = (url, body) => request('POST', url, body);
const put = (url, body) => request('PUT', url, body);
const del = (url) => request('DELETE', url);

/** "/api/x" + { a: 1, b: undefined } → "/api/x?a=1" (undefined values are left out). */
function withQuery(path, params) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString();
  return query ? `${path}?${query}` : path;
}

/** Which expenses: undefined = the current list, a number = that settlement, 'all' = everything. */
const scopeParams = (scope) =>
  scope === 'all' ? { all: true } : scope !== undefined ? { settlementId: scope } : {};

export const api = {
  // ----- session & account -----
  session: () => get('/api/session'),
  setup: (username, password) => post('/api/setup', { username, password }),
  login: (username, password) => post('/api/login', { username, password }),
  logout: () => post('/api/logout'),
  changePassword: (currentPassword, newPassword) => put('/api/me/password', { currentPassword, newPassword }),
  setDisplayName: (displayName) => put('/api/me/display-name', { displayName }),
  logoutOthers: () => post('/api/me/logout-others'),

  // ----- users (admin) -----
  users: () => get('/api/users'),
  createUser: (username, password, displayName) => post('/api/users', { username, password, displayName }),
  resetPassword: (id, password) => put(`/api/users/${id}/password`, { password }),
  deactivateUser: (id) => post(`/api/users/${id}/deactivate`),
  activateUser: (id) => post(`/api/users/${id}/activate`),

  // ----- settings & categories (shared) -----
  settings: () => get('/api/settings'),
  saveSettings: (settings) => put('/api/settings', settings),
  categories: () => get('/api/categories'),
  createCategory: (category) => post('/api/categories', category),
  updateCategory: (id, category) => put(`/api/categories/${id}`, category),
  archiveCategory: (id) => post(`/api/categories/${id}/archive`),
  restoreCategory: (id) => post(`/api/categories/${id}/restore`),
  /** Only archived categories can be deleted. */
  deleteCategory: (id) => del(`/api/categories/${id}`),
  reorderCategories: (ids) => put('/api/categories/order', { ids }),
  /** id = the new default category, null = no default. */
  setDefaultCategory: (id) => (id ? post(`/api/categories/${id}/default`) : del('/api/categories/default')),

  // ----- expenses -----
  expenses: (scope) => get(withQuery('/api/expenses', scopeParams(scope))),
  // lang: language of the place name, in case the server has to look it up after saving
  createExpense: (expense) => post(withQuery('/api/expenses', { lang }), expense),
  updateExpense: (id, expense) => put(withQuery(`/api/expenses/${id}`, { lang }), expense),
  deleteExpense: (id) => del(`/api/expenses/${id}`),
  fillPlace: (id) => post(withQuery(`/api/expenses/${id}/place`, { lang })),
  geocode: (lat, lon) => get(withQuery('/api/geocode', { lat, lon, lang })),
  uploadPhoto: (id, file, filename) => {
    const form = new FormData();
    form.append('photo', file, filename);
    return post(`/api/expenses/${id}/photo`, form);
  },
  deletePhoto: (id) => del(`/api/expenses/${id}/photo`),

  // ----- exchange rates (entering an expense in another currency) -----
  exchangeCurrencies: () => get('/api/exchange/currencies'),
  exchangeRate: (from, to, date) => get(withQuery('/api/exchange/rate', { from, to, date })),

  // ----- settlements (archive) -----
  settlements: () => get('/api/settlements'),
  settlement: (id) => get(`/api/settlements/${id}`),
  settle: (name) => post('/api/settlements', { name }),
  renameSettlement: (id, name) => put(`/api/settlements/${id}`, { name }),
  reopenSettlement: (id) => post(`/api/settlements/${id}/reopen`),
  deleteSettlement: (id) => del(`/api/settlements/${id}`),

  /** Download link; tz and lang make dates, separators and column names match the app. */
  exportUrl: (scope) => withQuery('/api/export.csv', {
    ...scopeParams(scope),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang,
  }),
};
