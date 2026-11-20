FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server ./server
COPY config/event.json ./config/event.json
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server/index.mjs"]
