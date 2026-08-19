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

Le jour où un nom pointe sur la machine, le passage au HTTPS est prévu : voir la surcouche
Caddy dans la section suivante. Il n'y a alors rien à changer côté serveur ; côté APK,
retirez `allowMixedContent` et `cleartext` de `capacitor.config.ts` et reconstruisez avec la
nouvelle adresse.

## Déployer sur un serveur distant (Hetzner)

Le déploiement part de GitHub sur un tag `v*` : le code est envoyé par SSH, l'image est
reconstruite sur place et les conteneurs redémarrent. Une version publiée met donc à jour le
serveur et produit l'APK correspondant, et rien ne bouge entre deux versions — un commit de
passage ne coupe jamais une partie en cours.

### 1. Faire pointer le nom sur le serveur

Si le nom a d'abord servi à joindre une machine à la maison via un client DynDNS, **coupez ce
client avant tout** : sur la Livebox, onglet DynDNS, supprimez l'entrée. Sinon la box
continuera d'y republier l'adresse de la maison toutes les quelques minutes et écrasera ce
que vous aurez mis.

Ensuite, chez le fournisseur du nom (No-IP), passez l'enregistrement A sur l'IP du serveur.
Une machine chez un hébergeur a une adresse fixe : le DNS dynamique n'a plus d'objet, un
enregistrement statique suffit. Vérifiez avant d'aller plus loin :

```bash
nslookup lecasse.ddns.net
```

La réponse doit être l'IP du serveur. Le certificat HTTPS ne peut pas être délivré tant que
ce n'est pas le cas.

### 2. Préparer la machine

Il faut Docker avec le plugin Compose, et les ports 80 et 443 ouverts — y compris dans le
pare-feu de l'hébergeur s'il y en a un (Hetzner Cloud Firewall). Le port 80 sert à valider le
certificat, même si tout le trafic finit en 443.

```bash
ssh utilisateur@serveur
sudo mkdir -p /opt/le-casse && sudo chown $USER /opt/le-casse
```

Le premier déploiement crée un `.env` à partir de `.env.example`. Renseignez-y `SITE_ADDRESS`
avec le nom du site (sans `http://`), puis relancez un déploiement.

### 3. Donner à GitHub de quoi se connecter

Créez une clé dédiée au déploiement, sans mot de passe — elle sert à une machine, pas à vous :

```bash
ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-actions"
ssh-copy-id -i deploy_key.pub utilisateur@serveur
```

Puis, dans **Settings → Secrets and variables → Actions** :

| Type | Nom | Valeur |
| --- | --- | --- |
| Secret | `DEPLOY_HOST` | l'IP ou le nom du serveur |
| Secret | `DEPLOY_USER` | l'utilisateur SSH |
| Secret | `DEPLOY_SSH_KEY` | le contenu de `deploy_key` (la clé **privée**, en entier) |
| Variable | `SITE_URL` | `https://lecasse.ddns.net` — sert à vérifier que le déploiement a pris |
| Variable | `DEPLOY_PATH` | facultatif, `/opt/le-casse` par défaut |
| Variable | `DEPLOY_PORT` | facultatif, `22` par défaut |

Supprimez ensuite `deploy_key` de votre machine : GitHub en a une copie, et cette clé ouvre
un accès au serveur.

### 4. Déployer

```bash
git tag v1.2.0 && git push --tags
```

Le workflow **Déploiement du serveur** part, et le workflow **APK Android** avec lui. Le
déploiement se termine par un appel à `/healthz` sur `SITE_URL` : tant que ça ne répond pas,
il n'est pas considéré comme réussi. Le tout premier essai peut prendre une minute de plus,
le temps que le certificat soit délivré.

On peut aussi le lancer à la main depuis **Actions → Déploiement du serveur → Run workflow**.

### Cohabitation et exploitation

Le jeu n'occupe que 80 et 443 (Caddy) : tout autre service déjà en place sur la machine, sur
ses propres ports, n'est pas concerné. Sur le serveur :

```bash
cd /opt/le-casse
docker compose logs -f          # les deux fichiers sont pris en compte via COMPOSE_FILE
docker compose ps
```

### Sans HTTPS

Si les ports 80/443 ne sont pas disponibles, déployez sans la surcouche : retirez
`-f docker-compose.https.yml` des deux commandes du workflow. Le jeu publie alors `HOST_PORT`
et s'atteint en `http://adresse:port`, à brancher derrière le reverse proxy déjà en place.

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
   la variable `SERVER_URL` avec l'adresse publique du serveur (ex. `https://lecasse.ddns.net`,
   ou `http://192.0.2.10:3001` tant que le serveur n'a pas de certificat).
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
