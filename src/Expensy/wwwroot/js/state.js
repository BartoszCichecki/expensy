// App state loaded from the server after login, and small helpers to read it.
import { api } from './api.js';
import { t } from './i18n.js';
import { setCurrency } from './format.js';

export const state = {
  version: '',      // app version, e.g. "1.0"
  user: null,       // the logged-in user { id, username, displayName, isAdmin }
  users: [],        // all accounts — loaded only for the admin (Settings → Users)
  settings: { currency: 'EUR', currencies: [], geocoding: false },
  categories: [],   // shared by everyone, including archived ones
};

export async function loadSettings() {
  state.settings = await api.settings();
  setCurrency(state.settings.currency);
}

export async function loadCategories() {
  state.categories = await api.categories();
}

export async function loadUsers() {
  state.users = await api.users();
}

// ---------- Users ----------

/** What the app shows for a user: their display name, or the username if they haven't set one. */
export const displayName = (user) => user?.displayName || user?.username || '';

// ---------- Categories ----------

export const activeCategories = () => state.categories.filter((c) => !c.archived);
export const archivedCategories = () => state.categories.filter((c) => c.archived);
export const defaultCategory = () => activeCategories().find((c) => c.isDefault) ?? null;

/** "Other": what an expense without any category is shown as. It isn't a real category, so it can't be picked or edited. */
const OTHER = { id: null, key: 'other', name: 'Other', icon: '📦', color: '#94a3b8' };

/** The expense's categories in list order; [OTHER] when it has none. The first one gives the icon. */
export function categoriesOf(expense) {
  const own = state.categories.filter((c) => expense.categoryIds.includes(c.id)); // state.categories is in list order
  return own.length ? own : [OTHER];
}

/** "Food, Travel" */
export const categoryNames = (expense) => categoriesOf(expense).map(categoryName).join(', ');

/**
 * Display name of a category. Built-in categories have a `key` ("food") and are shown in the app's
 * language until someone renames them (renaming clears the key on the server).
 */
export const categoryName = (c) => (c.key ? t(`categories.${c.key}`) : c.name);
