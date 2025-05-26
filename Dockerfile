FROM node:20.17.0-alpine3.20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY bin ./bin
COPY public ./public
COPY src ./src
COPY views ./views
COPY app.js ./
COPY .env ./

CMD ["npm", "start"]
