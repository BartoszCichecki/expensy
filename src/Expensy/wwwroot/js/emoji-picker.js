// Icon picker for categories. A square button with the current emoji sits next to the name field;
// tapping it opens a grid of emoji that fit expenses, plus one cell to type any other emoji.
// The chosen emoji is kept in a hidden <input name="icon">, so the form reads it like any other field.
import { html } from './html.js';
import { t } from './i18n.js';

const EMOJI = [
  // food & drinks
  '🍔', '🍕', '🍣', '🍜', '🥗', '🥐', '🍰', '🍦', '☕', '🍺', '🍷', '🍸',
  // shopping
  '🛒', '🛍️', '👕', '👟', '👗', '💄', '💍', '🎁',
  // home & bills
  '🏠', '🛋️', '🧹', '🔧', '💡', '🔌', '🧾', '📱', '💻', '📺',
  // getting around
  '🚗', '⛽', '🅿️', '🚌', '🚆', '🚕', '🚲', '🛴', '✈️', '🚢',
  // health
  '💊', '🏥', '🦷', '💪', '🧘', '💇',
  // free time & travel
  '🎬', '🎮', '🎵', '🎟️', '📚', '🎨', '⚽', '🏖️', '🏨', '🏕️',
  // family & pets
  '👶', '🧸', '🎓', '🐶', '🐱',
  // money & everything else
  '💸', '💳', '🏦', '📈', '💼', '🎉', '❤️', '⭐', '📦',
];

/** The button that shows the current icon — put it where the icon field goes. `color` tints it. */
export function emojiButton(selected, color) {
  return html`
    <div class="field">
      <span class="label">${t('category.icon')}</span>
      <input type="hidden" name="icon" value="${selected}">
      <button type="button" class="emoji-button" style="--c:${color}" data-emoji-toggle aria-expanded="false">${selected}</button>
    </div>`;
}

/** The grid of emoji, hidden until the button is tapped — put it below the button's row. */
export function emojiGrid(selected) {
  const custom = EMOJI.includes(selected) ? '' : selected;
  return html`
    <div class="emoji-grid" hidden>
      ${EMOJI.map((e) => html`<button type="button" class="emoji-cell" data-emoji="${e}">${e}</button>`)}
      <input class="emoji-cell emoji-custom" maxlength="16" value="${custom}"
             placeholder="+" aria-label="${t('category.customIcon')}" title="${t('category.customIcon')}">
    </div>`;
}

/** Wires up emojiButton() and emojiGrid() inside `form`. Returns setColor(), for when the colour changes. */
export function bindEmojiPicker(form) {
  const value = form.querySelector('[name=icon]');
  const button = form.querySelector('[data-emoji-toggle]');
  const grid = form.querySelector('.emoji-grid');
  const custom = grid.querySelector('.emoji-custom');

  const paint = () => {
    button.textContent = value.value;
    for (const cell of grid.querySelectorAll('[data-emoji]')) cell.classList.toggle('active', cell.dataset.emoji === value.value);
    custom.classList.toggle('active', custom.value !== '' && custom.value === value.value);
  };
  const setOpen = (open) => {
    grid.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  const pick = (emoji) => {
    value.value = emoji;
    paint();
    setOpen(false);
  };

  button.onclick = () => setOpen(grid.hidden);
  grid.onclick = (e) => {
    const cell = e.target.closest('[data-emoji]');
    if (cell) { custom.value = ''; pick(cell.dataset.emoji); }
  };
  // Typing (or picking from the phone's emoji keyboard) keeps only the first character, i.e. one emoji.
  custom.oninput = () => {
    custom.value = firstCharacter(custom.value.trim());
    if (custom.value) { custom.blur(); pick(custom.value); }
  };

  paint();
  return { setColor: (color) => button.style.setProperty('--c', color) };
}

/** First user-visible character: "👍🏽" or "🇵🇱" count as one, even though they're several code points. */
function firstCharacter(text) {
  const [first] = new Intl.Segmenter().segment(text);
  return first?.segment ?? '';
}
