# Le Casse

Adaptation web, mobile-first et multijoueur en ligne, du jeu de poker coopératif où un
gang doit se classer en secret — de la main la plus faible à la plus forte — en
n'utilisant que des jetons pour communiquer. Cette implémentation reprend les **règles**
du jeu original (déroulé des braquages, jetons, classement des mains, mode Avancé) mais
avec un visuel, des textes et un pack de cartes bonus/malus entièrement originaux — aucun
asset ni texte du jeu original n'est réutilisé.

## Fonctionnalités

- Parties en ligne à 3–6 joueurs : un joueur héberge, les autres rejoignent avec un code à 4 lettres.
- Moteur de jeu 100 % côté serveur (autoritaire) : tours de jetons en temps réel, showdown, égalité parfaite.
- 14 cartes bonus/malus originales (le pack complet est toujours en jeu, avec les exclusions automatiques des modes Pro/Gangster), qui se déclenchent après un succès (plus dur) ou un échec (plus facile) — inspirées des modes Avancé/Pro/Gangster, avec des effets et un contenu propres à cette adaptation.
- Reconnexion automatique (déconnexion Wi-Fi, mise en veille du téléphone) via un jeton stocké localement.
- Pensé mobile d'abord (PWA installable), utilisable aussi sur ordinateur.

## Stack technique

- `shared/` — types TypeScript, contrat d'événements Socket.IO, évaluateur de mains de poker, pack de cartes bonus/malus. Consommé directement en TypeScript par le serveur et le client (pas d'étape de build séparée).
- `server/` — Node.js + Express + Socket.IO. Moteur de jeu et salons en mémoire.
- `client/` — React + TypeScript + Vite, CSS mobile-first, PWA.

## Démarrage local

Prérequis : Node.js 20+.

```bash
npm install
npm run dev
```

Cela lance le serveur (port 3001) et le client (port 5173, avec proxy Socket.IO vers le
serveur) en parallèle. Ouvrez `http://localhost:5173` dans plusieurs onglets pour tester
une partie à plusieurs. Pour tester depuis un téléphone sur le même Wi-Fi, remplacez
`localhost` par l'adresse IP locale de votre ordinateur.

### Tests

```bash
npm run test
```

## Déploiement

L'application est un seul service déployable : en production, le serveur Express sert
aussi les fichiers statiques du client buildé, sur la même origine que Socket.IO (pas de
CORS à gérer, une seule URL à partager).

- **Build** : `npm ci && npm run build -w client`
- **Start** : `npm run start -w server`
- Le serveur lit `PORT` depuis l'environnement (par défaut 3001) — la plupart des
  hébergeurs (Render, Railway, Fly.io…) l'injectent automatiquement.

Un `Dockerfile` est fourni à la racine pour un déploiement par conteneur, sur n'importe
quel hébergeur qui le supporte :

```bash
docker build -t le-casse .
docker run -p 3001:3001 le-casse
```

## Structure du jeu

Voir le moteur dans [`server/src/game/engine.ts`](server/src/game/engine.ts) pour le
détail des règles implémentées, et
[`shared/src/bonusCards.ts`](shared/src/bonusCards.ts) pour le pack de cartes bonus/malus.
