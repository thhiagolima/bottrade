FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN npm ci --include-workspace-root --workspace=packages/shared --workspace=packages/server
COPY packages/shared packages/shared
COPY packages/server packages/server
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/server

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/server/package.json packages/server/
COPY --from=builder /app/node_modules node_modules
COPY package.json ./
EXPOSE 3001
CMD ["node", "packages/server/dist/index.js"]
