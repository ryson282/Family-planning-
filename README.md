# Family planning

Site statique privé : **Planning** (`index.html`) et **Tâches** (`taches.html`).

## Synchronisation Google Agenda
1. Google Agenda (version ordinateur) → Paramètres → l'agenda → « Intégrer l'agenda » → copier l'**adresse secrète au format iCal**.
2. GitHub → Settings → Secrets and variables → Actions → New secret `ICS_URLS`, une ligne par agenda :
   ```
   Famille|https://calendar.google.com/calendar/ical/.../private-xxxx/basic.ics
   Perso|https://calendar.google.com/calendar/ical/.../private-yyyy/basic.ics
   ```
3. Actions → « Synchroniser les agendas » → Run workflow (ensuite toutes les 3 h). Le résultat est écrit dans `data/calendar.js`.

Ne jamais mettre ces adresses dans le code. Ce dépôt doit rester **privé** (`data/calendar.js` contient vos événements).

## Données à compléter à la main
- `data/custody.js` : planning de garde
- `data/school-events.js` : événements scolaires (réunions de parents, examens ULiège...)
- `data/recurring-tasks.js` : tâches qui reviennent (entretiens, impôts, dentiste, pneus…), proposées dans les suggestions avant leur échéance (`month`, `day`, `lead`, `every`, `check`)
- `data/school-holidays.js` : vacances FWB 2026-2027 (à confirmer sur enseignement.be)
- `data/schedules.js` : horaires habituels (travail, école, garderie, activités, trajets) de chaque membre de la famille ; alimente la page **Semaine type** (`semaine.html`)

