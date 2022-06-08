const WebSocket = require('ws');

const data = require('../logic/data');

let wss;

function heartbeat() {
  this.isAlive = true;
}

const ws = {
  startWebSocket: (server) => {
    wss = new WebSocket.Server({server});

    wss.on('connection', (ws) => {
      console.log('NEW CONNECTION');
      ws.isAlive = true;
      ws.on('pong', heartbeat);

      ws.on('message', (message) => {
        console.log(message.toString());

        try {
          const light = JSON.parse(message.toString());
          data.lights.set(light.id, light);
          ws.lid = light.id;
        } catch (ignore) {
          // ignore
        }
      });
    });

    setInterval(() => {
      wss.clients.forEach((ws) => {

        if (!ws.isAlive) {
          data.lights.delete(ws.lid);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping(null, false, true);
      });
    }, 4000);
  },

  sendMessage: (id, message) => {
    let wsClient;
    wss.clients.forEach(ws => {
      if (ws.lid === id) {
        wsClient = ws;
      }
    });
    if (wsClient) {
      wsClient.send(JSON.stringify(message));
    }
  }
};

module.exports = ws;
