# syntax=docker/dockerfile:1

# ---- Base commune : Node 22 sur Alpine Linux (image légère) ----
# Alpine embarque déjà libssl, dont Prisma a besoin.
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- 1. Installation des dépendances ----
# On copie d'abord uniquement ce qu'il faut pour `npm ci` (+ `prisma generate`
# lancé en postinstall) : tant que ces fichiers ne changent pas, Docker
# réutilise cette couche en cache et le build est beaucoup plus rapide.
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Prisma exige une DATABASE_URL pour lire sa config (prisma.config.ts), mais
# aucune connexion n'est faite à l'installation ni au build : une valeur
# bidon suffit. La vraie URL est fournie au lancement du conteneur.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm ci

# ---- 2. Build de l'application Next.js ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build \
  && npm prune --omit=dev

# ---- 3. Image finale, celle qui tourne en production ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000
COPY --from=builder --chown=node:node /app ./
# On ne tourne pas en root dans le conteneur
USER node
EXPOSE 3000
# `npm start` applique les migrations (prisma migrate deploy) puis lance Next.js
CMD ["npm", "start"]
