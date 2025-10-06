FROM node:22-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm@10.13.1

# Install with build scripts enabled
RUN pnpm config set enable-pre-post-scripts true && \
    pnpm install --frozen-lockfile --shamefully-hoist

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["pnpm", "start"]
