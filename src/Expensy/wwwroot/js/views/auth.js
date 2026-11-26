// Full-screen first-run setup (create the admin account) and login.
import { api } from '../api.js';
import { t } from '../i18n.js';
import { html } from '../html.js';
import { submitForm } from '../ui.js';
import { appFooter } from './common.js';

/** Shows the setup screen; `onDone(user)` is called once the admin account exists and is logged in. */
export const showSetup = (view, onDone) => authScreen(view, {
  title: t('setup.title'),
  prompt: t('setup.prompt'),
  button: t('setup.submit'),
  isNewAccount: true,
  submit: (username, password) => api.setup(username, password),
  onDone,
});

/** Shows the login screen; `onDone(user)` is called after a successful login. */
export const showLogin = (view, onDone) => authScreen(view, {
  title: 'Expensy',
  prompt: t('login.prompt'),
  button: t('login.submit'),
  isNewAccount: false,
  submit: (username, password) => api.login(username, password),
  onDone,
});

function authScreen(view, { title, prompt, button, isNewAccount, submit, onDone }) {
  view.onclick = null;
  view.innerHTML = html`
    <div class="login">
      <img src="/icons/icon-192.png" alt="">
      <h1>${title}</h1>
      <p class="muted">${prompt}</p>
      <form novalidate>
        <label class="field">
          <span class="label">${t('login.username')}</span>
          <input class="input" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required>
        </label>
        <label class="field">
          <span class="label">${t('login.password')}</span>
          <input class="input" type="password" name="password" maxlength="64" required
                 autocomplete="${isNewAccount ? 'new-password' : 'current-password'}">
        </label>
        ${isNewAccount && html`
          <label class="field">
            <span class="label">${t('login.repeatPassword')}</span>
            <input class="input" type="password" name="repeat" autocomplete="new-password" maxlength="64" required>
          </label>`}
        <p class="error-text" data-error hidden></p>
        <button class="btn primary block" type="submit">${button}</button>
      </form>
    </div>
    ${appFooter('pinned')}`.s;

  const form = view.querySelector('form');
  form.onsubmit = (e) => submitForm(e, async () => {
    const { username, password, repeat } = Object.fromEntries(new FormData(form));
    if (isNewAccount && password !== repeat) throw new Error(t('login.passwordsDiffer'));
    onDone(await submit(username.trim(), password));
  });
  form.querySelector('[name=username]').focus();
}
