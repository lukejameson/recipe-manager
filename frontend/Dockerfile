FROM node:22-alpine AS builder

WORKDIR /app

# Build argument for API URL (empty = same origin for production behind reverse proxy)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm@10.13.1 && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN pnpm build

# Production image
FROM node:22-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built app and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nodejs

EXPOSE 3000

CMD ["node", "build"]
