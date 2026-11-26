// Safe HTML templating.
//
//   html`<b>${name}</b>`   escapes every interpolated value, so user data can never inject markup.
//   html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`   nested html`` results and arrays of them are kept as-is.
//   raw('<br>')             marks HTML you wrote yourself (e.g. a trusted translation) as safe.
//
// html`` returns a SafeHtml object; use `.s` (or String(x)) to get the string, e.g. for element.innerHTML.

class SafeHtml {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const raw = (s) => new SafeHtml(String(s));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** One interpolated value → HTML. null, undefined and false render nothing (handy for `${cond && html`...`}`). */
function render(value) {
  if (value instanceof SafeHtml) return value.s;
  if (Array.isArray(value)) return value.map(render).join('');
  if (value === null || value === undefined || value === false) return '';
  return escape(value);
}

export function html(strings, ...values) {
  return raw(strings.reduce((out, str, i) => out + str + (i < values.length ? render(values[i]) : ''), ''));
}

/** Boolean HTML attribute: html`<option ${attr('selected', isSelected)}>`. */
export const attr = (name, on) => (on ? raw(name) : '');
