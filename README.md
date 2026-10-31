<div align="center">

# Vynora

**Réseau social full-stack : fil d'actualité, reels, stories, messagerie temps réel, appels audio/vidéo, serveurs communautaires, premium et administration.**

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518.17-339933?logo=nodedotjs&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P-333333?logo=webrtc&logoColor=white)
![i18n](https://img.shields.io/badge/i18n-8%20langues-blueviolet)

</div>

---

## Sommaire

- [À propos](#à-propos)
- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration (variables d'environnement)](#configuration-variables-denvironnement)
- [Base de données](#base-de-données)
- [Scripts disponibles](#scripts-disponibles)
- [Administration](#administration)
- [Aperçu de l'API](#aperçu-de-lapi)
- [Temps réel (Socket.IO)](#temps-réel-socketio)
- [Sécurité](#sécurité)
- [Internationalisation](#internationalisation)
- [Structure du projet](#structure-du-projet)
- [Déploiement en production](#déploiement-en-production)
- [Dépannage](#dépannage)
- [Contribuer](#contribuer)
- [Licence](#licence)

---

## À propos

**Vynora** est une application de réseau social complète construite avec **Next.js (Pages Router)** et un **serveur Node.js personnalisé** qui embarque **Socket.IO** pour le temps réel (messagerie, présence, notifications, signalisation WebRTC). Les données sont stockées dans **MySQL**, y compris les médias (avatars, images, vidéos, messages vocaux) servis par une route authentifiée interne.

Le projet couvre l'ensemble d'une plateforme moderne : contenu social, messagerie, communautés façon « serveurs », monétisation par abonnement Premium (PayPal), modération et outils d'administration.

> Le nom de l'application est centralisé dans `lib/constants.js` (`APP_NAME`) : une seule valeur à modifier pour renommer l'interface.

---

## Fonctionnalités

### Authentification et comptes
- Inscription en **deux étapes avec code de vérification par e-mail**
- Connexion par **JWT** stocké dans un cookie HTTP (`authToken`)
- **reCAPTCHA v2** (activé automatiquement si la clé secrète est définie)
- Indicateur de **robustesse du mot de passe**
- **Mot de passe oublié** (code par e-mail) et **retrouver mon compte** (recherche, envoi de code, réinitialisation)
- **Changement d'e-mail** avec confirmation par code
- **Désactivation** et **suppression** de compte
- **Gestion des appareils** : alerte (notification + e-mail) à chaque connexion depuis un nouvel appareil, avec localisation approximative
- **Blocage** d'utilisateurs

### Profil
- Avatar et couverture (publiés comme publications dédiées), bio, travail, formation, ville, liens sociaux
- **Musique de profil** (lecteur intégré)
- **Statut personnalisé** (icône + texte, préréglages « En train de coder », « Ne pas déranger », etc.) et **statut en ligne** (désactivable)
- **Publications épinglées**, reels et collections affichés sur le profil
- **Partage par QR code** et **scanner de QR code**
- **Profil privé**, avec écrans dédiés pour les profils privés et bloqués
- **Visiteurs du profil** : compteur pour tous, détail réservé aux comptes Premium

### Publications et fil d'actualité
- Texte, images et vidéos multiples, avec lightbox et lecteur vidéo
- **Visibilité fine** : Public, Amis, Privé, *Sauf certaines personnes*, *Personnes précises*
- **Mentions** (`@`) avec autocomplétion, **hashtags** et pages de hashtag, **localisation**
- **6 réactions** : J'aime, Je n'aime pas, Haha, Wouah, Grr, Triste
- Commentaires **imbriqués** (réponses) avec réactions
- **Partage** (repost avec citation), **enregistrement**, **épinglage**, **brouillons**, édition
- Statistiques de vues, liste des réacteurs, des partageurs et des spectateurs
- **Fil personnalisé** par un algorithme de scoring **déterministe et documenté** (sans aléatoire ni modèle externe), combinant 8 composantes : récence (demi-vie de 30 h), proximité sociale, affinité avec l'auteur, affinité par messages, affinité par hashtags, engagement, vélocité initiale et activité de l'auteur. Voir `lib/feedScoring.js`
- **Assistant IA dans le composeur** : améliorer, corriger, reformuler, résumer, traduire, générer une légende

### Reels
- Vidéos courtes en flux vertical (durée max **180 s**, taille max configurable, **200 Mo** par défaut)
- Réactions, commentaires avec réactions, masquage de reels, compteur de vues

### Stories
- Stories **éphémères** (texte avec couleur de fond, image ou vidéo ; vidéo limitée à **5 minutes**)
- Barre de stories, visionneuse, réactions, liste des spectateurs

### Collections
- Dossiers ou playlists pour organiser des publications, avec visibilité privée, amis ou publique et couleurs personnalisables

### Amis et découverte
- Demandes d'amis (envoyer, annuler, accepter, refuser), suppression, **suggestions** (amis en commun)
- **Explorer** : hashtags tendance (fenêtre de 7 jours) et contenu public
- **Recherche intelligente tolérante aux fautes de frappe** (utilisateurs, hashtags, publications) avec historique (15 entrées par utilisateur)

### Messagerie temps réel
- Conversations privées et de groupe
- Messages texte, médias et **messages vocaux** (lecteur audio intégré)
- Indicateur de saisie, accusés de lecture, **transfert** de messages, **favoris**, suppression
- **Appels audio et vidéo 1-à-1** en WebRTC pair-à-pair (sonnerie 45 s, détection « occupé », sonneries et synchronisation multi-onglets)

### Groupes communautaires
- Groupes **publics** ou **privés** (demandes d'adhésion), rôles `owner` / `admin` / `member`
- Publications de groupe, invitations, avatar et couverture

### Serveurs (type Discord)
- **Catégories**, **salons textuels et vocaux**, salons privés
- **Rôles hiérarchiques** avec **15 permissions** (masque de bits) : administrateur, gérer le serveur, les salons, les rôles, supprimer les messages, expulser, créer des invitations, envoyer des messages, se connecter, parler, caméra, partage d'écran, rendre muet, gérer le mode lent, ignorer le mode lent
- **Mode lent** par salon, **mentions**, liens d'invitation
- **Vocal multi-participants** avec caméra, partage d'écran et mute modérateur

### Notifications
- Notifications **in-app** catégorisées (cloche et page dédiée, marquer comme lu / tout lire)
- **Notifications push Web Push** (VAPID), désactivables proprement si non configurées

### Premium (PayPal)
- Paiement via **PayPal Orders v2** avec montant **toujours fixé côté serveur**
- Prix, devise de facturation, taux de change, durée (ou à vie) et paramètres de boost **modifiables depuis l'administration**
- Avantages : **badge vérifié**, **boost de publications** (48 h par défaut, 3 boosts actifs max), **détail des visiteurs du profil**
- Les administrateurs bénéficient automatiquement du Premium à vie
- Valeurs par défaut : 49 MAD, 30 jours, facturation en USD (taux 0,10)

### Modération et administration
- **Signalements** (publications, commentaires, reels, groupes, serveurs, stories, utilisateurs)
- **Bannissements** avec motif et **demandes de révision** (page `/appeal` accessible sans connexion)
- Un utilisateur banni ou supprimé voit ses connexions temps réel **coupées immédiatement**
- Tableau de bord, journal d'audit, gestion du contenu et des paiements (voir [Administration](#administration))

### Expérience utilisateur
- **Thème clair / sombre**
- **8 langues**, dont l'arabe avec support **RTL**
- Interface responsive avec barre d'onglets mobile, squelettes de chargement, défilement infini, animations (Framer Motion), toasts et boîtes de confirmation
- **PWA** : manifeste et service worker pour les notifications push
- **Statistiques personnelles** avec graphique d'engagement sur 8 semaines

---

## Stack technique

| Couche | Technologies |
| --- | --- |
| Framework | Next.js 14.2 (Pages Router), React 18 |
| Serveur | Node.js, serveur HTTP personnalisé (`server.js`) |
| Temps réel | Socket.IO 4 (client et serveur), WebRTC |
| Base de données | MySQL (`mysql2`), schéma utf8mb4 |
| Authentification | `jose` (JWT), `bcryptjs` |
| Uploads | `formidable` (traitement en mémoire, stockage `LONGBLOB`) |
| Paiement | PayPal Orders v2 (API REST) |
| Notifications | `web-push` (VAPID) |
| UI | Tailwind CSS 3, Framer Motion, lucide-react |
| QR code | `qrcode` (génération), `jsqr` (lecture) |
| Qualité | ESLint (`eslint-config-next`) |

---

## Architecture

```
┌────────────────────────┐        ┌───────────────────────────────────────┐
│   Navigateur (React)   │◄──────►│  server.js  (Node.js HTTP)            │
│  Pages + composants    │  HTTP  │   ├─ Next.js (pages + routes /api/*)  │
│  Socket.IO client      │        │   └─ Socket.IO (/api/socket)          │
│  WebRTC (appels)       │        │        ├─ présence, messages, typing  │
└───────────┬────────────┘        │        ├─ server/callSignaling.js     │
            │                     │        └─ server/guildVoiceSignaling.js│
            │  flux audio/vidéo   └──────────────────┬────────────────────┘
            │  pair-à-pair                           │
            ▼                                        ▼
   ┌──────────────────┐                     ┌────────────────┐
   │ STUN / TURN      │                     │     MySQL      │
   │ (ICE_SERVERS)    │                     │ (données+médias)│
   └──────────────────┘                     └────────────────┘
```

Points clés :

- **Serveur personnalisé** : `npm run dev` et `npm start` lancent `server.js`, qui sert Next.js **et** Socket.IO sur le même port.
- **Signalisation WebRTC uniquement** : le serveur ne transporte jamais les flux audio/vidéo, les navigateurs communiquent en pair-à-pair.
- **Médias en base** : les fichiers sont stockés dans la table `media` et servis via `/api/media/[id]` (route authentifiée). L'optimiseur d'images Next.js est donc désactivé (`images.unoptimized`), car il ne transmet pas le cookie d'authentification.
- **Présence symétrique** : si un utilisateur masque son statut en ligne, il ne voit pas non plus celui des autres.

---

## Prérequis

- **Node.js** ≥ 18.17 (requis par Next.js 14) et **npm**
- **MySQL 8** (ou MariaDB compatible) avec support `utf8mb4`
- *(Optionnel)* Compte PayPal Developer, clés VAPID, clés reCAPTCHA v2, serveur TURN

---

## Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/oPahae/Vynora.git
cd Vynora

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env        # ou créez .env à partir de la section ci-dessous

# 4. Créer la base de données (voir l'avertissement ci-dessous)
mysql -u root -p < database.sql

# 5. Lancer en développement
npm run dev
```

L'application est disponible sur **http://localhost:3000** (ou le `PORT` défini).

Créer ensuite un compte administrateur :

```bash
npm run make-admin -- admin@exemple.com --create "MotDePasseSolide123!"
```

---

## Configuration (variables d'environnement)

Créez un fichier `.env` à la racine (déjà ignoré par Git). Exemple de `.env.example` :

```env
# --- Base de données ---
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=social_network

# --- Authentification ---
JWT_SECRET=remplacez-par-une-longue-chaine-aleatoire
JWT_EXPIRES_IN=7d

# --- Application ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
PORT=3000
MAX_UPLOAD_SIZE=            # en octets ; vide = aucune limite

# --- reCAPTCHA v2 (optionnel) ---
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=       # vide = vérification serveur désactivée

# --- E-mails (codes de vérification / réinitialisation) ---
MAIL_API_URL=               # vide = API par défaut du projet

# --- Appels audio/vidéo (optionnel) ---
ICE_SERVERS=                # tableau JSON RTCIceServer (STUN/TURN)

# --- Notifications push (optionnel) ---
# Générer : npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=mailto:contact@exemple.com

# --- Administration ---
ADMIN_EMAILS=               # e-mails (séparés par des virgules) promus admin

# --- Premium / PayPal ---
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox         # sandbox | live | mock (mock : hors production uniquement)

# --- Reels (optionnel) ---
REEL_MAX_FILE_BYTES=        # défaut : 209715200 (200 Mo)
```

| Variable | Obligatoire | Description |
| --- | :---: | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | ✅ | Connexion MySQL |
| `JWT_SECRET` | ✅ | Secret de signature des JWT (longue chaîne aléatoire) |
| `JWT_EXPIRES_IN` | ✅ | Durée de validité de la session |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL publique de l'application |
| `PORT` | — | Port d'écoute (3000 par défaut) |
| `MAX_UPLOAD_SIZE` | — | Plafond d'upload en octets (aucune limite si vide) |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` | — | reCAPTCHA v2 ; clé secrète vide = désactivé |
| `MAIL_API_URL` | — | API HTTP d'envoi d'e-mails |
| `ICE_SERVERS` | — | Serveurs STUN/TURN ; STUN Google par défaut |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT_EMAIL` | — | Web Push ; vides = push désactivé sans erreur |
| `ADMIN_EMAILS` | — | Promotion automatique en administrateur |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_MODE` | — | Paiement Premium |
| `REEL_MAX_FILE_BYTES` | — | Taille maximale d'un reel |

> ⚠️ **Ne commitez jamais `.env`.** Il est déjà couvert par `.gitignore` (seul `.env.example` est autorisé).

---

## Base de données

Le schéma complet est dans [`database.sql`](./database.sql) (utf8mb4, InnoDB, clés étrangères avec suppression en cascade). Il contient une soixantaine de tables, regroupées ainsi :

| Domaine | Tables principales |
| --- | --- |
| Utilisateurs et sécurité | `user`, `block`, `loginDevice`, `emailVerification`, `passwordReset`, `deletedAccount` |
| Contenu | `post`, `postMedia`, `postView`, `postVisibilityUser`, `hashtag`, `postHashtag`, `comment`, `mention`, `reaction`, `postDraft`, `draftMedia`, `savedPost`, `pinnedPost`, `collection`, `collectionItem` |
| Reels et stories | `reel`, `reelReaction`, `reelComment`, `reelCommentReaction`, `reelView`, `reelHidden`, `reelHashtag`, `status`, `statusView`, `statusReaction` |
| Social | `friend`, `communityGroup`, `communityGroupMember`, `profileVisit`, `searchHistory`, `presenceStatus` |
| Messagerie | `conversation`, `conversationParticipant`, `message`, `messageSeen`, `messageDeletion`, `messageFavorite` |
| Serveurs | `guild`, `guildMember`, `guildRole`, `guildMemberRole`, `guildCategory`, `guildChannel`, `guildChannelRole`, `guildChannelMember`, `guildMessage`, `guildInvite` |
| Notifications | `notification`, `pushSubscription` |
| Premium | `payment`, `postBoost`, `appSetting` |
| Modération | `report`, `banRecord`, `banAppeal`, `activityLog`, `adminAudit` |
| Médias | `media` (`LONGBLOB`) |

> ⚠️ **Attention :** `database.sql` commence par `DROP DATABASE social_network;` puis recrée la base. **Ne l'exécutez jamais sur une base contenant des données à conserver.** Supprimez ou commentez cette ligne pour une installation sur un serveur existant.

---

## Scripts disponibles

| Commande | Description |
| --- | --- |
| `npm run dev` | Démarre le serveur de développement (`node server.js`, Next.js + Socket.IO) |
| `npm run build` | Compile l'application Next.js pour la production |
| `npm start` | Démarre en production (`NODE_ENV=production node server.js`) |
| `npm run lint` | Analyse le code avec ESLint |
| `npm run make-admin -- <email>` | Promeut un compte en administrateur |
| `npm run make-admin -- <email> --remove` | Retire les droits d'administrateur |
| `npm run make-admin -- <email> --create "<mot de passe>"` | Crée un compte administrateur déjà vérifié |

---

## Administration

Deux moyens d'obtenir un compte administrateur :

1. La variable `ADMIN_EMAILS` : les adresses listées sont promues à leur prochaine requête.
2. Le script `npm run make-admin` (voir ci-dessus).

Le panneau `/admin` regroupe :

| Onglet | Rôle |
| --- | --- |
| Vue d'ensemble | Statistiques globales |
| Signalements | Traitement des signalements |
| Révisions | Demandes de révision de bannissement |
| Utilisateurs | Recherche, bannissement, gestion des comptes |
| Premium | Acheteurs, paiements, réglages (prix, devise, taux, durée, boosts) |
| Publications, Commentaires, Reels, Com. reels | Modération du contenu |
| Groupes, Serveurs | Modération des communautés |
| Journal d'audit | Historique des actions d'administration |

Toute sanction exige un **motif** (non-respect des règles, spam, harcèlement, discours haineux, violence, nudité, fausses informations, arnaque, usurpation d'identité, ou motif libre). L'utilisateur concerné est notifié.

---

## Aperçu de l'API

Toutes les routes sont sous `/api` (Next.js API Routes) et protégées par le cookie JWT, sauf l'authentification et les pages publiques.

| Domaine | Exemples de routes |
| --- | --- |
| Auth | `POST /api/auth/login`, `/logout`, `/register/request-code`, `/register/confirm`, `/forgot-password`, `/reset-password`, `/find-account/*`, `GET /api/auth/me` |
| Utilisateurs | `/api/users/me`, `/users/[id]`, `/users/search`, `/users/me/{avatar,cover,password,privacy,theme,language,music}`, `/users/me/email-change/*`, `/users/me/account/{deactivate,delete}` |
| Publications | `/api/posts`, `/posts/[id]`, `/posts/[id]/{react,comments,share,save,pin,boost,view,viewers,reactions,shares}`, `/posts/saved`, `/api/feed` |
| Commentaires | `/api/comments/[id]`, `/comments/[id]/{react,replies}` |
| Reels | `/api/reels`, `/reels/[id]/{comments,react,view,hide}`, `/api/reel-comments/[id]` |
| Stories | `/api/stories`, `/stories/[id]/{react,view,viewers}` |
| Messagerie | `/api/conversations`, `/conversations/[id]/{messages,read}`, `/api/messages/[id]/{forward,favorite}`, `/api/messages/favorites` |
| Amis | `/api/friends`, `/friends/[userId]/{request,accept,reject,cancel,remove}`, `/friends/{requests,sent,suggestions}` |
| Groupes | `/api/groups`, `/groups/[id]/{members,join,leave,invite,posts,requests,avatar,cover}` |
| Serveurs | `/api/guilds`, `/guilds/join`, `/guilds/[id]/{channels,categories,roles,members,invite,leave}` |
| Collections | `/api/collections`, `/collections/[id]/items` |
| Recherche et découverte | `/api/search`, `/search/history`, `/api/explore`, `/hashtags/[tag]/posts`, `/api/mentions/search` |
| Notifications et push | `/api/notifications`, `/notifications/readAll`, `/push/{subscribe,unsubscribe,vapid-public-key}` |
| Premium | `/api/premium`, `/premium/order`, `/premium/capture` |
| Modération | `/api/reports`, `/api/appeals`, `/api/block` |
| Divers | `/api/media/[id]`, `/api/ai/assist`, `/api/calls/ice-servers`, `/api/stats`, `/api/visitors`, `/api/devices`, `/api/status`, `/api/drafts` |
| Administration | `/api/admin/{stats,users,reports,appeals,content,payments,premium-buyers,audit,settings}` |

Format de réponse : JSON avec `{ success: boolean, message?: string, ... }`.

---

## Temps réel (Socket.IO)

Le serveur Socket.IO est exposé sur le chemin `/api/socket` et authentifie chaque connexion via le cookie `authToken` (les comptes bannis ou supprimés sont refusés).

| Module | Événements |
| --- | --- |
| Présence et conversations | `presence:list`, `presence:update`, `conversation:join`, `conversation:leave` |
| Appels 1-à-1 (`server/callSignaling.js`) | client → serveur : `call:invite`, `call:accept`, `call:decline`, `call:end`, `call:signal`, `call:state` ; serveur → client : `call:incoming`, `call:accepted`, `call:handled`, `call:ended`, `call:signal`, `call:peer-state` |
| Vocal des serveurs (`server/guildVoiceSignaling.js`) | `voice:join`, `voice:list`, `voice:leave`, `voice:signal`, `voice:state`, `voice:mute-user` |

---

## Sécurité

- **Mots de passe** hachés avec `bcryptjs`
- **Sessions** par JWT signé (`jose`), vérifiées par un `middleware.js` qui redirige les visiteurs non connectés vers `/login`
- **Vérification d'e-mail** à l'inscription et pour le changement d'adresse
- **reCAPTCHA v2** sur les formulaires d'authentification
- **Limiteur de débit** en mémoire (fenêtre glissante) sur les routes sensibles
- **Paiements** : montants décidés côté serveur uniquement, jamais par le navigateur
- **Alertes de connexion** sur nouvel appareil, avec cookie d'appareil `HttpOnly` / `SameSite=Lax` (`Secure` en production)
- **Contrôle d'accès** sur chaque publication (visibilité, blocages, amis) et sur chaque salon (permissions par rôle)
- **Coupure immédiate** des sockets d'un utilisateur banni ou supprimé
- Requêtes SQL **paramétrées**

Voir aussi la section [Déploiement en production](#déploiement-en-production) pour les points de durcissement.

---

## Internationalisation

8 langues disponibles, sélectionnables dans les paramètres : **Français** (langue par défaut), **English**, **العربية** (RTL), **Español**, **Italiano**, **日本語**, **中文**, **Русский**.

- Les fichiers de traduction sont dans `lib/i18n/locales/`
- La langue est mémorisée dans le cookie `lang` et sur le compte utilisateur
- La direction du texte (LTR / RTL) est appliquée automatiquement

Pour ajouter une langue : créer `lib/i18n/locales/<code>.js`, l'enregistrer dans `lib/i18n/locales/index.js` et l'ajouter à la liste `LOCALES` de `lib/i18n/config.js`.

---

## Structure du projet

```
Vynora/
├── components/          # Composants React par domaine
│   ├── admin/ auth/ calls/ collections/ comments/ drafts/ friends/
│   ├── groups/ layout/ messages/ notifications/ posts/ premium/
│   ├── profile/ reels/ reports/ search/ servers/ settings/
│   ├── shared/ stats/ status/ stories/
├── lib/                 # Logique métier (accès BDD, auth, premium, feed, i18n…)
│   └── i18n/            # Moteur de traduction + 8 langues
├── pages/               # Pages Next.js (Pages Router)
│   └── api/             # Routes d'API REST
├── server/              # Signalisation WebRTC (appels, vocal des serveurs)
├── scripts/make-admin.js
├── public/              # manifest.json, service worker, icônes
├── styles/globals.css
├── database.sql         # Schéma MySQL complet
├── middleware.js        # Protection des routes
├── server.js            # Serveur HTTP + Next.js + Socket.IO
├── tailwind.config.js
└── package.json
```

---

## Déploiement en production

```bash
npm ci
npm run build
npm start
```

Checklist recommandée :

- [ ] Servir derrière **HTTPS** (reverse proxy Nginx / Caddy) avec support **WebSocket** pour `/api/socket`
- [ ] Définir un `JWT_SECRET` long et aléatoire, et un `NEXT_PUBLIC_APP_URL` en `https://`
- [ ] Restreindre l'origine CORS de Socket.IO (actuellement `*` dans `server.js`) à votre domaine
- [ ] Configurer un **serveur TURN** via `ICE_SERVERS` : sans lui, les appels peuvent échouer sur réseaux mobiles ou derrière des pare-feu stricts
- [ ] Passer `PAYPAL_MODE=live` avec les identifiants de production
- [ ] Générer et renseigner les clés **VAPID** pour les notifications push
- [ ] Activer **reCAPTCHA** (`RECAPTCHA_SECRET_KEY`)
- [ ] Prévoir des **sauvegardes MySQL** régulières : les médias étant en base, la taille des sauvegardes augmente rapidement
- [ ] Le limiteur de débit est **en mémoire** : adapté à une seule instance ; le remplacer par Redis pour un déploiement multi-instances (le même constat vaut pour l'état de présence Socket.IO)
- [ ] Surveiller `max_allowed_packet` MySQL et fixer `MAX_UPLOAD_SIZE` en cohérence

---

## Dépannage

| Problème | Piste de résolution |
| --- | --- |
| Erreur de connexion MySQL au démarrage | Vérifier `DB_*` dans `.env` et que la base existe |
| Upload de vidéo qui échoue | Augmenter `max_allowed_packet` côté MySQL, vérifier `MAX_UPLOAD_SIZE` |
| Pas de notifications push | Vérifier les clés VAPID, que le site est en HTTPS et que le service worker est enregistré |
| Appels qui ne se connectent pas | Ajouter un serveur TURN dans `ICE_SERVERS` |
| E-mails non reçus | Vérifier `MAIL_API_URL` et les dossiers spam |
| Paiement PayPal indisponible | Vérifier `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` et `PAYPAL_MODE` |
| Images qui ne s'affichent pas | Les médias exigent le cookie de session : ne pas les charger depuis un autre domaine |

---

## Contribuer

Les contributions sont les bienvenues.

1. Forkez le dépôt
2. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
3. Committez vos changements : `git commit -m "feat: ma fonctionnalité"`
4. Poussez : `git push origin feature/ma-fonctionnalite`
5. Ouvrez une Pull Request

Merci de lancer `npm run lint` avant de soumettre, et de fournir les chaînes de traduction pour les nouveaux textes d'interface.

---

## Licence

Aucune licence n'est actuellement définie pour ce projet. Ajoutez un fichier `LICENSE` (par exemple MIT) pour préciser les conditions d'utilisation.

---

<div align="center">

Développé par [oPahae](https://github.com/oPahae)

</div>
