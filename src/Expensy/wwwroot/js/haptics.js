// Haptic feedback for on-screen keys.
//
//  - Android: the Vibration API, a short buzz.
//  - iPhone: Safari has no Vibration API, but since iOS 18 toggling a switch (<input type="checkbox" switch>)
//    plays the system "tick". So we keep a hidden switch and click its label. Older iOS: nothing happens.
//
// Call it from a tap / click handler: browsers only allow both of these in response to the user.

/**
 * A short tick. `container` is where the hidden switch lives: pass the open dialog,
 * because everything outside a modal <dialog> ignores clicks.
 */
export function haptic(container, ms = 8) {
  if (navigator.vibrate) { navigator.vibrate(ms); return; }
  const label = hiddenSwitch(container);
  label.click();
  label.firstChild.blur(); // clicking a label focuses its switch; give the focus back
}

function hiddenSwitch(container) {
  let label = container.querySelector(':scope > .haptic-switch');
  if (!label) {
    label = document.createElement('label');
    label.className = 'haptic-switch';
    label.ariaHidden = 'true';
    label.innerHTML = '<input type="checkbox" switch tabindex="-1">';
    container.append(label);
  }
  return label;
}
