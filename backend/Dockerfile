FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm@10.13.1 && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["pnpm", "start"]
