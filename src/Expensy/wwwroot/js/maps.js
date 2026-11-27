// Everything about maps: the small OpenStreetMap preview and opening a location in a maps app.
//
// A web page can't see which apps are installed, so:
//   - Android: a geo: link — the system itself offers the installed maps apps.
//   - iPhone / iPad / Mac: ask "Apple Maps or Google Maps?" (the answer can be remembered on the device).
//   - anything else: Google Maps in the browser.
import { t } from './i18n.js';
import { html, raw } from './html.js';
import { icons } from './icons.js';
import { loadPref, savePref } from './storage.js';
import { showDialog, closeDialog } from './ui.js';

const MAPS_PREF = 'expensy.mapsApp'; // 'apple' | 'google' | absent = ask every time

export const isApplePlatform = () =>
  /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) &&
  !/Android/.test(navigator.userAgent); // (iPads report "Macintosh" too)
const isAndroid = () => /Android/.test(navigator.userAgent);

export const getMapsPreference = () => loadPref(MAPS_PREF, 'ask');
export const setMapsPreference = (value) => savePref(MAPS_PREF, value === 'ask' ? null : value);

const urls = {
  // Universal links: open the app when installed, the website otherwise.
  google: (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  apple: (lat, lon, label) => `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(label || `${lat},${lon}`)}`,
  geo: (lat, lon, label) => `geo:${lat},${lon}?q=${lat},${lon}${label ? `(${encodeURIComponent(label)})` : ''}`,
};

const open = (url) => window.open(url, '_blank', 'noopener');

/** Opens the location in a maps app (see the rules at the top of this file). */
function openInMaps(lat, lon, label) {
  if (isAndroid()) { location.href = urls.geo(lat, lon, label); return; }
  if (!isApplePlatform()) return open(urls.google(lat, lon));

  const pref = getMapsPreference();
  if (pref === 'apple' || pref === 'google') return open(urls[pref](lat, lon, label));
  askWhichApp(lat, lon, label);
}

/** Small separate dialog, so it can sit on top of the expense sheet without replacing it. */
function askWhichApp(lat, lon, label) {
  const d = document.createElement('dialog');
  d.className = 'sheet maps-chooser';
  d.innerHTML = html`
    <div class="sheet-inner">
      <div class="sheet-head"><h2>${t('maps.openIn')}</h2>
        <button class="icon-btn" type="button" data-close aria-label="${t('common.close')}">${icons.close}</button></div>
      <div class="maps-options">
        <button class="btn block" type="button" data-app="apple">${t('maps.apple')}</button>
        <button class="btn block" type="button" data-app="google">${t('maps.google')}</button>
      </div>
      <label class="toggle-row remember">
        <span>${t('maps.remember')}</span><input type="checkbox" name="remember">
      </label>
    </div>`.s;
  d.onclick = (e) => {
    const app = e.target.closest('[data-app]')?.dataset.app;
    if (app) {
      if (d.querySelector('[name=remember]').checked) setMapsPreference(app);
      open(urls[app](lat, lon, label));
      closeDialog(d);
    } else if (e.target === d || e.target.closest('[data-close]')) {
      closeDialog(d);
    }
  };
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  showDialog(d);
}

// ---------- Mini map ----------

const TILE = 256;
const ZOOM = 16;

/**
 * A small static map centred on the point: a 3×3 grid of OpenStreetMap tiles with a pin, no library needed.
 * Tapping it (element with data-open-map) opens the location in a maps app.
 */
export function miniMap(lat, lon, label) {
  const n = 2 ** ZOOM;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(x), tileY = Math.floor(y);
  // Offset of the grid so that the point lands exactly in the middle of the box.
  const left = -(TILE + (x - tileX) * TILE), top = -(TILE + (y - tileY) * TILE);

  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = (((tileX + dx) % n) + n) % n; // wrap around the antimeridian
      tiles.push(html`<img src="https://tile.openstreetmap.org/${ZOOM}/${tx}/${tileY + dy}.png" alt=""
        loading="lazy" referrerpolicy="strict-origin-when-cross-origin" draggable="false">`);
    }
  }

  return html`
    <button type="button" class="mini-map" data-open-map data-lat="${lat}" data-lon="${lon}" data-label="${label ?? ''}"
            aria-label="${t('location.map')}">
      <span class="map-tiles" style="left:calc(50% + ${left.toFixed(1)}px);top:calc(50% + ${top.toFixed(1)}px)">${tiles}</span>
      <span class="pin">${icons.mapPin}</span>
      <span class="attribution">${raw('&copy;')} OpenStreetMap</span>
    </button>`;
}

/** Call once per rendered sheet/view: makes mini maps and [data-open-map] buttons open the maps app. */
export function bindMapLinks(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-open-map]');
    if (!el) return;
    e.preventDefault();
    openInMaps(Number(el.dataset.lat), Number(el.dataset.lon), el.dataset.label || '');
  });
}
