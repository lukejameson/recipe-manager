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

# Install pnpm
RUN npm install -g pnpm@10.13.1

# Set environment variables for better-sqlite3 compilation
ENV PYTHON=/usr/bin/python3
ENV SQLITE_SKIP_BINARIES=1

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["pnpm", "start"]
