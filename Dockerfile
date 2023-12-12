FROM node:16.19-alpine3.16

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
