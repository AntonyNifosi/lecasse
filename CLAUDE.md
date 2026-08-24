# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Le Casse" — a mobile-first, online multiplayer adaptation of a cooperative poker game where a
gang must secretly rank itself weakest-to-strongest hand using only tokens to communicate.

**Hard constraint, set by the owner at project inception and still binding:** reuse the
*rules* of the source game, never its assets. No art, branding, card names, or flavor text
from the original — every visual, every string, and the whole 14-card bonus/malus pack are
original inventions for this adaptation. When adding content, invent it; don't port it.

**Language convention:** all user-facing UI text is French. All code comments and identifiers
are English. The README is French (it's for the owner). Match this.

## Commands

```bash
npm install          # once, from the repo root — npm workspaces
npm run dev          # server (:3001) + client (:5173, proxies /socket.io to the server)
npm test             # shared then server suites
npm run build -w client   # tsc -b && vite build — the only real build step
```

Testing a single file or case (vitest, run from the workspace that owns it):

```bash
npx vitest run src/game/engine.test.ts -t "name of the case"
```

Typechecking without building — the server has no build step, so this is the only way to
catch its type errors:

```bash
npx tsc -b server
```

Open `http://localhost:5173` in several tabs to play a multi-player game locally; a room
needs 3 players minimum. `start-dev.cmd` is a Windows convenience wrapper around `npm run dev`.

## Architecture

Three npm workspaces. `shared/` is consumed **as raw TypeScript** by both other packages
(`"main": "./src/index.ts"`, no build artifact) — editing it takes effect on both sides at
once, with no rebuild step to remember.

### Server is authoritative; the client renders and diffs

Nearly every mutation ends the same way: the server mutates room state, then broadcasts the
*entire* `RoomPublicState` to the room via a single `room:state` event
([handlers.ts](server/src/socket/handlers.ts) `broadcastRoom`). The client keeps one reducer
([GameContext.tsx](client/src/state/GameContext.tsx)) that replaces its state wholesale on
each one, and **derives animations by diffing against the previous state** rather than
listening for fine-grained events. This is deliberate — see the doc comment on
[events.ts](shared/src/events.ts) — and it means a reconnecting client is correct for free.

Consequences worth knowing before adding a feature:

- Adding a new "something happened" signal usually means adding a **field to the state**, not
  a new socket event. Reach for a new event only for things that must NOT survive a reconnect.
- `player:emoteReceived` is the reference example of a genuinely transient event: reactions
  are never stored in room state, so a late joiner simply doesn't see one that already fired.
- Private, per-player information travels as a `SideEffect`
  ([roomTypes.ts](server/src/game/roomTypes.ts)): engine functions return an array of them,
  and handlers dispatch them after the broadcast. Two shapes — `privatePeek` (exactly one
  card, about *someone else's* hand) and `privateInfo` (0+ cards, about *your own* situation).
  They surface as toasts in `App.tsx`.
- Hole cards never enter `RoomPublicState`. `toPublicState` / `toPublicGame`
  ([serialize.ts](server/src/game/serialize.ts)) strip the deck, and each player's own cards
  go out separately over `player:private`. **Anything secret must be filtered here.**

### Game engine

Rooms live in an in-memory `Map` ([rooms.ts](server/src/game/rooms.ts)) — nothing is
persisted, and idle rooms are swept after 30 minutes. Player join order *is* seating order,
which neighbor-based card effects depend on.

[engine.ts](server/src/game/engine.ts) holds the whole heist lifecycle. The flow:

`startGame` → `computeActiveCardsForHeist` → `startHeist` (fresh shuffled deck, deal,
`applyOnDealEffects`) → `enterRound` per color (white → yellow/flop → orange → red, drawing
community cards, `applyOnFlopEffects` at the flop) → `maybeAdvanceRound` once every token in
the round is claimed → `beginShowdown` → `revealNext` per player → `resolveHeist` →
`nextHeist`.

`computeActiveCardsForHeist` is the single point that decides what's active, for every mode.
Rounds a malus card disabled are skipped by `enterRound` recursing past them, so an inactive
round never becomes a state the client has to handle.

### Bonus/malus cards

[bonusCards.ts](shared/src/bonusCards.ts) defines 14 cards, each built from one of ~11
`EffectType` kinds. **A new card that reuses an existing effect kind needs no engine change** —
just add it to `BONUS_MALUS_CARDS`. A new *kind* needs a matching case in the engine's
`applyOnDealEffects` / `applyOnFlopEffects` / `beginShowdown` / `takeToken`.

The four `CardMode`s ([types.ts](shared/src/types.ts)) differ only in how the pools are
populated and which cards stay permanently active:

| Mode | Cards |
| --- | --- |
| `classique` | none, ever — pools left genuinely empty and `computeActiveCardsForHeist` returns `[]` |
| `avance` | one card per heist from heist 2: malus after a success, bonus after a failure |
| `pro` | `avance`, plus one permanent malus drawn at game start, live from heist 1 |
| `gangster` | always exactly 2 malus (no bonus at all), from heist 1, oldest swapped each heist; 2 alarms lose instead of 3 |

`vigile-zele` is excluded from the Pro/Gangster pools, mirroring the source rules.

### Client

Screens are chosen by `renderScreen` in [App.tsx](client/src/App.tsx) from room status +
`game.currentRound`, with local "ack" flags so the showdown and the final result aren't
skipped past when the server resolves several beats in one update.

Seat layout around the oval is computed in
[tableGeometry.ts](client/src/tableGeometry.ts) — extracted specifically so a harness can
measure the real layout rather than an approximation.

**Animation gotcha, learned the hard way — read before touching seat or token animation.**
[useTokenFlights.ts](client/src/hooks/useTokenFlights.ts) measures token positions with
`getBoundingClientRect()` synchronously inside a `useLayoutEffect`, i.e. before any paint. Any
CSS `transition` or `animation` on an *ancestor* of a token is therefore read at its **starting**
value, and the flying ghost lands in the wrong place. This is why `.my-seat.has-token`'s shift
has no CSS transition, and why [MySeat.tsx](client/src/components/MySeat.tsx) animates the
avatar/info/cards imperatively via the Web Animations API as *siblings* of the token instead.
WAAPI is also used there because re-keying a wrapper to restart a CSS animation remounts the
`.playing-card` children and re-triggers their own entrance animation.

## Deployment

Pushing a tag matching `v*` triggers **both** GitHub Actions workflows: the server deploys to
the Hetzner VPS over SSH, and the Android APK is built and attached to a GitHub Release. The
APK is also mirrored to the server at `downloads/le-casse.apk` (bind-mounted, served at
`/telecharger/`), always overwriting so only the latest build is kept.

**A tag push is a production deploy.** Don't tag or push without being asked; when asked,
derive the next version from `git tag -l --sort=-v:refname` rather than guessing.

The APK wraps the same web client via Capacitor and talks to the server over the network, so
its server address is baked in at build time (`VITE_SERVER_URL`). Code that must not run
inside the Android shell is gated on `'Capacitor' in window` — used for the service worker
registration ([main.tsx](client/src/main.tsx)) and the APK download button
([HomeScreen.tsx](client/src/screens/HomeScreen.tsx)).

`CORS_ORIGINS` being empty (= allow all) is a deliberate choice, not an oversight; the
reasoning is in [index.ts](server/src/index.ts).

## Conventions

Commit subjects are full sentences in the imperative describing the user-visible effect, not
conventional-commit prefixes — e.g. "Stop the claim animation flying my token too far right,
then snapping back", "Add a Classique mode with no bonus or malus cards".

Comments in this codebase explain *why*, especially where a simpler-looking approach was tried
and failed. Several carry hard-won reasoning (the animation gotcha above, emote transience,
CORS). Preserve them when refactoring nearby code.
