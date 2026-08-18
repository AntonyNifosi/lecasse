import { useState } from 'react';
import { EMOTES } from '@thegang/shared';
import { sendEmote } from '../actions';

/** The one wordless way to react during a heist — the game bans talking about your cards,
 * so this is deliberately a closed, original set of reactions rather than free text or
 * arbitrary emoji, and the server enforces a per-player cooldown so it can't be spammed
 * (see rooms.sendEmote) — this button just fires and closes, no local cooldown UI of its
 * own, since a rejection just surfaces through the normal error toast. */
export function EmotePicker() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-ghost" aria-label="Réagir" onClick={() => setOpen(true)}>
        😊
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h2>Réagir</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
            <div className="emote-grid">
              {EMOTES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="emote-choice"
                  onClick={() => {
                    sendEmote(e.id);
                    setOpen(false);
                  }}
                >
                  <span className="emote-choice-icon">{e.emoji}</span>
                  <span className="emote-choice-label">{e.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
