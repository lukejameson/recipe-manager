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

# Install dependencies except better-sqlite3
RUN pnpm config set enable-pre-post-scripts true && \
    pnpm install --frozen-lockfile

# Remove better-sqlite3 and reinstall with npm to ensure proper compilation
RUN pnpm remove better-sqlite3 && \
    npm install better-sqlite3@11.10.0 --verbose

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Verify better-sqlite3 was built correctly
RUN echo "Checking for better-sqlite3 bindings..." && \
    ls -la /app/node_modules/better-sqlite3/build/ 2>/dev/null || \
    ls -la /app/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/ 2>/dev/null || \
    echo "Build directory not found - listing all better-sqlite3 locations:" && \
    find /app/node_modules -name "better-sqlite3" -type d

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["pnpm", "start"]
