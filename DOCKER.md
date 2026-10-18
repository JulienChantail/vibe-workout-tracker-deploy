# Lancer l'appli avec Docker

L'appli est empaquetée dans une **image Docker** : un paquet qui contient Node.js,
les dépendances et le code déjà compilé. Cette même image tourne à l'identique sur ton
PC et chez un hébergeur cloud (Azure, Google Cloud…).

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `Dockerfile` | La recette de l'image : installe les dépendances, compile Next.js, prépare l'image finale. |
| `.dockerignore` | Ce qu'on n'envoie **pas** dans l'image (`node_modules`, `.env`, `.git`…). |
| `docker-compose.yml` | Lance **l'appli + une base PostgreSQL** ensemble, pour tester en local. |
| `.env.example` | Les variables d'environnement attendues par l'appli. |

## Prérequis

Installe [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS)
ou Docker Engine (Linux), puis vérifie :

```bash
docker --version
docker compose version
```

## Lancer en local (appli + base de données)

```bash
docker compose up --build
```

Au premier lancement, Docker construit l'image (quelques minutes). Ensuite :

1. Le conteneur `db` démarre PostgreSQL.
2. Le conteneur `app` attend que la base soit prête, applique les migrations Prisma
   (`prisma migrate deploy`) puis lance Next.js.
3. Ouvre [http://localhost:3000](http://localhost:3000).

Dans un **autre terminal**, crée les types de séance par défaut (Traction, Dips) :

```bash
docker compose exec app node prisma/seed.mjs
```

Commandes utiles :

```bash
docker compose logs -f app   # suivre les logs de l'appli
docker compose down          # tout arrêter (les données sont conservées)
docker compose down -v       # tout arrêter ET effacer la base
```

Les données de la base sont stockées dans un **volume Docker** (`db-data`) : elles
survivent à un `docker compose down`.

## Construire et lancer uniquement l'image de l'appli

C'est ce que fera un hébergeur cloud : il lance **une seule** image, et la base de
données est ailleurs (Neon, Azure Database for PostgreSQL…).

```bash
docker build -t vibe-workout-tracker .

docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require" \
  -e SESSION_SECRET="une-longue-chaine-aleatoire" \
  vibe-workout-tracker
```

## Variables d'environnement

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `DATABASE_URL` | oui | URL de connexion PostgreSQL. |
| `SESSION_SECRET` | oui en prod | Clé qui signe les cookies de session. Mets une longue chaîne aléatoire (`openssl rand -hex 32`). |
| `PORT` | non | Port d'écoute, `3000` par défaut. |

`NODE_ENV=production` est déjà défini dans l'image. En production, le cookie de session
est marqué `secure` : l'appli doit être servie en **HTTPS** (c'est automatique chez les
hébergeurs cloud ; `http://localhost` est accepté par les navigateurs).
