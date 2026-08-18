/** Copies text to the clipboard and reports whether it actually worked.
 *
 * The async Clipboard API only exists in a secure context, and the phone case this app is
 * built for is exactly the insecure one: everyone opens it over plain http on a LAN address
 * during a game night, where `navigator.clipboard` is simply undefined — the old code awaited
 * it inside a try/catch and swallowed the failure, so the button looked like it did nothing.
 * Falling back to the legacy selection trick covers that, and returning a boolean lets the
 * caller say "copié" or "impossible" instead of lying either way. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied, or the user gesture was already spent — the legacy path below can
    // still succeed, so it's worth trying rather than giving up here.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // Off-screen but still rendered: `display: none` or `visibility: hidden` would make the
  // selection — and therefore the copy — a silent no-op.
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';
  document.body.appendChild(area);
  try {
    area.select();
    area.setSelectionRange(0, text.length); // iOS ignores select() on its own
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
