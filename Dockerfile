# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY core/ core/
COPY spec/ spec/
COPY sandbox/ sandbox/
COPY adapter/ adapter/
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

RUN addgroup -S iscl && adduser -S iscl -G iscl

COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY package.json ./

RUN mkdir -p /home/iscl/.iscl/keystore /home/iscl/.iscl/data && chown -R iscl:iscl /home/iscl

USER iscl

EXPOSE 3100

ENV ISCL_HOST=0.0.0.0
ENV ISCL_PORT=3100
ENV ISCL_AUDIT_DB=/home/iscl/.iscl/data/audit.sqlite
ENV ISCL_KEYSTORE_PATH=/home/iscl/.iscl/keystore

CMD ["node", "dist/core/main.js"]