## Utilisation
Page **Planning** : vue **Mois** (pastilles, détail du jour au toucher) ou vue **Semaine** (semaine par semaine, comparée à la semaine type de `data/schedules.js` : en rouge ce qui change, est barré ou s'ajoute — congés, enfants chez l'autre parent, sessions d'examens, événements ; case « Seulement les différences »).
Ouvrir `index.html` dans un navigateur (ou servir le dossier avec `python3 -m http.server`).
Les tâches sont stockées dans le navigateur (localStorage) ; elles peuvent être partagées entre appareils (voir ci-dessous).

## Export du planning de garde estimé vers Google Agenda
`node scripts/export-ics.mjs` génère `export/garde-estimee.ics` (garde estimée par les règles de `data/custody.js`,
après le dernier événement réel). Dans Google Agenda (ordinateur) : Paramètres → Importer et exporter → Importer,
puis choisir l'agenda de destination. Les identifiants (UID) sont stables : réimporter le même fichier met à jour au lieu de dupliquer.

## Congés scolaires automatiques
Le workflow « Congés scolaires » (1er de chaque mois, ou à la main dans l'onglet Actions) lit la page « Calendrier scolaire » de www.enseignement.be (enseignement obligatoire, trois années scolaires
publiées à la fois) et écrit `data/school-holidays-auto.js`. (L'API OpenHolidays a été écartée : elle ne publie la FWB
que jusqu'en juillet 2027.) Les dates saisies à la main dans `data/school-holidays.js` restent prioritaires ; seules
les périodes postérieures à sa dernière entrée sont ajoutées. Si la page est injoignable ou n'a plus la structure
attendue, le workflow échoue (croix rouge) sans rien écrire.

## Partager les tâches entre appareils (Supabase)
Sans configuration, les tâches restent dans le navigateur de chaque appareil. Pour les partager (vous, Émilie, téléphone) :
1. Créer un projet gratuit sur https://supabase.com (région Europe), puis dans **SQL Editor** exécuter :
   ```sql
   create table family_tasks (id text primary key, data jsonb not null);
   alter table family_tasks enable row level security;
   create policy "famille" on family_tasks for all to anon using (true) with check (true);
   ```
2. **Project Settings → API** : copier l'**adresse du projet** (`https://xxxx.supabase.co`) et la clé **anon public**.
3. Renseigner les deux valeurs dans `data/sync-config.js` (déjà fait pour le projet de la famille) : elles sont alors partagées par tous les appareils qui ont le dépôt. À défaut, la page Tâches → « Synchronisation entre appareils » permet de les saisir dans le navigateur (propre à l'appareil).

La synchronisation se fait au chargement, toutes les minutes et au retour sur la page ; la modification la plus récente gagne. Hors ligne, les tâches restent utilisables et sont renvoyées ensuite.
Attention : toute personne qui possède l'adresse et la clé peut lire et modifier les tâches ; le dépôt doit rester **privé**. Utiliser uniquement la clé publique (`anon` / `publishable`), jamais la clé `service_role` ou « secret ». Il faut aussi que la page soit accessible sur chaque appareil (copie du dépôt ou hébergement).

## Consulter le site sur le téléphone (Cloudflare Pages)
Le workflow « Publier sur Cloudflare » publie le site (pages, `assets/`, `data/`) à chaque fusion dans `main` et après chaque synchronisation des agendas ou des congés.
1. Cloudflare → My Profile → API Tokens → Create Token → *Create Custom Token* : permission **Account > Cloudflare Pages > Edit**. Copier le jeton.
2. Copier aussi l'**Account ID** (Workers & Pages, colonne de droite).
3. GitHub → Settings → Secrets and variables → Actions → deux secrets : `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.
4. Actions → « Publier sur Cloudflare » → Run workflow. Le site est publié sur `https://<projet>.pages.dev` (nom du projet : variable optionnelle `CF_PAGES_PROJECT`, défaut `family-planning-ryson282`).
5. **Protéger l'accès avant de partager l'adresse** : Cloudflare → projet Pages → Settings → *Access policy* (Zero Trust, gratuit) → autoriser uniquement les e-mails de la famille (code à usage unique).
Sans les secrets, le workflow ne fait rien.

### Installer sur l'écran d'accueil (Android)
Le site fournit un manifeste (`manifest.webmanifest`) et une icône : dans Chrome, menu ⋮ → « Ajouter à l'écran d'accueil » (ou « Installer l'application ») ouvre le site en plein écran. Pas de mode hors ligne : les données sont toujours celles de la dernière publication.

## Contrôle des données et publication
- `node scripts/check-data.mjs` contrôle tous les fichiers `data/*.js` (syntaxe, personnes connues, dates valides, fin >= début, jour d'ancrage de la garde, horaires) et fait tourner la logique du site dessus (semaine type avec/sans A², vue semaine, garde). Il tourne à chaque pull request (workflow « Contrôle des données ») et **avant chaque publication** : une erreur bloque le déploiement. Il avertit aussi quand les événements scolaires ou le calendrier des congés arrivent à expiration (préparer l'année suivante).
- Les synchronisations (agendas toutes les 3 h, congés chaque mois) ne publient le site que si quelque chose a changé, ne se chevauchent pas, et gardent l'ancien contenu d'un agenda qui échoue ou répond vide. Les heures des événements sont celles de Bruxelles.
- Page Tâches : « Écarter » une suggestion (déjà réglé, on ne le fait pas) la fait disparaître pour tous les appareils ; « +1 sem. » reporte une échéance ; un titre peut avoir une heure (rendez-vous).

## Rappels sur le téléphone : flux iCal
Le site peut publier un flux iCal privé avec : les changements de garde (alarme la veille à 18 h), les congés, les événements scolaires importants (alarme la veille), les tâches avec échéance et celles en retard, les rappels annuels, et des alertes « ⚠ Garde de A² à organiser » / « ⚠ Qui garde Lana ? » à J-14 (représentées chaque jour tant que ce n'est pas réglé).
1. GitHub → Settings → Secrets and variables → Actions → secret `FEED_TOKEN` : une chaîne aléatoire d'au moins 16 caractères (lettres, chiffres, - et _). Elle fait partie de l'adresse du flux : ne pas la partager.
2. Une fois le site republié (chaque jour et à chaque fusion), l'adresse est `https://<site>/ics/<FEED_TOKEN>/famille.ics`.
3. Google Agenda (version ordinateur) → Autres agendas → **À partir de l'URL** → coller l'adresse. Sur l'agenda ajouté : Paramètres → **Notifications pour les événements** (et pour les événements sur la journée entière) : c'est ce réglage qui déclenche les rappels dans Google Agenda ; d'autres applications (Samsung, Apple, Outlook) utilisent les alarmes incluses dans le flux. Google actualise un abonnement toutes les 8 à 24 h.
4. Si Cloudflare Access protège le site, exclure le chemin `/ics/*` de la protection (Google ne peut pas s'authentifier) : le jeton secret protège alors le flux.
Le flux n'est généré que si `FEED_TOKEN` existe.

## Saisie sans code : l'agenda « Famille » et les écrans de l'application
- **Événements saisis dans le site** : sur la page Planning, « ＋ Ajouter un événement » (ou dans le détail d'un jour) enregistre un rendez-vous, une sortie ou un déplacement (titre, date, plusieurs jours, heures, personnes concernées, note) ; « Modifier » et « Supprimer » sont dans le détail du jour. Ils sont partagés entre les appareils comme les tâches (même table Supabase, `kind: "event"`), apparaissent dans le mois, la semaine, l'accueil et le flux iCal (alarme 1 h avant, ou la veille à 18 h pour une journée entière). Aucune donnée personnelle n'est stockée dans le dépôt.
- **Sorties à deux** : page à part (onglet « Sorties »), pas une tâche. Les occasions sont **typées selon le temps libre** : *Quelques heures* (un soir de semaine, avec l'heure à partir de laquelle vous êtes libres), *Journée*, *Week-end* (avec le vendredi soir) et *Escapade* (plusieurs jours de congé), avec des filtres ; « garde à confirmer » quand Adrian et Alixia sont chez Yves (Louanne ou Lukas à la maison). Les soirs où quelque chose est déjà prévu sont masqués ou signalés ; les fêtes sont mentionnées. « Meilleure occasion » se planifie en un tap (avec « Annuler »). « Planifier » crée un événement (Yves et Émilie) avec qui garde les enfants, à réserver (rappel 3 jours à 2 semaines avant) et, pour plusieurs jours, la maison vide (Lana). « On est sortis aujourd'hui », « Hier » et « Samedi dernier » notent une sortie ; une sortie prévue et passée se confirme (« C'était fait » ou « Annulée »). Une invitation s'affiche sur le Planning quand la dernière sortie date de plus de 3 semaines.
- **Navigation** : quatre onglets en bas (Planning, Tâches, Sorties, Vacances, défilants si l'écran est étroit) et un bouton ＋ (événement ou tâche) ; la semaine type est un lien depuis le Planning. Un **bandeau d'état** en haut des pages signale ce qui peut rendre le planning faux sans bruit : modifications pas encore envoyées, agenda non synchronisé depuis 3 jours, garde ou événements scolaires qui s'arrêtent, horaires à revoir (`SCHEDULES.validUntil`).
- **Voyage et jours sans école** : dans « Plus d'options » d'un événement, « La maison sera vide » (Lana : alerte tant que personne ne la garde, tâche « Avant le départ »), « Jour sans école » (la garde d'Adrian et Alixia à organiser est recalculée), répétition (chaque semaine, quinzaine, mois), rappel 1, 2 ou 7 jours avant, tâche de préparation. Le site indique les jours d'école manqués.
- **Rappels** : le flux iCal est publié deux fois par jour (matin et fin d'après-midi) ; `famille.ics` (tout), `yves.ics` et `emilie.ics` (leurs tâches plus celles « à attribuer »). Les rappels annuels sonnent à J-30, J-14, J-7 et la veille, et une date dépassée rappelle chaque jour pendant 30 jours. Page Tâches : « Cet appareil » règle la personne qui tient le téléphone, « Sauvegarde » exporte et importe toutes les données (JSON).
- **Hors ligne** : `sw.js` garde une copie des pages (réseau d'abord, copie en secours).
- **Agenda « Famille » (Google Agenda)** : créer un agenda partagé « Famille » (rendez-vous, réunions de parents, sorties, congés exceptionnels) que chacun alimente depuis son téléphone, puis ajouter une ligne `Famille|<adresse secrète iCal>` au secret `ICS_URLS` (voir « Synchronisation Google Agenda »). Les événements apparaissent dans le planning et la vue Semaine, avec leurs heures. Un **prénom en début de titre** désigne les personnes concernées (« Lukas : dentiste 15h45 », « Adrian, Alixia : photos », « Famille : repas ») ; il est retiré du titre affiché. Sans prénom, l'événement est « famille ».
- **Garde** : dans le planning, toucher un jour → « Modifier la garde ce jour… » : échange exceptionnel ou changement de dernière minute (un jour ou plusieurs), « Rétablir le rythme habituel », ou « Enfant malade ou école fermée » (crée une tâche). Enregistré dans l'application et partagé entre les appareils (même table que les tâches, rien à configurer).
- **Tâches → Suggestions → « Organisé »** : noter la solution trouvée pour la garde de A² pendant un congé (stage, grands-parents…) ou pour Lana ; la suggestion et l'alerte disparaissent.
- **Tâches → Échéances du foyer** : dates propres au foyer (assurance auto, contrôle technique, carte d'identité, vaccin de Lana…), annuelles ou ponctuelles ; elles reviennent en suggestion avant l'échéance et dans le flux de rappels.
- **Événements scolaires** (`data/school-events.js`) : champs facultatifs `time`, `todo` (action : génère une tâche proposée 30 jours avant), `dueOffset`, `amount`, `needsParent` (présence d'un parent requise : visible dans la ligne d'Yves même quand les enfants sont chez l'autre parent), `note`.

## Récapitulatif du dimanche
Le workflow « Récapitulatif du dimanche » (dimanche 16 h 30 UTC) publie le récapitulatif de la semaine qui vient (à traiter, jour par jour avec les changements et conflits, tâches de la semaine, à anticiper sur 2 à 4 semaines) comme **issue** du dépôt : GitHub vous envoie alors un e-mail et une notification, sans rien configurer. Option : avec les secrets `RESEND_API_KEY` et `DIGEST_TO` (et `DIGEST_FROM`), le même texte part aussi par e-mail via Resend. Lancement à la demande : Actions → « Récapitulatif du dimanche » → Run workflow.

## Page Vacances et sorties à deux
- **Vacances** : une carte par congé des deux prochaines années (fenêtres de départ possibles : A² chez l'autre parent et disponibilité de Louanne ; garde de A² à organiser ; Lana) avec la décision (on part / on reste / à décider), dates, destination, budget, réservations, documents, qui garde Lana. « On part » avec dates alimente le flux iCal ; la décision retire les suggestions de planification correspondantes ; une personne pour Lana note la garde (plus d'alerte). En dessous : ponts et jours fériés, avec le week-end concerné et où sont les enfants.
- **Sorties avec Émilie** (page Tâches) : heure de libération de chaque soir ; bouton « On est sortis aujourd'hui » ; rappel quand la dernière sortie remonte à plus de 3 semaines.
- **Conflits** : la vue Semaine signale (⚠) un événement horaire qui chevauche une autre activité de la même personne ; la page Semaine type calcule les usages de chaque voiture et affiche les « plans B » à définir (`planB` dans `data/schedules.js`).

## Planificateur de séjour (`sejour.html`)
Ouvert depuis la page Sorties (bouton « Organiser un séjour » sur une journée, un week-end ou une escapade) ou directement : on tape **n'importe quelle destination** et des dates. Le téléphone localise le nom (Nominatim), cherche les hébergements, lieux à voir et restaurants autour (Overpass, plusieurs serveurs essayés l'un après l'autre, copie gardée 7 jours), calcule le temps de route (OSRM), le coucher du soleil (formule locale) et la météo (Open-Meteo, 16 jours). Aucune clé, aucun serveur à nous (`assets/places.js`).
- **Ne rien inventer** : aucun prix, aucune disponibilité, aucun avis. Un horaire n'est jamais affirmé (« à confirmer », avec la mention du jour férié en Belgique). Chaque lieu renvoie à sa fiche OpenStreetMap ; badge de confiance par règle : *Vérifié* (contrôle de moins de 12 mois + contact + adresse), *Source ouverte à confirmer*, *Non vérifié* ; le bouton « J'ai confirmé » garde la date où vous avez appelé ou vu le site officiel.
- **Filtres** : fermés, privés, campings de novembre à mars, établissements scolaires, bornes, doublons (même site, même téléphone ou même nom à moins de 60 m). Les lieux peu renseignés vont sous « autres ». Score visible lieu par lieu (« Pourquoi ce lieu ? »), au plus 2 lieux du même type dans « à voir ».
- **Séjours gardés sur le téléphone seulement** (`localStorage`, clé `sejours-v1`), pas dans la base partagée tant que le dépôt est public ; plusieurs séjours possibles.
- Contrôle : `scripts/check-data.mjs` vérifie le soleil, les filtres et la confiance. Données © contributeurs OpenStreetMap (ODbL).
- Pas encore fait : bases officielles (Luxembourg, Wallonie), contrôle automatique des sites web, suggestions Wikivoyage, séjour affiché dans le Planning.
