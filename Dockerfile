FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/data ./data
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "server/cloud-run.ts"]
