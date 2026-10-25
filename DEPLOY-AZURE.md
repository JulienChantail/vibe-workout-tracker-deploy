# Déploiement sur Azure

Objectif : mettre l'appli en ligne sur Azure, en conteneur Docker, **sans rien payer**.

## L'architecture

```
GitHub (push sur main)
   │  GitHub Actions : docker build + docker push
   ▼
GitHub Container Registry (ghcr.io) ← stocke les images Docker (gratuit, image publique)
   │  az containerapp update
   ▼
Azure Container Apps                ← fait tourner le conteneur, URL publique en HTTPS
   │  DATABASE_URL
   ▼
Azure SQL Database                  ← la base de données (moteur SQL Server)
```

Tout est rangé dans un **groupe de ressources** (`rg-vibe-workout`). Pour tout
supprimer à la fin, il suffit de supprimer ce groupe (étape 10).

## Coûts : 0 €

| Ressource | Coût |
| --- | --- |
| GitHub Container Registry | Gratuit pour une image publique. |
| Container Apps | Quota gratuit mensuel largement suffisant ; l'appli se met en veille (0 instance) quand personne ne l'utilise. |
| Azure SQL Database, offre gratuite | Gratuit à vie : 100 000 secondes de vCore/mois + 32 Go par base. Si le quota est épuisé, la base se met en pause jusqu'au mois suivant (rien n'est facturé). |
| Log Analytics (les logs) | Gratuit jusqu'à 5 Go/mois. |

> On n'utilise **pas** Azure Container Registry : son offre la moins chère (Basic)
> coûte environ 5 $/mois.

## Étape 0 — Ouvrir un terminal Azure

Le plus simple : **Azure Cloud Shell**, un terminal dans le navigateur avec `az` déjà
installé et connecté.

