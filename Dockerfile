# Dependencies

FROM node:22-alpine3.19 AS deps

WORKDIR /usr/src/app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile

# Builder
FROM node:22-alpine3.19 AS builder

WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules

COPY . .

RUN yarn build

RUN yarn install --frozen-lockfile --production && \
    yarn cache clean


# Crear la imagen final 
FROM node:22-alpine3.19 AS prod

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
