// Triggers a short vibration pulse where the browser/device supports it.
// Note: the Vibration API only works on Chrome/Android — Safari (iOS/macOS)
// and desktop browsers generally don't support it, so this silently no-ops there.
export function triggerHaptic(pattern = 12) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}
