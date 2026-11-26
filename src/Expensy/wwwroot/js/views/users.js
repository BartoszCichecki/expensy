// Settings → Users (admin only): add users, reset passwords, deactivate / activate.
import { api } from '../api.js';
import { t } from '../i18n.js';
import { html } from '../html.js';
import { icons } from '../icons.js';
import { state, displayName } from '../state.js';
import { formSheet, confirmSheet, handleClick, toast, toastError } from '../ui.js';
import { initial } from './account.js';

export function usersSection() {
  return html`
    <section class="card">
      <h2>${t('users.title')}</h2>
      ${state.users.map(userRow)}
      <button class="btn block section-button" type="button" data-add-user>${t('users.add')}</button>
      <p class="muted small section-note">${t('users.hint')}</p>
    </section>`;
}

function userRow(u) {
  const isMe = u.id === state.user.id;
  return html`
    <div class="cat-row" data-user="${u.id}">
      <span class="avatar ${!u.active && 'inactive'}">${initial(u)}</span>
      <span class="name ${!u.active && 'muted'}">
        ${displayName(u)}
        ${u.isAdmin && html` <span class="badge">${t('users.admin')}</span>`}
        ${!u.active && html` <span class="badge muted">${t('users.inactive')}</span>`}
        ${u.displayName && html`<br><span class="muted small">${t('account.username', { username: u.username })}</span>`}
      </span>
      ${!isMe && html`
        <span class="tools">
          ${u.active ? html`
            <button class="icon-btn" type="button" data-reset-password title="${t('users.resetPassword')}" aria-label="${t('users.resetPassword')}">${icons.key}</button>
            <button class="icon-btn" type="button" data-deactivate title="${t('users.deactivate')}" aria-label="${t('users.deactivate')}">${icons.userOff}</button>`
          : html`<button class="link-btn" type="button" data-activate>${t('users.activate')}</button>`}
        </span>`}
    </div>`;
}

/** The user whose row contains the clicked element. */
const userOf = (element) => state.users.find((u) => u.id === Number(element.closest('[data-user]').dataset.user));

/** Handles clicks inside the section; returns true if the click was ours. */
export const onUsersClick = (target, rerender) => handleClick(target, {
  '[data-add-user]': () => addUser(rerender),
  '[data-reset-password]': (b) => resetPassword(userOf(b)),
  '[data-deactivate]': (b) => deactivate(userOf(b), rerender),
  '[data-activate]': (b) => activate(userOf(b), rerender),
});

function addUser(rerender) {
  formSheet({
    title: t('users.addTitle'),
    intro: t('users.addIntro'),
    fields: [
      { name: 'username', label: t('login.username'), type: 'text', autocomplete: 'off', maxlength: 32, verbatim: true },
      { name: 'displayName', label: t('account.displayNameOptional'), type: 'text', autocomplete: 'off', maxlength: 50, optional: true },
      { name: 'password', label: t('login.password'), autocomplete: 'new-password' },
      { name: 'repeat', label: t('login.repeatPassword'), autocomplete: 'new-password', sameAs: 'password' },
    ],
    submitLabel: t('users.create'),
    onSubmit: async ({ username, displayName: name, password }) => {
      const user = await api.createUser(username.trim(), password, name.trim() || null);
      toast(t('users.created', { name: displayName(user) }));
      rerender();
    },
  });
}

function resetPassword(user) {
  formSheet({
    title: t('users.resetTitle', { name: displayName(user) }),
    intro: t('users.resetIntro'),
    fields: [
      { name: 'password', label: t('account.newPassword'), autocomplete: 'new-password' },
      { name: 'repeat', label: t('login.repeatPassword'), autocomplete: 'new-password', sameAs: 'password' },
    ],
    submitLabel: t('common.save'),
    onSubmit: async ({ password }) => {
      await api.resetPassword(user.id, password);
      toast(t('users.passwordReset'));
    },
  });
}

async function deactivate(user, rerender) {
  const confirmed = await confirmSheet({
    title: t('users.deactivateTitle', { name: displayName(user) }),
    message: t('users.deactivateMessage'),
    confirmLabel: t('users.deactivate'),
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api.deactivateUser(user.id);
    toast(t('users.deactivated'));
    rerender();
  } catch (err) { toastError(err); }
}

async function activate(user, rerender) {
  try {
    await api.activateUser(user.id);
    toast(t('users.activated'));
    rerender();
  } catch (err) { toastError(err); }
}