1. Va sur [portal.azure.com](https://portal.azure.com).
2. Clique sur l'icône `>_` en haut à droite → choisis **Bash**.
3. S'il propose un stockage, choisis **« Aucun compte de stockage requis »**.

(Alternative : installer [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
sur ton PC puis lancer `az login`.)

Vérifie que tu es sur le bon abonnement :

```bash
az account show --query "{abonnement:name, id:id}" -o table
```

## Étape 1 — Variables

On définit les noms une fois pour toutes. Les noms du registre et de la base doivent
être **uniques dans tout Azure**, d'où le suffixe aléatoire.

```bash
RG=rg-vibe-workout
LOCATION=francecentral
SUFFIX=$RANDOM
SQL_SERVER=sql-vibe-workout-$SUFFIX
ENV=env-vibe-workout
APP=vibe-workout-tracker
SQL_USER=workoutadmin
# Azure SQL exige un mot de passe complexe (majuscule, minuscule, chiffre, symbole)
SQL_PASSWORD="Wk-$(openssl rand -hex 12)"

# À noter quelque part : si le terminal se ferme, ces variables sont perdues.
echo "SUFFIX=$SUFFIX  SQL_PASSWORD=$SQL_PASSWORD"
```

> Si le terminal se ferme, relance ce bloc en remplaçant `SUFFIX=$RANDOM` et
> `SQL_PASSWORD=...` par les valeurs notées.

## Étape 2 — Préparer l'abonnement

On active les services Azure utilisés (une seule fois par abonnement, ça peut prendre
quelques minutes) et l'extension Container Apps de la CLI :

```bash
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.Sql
az extension add --name containerapp --upgrade
```

## Étape 3 — Groupe de ressources

```bash
az group create --name $RG --location $LOCATION
```

## Étape 4 — La base Azure SQL

Azure SQL Database, c'est SQL Server géré par Azure. Il faut d'abord un **serveur
logique** (il porte le nom DNS, le compte administrateur et le pare-feu), puis une
**base** dessus.

```bash
az sql server create \
  --resource-group $RG \
  --name $SQL_SERVER \
  --location $LOCATION \
  --admin-user $SQL_USER \
  --admin-password "$SQL_PASSWORD"
```

Le pare-feu bloque tout par défaut. Cette règle spéciale (`0.0.0.0`) autorise
uniquement les services Azure, donc notre Container App :

```bash
az sql server firewall-rule create \
  --resource-group $RG \
  --server $SQL_SERVER \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

On crée la base avec l'**offre gratuite** (modèle *serverless* : la base se met en
pause quand elle ne sert pas, et `AutoPause` garantit qu'on ne paie jamais de
dépassement) :

```bash
az sql db create \
  --resource-group $RG \
  --server $SQL_SERVER \
  --name workout \
  --edition GeneralPurpose \
  --family Gen5 \
  --capacity 2 \
  --compute-model Serverless \
  --use-free-limit \
  --free-limit-exhaustion-behavior AutoPause
```

> L'offre gratuite est limitée en nombre de bases par abonnement. Si Azure refuse
> `--use-free-limit`, retire les deux dernières options : la base sera alors facturée
> à l'usage (quelques euros par mois pour un petit usage).
>
> Erreur du type *« location is restricted »* ? Certains abonnements (étudiants
> notamment) n'ont pas accès à toutes les régions : refais l'étape avec
> `--location swedencentral` ou `--location northeurope` sur `az sql server create`.

On construit l'URL de connexion que l'appli utilisera (format SQL Server, avec des
`;`) :

```bash
DATABASE_URL="sqlserver://$SQL_SERVER.database.windows.net:1433;database=workout;user=$SQL_USER;password=$SQL_PASSWORD;encrypt=true"
```

> **Réveil de la base** : après un moment sans activité, la base se met en pause. La
> première connexion la réveille, ce qui peut prendre jusqu'à une minute : le
> conteneur réessaie automatiquement les migrations pendant ce temps
> (`scripts/docker-start.sh`). La toute première visite après une longue pause peut
> donc être lente, c'est normal.

## Étape 5 — Le registre d'images : GitHub Container Registry

Rien à créer sur Azure : les images sont stockées gratuitement sur **GitHub Container
Registry** (`ghcr.io`), à côté du code. GitHub Actions les y publie (étape 7).

L'image est **publique** : Azure peut la télécharger sans identifiant, et le code est
déjà public. Elle ne contient aucun secret : `DATABASE_URL` et `SESSION_SECRET` sont
fournis par Azure au démarrage du conteneur.

## Étape 6 — L'environnement et la Container App

Un **environnement** Container Apps regroupe une ou plusieurs applications (réseau et
logs communs) :

```bash
az containerapp env create \
  --name $ENV \
  --resource-group $RG \
  --location $LOCATION
```

On crée l'application avec une **image temporaire** de démonstration Microsoft :
notre propre image n'existe pas encore, c'est GitHub Actions qui la construira à
l'étape 7.

```bash
az containerapp create \
  --name $APP \
  --resource-group $RG \
  --environment $ENV \
  --image mcr.microsoft.com/k8se/quickstart:latest \
  --target-port 3000 \
  --ingress external \
  --secrets database-url="$DATABASE_URL" session-secret="$(openssl rand -hex 32)" \
  --env-vars DATABASE_URL=secretref:database-url SESSION_SECRET=secretref:session-secret \
  --cpu 0.5 --memory 1.0Gi \
  --min-replicas 0 --max-replicas 1
```

- `--secrets` : les valeurs sensibles sont stockées comme **secrets** de la Container
  App, et les variables d'environnement y font référence (`secretref:`).
- `--min-replicas 0` : l'appli s'éteint quand elle ne reçoit pas de visites (gratuit),
  et redémarre en quelques secondes à la visite suivante.

> Pour l'instant l'URL ne répond pas : l'image temporaire écoute sur le port 80 et
> non 3000. C'est normal, elle sera remplacée à l'étape 7.

## Étape 7 — Déploiement automatique avec GitHub Actions

Le fichier [`.github/workflows/deploy-azure.yml`](.github/workflows/deploy-azure.yml)
construit l'image, la publie sur `ghcr.io` et met à jour la Container App à chaque
push sur `main`. Pour publier sur `ghcr.io`, il utilise le jeton fourni automatiquement
par GitHub (`GITHUB_TOKEN`) : rien à configurer. Il lui faut en revanche un accès à
Azure.

**7.1 — Créer une identité pour GitHub** (un « service principal »), autorisée
uniquement sur notre groupe de ressources :

```bash
az ad sp create-for-rbac \
  --name sp-vibe-workout-github \
  --role contributor \
  --scopes $(az group show --name $RG --query id -o tsv) \
  --json-auth
```

Copie **tout** le JSON affiché (de `{` à `}`). C'est un mot de passe : ne le colle
nulle part ailleurs que dans GitHub.

**7.2 — Configurer le dépôt GitHub** : sur GitHub, ouvre le dépôt → **Settings** →
**Secrets and variables** → **Actions**.

- Onglet **Secrets** → *New repository secret* :
  - `AZURE_CREDENTIALS` = le JSON de l'étape 7.1
- Onglet **Variables** → *New repository variable* :
  - `RESOURCE_GROUP` = `rg-vibe-workout`
  - `CONTAINER_APP_NAME` = `vibe-workout-tracker`

**7.3 — Lancer le déploiement** : onglet **Actions** du dépôt → *Deploy to Azure* →
**Run workflow**.

**7.4 — Rendre l'image publique (une seule fois)** : une image publiée sur `ghcr.io`
est privée au départ, et Azure ne peut pas la télécharger. Le premier déploiement
échoue donc à l'étape « Déployer la nouvelle image » : c'est normal.

1. Sur la page du dépôt, colonne de droite → **Packages** → `vibe-workout-tracker-deploy`.
2. **Package settings** → tout en bas, **Change visibility** → **Public** → confirme.
3. Relance le déploiement (7.3).

Ensuite, chaque `git push` sur `main` redéploiera automatiquement.

## Étape 8 — Ouvrir l'appli

```bash
echo "https://$(az containerapp show --name $APP --resource-group $RG \
  --query properties.configuration.ingress.fqdn -o tsv)"
```

Au démarrage, le conteneur crée les tables dans Azure SQL (migrations Prisma), puis
lance Next.js. Ouvre l'URL : tu dois tomber sur `/login`.

Crée ensuite les types de séance par défaut (Traction, Dips), une seule fois. L'appli
doit être allumée (ouvre l'URL juste avant) :

```bash
az containerapp exec --name $APP --resource-group $RG --command "node prisma/seed.mjs"
```

## Étape 8 bis — Importer les données de la première version (Neon)

Le script [`scripts/import-from-neon.mjs`](scripts/import-from-neon.mjs) copie les profils,
types de séance, séances préenregistrées, séances et séries de l'ancienne base
PostgreSQL (Neon) vers Azure SQL :

- les mots de passe sont conservés (chacun se reconnecte avec son ancien mot de passe) ;
- ce qui existe déjà sur Azure est réutilisé, sans doublon : un profil de même nom
  (sans tenir compte des majuscules) garde son mot de passe Azure et récupère les
  séances de Neon ; « Traction » et « Dips » créés par le seed sont réutilisés ;
- tout se fait dans une transaction : en cas d'erreur, rien n'est écrit ;
- il peut être relancé sans risque.

Récupère l'URL de connexion Neon : sur [console.neon.tech](https://console.neon.tech) →
ton projet → **Connect**, ou la variable `DATABASE_URL` du service sur Render.

Ouvre l'appli dans ton navigateur (pour qu'elle soit allumée), puis ouvre un terminal
**dans le conteneur** :

```bash
az containerapp exec --name $APP --resource-group $RG --command sh
```

Dans ce terminal (la base Azure SQL y est déjà configurée) :

```sh
export NEON_DATABASE_URL='postgresql://...'   # colle l'URL Neon entre les apostrophes
node scripts/import-from-neon.mjs --dry-run      # simulation : affiche ce qui serait importé
node scripts/import-from-neon.mjs                # import réel
exit
```

## Étape 9 — Observer et dépanner

```bash
# Logs de l'appli en direct
az containerapp logs show --name $APP --resource-group $RG --follow

# Historique des versions déployées (« révisions »)
az containerapp revision list --name $APP --resource-group $RG -o table
```

Dans le portail : ressource `vibe-workout-tracker` → **Flux de journaux** (Log stream)
et **Révisions**.

## Étape 10 — Tout supprimer

Quand tu as fini :

```bash
az group delete --name $RG --yes --no-wait
az ad sp delete --id $(az ad sp list --display-name sp-vibe-workout-github --query "[0].appId" -o tsv)
```

Puis supprime le secret `AZURE_CREDENTIALS` et les variables dans GitHub, et l'image :
dépôt → **Packages** → `vibe-workout-tracker-deploy` → **Package settings** →
**Delete this package**.
