FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=1001:1001 /app/build ./build
COPY --from=builder --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=builder --chown=1001:1001 /app/package.json ./
COPY --from=builder --chown=1001:1001 /app/src/lib/server/db ./src/lib/server/db
COPY --from=builder --chown=1001:1001 /app/drizzle.config.ts ./
COPY --from=builder --chown=1001:1001 /app/drizzle ./drizzle
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /app/data
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --create-home nodejs && \
    mkdir -p /home/nodejs/.local/share && \
    chown -R nodejs:nodejs /home/nodejs && \
    chown -R nodejs:nodejs /app
USER nodejs
ENV XDG_DATA_HOME=/home/nodejs/.local/share
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "build"]
