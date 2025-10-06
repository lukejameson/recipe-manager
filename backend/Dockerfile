# Use a regular Node.js image instead of Alpine for better native module support
FROM node:22-slim

WORKDIR /app

# Install system dependencies for building native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and node-gyp globally
RUN npm install -g pnpm@10.13.1 node-gyp

# Set environment variables for better-sqlite3 compilation
ENV PYTHON=/usr/bin/python3
ENV SQLITE_SKIP_BINARIES=1

# Install dependencies and enable build scripts
RUN pnpm config set enable-pre-post-scripts true && \
    pnpm install --frozen-lockfile && \
    pnpm rebuild better-sqlite3 --verbose

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Verify better-sqlite3 was built correctly
RUN ls -la /app/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/ || echo "Build directory not found"

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["pnpm", "start"]
