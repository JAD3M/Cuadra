# Imagen de producción (AD-17). La misma sirve a la API, al worker y a las
# migraciones: solo cambia el comando. Para desarrollo: Dockerfile.dev.

FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node --from=dependencias /app/node_modules ./node_modules
COPY --chown=node:node --from=compilacion /app/dist ./dist
USER node
EXPOSE 3000
# API por defecto. Worker: `node dist/worker`. Migraciones: ver docker-compose.yml.
CMD ["node", "dist/main"]
