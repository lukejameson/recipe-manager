FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:22-slim

WORKDIR /app

# Install runtime dependencies for native modules and PostgreSQL client
RUN apt-get update && apt-get install -y \
    python3 make g++ postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy built artifacts
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/lib/server/db ./src/lib/server/db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/drizzle ./drizzle

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory
RUN mkdir -p /app/data

# Create non-root user and ensure proper ownership
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --create-home nodejs && \
    mkdir -p /home/nodejs/.local/share && \
    chown -R nodejs:nodejs /home/nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Set XDG_DATA_HOME to avoid permission issues with drizzle-kit
ENV XDG_DATA_HOME=/home/nodejs/.local/share

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "build"]
