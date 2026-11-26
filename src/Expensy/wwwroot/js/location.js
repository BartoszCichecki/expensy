// The device's current position, as a promise.
import { t } from './i18n.js';

const OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 };

/**
 * Resolves with { lat, lon, accuracy } (accuracy in metres).
 * Rejects with an Error whose message is ready to show ("Location permission denied", "Location requires HTTPS"...).
 */
export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error(t('location.unsupported')));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy }),
      (err) => reject(new Error(
        err.code !== err.PERMISSION_DENIED ? t('location.failed')
          : window.isSecureContext ? t('location.denied')
            : t('location.needsHttps'), // browsers only allow location over HTTPS
      )),
      OPTIONS,
    );
  });
}

/** "52.22970, 21.01220 (±8 m)" — shown when there's no place name. */
export const coordinatesText = (lat, lon, accuracy) =>
  `${lat.toFixed(5)}, ${lon.toFixed(5)}${accuracy ? ` (±${Math.round(accuracy)} m)` : ''}`;
