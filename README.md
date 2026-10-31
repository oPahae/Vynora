# Vynora — Reseau social

Reseau social complet inspire de Facebook, Threads et Discord, construit avec
Next.js (Pages Router), React, TailwindCSS, MySQL et Socket.IO.

Projet **complet** — les 10 phases de developpement initiales ont ete livrees
et verifiees, avec une refonte complete du design (identite visuelle "Nexus",
palette cobalt-violet/corail, typographie Space Grotesk + Inter, mode sombre)
et un stockage de tous les medias en BLOB dans MySQL plutot que sur disque.
Voir la section [Fonctionnalites](#fonctionnalites) pour le detail.

> **Extension 2026 (complete)** : un second lot de fonctionnalites a ete
> ajoute par phases validees une a une : statut personnalise, publications
> enregistrees/epinglees, brouillons, notifications par categorie, feed
> personnalise par score, recherche globale, notifications push,
> assistant IA, groupes/communautes, page Explorer, geolocalisation et
> statistiques personnelles. Voir [Nouvelles fonctionnalites](#nouvelles-fonctionnalites-en-cours)
> pour le detail de chaque phase et les limitations connues.

## Stack technique

| Domaine | Technologie |
|---|---|
| Framework | Next.js 14 (Pages Router, JavaScript uniquement) |
| UI | React 18, TailwindCSS, Framer Motion, lucide-react |
| Base de donnees | MySQL / MariaDB (mysql2) |
| Authentification | JWT (jose) + bcryptjs + cookies HTTP Only |
| Temps reel | Socket.IO (serveur Node personnalise) |
| Upload de fichiers | formidable (parsing en memoire, aucune ecriture disque) |
| Stockage des medias | BLOB en base de donnees MySQL (table `media`), servis via `/api/media/[id]` |
| Images | next/image |
| Audio / Video | HTML5 natif |

Aucune librairie superflue : pas de TypeScript, pas de Prisma, pas de Redux,
pas de framework CSS externe, pas de CSS Modules ni de styled-components.

## Fonctionnalites

- **Authentification** : inscription, connexion, deconnexion, JWT en cookie
  HTTP Only, middleware de protection des routes, hachage bcrypt
- **Captcha** : Google reCAPTCHA v2 (case a cocher) sur la connexion,
  verifie cote serveur (voir la section « Configuration » ci-dessous)
- **Mot de passe oublie** : code a 6 chiffres envoye par email (valable
  15 min, 5 essais, usage unique), puis choix d'un nouveau mot de passe
- **Profils** : photo de profil, couverture, bio, travail, etudes, ville,
  pays, edition complete
- **Amis** : invitations, acceptation, refus, annulation, suppression,
  blocage/deblocage, suggestions basees sur les amis en commun
- **Publications** : texte, images, videos multiples, hashtags, mentions
  `@`, visibilite (publique / amis / privee / tout le monde sauf... /
  personnes precises) verifiee cote serveur, edition, suppression, copie de
  lien, partage
- **Commentaires** : texte, image, video, audio, edition, suppression,
  reponses imbriquees infinies
- **Reactions** : 6 types (J'aime, J'adore, Haha, Wouah, Grr, Triste) sur
  publications, commentaires et stories
- **Fil d'actualite** : agregation des publications d'amis, publiques et
  partagees, avec pagination infinie
- **Stories** : texte, photo, video, expiration automatique a 24h, vues,
  reactions
- **Messagerie temps reel** : conversations privees, texte/image/video/
  audio/fichier, edition, suppression (pour moi / pour tous), accuses de
  lecture, indicateur de frappe, presence en ligne
- **Appels audio / video et partage d'ecran** : depuis l'en-tete d'une
  conversation privee, en pair-a-pair (WebRTC). Sonnerie sur toutes les pages
  et tous les onglets, micro / camera / partage d'ecran activables en cours
  d'appel, mode reduit, refus des appels entre utilisateurs bloques
- **Notifications temps reel** : amis, messages, commentaires, reponses,
  mentions, likes, partages, stories
- **Parametres** : email, mot de passe, theme clair/sombre, compte prive,
  gestion des utilisateurs bloques

## Nouvelles fonctionnalites (en cours)

Ajout progressif, par phases validees une a une, des fonctionnalites du
second cahier des charges. Chaque phase reste additive : aucune
fonctionnalite existante n'a ete supprimee ni modifiee dans son
comportement d'origine.

### Phase 1 — Livree

- **🟢 Statut personnalise** : distinct du statut en ligne/hors ligne
  (Socket.IO, inchange). Table `presenceStatus` (a ne pas confondre avec la
  table `status` existante, qui gere les *stories*). Presets (En train de
  coder, de jouer, d'etudier, d'ecouter de la musique, Ne pas deranger) ou
  texte + emoji libres, expiration facultative (1h / 4h / aujourd'hui /
  jusqu'a modification). Reglable depuis l'icone dediee dans la barre de
  navigation ; affiche sur le profil, dans la liste d'amis et dans la liste
  de conversations, en respectant les memes regles de confidentialite que le
  profil (bloque = invisible, profil prive = reserve aux amis).
- **🔖 Publications enregistrees** : bouton "Enregistrer" dans le menu de
  chaque publication, page dediee `/saved` avec filtres (Tous / Photos /
  Videos / Publications) et date d'enregistrement affichee. Table
  `savedPost`.
- **📌 Publications epinglees** : jusqu'a 3 par profil, bandeau dedie en
  haut du profil, badge visuel "Epingle", verification serveur que seul le
  proprietaire peut epingler ses propres publications. Table `pinnedPost`.
- **📝 Brouillons** : sauvegarde explicite depuis le composeur ("Brouillon"),
  page `/drafts` (modifier / publier / supprimer), support du texte, de la
  visibilite et des medias (images/videos). Limite de 30 brouillons par
  utilisateur pour eviter les abus de stockage. Tables `postDraft` et
  `draftMedia`.
- **🔔 Notifications par categorie** : onglets Tout / J'aime / Commentaires /
  Amis / Mentions / Partages sur `/notifications`, filtrage cote serveur.
  Compteur non-lu, "tout marquer comme lu" et navigation vers le contenu
  concerne existaient deja et ont ete conserves tels quels. La categorie
  "Messages" du cahier des charges n'a pas ete recreee : l'application
  genere deja un badge de messages non lus separe (page Messages) et ne
  cree pas de notifications de type "message" par conception — dupliquer ce
  compteur dans le centre de notifications aurait ete redondant et source
  d'incoherence.

**Non traite dans cette phase** (prevu pour les phases suivantes, non
encore implemente) : feed personnalise par score, recherche globale
utilisateurs/hashtags/publications, page Explorer, groupes/communautes,
statistiques personnelles, assistant IA dans le composeur, notifications
push (Web Push), geolocalisation des publications.

### Phase 2 — Livree

- **📰 Feed personnalise par score** : la route existante `/api/feed` a ete
  enrichie (pas de nouvelle route) avec un mode "Pour vous" par defaut et un
  mode "Recent" (chronologique, comportement d'origine strictement
  conserve, accessible via `?sort=recent` ou le bouton dans l'interface).
  Le score est deterministe (aucun alea, aucune IA) et documente en detail
  dans `lib/feedScoring.js` : ponderation de la recence (decroissance
  exponentielle, demi-vie 30h), de la proximite sociale (ami / ami commun /
  inconnu), de l'affinite avec l'auteur (historique d'interactions sur 30
  jours), de l'affinite avec les hashtags interagis recemment, et de
  l'engagement global du post (likes/commentaires/partages, normalise). Une
  passe de diversite limite a 2 le nombre de publications consecutives du
  meme auteur. Un utilisateur sans amis ni historique retombe naturellement
  sur un classement recence + engagement (pas de code special requis).
  **Notes de performance** : le lot de candidats (200 publications
  visibles les plus recentes) est recalcule a chaque requete de page ; ce
  choix privilegie la simplicite et la fraicheur des donnees pour un reseau
  de taille moyenne. Sur un reseau a tres grande echelle, la piste
  d'optimisation recommandee serait de mettre en cache le score par
  utilisateur (ex. Redis, TTL de quelques minutes) plutot que de le
  recalculer systematiquement.
- **🔎 Recherche globale avancee** : nouvelle route unifiee `/api/search`
  (personnes + hashtags + publications, respecte les blocages et la
  confidentialite existante) plutot que des routes dupliquees — la route
  `/api/users/search` deja existante n'a pas ete touchee et continue de
  servir l'ajout d'amis. Barre de recherche dans la navbar (apercu en
  direct avec debounce 300ms, recherches recentes) et page `/search`
  dediee avec onglets Tout / Personnes / Hashtags / Publications,
  pagination progressive. Historique de recherche par utilisateur
  (`searchHistory`, 15 entrees max, purge automatique des plus anciennes),
  avec suppression individuelle ou totale.

**Non traite dans les phases suivantes** (a venir) : page Explorer,
groupes/communautes, statistiques personnelles, assistant IA dans le
composeur, notifications push (Web Push), geolocalisation des
publications.

### Phase 3 — Livree

- **🔔 Notifications push (Web Push)** : couche supplementaire ajoutee au
  point d'entree unique `createNotification` (`lib/notifications.js`) —
  aucun des tres nombreux appelants existants (likes, commentaires,
  reponses, partages, mentions, demandes/acceptations d'ami...) n'a ete
  modifie, les notifications in-app continuent de fonctionner exactement
  comme avant. Service Worker (`public/sw.js`), abonnement gere cote
  client (`lib/pushClient.js`) avec demande d'autorisation explicite
  (jamais automatique), reglage dans Parametres > Notifications. Cote
  serveur (`lib/push.js`) : stockage securise des abonnements
  (`pushSubscription`, un par navigateur/appareil, dedoublonne par
  `endpoint`), suppression automatique des abonnements expires/invalides
  (reponses HTTP 404/410 du service push), et non-envoi du push si
  l'utilisateur a deja une session Socket.IO active (evite la double
  alerte in-app + push). Sans cles VAPID configurees, la fonctionnalite
  reste desactivee proprement (aucune erreur, le reste de l'application
  n'est pas affecte) — voir "Configuration des notifications push"
  ci-dessous.
- **🤖 Assistant IA du composeur** : bouton "✨ Assistant IA" dans le
  composeur et dans l'edition de brouillon, avec 6 actions (ameliorer,
  corriger, reformuler, resumer, traduire, generer une legende). Appel a
  l'API Anthropic (Claude) exclusivement depuis le backend
  (`lib/aiAssistant.js` + route `/api/ai/assist`) : la cle API n'est
  jamais exposee au frontend. Limite de frequence (15 requetes / 10 min
  par utilisateur, en memoire), delai d'attente de 20s, longueur de texte
  plafonnee (2000 caracteres), messages d'erreur clairs (cle invalide,
  service indisponible, delai depasse). Sans `AI_API_KEY` configuree,
  l'assistant se desactive proprement au lieu d'utiliser une fausse cle —
  voir "Configuration de l'assistant IA" ci-dessous. **Verifie** : la
  route a ete testee avec une vraie requete reseau vers l'API Anthropic
  (cle invalide volontaire) pour confirmer le format de requete et la
  gestion d'erreur ; un test avec une cle valide reste a faire par vous
  lors du deploiement.

**Non traite dans la prochaine phase** (a venir) : page Explorer,
groupes/communautes, statistiques personnelles, geolocalisation des
publications.

### Phase 4 — Livree

- **👥 Groupes/communautes** : creation (nom, description, public/prive),
  adhesion immediate (public) ou sur demande avec approbation (prive),
  roles owner/admin/member, exclusion de membres (regles : le proprietaire
  ne peut etre exclu, un admin ne peut pas exclure un autre admin),
  promotion/retrogradation admin reservee au proprietaire, suppression du
  groupe (cascade sur ses membres et publications), moderation des
  publications par les admins/owner. Nouvelles tables `communityGroup` et
  `communityGroupMember`, colonne `post.groupId`. La visibilite d'une
  publication de groupe est geree par une branche dediee, ajoutee en tete
  de `canViewPost` (`lib/posts.js`) : elle ne modifie ni ne contourne la
  logique de visibilite existante pour les publications hors groupe. Les
  publications de groupe sont volontairement exclues du fil d'actualite
  principal et de la recherche globale (espace dedie a la page du groupe),
  pour eviter toute confusion entre contenu personnel et contenu de
  groupe. Limitation assumee : le blocage entre utilisateurs ne s'applique
  pas au contenu d'un groupe partage (comportement usuel des groupes sur
  la plupart des reseaux sociaux — le blocage empeche les interactions
  directes, pas la coexistence dans un espace commun).
- **🔥 Page Explorer** (`/explore`) : hashtags tendance (7 derniers jours),
  publications populaires (classees par engagement reel, jamais
  aleatoire), publications recentes, et une section "Utilisateurs a
  decouvrir" qui **reutilise la route existante** `/api/friends/suggestions`
  plutot que d'en dupliquer la logique.
- **🗺️ Geolocalisation des publications** : champ texte facultatif
  (`post.location`, ex. "Casablanca, Morocco") ajoutable/modifiable/
  supprimable depuis le composeur et l'edition d'une publication, jamais
  detecte automatiquement (aucun appel a la geolocalisation du navigateur
  sans action explicite de l'utilisateur, conformement au cahier des
  charges). Affiche sur la publication avec une icone dediee, respecte la
  visibilite existante de la publication (aucune regle de confidentialite
  separee necessaire).
- **📊 Statistiques personnelles** (`/stats`) : publications, reactions et
  commentaires recus, partages, vues, nombre d'amis — toutes ces valeurs
  proviennent de requetes reelles sur la base de donnees, jamais de
  donnees inventees. Graphique d'evolution de l'engagement sur 8 semaines,
  dessine en SVG leger (`components/stats/engagementChart.jsx`) sans
  dependance de librairie graphique supplementaire. **Verifie** : le
  decoupage par semaine ISO calcule cote JavaScript a ete teste face a
  l'equivalent SQL `YEARWEEK(date, 3)` de MySQL sur plusieurs dates,
  y compris des cas limites de fin/debut d'annee, pour garantir que les
  deux cotes s'alignent exactement.

Les 13 fonctionnalites du cahier des charges sont desormais toutes
livrees. Voir "Limitations connues" ci-dessous pour les quelques
simplifications assumees.

## Phase 5 — Reels, collections, signalements, administration

Toutes ces fonctionnalites sont additives. Sur une **base existante**, executer
une fois, dans l'ordre : `migrations/013_reels_collections_reports_admin_activity.sql` puis
`migrations/014_moderation_reasons.sql` (`mysql -u root -p social_network < fichier.sql`, rejouables sans danger). Une nouvelle installation via `database.sql` contient deja tout.
Nouvelles dependances : `npm install` (ajoute `qrcode` et `jsqr`).

- **Reels** (`/reels`) : flux vertical plein ecran (defilement magnetique, lecture
  automatique du reel visible, double-tap = j'aime, appui long / survol = palette de
  reactions, barre de progression glissable, son, clavier : fleches/j/k, espace, m, l, c).
  J'aime, commentaires et **reponses** (avec reactions) comme les publications,
  notifications, signalement, "ce reel ne m'interesse pas", partage, ajout a une collection.
  Onglets **Pour vous** (recommandation) et **Amis**. Publication : video 3 min / 200 Mo max
  (`REEL_MAX_FILE_BYTES` pour changer la limite).
- **Recommandation intelligente** (`lib/reels.js`, sans service externe) : profil de gout
  construit depuis le temps de visionnage, les boucles, les reactions, commentaires, ajouts
  en collection, les "pas interesse" et les skips rapides, repartis sur hashtags et auteurs ;
  score = interet + affinite auteur + proximite sociale + qualite + fraicheur + popularite +
  duree preferee, penalite "deja vu", diversite d'auteurs et ~20 % d'exploration. Chaque reel
  recommande indique pourquoi ("Parce que vous aimez #cuisine"...).
- **Collections** (`/collections`) : dossiers imbriquables et playlists ordonnees (posts + reels),
  couleurs, visibilite prive/amis/public, deplacement, reordonnancement, lecture continue des
  reels d'une playlist. Ajout depuis le menu d'une publication ou d'un reel. Affichees sur le profil.
- **Signalements** : comptes, publications, commentaires, reels, commentaires de reels, groupes
  (menu "Signaler"), anonymes, un signalement par personne et par contenu.
- **Administration** (`/admin`) : vue d'ensemble, signalements groupes par cible (ignorer / supprimer
  le contenu / bannir, avec option de purge), utilisateurs (bannir, debannir, promouvoir,
  supprimer), publications, commentaires, reels, groupes, serveurs, journal d'audit. Un compte
  banni est deconnecte immediatement (API + sockets) et son contenu disparait des flux.
  **Premier administrateur** : `ADMIN_EMAILS=moi@exemple.com` dans `.env`, ou
  `npm run make-admin -- moi@exemple.com` (`--remove` pour retrograder).
- **Motifs de moderation** : toute suppression de contenu, tout bannissement et toute suppression
  de compte par un admin demande un motif (liste deroulante + « Autre » avec champ libre). L'auteur
  recoit une notification « L'administration a supprime votre ... Motif : ... » (identite de l'admin
  masquee). Un compte banni ou supprime est **deconnecte en direct** (evenement socket, avec controle
  de secours toutes les 60 s) et le motif s'affiche sur la page de connexion, puis a chaque tentative.
