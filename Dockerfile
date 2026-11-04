FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --legacy-peer-deps --no-audit --no-fund; fi

FROM node:22-alpine AS builder
WORKDIR /app

# Non-sensitive configuration needed at build time
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MEDPRO_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_HOTLINE
ARG NEXT_PUBLIC_ZALO_URL
ARG NEXT_PUBLIC_GA_ID

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_MEDPRO_URL=$NEXT_PUBLIC_MEDPRO_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_HOTLINE=$NEXT_PUBLIC_HOTLINE
ENV NEXT_PUBLIC_ZALO_URL=$NEXT_PUBLIC_ZALO_URL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID


COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app ./
# Payload local upload fallback: the app runs as the non-root `node` user,
# so create the media directory during the image build and give that user
# ownership. This fixes EACCES on mkdir('/app/media') on Railway.
RUN mkdir -p /app/media && chown -R node:node /app/media
USER node
EXPOSE 3000
CMD ["npm","start"]
