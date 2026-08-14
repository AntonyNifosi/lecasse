import { useState } from 'react';
import type { ErrorCode } from '@thegang/shared';
import { createRoom, joinRoom } from '../actions';
import { saveSession } from '../session';
import { useGameDispatch } from '../state/GameContext';
import { AVATAR_COLORS } from '../theme';

type View = 'menu' | 'create' | 'join';

function createErrorMessage(code: ErrorCode): string {
  if (code === 'NAME_TAKEN') return 'Ce pseudo est déjà pris';
  return 'Une erreur est survenue, réessayez.';
}

function joinErrorMessage(code: ErrorCode): string {
  switch (code) {
    case 'ROOM_NOT_FOUND':
      return "Cette salle n'existe pas (ou plus)";
    case 'ROOM_FULL':
      return 'Cette salle est complète';
    case 'NAME_TAKEN':
      return 'Ce pseudo est déjà pris dans cette salle';
    default:
      return 'Une erreur est survenue, réessayez.';
  }
}

interface ColorPickerProps {
  colorTag: string;
  onChange: (color: string) => void;
}

function ColorPicker({ colorTag, onChange }: ColorPickerProps) {
  return (
    <div className="field">
      <label>Couleur</label>
      <div className="row">
        {AVATAR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-swatch${color === colorTag ? ' selected' : ''}`}
            style={{ background: color }}
            aria-label={`Choisir la couleur ${color}`}
            aria-pressed={color === colorTag}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  );
}

export function HomeScreen() {
  const dispatch = useGameDispatch();
  const [view, setView] = useState<View>('menu');
  const [name, setName] = useState('');
  const [colorTag, setColorTag] = useState<string>(AVATAR_COLORS[0]);
  const [roomCode, setRoomCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goTo(next: View) {
    setError(null);
    setView(next);
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createRoom(trimmedName, colorTag);
      if (res.ok) {
        saveSession({ roomCode: res.roomCode, playerId: res.playerId, secretToken: res.secretToken, name: trimmedName, colorTag });
        dispatch({ type: 'SET_IDENTITY', playerId: res.playerId });
        // room:state will arrive over the socket and the app will navigate away from here automatically
      } else {
        setError(createErrorMessage(res.error));
        setSubmitting(false);
      }
    } catch {
      setError('Une erreur est survenue, réessayez.');
      setSubmitting(false);
    }
  }

  async function handleJoin() {
    const trimmedName = name.trim();
    if (!trimmedName || roomCode.length !== 4 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await joinRoom(roomCode, trimmedName, colorTag);
      if (res.ok) {
        saveSession({ roomCode: res.roomCode, playerId: res.playerId, secretToken: res.secretToken, name: trimmedName, colorTag });
        dispatch({ type: 'SET_IDENTITY', playerId: res.playerId });
      } else {
        setError(joinErrorMessage(res.error));
        setSubmitting(false);
      }
    } catch {
      setError('Une erreur est survenue, réessayez.');
      setSubmitting(false);
    }
  }

  if (view === 'menu') {
    return (
      <div className="screen screen-centered">
        <div>
          <h1 className="brand-title">
            Le <span className="accent">Casse</span>
          </h1>
          <p>Braquage coopératif à jouer entre potes, en ligne.</p>
        </div>
        <div className="stack" style={{ width: '100%' }}>
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => goTo('create')}>
            Créer une partie
          </button>
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => goTo('join')}>
            Rejoindre une partie
          </button>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="screen">
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => goTo('menu')}>
          ← Retour
        </button>
        <h2>Créer une partie</h2>
        <form
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <div className="stack">
            <div className="field">
              <label htmlFor="create-name">Pseudo</label>
              <input
                id="create-name"
                className="input"
                type="text"
                value={name}
                maxLength={20}
                placeholder="Ton pseudo"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <ColorPicker colorTag={colorTag} onChange={setColorTag} />
          </div>
          <div className="spacer" />
          {error && (
            <p className="muted center" style={{ color: 'var(--red-strong)' }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting || !name.trim()}>
            Créer la partie
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="screen">
      <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => goTo('menu')}>
        ← Retour
      </button>
      <h2>Rejoindre une partie</h2>
      <form
        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          void handleJoin();
        }}
      >
        <div className="stack">
          <div className="field">
            <label htmlFor="join-code">Code de la salle</label>
            <input
              id="join-code"
              className="input input-code"
              type="text"
              value={roomCode}
              maxLength={4}
              placeholder="ABCD"
              autoFocus
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
            />
          </div>
          <div className="field">
            <label htmlFor="join-name">Pseudo</label>
            <input
              id="join-name"
              className="input"
              type="text"
              value={name}
              maxLength={20}
              placeholder="Ton pseudo"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <ColorPicker colorTag={colorTag} onChange={setColorTag} />
        </div>
        <div className="spacer" />
        {error && (
          <p className="muted center" style={{ color: 'var(--red-strong)' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-block btn-lg"
          disabled={submitting || !name.trim() || roomCode.length !== 4}
        >
          Rejoindre
        </button>
      </form>
    </div>
  );
}
