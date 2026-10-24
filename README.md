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
- `data/school-holidays.js` : vacances FWB 2026-2027 (à confirmer sur enseignement.be)

## Utilisation
Ouvrir `index.html` dans un navigateur (ou servir le dossier avec `python3 -m http.server`).
Les tâches sont stockées dans le navigateur (localStorage).