- **Mot de passe** : barre de force animee en temps reel (inscription, reinitialisation,
  changement de mot de passe).
- **Journal d'activite** (`/activity`) : publications, reactions, commentaires, invitations
  envoyees/acceptees/refusees, reels, groupes, blocages, connexions... avec filtres.
- **QR code** : "QR code du profil" (telechargeable en PNG, copiable, partageable) et scanner
  dans la page Amis (camera ou image importee). La camera exige HTTPS (ou localhost).
- **Langues** : les nouveaux textes sont traduits en anglais, arabe et espagnol ; les autres
  langues retombent automatiquement sur le francais pour ces textes.

## Phase 6 — Alertes de connexion, Premium (PayPal), revision des bannissements

Sur une base existante, executer en plus (apres 013 et 014) :
`mysql -u root -p social_network < migrations/015_login_alerts_premium_appeals.sql` (rejouable).

- **Alertes de connexion** : chaque appareil est identifie par un cookie long (`nx_device`). Une
  connexion depuis un **nouvel appareil** (alors que le compte en connaissait deja un) cree une
  notification (+ push) et envoie un email avec l'appareil, la **localisation approximative** et l'IP.
  Localisation : en-tetes CDN (`x-vercel-ip-city`, `cf-ipcountry`...) sinon service ipwho.is ;
  en local, « Reseau local ». Page `/devices` : liste des appareils, « Oublier ». Derriere un proxy,
  transmettre `X-Forwarded-For`. Le tout apres la reponse de connexion : aucun ralentissement.
