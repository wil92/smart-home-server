FROM node:14.16-alpine3.11

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY bin ./bin
COPY public ./public
COPY src ./src
COPY views ./views
COPY app.js ./
COPY .env ./

CMD ["node", "bin/www"]
