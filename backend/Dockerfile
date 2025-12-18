FROM node:22-slim

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json ./

# Install dependencies with npm (better native module support than pnpm)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Copy migrations to dist folder (they're not compiled by tsc)
RUN cp -r src/db/migrations dist/db/

# Create data directory and set permissions
RUN mkdir -p /app/data

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 3001

# Run migrations then start server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
