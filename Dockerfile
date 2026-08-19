FROM node:22-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/dist /usr/share/nginx/html

# envsubst (utilise par l'entrypoint nginx sur les .template) n'a pas de
# fallback façon shell ${VAR:-defaut} : si la variable n'existe pas du
# tout dans l'environnement du conteneur, ${BACKEND_HOST} reste tel quel
# dans le conf genere et nginx le prend pour une syntaxe de variable a
# lui, provoquant "unknown variable" au demarrage. Il faut donc TOUJOURS
# que ces variables existent — valeurs par defaut ici, overridables via
# `docker run -e` / `environment:` en docker-compose.
ENV BACKEND_HOST=demo
ENV BACKEND_PORT=8000

# lana-config.js contient l'URL Keycloak et le realm : en dev ces valeurs
# sont en dur (localhost:8088), ici on les regenere au demarrage du
# conteneur a partir de variables d'environnement (meme mecanisme
# d'entrypoint que nginx utilise pour ses propres templates .template).
COPY runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80

# Le processus maitre nginx demarre root (necessaire pour bind :80), les
# workers qui servent reellement le trafic tournent en utilisateur non-
# privilegie "nginx" via la directive `user nginx;` deja presente dans
# l'image officielle — pas de USER explicite ici, il casserait le binding
# du port privilegie et l'ecriture du template au demarrage.
# 127.0.0.1 explicite : "localhost" resout en ::1 dans ce conteneur et
# nginx n'ecoute qu'en IPv4 avec `listen 80;` seul, ce qui fait echouer
# le healthcheck en boucle malgre un serveur qui repond normalement.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ || exit 1
