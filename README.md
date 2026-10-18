# Vibe Workout Tracker

Suivi de séances de street workout / musculation (traction, dips, développé couché...),
multi-utilisateurs, avec séances préenregistrées, historique filtrable et courbe de
progression basée sur une estimation du 1RM.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + Tailwind CSS 4
- [Prisma ORM 7](https://www.prisma.io) + PostgreSQL ([Neon](https://neon.tech) en production)
- Auth maison par profils + mot de passe (cookie de session signé)
- [Recharts](https://recharts.org) pour la courbe de progression

## Démarrer en local

1. Avoir une base Postgres accessible (Neon, ou un conteneur local) et renseigner
   `DATABASE_URL` dans `.env` (voir `.env.example`).
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
  couché), avec catégorie "poids du corps + leste" ou "poids externe".
- **Séances préenregistrées** : modèle à 3 paliers de leste/poids (lourd / moyen /
  léger, moyen et léger calculés automatiquement si non précisés) avec une séquence de
  blocs de séries personnalisable.
- **Historique** : vue liste ou agenda, filtrable par type de séance et par
  utilisateur.
- **Progression** : courbe du 1RM estimé (formule d'Epley, meilleure série de travail
  de la séance), filtrable par type de séance et utilisateur.
- **Multi-utilisateurs** : chaque séance est associée à son auteur.

## Déploiement

Voir [DEPLOY.md](./DEPLOY.md) pour la mise en production sur Render avec une base Neon.
