FROM node:20-alpine AS builder
WORKDIR /app

# Next.js ships a glibc-linked native swc binary for linux-x64; alpine is musl,
# so without this shim Next falls back to the wasm compiler and then fails to
# load next.config.ts. The official alpine image docs require libc6-compat.
RUN apk add --no-cache libc6-compat

COPY site/package.json site/package-lock.json ./
RUN npm ci

COPY shared /shared
COPY site .

ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
# Build-time origin for the /api and /uploads rewrites baked into the
# standalone output. The default keeps the historic behaviour (public API
# domain); compose overrides it with the container-network address so the
# local split-port stack never proxies towards production. Runtime
# `environment:` in both compose files overrides this for the running app.
ARG INTERNAL_API_ORIGIN=https://api.culvoy.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV INTERNAL_API_ORIGIN=$INTERNAL_API_ORIGIN
ENV NEXT_OUTPUT=standalone

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./app/public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./app/.next/static

USER nextjs

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "app/server.js"]
