FROM node:14.16-alpine3.11

WORKDIR /app

COPY package.json ./
RUN npm install

COPY bin ./bin
COPY public ./public
COPY socket ./socket
COPY routes ./routes
COPY views ./views
COPY logic ./logic
COPY app.js ./

CMD ["node", "bin/www"]
