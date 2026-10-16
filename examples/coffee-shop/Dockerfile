# syntax=docker/dockerfile:1
# The coffee shop: an Astro server build → Node without root. TLS and the domain are on the host's nginx.
# Built from the root of the repository: the site takes @seamlet/astro from its workspace there.
#   docker build -f examples/coffee-shop/Dockerfile --build-arg CMS_ORIGIN=https://cms.example .

FROM node:24-alpine AS build
WORKDIR /src
# Only the manifests first: the dependency layer is reused until they change.
COPY package.json package-lock.json ./
COPY packages/astro/package.json packages/astro/
COPY examples/coffee-shop/package.json examples/coffee-shop/
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# Where the content comes from and whose editor may frame the preview; the build bakes it in.
ARG CMS_ORIGIN
RUN test -n "$CMS_ORIGIN" && npm run build && CMS_ORIGIN="$CMS_ORIGIN" npm run build:coffee-shop

FROM node:24-alpine AS runtime-dependencies
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/astro/package.json packages/astro/
COPY examples/coffee-shop/package.json examples/coffee-shop/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
COPY --from=runtime-dependencies /src/node_modules ./node_modules
COPY --from=build /src/examples/coffee-shop/dist ./examples/coffee-shop/dist
COPY package.json ./
USER node
EXPOSE 8080
CMD ["node", "examples/coffee-shop/dist/server/entry.mjs"]
