# One image that serves both the API and the admin app on port 8787.
FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY . .
# Builds the admin app and the library packages it and the API depend on.
RUN pnpm install --frozen-lockfile && pnpm --filter "@formknit/web..." build

ENV NODE_ENV=production \
    PORT=8787 \
    WEB_DIR=/app/apps/web/dist \
    DATABASE_URL=/data/formknit.sqlite \
    UPLOAD_DIR=/data/uploads
# The database file (when using SQLite) and uploaded files live here; mount a volume on it.
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 8787
WORKDIR /app/apps/api
CMD ["node", "--import", "tsx", "src/index.ts"]
