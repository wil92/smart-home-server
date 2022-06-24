const WebSocket = require('ws');

const data = require('../data');
const {randomText} = require("../utils");
const {Subject, timer, filter, first, takeUntil, tap} = require("rxjs");

let wss;

function heartbeat() {
  this.isAlive = true;
}

const incomeMessages = new Subject();

const ws = {
  wss,

  startWebSocket: (server) => {
    wss = new WebSocket.Server({server});

    wss.on('connection', (ws) => {
      console.log('NEW CONNECTION');
      ws.isAlive = true;
      ws.on('pong', heartbeat);

      ws.on('message', (message) => {
        console.log(message.toString());

        try {
          const messageObj = JSON.parse(message.toString());

          data.lights.set(messageObj.payload.id, messageObj.payload);
          ws.lid = messageObj.payload.id;

          incomeMessages.next(messageObj);
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

  async sendMessageWaitResponse(id, message) {
    const mid = this.sendMessage(id, message);

    return new Promise((resolve, reject) => {
      incomeMessages
        .pipe(
          filter(m => m.mid === mid),
          takeUntil(timer(1000).pipe(tap(() => reject()))),
          first()
        )
        .subscribe(m => {
          resolve(m);
        });
    });
  },

  sendMessage: (id, message) => {
    const mid = randomText(20);

    wss.clients.forEach(ws => {
      if (ws.lid === id) {
        ws.send(JSON.stringify({...message, mid}));
      }
    });

    return mid;
  },

  broadcastMessage(message) {
    wss.clients.forEach(ws => {
      ws.send(JSON.stringify(message));
    });
  }
};

module.exports = ws;
