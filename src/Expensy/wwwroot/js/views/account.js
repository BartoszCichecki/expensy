// Settings → Account: who's logged in, display name, password, logout.
import { api } from '../api.js';
import { t } from '../i18n.js';
import { html } from '../html.js';
import { icons } from '../icons.js';
import { state, displayName } from '../state.js';
import { formSheet, confirmSheet, handleClick, toast, toastError } from '../ui.js';
import { clearPhotoCache } from '../photos.js';

export function accountSection() {
  const me = state.user;
  return html`
    <section class="card">
      <h2>${t('account.title')}</h2>
      <div class="setting">
        <span class="account-name">
          <span class="avatar">${initial(me)}</span>
          <span>
            <b>${displayName(me)}</b>${me.isAdmin && html` <span class="badge">${t('users.admin')}</span>`}<br>
            <span class="muted small">${t('account.username', { username: me.username })}</span>
          </span>
        </span>
        <button class="link-btn" type="button" data-display-name>${t('account.editName')}</button>
      </div>
      <div class="actions-row">
        <button class="btn" type="button" data-change-password>${icons.key} ${t('account.changePassword')}</button>
        <button class="btn danger" type="button" data-logout>${icons.logout} ${t('account.logout')}</button>
      </div>
      <button class="link-btn section-link" type="button" data-logout-others>${t('account.logoutOthers')}</button>
    </section>`;
}

/** First letter of the shown name, for the round avatar. */
export const initial = (user) => displayName(user).slice(0, 1).toUpperCase();

/** Handles clicks inside the section; returns true if the click was ours. */
export const onAccountClick = (target, rerender) => handleClick(target, {
  '[data-display-name]': () => editDisplayName(rerender),
  '[data-change-password]': changePassword,
  '[data-logout-others]': logoutOtherDevices,
  '[data-logout]': logout,
});

function editDisplayName(rerender) {
  formSheet({
    title: t('account.editName'),
    intro: t('account.displayNameHint'),
    fields: [{
      name: 'displayName', label: t('account.displayName'), type: 'text', autocomplete: 'nickname',
      value: state.user.displayName ?? '', placeholder: state.user.username, maxlength: 50, optional: true,
    }],
    submitLabel: t('common.save'),
    onSubmit: async ({ displayName }) => {
      state.user = await api.setDisplayName(displayName.trim() || null);
      toast(t('account.nameSaved'));
      rerender();
    },
  });
}

function changePassword() {
  formSheet({
    title: t('account.changePassword'),
    fields: [
      { name: 'current', label: t('account.currentPassword'), autocomplete: 'current-password' },
      { name: 'password', label: t('account.newPassword'), autocomplete: 'new-password' },
      { name: 'repeat', label: t('login.repeatPassword'), autocomplete: 'new-password', sameAs: 'password' },
    ],
    submitLabel: t('common.save'),
    onSubmit: async ({ current, password }) => {
      await api.changePassword(current, password);
      toast(t('account.passwordChanged'));
    },
  });
}

async function logoutOtherDevices() {
  const confirmed = await confirmSheet({
    title: t('account.logoutOthersTitle'),
    message: t('account.logoutOthersMessage'),
    confirmLabel: t('account.logoutOthers'),
  });
  if (!confirmed) return;
  try {
    await api.logoutOthers();
    toast(t('account.loggedOutOthers'));
  } catch (err) { toastError(err); }
}

async function logout() {
  await api.logout().catch(() => {});
  await clearPhotoCache(); // don't leave receipts on a shared device
  location.reload();
}
