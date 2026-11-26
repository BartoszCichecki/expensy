// Entering an expense in another currency: rates come from our server (ECB rates via Frankfurter),
// the amount is converted to the app's currency before saving. Nothing about the original currency is stored.
import { api } from './api.js';
import { state } from './state.js';

let convertible; // Promise<string[]>, loaded once

/**
 * Currencies an expense can be entered in: the app's currencies that have exchange rates, app currency first.
 * Empty when the app's own currency has no rates or the rate service can't be reached — then there's nothing to pick.
 */
export function selectableCurrencies() {
  convertible ??= api.exchangeCurrencies().catch(() => []);
  return convertible.then((withRates) => {
    const base = state.settings.currency;
    if (!withRates.includes(base)) return [];
    const others = state.settings.currencies.filter((c) => c !== base && withRates.includes(c));
    return [base, ...others];
  });
}

const rates = new Map(); // "EUR:PLN:2026-11-20" → Promise<{ rate, date }>

/** Rate from `from` to the app's currency on `day` ("yyyy-mm-dd"); rejects if unavailable. */
export function rateToBase(from, day) {
  const key = `${from}:${state.settings.currency}:${day}`;
  if (!rates.has(key)) {
    const request = api.exchangeRate(from, state.settings.currency, day);
    request.catch(() => rates.delete(key)); // don't remember failures — try again next time
    rates.set(key, request);
  }
  return rates.get(key);
}

export const convert = (cents, rate) => Math.round(cents * rate);
