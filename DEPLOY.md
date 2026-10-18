# Déploiement — Neon + Render

## 1. Créer la base de données sur Neon

1. Va sur [neon.tech](https://neon.tech) et crée un compte / projet.
2. Dans le projet, crée une base (ex : `workout`).
3. Récupère la **connection string** (onglet "Connection Details"). Elle ressemble à :
   ```
   postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require
   ```
4. Garde cette URL de côté, elle servira de `DATABASE_URL`.

## 2. Appliquer le schéma sur Neon

En local, avec `DATABASE_URL` pointant vers Neon dans `.env` :

```bash
npm install
npx prisma migrate deploy
npm run db:seed   # crée les types de séance par défaut (Traction, Dips)
```

`prisma migrate deploy` applique les migrations déjà présentes dans `prisma/migrations/`
(déjà créées et testées en local par ce projet — pas besoin de relancer `migrate dev`).

## 3. Déployer sur Render

### Option A — avec le fichier `render.yaml` (Blueprint)

1. Pousse le projet sur un repo Git (GitHub/GitLab).
2. Sur [render.com](https://render.com) → **New** → **Blueprint**, connecte le repo.
   Render détecte `render.yaml` à la racine et crée le service `vibe-workout-tracker`.
3. Render demandera la valeur de `DATABASE_URL` (marquée `sync: false`) : colle la
   connection string Neon de l'étape 1.
4. `SESSION_SECRET` est généré automatiquement par Render.
5. Lance le déploiement.

### Option B — manuellement

1. Sur Render → **New** → **Web Service**, connecte le repo.
2. Render : Node
3. Build command : `npm install && npm run build`
4. Start command : `npm start`
5. Ajoute les variables d'environnement :
   - `DATABASE_URL` = connection string Neon
   - `SESSION_SECRET` = une chaîne aléatoire longue
   - `NODE_ENV` = `production`
6. Déploie.

Au démarrage (`npm start`), le service exécute `prisma migrate deploy` avant de lancer
Next.js : toute nouvelle migration créée localement (`npm run db:migrate`) sera donc
appliquée automatiquement sur Neon au prochain déploiement.

## 4. Premier lancement

Une fois déployé, ouvre l'URL Render fournie → tu arrives sur `/login` → crée ton
premier profil (nom + mot de passe). Les types de séance "Traction" et "Dips" sont
déjà présents (créés par `npm run db:seed`) ; tu peux en ajouter d'autres depuis la
page "Types de séance".

## Faire évoluer le schéma plus tard

En local :

```bash
# modifie prisma/schema.prisma, puis :
npm run db:migrate -- --name ma_modification
```

Cela crée un nouveau dossier dans `prisma/migrations/`. Commite-le, poussé sur Git il
sera appliqué automatiquement sur Neon au prochain déploiement Render (`prisma migrate
deploy` dans le start command).
