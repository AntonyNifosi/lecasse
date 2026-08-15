import { useState } from 'react';
import { leaveRoom } from '../actions';
import { clearSession } from '../session';
import { useGameDispatch, useGameState } from '../state/GameContext';
import { Avatar } from './Avatar';

export function GameMenu() {
  const { room, myPlayerId } = useGameState();
  const dispatch = useGameDispatch();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  if (!room) return null;

  const handleClose = () => {
    setOpen(false);
    setConfirmingLeave(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable or denied — fail silently.
    }
  };

  const handleLeave = () => {
    leaveRoom();
    clearSession();
    dispatch({ type: 'LEFT_ROOM' });
  };

  return (
    <>
      <button type="button" className="btn btn-ghost" aria-label="Menu de la partie" onClick={() => setOpen(true)}>
        ☰
      </button>

      {open && (
        <div className="modal-backdrop" onClick={handleClose}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h2>Menu</h2>
              <button className="btn btn-ghost" onClick={handleClose} aria-label="Fermer">
                ✕
              </button>
            </div>

            <div className="card center stack" style={{ marginTop: '0.75rem' }}>
              <p className="muted">Code de la salle</p>
              <div className="input-code">{room.code}</div>
              <button type="button" className="btn btn-secondary" style={{ alignSelf: 'center' }} onClick={() => void handleCopy()}>
                {copied ? 'Copié !' : 'Copier'}
              </button>
              <p className="muted center" style={{ fontSize: '0.85rem' }}>
                Un ami pourra rejoindre avec ce code entre deux parties (pas en plein braquage).
              </p>
            </div>

            <div className="stack" style={{ marginTop: '1rem' }}>
              <span className="muted">Le gang</span>
              <div>
                {room.players.map((p) => (
                  <div key={p.id} className="player-row">
                    <Avatar name={p.name} color={p.colorTag} size="sm" />
                    <span className={`player-name${p.connected ? '' : ' disconnected'}`}>
                      {p.name}
                      {p.id === myPlayerId && ' (vous)'}
                      {!p.connected && ' (déconnecté)'}
                    </span>
                    {p.isHost && <span className="badge badge-gold">Hôte</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="stack" style={{ marginTop: '1.25rem' }}>
              {confirmingLeave ? (
                <>
                  <p className="muted center">Le reste du gang continuera sans vous. Confirmer ?</p>
                  <button type="button" className="btn btn-danger btn-block" onClick={handleLeave}>
                    Oui, quitter la partie
                  </button>
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmingLeave(false)}>
                    Annuler
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirmingLeave(true)}>
                  Quitter la partie
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
