# Déploiement sur Azure

Objectif : mettre l'appli en ligne **entièrement sur Azure**, en conteneur Docker.

## L'architecture

```
GitHub (push sur main)
   │  GitHub Actions : docker build + docker push
   ▼
Azure Container Registry (ACR)      ← stocke les images Docker
   │  az containerapp update
   ▼
Azure Container Apps                ← fait tourner le conteneur, URL publique en HTTPS
   │  DATABASE_URL
   ▼
Azure Database for PostgreSQL       ← la base de données (Flexible Server)
```

Tout est rangé dans un **groupe de ressources** (`rg-vibe-workout`). Pour tout
supprimer à la fin, il suffit de supprimer ce groupe (étape 10).

## Coûts (à surveiller !)

| Ressource | Coût indicatif |
| --- | --- |
| Container Apps | Quota gratuit mensuel largement suffisant ; l'appli se met en veille (0 instance) quand personne ne l'utilise. |
| Container Registry, offre Basic | ~5 $/mois (facturé à la journée). |
| PostgreSQL Flexible Server B1ms | Gratuit 12 mois avec un compte gratuit Azure (750 h/mois + 32 Go), sinon ~15 $/mois. |

Avec **Azure for Students** (100 $ de crédit, sans carte bancaire), ça tient largement.
Pense à supprimer les ressources quand tu as fini d'apprendre (étape 10).

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
ACR=acrvibeworkout$SUFFIX
PG=pg-vibe-workout-$SUFFIX
ENV=env-vibe-workout
APP=vibe-workout-tracker
PG_USER=workoutadmin
PG_PASSWORD=$(openssl rand -hex 16)

# À noter quelque part : si le terminal se ferme, ces variables sont perdues.
echo "SUFFIX=$SUFFIX  PG_PASSWORD=$PG_PASSWORD"
```

> Si le terminal se ferme, relance ce bloc en remplaçant `SUFFIX=$RANDOM` et
> `PG_PASSWORD=...` par les valeurs notées.

## Étape 2 — Préparer l'abonnement

On active les services Azure utilisés (une seule fois par abonnement, ça peut prendre
quelques minutes) et l'extension Container Apps de la CLI :

```bash
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.DBforPostgreSQL
az extension add --name containerapp --upgrade
```

## Étape 3 — Groupe de ressources

```bash
az group create --name $RG --location $LOCATION
```

## Étape 4 — La base PostgreSQL

```bash
az postgres flexible-server create \
  --resource-group $RG \
  --name $PG \
  --location $LOCATION \
  --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 \
  --version 16 \
  --admin-user $PG_USER \
  --admin-password $PG_PASSWORD \
  --database-name workout \
  --public-access 0.0.0.0 \
  --yes
```

Ça prend 5 à 10 minutes. `--public-access 0.0.0.0` autorise uniquement les services
Azure (donc notre Container App) à se connecter.

> Erreur du type *« location is restricted »* ? Certains abonnements (étudiants
> notamment) n'ont pas accès à toutes les régions : réessaie avec
> `LOCATION=swedencentral` ou `LOCATION=northeurope` (refais alors l'étape 3 avec un
> autre nom de groupe, ou garde le même groupe et change seulement `--location` ici).

On construit l'URL de connexion que l'appli utilisera :

```bash
DATABASE_URL="postgresql://$PG_USER:$PG_PASSWORD@$PG.postgres.database.azure.com:5432/workout?sslmode=require"
```

## Étape 5 — Le registre d'images (ACR)

```bash
az acr create \
  --resource-group $RG \
  --name $ACR \
  --sku Basic \
  --admin-enabled true
```

Le compte « admin » du registre permet à la Container App de récupérer les images
avec un simple identifiant / mot de passe :

```bash
ACR_PASSWORD=$(az acr credential show --name $ACR --query "passwords[0].value" -o tsv)
```

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
notre propre image n'existe pas encore dans le registre, c'est GitHub Actions qui la
construira à l'étape 7.

```bash
az containerapp create \
  --name $APP \
  --resource-group $RG \
  --environment $ENV \
  --image mcr.microsoft.com/k8se/quickstart:latest \
  --target-port 3000 \
  --ingress external \
  --registry-server $ACR.azurecr.io \
  --registry-username $ACR \
  --registry-password "$ACR_PASSWORD" \
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
construit l'image, l'envoie dans l'ACR et met à jour la Container App à chaque push
sur `main`. Il lui faut un accès à Azure.

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
- Onglet **Variables** → *New repository variable* (affiche les valeurs avec
  `echo $ACR $RG $APP`) :
  - `ACR_NAME` = la valeur de `$ACR` (ex : `acrvibeworkout12345`)
  - `RESOURCE_GROUP` = `rg-vibe-workout`
  - `CONTAINER_APP_NAME` = `vibe-workout-tracker`

**7.3 — Lancer le déploiement** : onglet **Actions** du dépôt → *Deploy to Azure* →
**Run workflow**. Ensuite, chaque `git push` sur `main` redéploiera automatiquement.

## Étape 8 — Ouvrir l'appli

```bash
echo "https://$(az containerapp show --name $APP --resource-group $RG \
  --query properties.configuration.ingress.fqdn -o tsv)"
```

Au démarrage, le conteneur applique les migrations Prisma sur la base Azure, puis
lance Next.js. Ouvre l'URL : tu dois tomber sur `/login`.

Crée ensuite les types de séance par défaut (Traction, Dips), une seule fois. L'appli
doit être allumée (ouvre l'URL juste avant) :

```bash
az containerapp exec --name $APP --resource-group $RG --command "node prisma/seed.mjs"
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

Quand tu as fini, pour ne plus rien payer :

```bash
az group delete --name $RG --yes --no-wait
az ad sp delete --id $(az ad sp list --display-name sp-vibe-workout-github --query "[0].appId" -o tsv)
```

Puis supprime le secret `AZURE_CREDENTIALS` et les variables dans GitHub.
