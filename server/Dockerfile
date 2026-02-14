# MCP Server for GCP Cloud Run
# Long-running SSE connections - not suitable for Vercel serverless

FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (include dev for build)
RUN npm ci

# Copy source
COPY . .

# Build not required - we run TypeScript with tsx
# Add tsx if not in package.json
RUN npm ls tsx || npm install -g tsx

EXPOSE 8080

ENV PORT=8080
CMD ["npx", "tsx", "mcp-server/index.ts"]
