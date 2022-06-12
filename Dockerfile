FROM node:14.16-alpine3.11

WORKDIR /app

COPY package.json ./
RUN npm install

COPY bin ./bin
COPY public ./public
COPY src/socket ./socket
COPY src/routes ./routes
COPY views ./views
COPY src ./logic
COPY app.js ./
COPY .env ./

CMD ["node", "bin/www"]
