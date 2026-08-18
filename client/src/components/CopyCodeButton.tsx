import { useState } from 'react';
import { copyText } from '../clipboard';

/** Copies the room code, and says so — including when it can't. Phones are the case that
 * matters here: the app is usually opened over plain http on a LAN address during a game
 * night, where the Clipboard API doesn't exist at all, and the button used to swallow that
 * and look simply broken. */
export function CopyCodeButton({ code, label = 'Copier' }: { code: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  async function handleCopy() {
    const ok = await copyText(code);
    setStatus(ok ? 'ok' : 'fail');
    setTimeout(() => setStatus('idle'), 2500);
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" style={{ alignSelf: 'center' }} onClick={() => void handleCopy()}>
        {status === 'ok' ? 'Copié !' : status === 'fail' ? 'Copie impossible' : label}
      </button>
      {status === 'fail' && (
        <p className="muted center" style={{ fontSize: '0.8rem', margin: 0 }}>
          Votre navigateur refuse le presse-papier ici — recopiez le code à la main.
        </p>
      )}
    </>
  );
}
