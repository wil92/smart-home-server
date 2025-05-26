# Smart home server (v1)

This is the server side of the project [smart-home-arduino]().
This project is a REST API that allows you to control your smart home devices and integrate them with Google Home API.

## Install dependencies

```bash
npm install
```

## Run server

### Setup database

To start the tests you need to have a database running. In the scripts folder you can find the docker-comnpose.db.yml
file that will start a MongoDB instance by executing the following command:

```bash
docker-compose -f scripts/docker-compose.db.yml up -d
```

### Start server

```bash
npm start
# or
npm run dev
```

## Run tests

So far we have implemented unit tests for the server and integration tests for the API integration with Google Home and
WebSocket connection simulation with the devices.

```bash
# before starting the server see "Setup database" in the "Run server" section
npm test
```

## Contributions

All contributions are welcome

## Author

- [wil92](https://github.com/wil92)

```
// login example
http://localhost:3002/auth?client_id=GOOGLE_CLIENT_ID&redirect_uri=REDIRECT_URI&state=STATE_STRING&scope=REQUESTED_SCOPES&response_type=code
```
