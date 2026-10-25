# Vibe Workout Tracker

Suivi de séances de street workout / musculation (traction, dips, développé couché...),
multi-utilisateurs, avec séances préenregistrées, historique filtrable et courbe de
progression basée sur une estimation du 1RM.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + Tailwind CSS 4
- [Prisma ORM 7](https://www.prisma.io) + SQL Server ([Azure SQL Database](https://learn.microsoft.com/azure/azure-sql/database/) en production)
- Auth maison par profils + mot de passe (cookie de session signé)
- [Recharts](https://recharts.org) pour la courbe de progression

## Démarrer en local

Le plus simple : avec Docker, `docker compose up --build` lance l'appli et une base
SQL Server d'un coup. Voir [DOCKER.md](./DOCKER.md).

Sans Docker :

1. Avoir un SQL Server accessible (Azure SQL, ou le conteneur local :
   `docker compose up -d db`) et renseigner `DATABASE_URL` dans `.env` (voir
   `.env.example`).
2. Installer les dépendances et préparer la base :

   ```bash
   npm install
   npm run db:migrate   # applique le schéma
   npm run db:seed      # crée les types de séance par défaut (Traction, Dips)
   ```

3. Lancer le serveur de dev :

   ```bash
   npm run dev
   ```

4. Ouvrir [http://localhost:3000](http://localhost:3000) → tu es redirigé vers `/login`
   → crée ton premier profil.

## Fonctionnalités

- **Ajouter une séance** : choix du type de séance, puis d'une séance personnalisée
  (séries libres avec leste/poids, répétitions, type échauffement/travail/récupération)
  ou d'une séance préenregistrée.
- **Types de séance** : Traction et Dips par défaut, extensible (ex : développé
  couché), avec catégorie "poids du corps + leste", "poids externe" ou "circuit
  chronométré".
- **Circuits chronométrés** (ex : défi Tom Holland / « Cindy ») : le plus de tours
  possible dans un temps donné, au poids du corps. On choisit un objectif de tours au
  départ (10 tours en 20 min = un départ toutes les 2:00) : l'appli compte les tours
  à chaque départ, et un « mode libre » permet de compter soi-même avec − / +. Sans
  objectif, on compte ses tours librement. Score en tours + répétitions (avec
  l'objectif), suivi dans l'historique et la progression.
- **EMOM** (every minute on the minute) : 10 minutes par défaut, exercice au choix
  (Dips, Tractions, Pompes… liste modifiable) ; à la fin on saisit la moyenne de
  répétitions par minute (ex : 6,5), suivie par exercice dans la progression.
- **Chrono des circuits et EMOM** : horloge plein écran inspirée de SmartWOD Timer,
  annonces vocales en anglais (« 3, 2, 1, go », bip à chaque départ, « halfway there »
  au milieu de chaque intervalle, « time » à la fin), vibration, écran maintenu
  allumé ; le chrono continue si on passe sur une autre appli.
- **Séances préenregistrées** : modèle à 3 paliers de leste/poids (lourd / moyen /
  léger, moyen et léger calculés automatiquement si non précisés) avec une séquence de
  blocs de séries personnalisable.
- **Historique** : vue liste ou agenda, filtrable par type de séance et par
  utilisateur.
- **Progression** : courbe du 1RM estimé (formule d'Epley, meilleure série de travail
  de la séance), filtrable par type de séance et utilisateur.
- **Multi-utilisateurs** : chaque séance est associée à son auteur.

## Déploiement

- [DEPLOY-AZURE.md](./DEPLOY-AZURE.md) : mise en production gratuite sur Azure (Container Apps +
  Azure SQL Database, images sur GitHub Container Registry), avec déploiement automatique
  par GitHub Actions.
- [DOCKER.md](./DOCKER.md) : image Docker de l'appli (base pour un déploiement en
  conteneur).