- **Premium** (`/premium`), paiement **PayPal** : badge verifie (publications, commentaires, reels,
  profil), **visiteurs du profil** (`/visitors`, visites enregistrees pour tous, detail reserve aux
  premium), **boost** de publications publiques (menu de la publication : priorite dans les fils +
  mention « Mis en avant »). Prix, duree, devise PayPal, taux, duree et nombre de boosts sont
  **modifiables par l'admin** (Administration > Premium). Defaut : 49 MAD pour 30 jours.
  PayPal n'accepte pas le dirham : le prix affiche reste en MAD, PayPal facture la conversion
  (devise + taux reglables, defaut 1 MAD = 0,10 USD). Le montant est toujours fixe cote serveur
  et verifie a la capture. Configurer `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`
  (`sandbox` pour tester, `live` en production). `PAYPAL_MODE=mock` simule PayPal en local
  (refuse en production). L'admin peut offrir/retirer Premium et voir paiements et revenus.
- **Revision d'un bannissement** : sur la page de connexion, un compte banni voit le motif et un lien
  « Demander une revision » (`/appeal`, publique : email + mot de passe + message). L'admin traite
  (Administration > Revisions) : **accepter** (compte retabli) ou **refuser** (motif obligatoire) ;
  la decision est envoyee **par email**. Une seule demande en attente, nouvelle demande possible
  7 jours apres un refus. Un deban depuis la liste des utilisateurs cloture aussi la demande.

