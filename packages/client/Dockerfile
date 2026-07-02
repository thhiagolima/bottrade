FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
RUN npm ci --include-workspace-root --workspace=packages/shared --workspace=packages/client
COPY packages/shared packages/shared
COPY packages/client packages/client
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/client

FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
