# Single-service image for Render / Railway / Fly.io / a VPS: builds the React app, then serves it from the Node server.
FROM node:20-alpine AS client
WORKDIR /c
COPY client/package.json ./
RUN npm install
COPY client/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/ .
COPY --from=client /c/dist ./public
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["node", "index.js"]
