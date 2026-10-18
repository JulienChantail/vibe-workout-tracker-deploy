#!/bin/sh
# Démarrage du conteneur : applique les migrations puis lance Next.js.
# Une base Azure SQL "serverless" se met en pause quand elle n'est pas utilisée
# et refuse les connexions pendant son réveil (jusqu'à ~1 min) : on réessaie.
set -u

attempt=1
max_attempts=10
until npx prisma migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "La base de données reste injoignable, abandon." >&2
    exit 1
  fi
  echo "Base de données pas encore disponible, nouvel essai dans 10 s ($attempt/$max_attempts)..."
  attempt=$((attempt + 1))
  sleep 10
done

exec npx next start -p "${PORT:-3000}"
