FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app

# Copy the built app
COPY --from=builder /app /app

# Set environment to production
ENV NODE_ENV=production
ENV DB_PATH=/data/mjod.sqlite

# Expose a directory for the database volume
VOLUME ["/data"]

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
