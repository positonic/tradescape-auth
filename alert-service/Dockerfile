# Use official Bun image
FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --production

# Copy Prisma schema from parent directory for client generation
COPY ../prisma/schema.prisma ./prisma/schema.prisma

# Generate Prisma client
RUN bunx prisma generate

# Copy source code
COPY . .

# Expose the service port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the service
CMD ["bun", "run", "start"]
