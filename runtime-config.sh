#!/bin/sh
# Execute automatiquement par l'entrypoint officiel de l'image nginx
# (tout script executable dans /docker-entrypoint.d/ est lance avant le
# demarrage de nginx). Regenere lana-config.js a partir des variables
# d'environnement du conteneur : en dev ces valeurs sont en dur sur
# localhost:8088 dans public/lana-config.js, ce qui casserait toute
# image deployee ailleurs qu'en local si on se contentait de copier le
# fichier tel quel dans le build.
set -eu

TARGET=/usr/share/nginx/html/lana-config.js

cat > "$TARGET" <<EOF
window.__LANACASH_CONFIG__ = {
  ...(window.__LANACASH_CONFIG__ || {}),
  keycloakUrl: '${KEYCLOAK_URL:-http://localhost:8088}',
  keycloakRealm: '${KEYCLOAK_REALM:-PFE26}',
  keycloakClientId: '${KEYCLOAK_CLIENT_ID:-portail-affiliation}'
};
EOF

echo "runtime-config.sh: lana-config.js regenere (keycloakUrl=${KEYCLOAK_URL:-http://localhost:8088})"
