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

## Héberger le serveur

L'application est un seul service : le serveur Express sert aussi les fichiers statiques du
client buildé, sur la même origine que Socket.IO. Une seule URL à partager, rien à
persister — les salons vivent en mémoire et disparaissent avec le processus.

### Avec Docker (recommandé)

Le conteneur ne publie qu'un port sur la machine hôte, donc il cohabite sans rien demander
avec d'autres conteneurs déjà en place : il suffit que le port choisi soit libre. Il ne
prend ni 80 ni 443 et n'a pas besoin de reverse proxy pour fonctionner.

```bash
git clone <votre-dépôt> le-casse && cd le-casse
cp .env.example .env          # ajustez HOST_PORT si 3001 est déjà pris
docker compose up -d --build
```

Le jeu est alors sur `http://ADRESSE_DU_SERVEUR:HOST_PORT`. Ensuite :

```bash
docker compose logs -f            # suivre les logs
docker compose ps                 # état + résultat du healthcheck
git pull && docker compose up -d --build   # mettre à jour
```

Le serveur expose `/healthz` (utilisé par le healthcheck du conteneur, et pratique pour de
la supervision).

### Sans Docker

```bash
npm ci
npm run build -w client
PORT=3001 npm run start -w server
```

### Variables d'environnement

| Variable       | Défaut | Rôle                                                                    |
| -------------- | ------ | ----------------------------------------------------------------------- |
| `PORT`         | `3001` | Port d'écoute du serveur.                                               |
| `HOST_PORT`    | `3001` | (compose) Port publié sur la machine hôte.                              |
| `CORS_ORIGINS` | vide   | Origines autorisées, séparées par des virgules. Vide = toutes acceptées. |

`CORS_ORIGINS` vide est un choix, pas un oubli : l'app Android sert ses pages depuis l'APK
et parle donc au serveur en cross-origin par nature. Il n'y a rien à protéger par origine —
ni cookie, ni identifiant implicite du navigateur — et un salon n'est jamais plus privé que
son code à 4 lettres.

### En HTTP simple (adresse IP, sans nom de domaine)

C'est le mode de fonctionnement par défaut ci-dessus, et le jeu marche entièrement ainsi,
navigateur comme APK. Deux limites à connaître :

- **Pas d'installation en PWA** depuis un navigateur : l'installation et le service worker
  exigent un contexte sécurisé (HTTPS ou `localhost`). L'APK Android n'est pas concerné.
- **L'APK doit accepter le trafic en clair**, ce qui est déjà configuré dans
  [`client/capacitor.config.ts`](client/capacitor.config.ts) (`allowMixedContent` +
  `cleartext`).

Le jour où vous avez un nom de domaine pointant sur la machine, un reverse proxy avec
certificat automatique suffit à passer en HTTPS — par exemple, avec Caddy :

```
lecasse.exemple.fr {
    reverse_proxy localhost:3001
}
```

Il n'y a alors plus rien à changer côté serveur ; côté APK, retirez `allowMixedContent` et
`cleartext` de `capacitor.config.ts` et reconstruisez avec la nouvelle adresse.

## APK Android

Le client web est empaqueté tel quel dans une coque Android
([Capacitor](https://capacitorjs.com/)) : même jeu, même code, mais les pages viennent de
l'APK au lieu d'être servies par le serveur. C'est pour ça que l'adresse du serveur doit
être connue **au moment du build** — d'où `VITE_SERVER_URL`.

Le projet Android n'est pas versionné : il est régénéré à chaque build à partir de
`capacitor.config.ts` et de `client/public/icon.svg`, qui restent les seules sources à
modifier.

### Construire l'APK

1. Dans le dépôt GitHub, **Settings → Secrets and variables → Actions → Variables**, créez
   la variable `SERVER_URL` avec l'adresse publique du serveur (ex. `http://192.0.2.10:3001`).
2. Onglet **Actions → APK Android → Run workflow**. L'adresse peut aussi être saisie
   directement au lancement, ce qui prend le pas sur la variable.
3. L'APK est en pièce jointe du run (section *Artifacts*), à récupérer et à installer sur le
   téléphone (il faut autoriser l'installation depuis une source inconnue).

Pousser un tag `v*` (`git tag v1.0.0 && git push --tags`) fait la même chose et attache en
plus l'APK à une release GitHub.

### Clé de signature (recommandé)

Sans clé configurée, le workflow produit un APK de **debug** : installable, mais chaque run
le signe avec une clé différente, donc Android refusera d'installer un nouveau build
par-dessus l'ancien sans désinstaller d'abord (ce qui efface la session en cours).

Pour y remédier, générez une clé une fois pour toutes :

```bash
keytool -genkey -v -keystore le-casse.jks -keyalg RSA -keysize 2048 -validity 10000 -alias le-casse
base64 -w0 le-casse.jks    # macOS : base64 -i le-casse.jks
```

Puis créez 4 secrets de dépôt (**Settings → Secrets and variables → Actions → Secrets**) :
`ANDROID_KEYSTORE_BASE64` (la sortie de la commande ci-dessus), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` (`le-casse`), `ANDROID_KEY_PASSWORD`. Le workflow bascule alors seul sur
un APK de release signé. **Conservez le fichier `.jks`** : le perdre interdit définitivement
toute mise à jour des installations existantes.

### Construire en local

```bash
cd client
VITE_SERVER_URL=http://192.0.2.10:3001 npm run build -w ../client
npx cap add android          # une seule fois
npm run android:assets
npx cap sync android
cd android && ./gradlew assembleDebug
```

Prérequis : JDK 21 et le SDK Android (Android Studio le fournit).

## Structure du jeu

Voir le moteur dans [`server/src/game/engine.ts`](server/src/game/engine.ts) pour le
détail des règles implémentées, et
[`shared/src/bonusCards.ts`](shared/src/bonusCards.ts) pour le pack de cartes bonus/malus.
