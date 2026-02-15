# YouTubeTranscript-MiniSaaS MCP Server (stdio)
# Multi-stage build for minimal image size

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Release stage
FROM node:22-alpine AS release

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts

ENV NODE_ENV=production

# MCP stdio: no exposed port, uses stdin/stdout
ENTRYPOINT ["node", "dist/index.js"]