## Phase 7 — Achats Premium, badge partout, historique des bannissements

Sur une base existante, executer en plus : `migrations/016_premium_notifications_ban_records.sql`
(rejouable ; ordre : 013, 014, 015, 016).

- **Achat Premium** : l'acheteur recoit une notification de felicitations (+ email + message sur la page),
  tous les administrateurs sont notifies en temps reel. Administration > Premium : statistiques de
  vente (aujourd'hui, 7/30 jours, revenus, acheteurs, rachats, panier moyen, taux de conversion,
  graphique 14 jours) et **liste des acheteurs** (nombre d'achats, total, dernier achat, actif/expire).
- **Les administrateurs ont Premium par defaut** (badge, visiteurs, boost), sans achat.
- Une fois Premium (achat ou admin), l'entree « Premium » disparait du menu lateral.
- **Son des reels** : active par defaut quand l'utilisateur arrive par un clic ; si le navigateur
  bloque l'autoplay avec son, une pastille « Appuyez pour activer le son » apparait (un appui suffit).
  Le choix muet/son est memorise.
- **Badge verifie partout** a cote du nom : publications, commentaires, partages, reels, stories,
  recherche, amis/suggestions, messages, groupes, serveurs, mentions, listes de reactions/vues,
  visiteurs, profil et menu utilisateur.
- **Revision d'un bannissement** : l'admin voit le motif d'origine, la date, l'administrateur, le
  **contenu a l'origine du bannissement** (publication, reel, commentaire... avec extrait conserve
  meme si supprime, et lien s'il existe) ou, a defaut, les signalements lies au compte.

## Limitations connues

- **Feed personnalise** : le score est recalcule a chaque requete plutot
  que mis en cache (voir "Notes de performance" plus haut) ; adapte a un
  reseau de taille moyenne, un cache serait recommande a tres grande
  echelle.
- **Notifications** : la categorie "Messages" n'a pas ete recreee dans le
  centre de notifications, les messages ayant deja leur propre badge non-lu
  dedie (voir Phase 1).
- **Brouillons** : la localisation n'est pas encore persistee dans un
  brouillon (uniquement au moment de la publication reelle).
- **Assistant IA** : teste uniquement avec une cle invalide (gestion
  d'erreur confirmee) faute de cle Anthropic valide disponible pendant le
  developpement ; a tester avec une vraie cle lors du deploiement.
- **Groupes** : pas de transfert de propriete (le proprietaire ne peut pas
  quitter son groupe, seulement le supprimer) ; le blocage entre
  utilisateurs ne s'applique pas au contenu partage d'un groupe commun.

## Verification finale

Conformement a la demande, une derniere verification globale a ete
effectuee apres la Phase 4, serveur reellement demarre (`node server.js`)
et requetes HTTP reelles envoyees (`curl`) :

- **Bug trouve et corrige** : le middleware d'authentification
  (`middleware.js`) interceptait `/sw.js`, `/manifest.json` et les icones
  PNG et redirigeait les requetes non authentifiees vers `/login` (ces
  fichiers n'etaient pas exclus du matcher). Consequence concrete : le
  Service Worker, enregistre des le chargement de l'app (y compris sur la
  page de connexion), recevait une reponse HTML de redirection au lieu du
  fichier JavaScript attendu, et echouait silencieusement. Corrige en
  excluant ces fichiers publics du matcher. Verifie apres correction :
  `/sw.js`, `/manifest.json` et `/icon.png` repondent `200` avec le bon
  type MIME sans authentification, tandis que les pages protegees
  continuent de rediriger correctement (`307`) et que toutes les nouvelles
  routes API (`/api/groups`, `/api/explore`, `/api/stats`, `/api/search`,
  `/api/status`, `/api/posts/saved`, `/api/drafts`, `/api/ai/assist`,
  `/api/push/vapid-public-key`) continuent de repondre `401` sans session.
- Schema complet (`database.sql`) importe tel quel (DROP/CREATE DATABASE
  inclus, comme le ferait un utilisateur reel) : 33 tables creees sans
  erreur.
- Parcours de mise a jour complet simule : base reconstituee dans son etat
  *avant toute extension*, puis les 3 migrations incrementales
  (`002` → `003` → `004`) appliquees dans l'ordre : resultat identique
  (33 tables) a une installation neuve.
- Aucun `console.log` de debogage ni marqueur `TODO`/`FIXME` laisse dans
  le code ajoute.



- Node.js 18 ou superieur
- MySQL 8 ou superieur (ou MariaDB compatible)

## Installation

1. Installer les dependances :

   ```bash
   npm install
   ```

2. Creer la base de donnees en important le schema complet :

   ```bash
   mysql -u root -p < database.sql
   ```

   Le script cree la base `social_network`, ses 23 tables (utilisateurs,
   medias en BLOB, amis, blocages, publications, commentaires, reactions, hashtags,
   mentions, stories, conversations, messages, notifications) ainsi que les
   index de performance.

3. Copier le fichier d'environnement et renseigner vos identifiants MySQL :

   ```bash
   cp .env.example .env.local
   ```

   Variables a configurer dans `.env.local` :

   | Variable | Description |
   |---|---|
   | `DB_HOST` | Hote MySQL (ex: `localhost` ou `127.0.0.1`) |
   | `DB_PORT` | Port MySQL (par defaut `3306`) |
   | `DB_USER` | Utilisateur MySQL |
   | `DB_PASSWORD` | Mot de passe MySQL |
   | `DB_NAME` | Nom de la base (`social_network`) |
   | `JWT_SECRET` | Cle secrete utilisee pour signer les tokens JWT, a changer en production |
   | `JWT_EXPIRES_IN` | Duree de validite du token (ex: `7d`) |
   | `UPLOAD_DIR` | Dossier de stockage des fichiers uploades |
   | `MAX_UPLOAD_SIZE` | Taille maximale d'un fichier uploade en octets |
   | `NEXT_PUBLIC_APP_URL` | URL publique de l'application |
   | `PORT` | Port du serveur Node |

4. Lancer le serveur de developpement :

   ```bash
   npm run dev
   ```

   L'application est disponible sur [http://localhost:3000](http://localhost:3000).

## Configuration : captcha, emails et appels

Variables a definir dans `.env` (voir `.env.example`) :

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Cle publique reCAPTCHA v2 (affichee au navigateur) |
| `RECAPTCHA_SECRET_KEY` | Cle secrete reCAPTCHA (serveur uniquement). Vide = captcha desactive |
| `MAIL_API_URL` | API d'envoi d'emails (requete GET `?email=&subject=&text=&html=`) |
| `ICE_SERVERS` | Optionnel : serveurs STUN/TURN au format JSON pour les appels |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Cles Web Push. Vide = notifications push desactivees proprement |
| `VAPID_CONTACT_EMAIL` | Email de contact transmis avec les cles VAPID (requis par la norme Web Push) |
| `AI_API_KEY` | Cle API Anthropic. Vide = assistant IA desactive proprement |
| `AI_MODEL` | Modele Anthropic utilise par l'assistant IA (verifier la disponibilite sur docs.claude.com) |

- **reCAPTCHA** : les cles doivent etre de type **v2 « Je ne suis pas un
  robot »** et le domaine utilise (`localhost` en developpement) doit figurer
  dans la console reCAPTCHA. `NEXT_PUBLIC_*` est integre au build : relancer
  `npm run build` apres modification.
- **Mot de passe oublie** : sur une base existante, executer
  `migrations/001_password_reset.sql` (cree la table `passwordReset` sans
  toucher aux donnees ; `database.sql` commence par `DROP DATABASE`).
- **Statut personnalise / enregistres / epingles / brouillons** : sur une
  base existante (installee avant cette mise a jour), executer
  `migrations/002_phase1_features.sql` (cree les tables `presenceStatus`,
  `savedPost`, `pinnedPost`, `postDraft`, `draftMedia` sans toucher aux
  donnees existantes ; script idempotent, peut etre relance sans risque).
  Pour une toute nouvelle installation, `database.sql` contient deja ces
  tables, aucune action supplementaire n'est necessaire.
- **Notifications push** : sur une base existante, executer
  `migrations/003_phase3_push.sql` (cree la table `pushSubscription`,
  idempotent). Puis generer une paire de cles VAPID :
  `npx web-push generate-vapid-keys`, et renseigner `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` et `VAPID_CONTACT_EMAIL` dans `.env`. Sans ces
  variables, la fonctionnalite reste desactivee proprement (aucune
  erreur), le reste de l'application n'est pas affecte.
- **Assistant IA** : renseigner `AI_API_KEY` (cle API Anthropic) dans
  `.env` pour activer le bouton "Assistant IA" du composeur. Sans cette
  variable, le bouton reste visible mais indique clairement que
  l'assistant n'est pas configure plutot que d'utiliser une fausse cle.
- **Groupes et geolocalisation** : sur une base existante, executer
  `migrations/004_phase4_groups_location.sql` (cree les tables
  `communityGroup`/`communityGroupMember` et ajoute les colonnes
  `post.groupId`/`post.location`, idempotent — verifie via
  information_schema avant chaque modification).
- **Appels** : le navigateur n'autorise micro / camera / partage d'ecran qu'en
  **HTTPS** (ou sur `localhost`). Sans serveur TURN, certains reseaux
  (4G, pare-feu d'entreprise) peuvent empecher la connexion pair-a-pair :
  renseigner `ICE_SERVERS` avec un serveur TURN (ex. coturn) en production.
  Le partage d'ecran n'est pas propose sur les navigateurs mobiles qui ne le
  supportent pas.

## Lancement en production

```bash
npm run build
npm start
```

Le projet utilise un serveur Node personnalise (`server.js`) qui combine
Next.js et Socket.IO afin que tout le temps reel (messagerie, notifications,
frappe en direct, presence en ligne) fonctionne nativement, sans service
externe additionnel.

## Structure du projet

```
social-network/
  components/        Composants React reutilisables (camelCase), organises par domaine
    auth/            Connexion, inscription, mot de passe oublie, reCAPTCHA
    calls/           Interface des appels audio/video (plein ecran, reduit, boutons)
    comments/        Commentaires et reponses
    friends/         Amis et cartes utilisateur
    layout/          Navbar, navigation mobile, mise en page
    messages/        Messagerie
    notifications/   Notifications
    posts/           Publications, reactions, partages, mentions
    profile/         Profil utilisateur
    settings/        Parametres du compte
    shared/          Composants generiques (avatar, listes infinies...)
    stories/         Stories
  lib/               Logique partagee cote serveur et client
    auth.js          JWT, hachage des mots de passe, cookies
    db.js            Pool de connexions MySQL
    posts.js         Visibilite, agregation, hashtags, mentions, partages
    comments.js      Agregation des commentaires
    conversations.js Messagerie
    stories.js       Stories
    notifications.js Creation, diffusion temps reel et categorisation des
                     notifications
    presenceStatus.js Statut personnalise (distinct de la presence en ligne
                     et des stories)
    statusConstants.js Constantes du statut personnalise (partagees
                     client/serveur, sans dependance a la base de donnees)
    savedPosts.js    Publications enregistrees
    pinnedPosts.js   Publications epinglees sur le profil
    drafts.js        Brouillons de publication
    feedScoring.js   Scoring deterministe du feed personnalise
    search.js        Recherche globale et historique de recherche
    push.js          Envoi de notifications push (Web Push, serveur)
    pushClient.js     Enregistrement du Service Worker et abonnement push (client)
    aiAssistant.js   Assistant IA du composeur (appel API Anthropic, serveur)
    groups.js        Groupes/communautes : creation, adhesion, roles, moderation
    explore.js       Hashtags tendance, publications populaires/recentes (page Explorer)
    stats.js         Statistiques personnelles de l'utilisateur
    upload.js        Upload de fichiers (formidable)
    callContext.jsx  Etat global des appels WebRTC (micro, camera, partage d'ecran)
    mailer.js        Envoi d'emails via l'API HTTP
    passwordReset.js Codes de reinitialisation du mot de passe
    recaptcha.js     Verification serveur des jetons reCAPTCHA
  pages/
    api/             Toutes les routes API REST
    ...              Pages Next.js (Pages Router)
  public/uploads/    Fichiers uploades par les utilisateurs
  public/sw.js       Service Worker (reception des notifications push)
  public/icon*.png, manifest.json  Icones utilisees par les notifications
                     push et le manifeste web
  styles/            Feuille de style Tailwind globale (inclut le mode sombre)
  database.sql       Schema MySQL complet du projet
  middleware.js      Protection des routes cote edge
  migrations/        Scripts SQL a appliquer sur une base existante
  server/            Signalisation des appels (Socket.IO), utilisee par server.js
  server.js          Serveur Node personnalise (Next.js + Socket.IO)
```

## Notes de performance

- Les agregats (reactions, commentaires, vues) sont calcules par requetes
  groupees en lot plutot que requete par requete, quel que soit le nombre
  d'elements affiches sur une page.
- Index composites dedies aux jointures et filtres les plus frequents.
- Pagination infinie (chargement automatique au scroll) sur le fil
  d'actualite, les commentaires et les notifications.
- Composants de liste memoises (`React.memo`) avec callbacks stabilises.
- Images optimisees via `next/image` (lazy loading automatique).

## Etat d'avancement

- [x] Phase 1 — Initialisation, base de donnees, authentification JWT
- [x] Phase 2 — Profils, amis, blocage
- [x] Phase 3 — Publications, commentaires, reactions, visibilite
- [x] Phase 4 — Partages, tags, fil d'actualite
- [x] Phase 5 — Stories
- [x] Phase 6 — Messagerie Socket.IO
- [x] Phase 7 — Notifications temps reel
- [x] Phase 8 — Parametres
- [x] Phase 9 — Optimisation, animations, responsive
- [x] Phase 10 — Verification complete et documentation finale

## Langues (i18n)

L'application est disponible en **arabe (RTL)**, anglais, francais, espagnol, italien, japonais, chinois et russe.
La langue se change dans **Parametres > Langue** (et via le selecteur en haut des pages de connexion/inscription).

- Migration a executer : `mysql -u root -p social_network < migrations/012_user_language.sql`
- Les textes francais d'origine servent de cles : `t("Texte francais")` (`lib/i18n/runtime.jsx`).
- Dictionnaires : `lib/i18n/locales/{en,ar,es,it,ja,zh,ru}.js` (cle absente = texte francais).
- Cote serveur : les e-mails et notifications push utilisent la langue enregistree sur le compte ; les messages d'API sont traduits cote client.
- RTL : `dir="rtl"` est applique automatiquement a `<html>` pour l'arabe (classes Tailwind logiques `ms-/me-/ps-/pe-/start-/end-`).
- Pour ajouter un texte : l'ecrire en francais dans `t("...")` puis ajouter sa traduction dans chaque dictionnaire.
