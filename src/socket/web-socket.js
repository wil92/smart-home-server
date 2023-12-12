const {WebSocketServer} = require("ws");

const {randomText} = require("../utils");
const {Subject, timer, filter, first, takeUntil, tap} = require("rxjs");
const {models} = require("../models");

let wss, intervalId;

const incomeMessages = new Subject();
const connectedDevices = new Set();

const ws = {
  wss,
  incomeMessages,
  connectedDevices,

  stop: async () => {
    clearInterval(intervalId);
    return new Promise(resolve => wss.close(resolve));
  },

  startWebSocket: (server) => {
    wss = new WebSocketServer({server});

    wss.on('connection', (ws) => {
      console.log('NEW CONNECTION');
      ws.isAlive = true;

      ws.on('pong', function () {
        console.log('pong')
        this.isAlive=true;
      });

      ws.on('message', async (message) => {
        console.log(message.toString());

        try {
          const messageObj = JSON.parse(message.toString());

          await models.Device.updateOrCreate(messageObj);
          connectedDevices.add(messageObj.payload.id);
          ws.lid = messageObj.payload.id;

          incomeMessages.next(messageObj);
        } catch (err) {
          console.error(err);
        }
      });
    });

    intervalId = setInterval(() => {
      wss.clients.forEach((ws) => {

        if (!ws.isAlive) {
          connectedDevices.delete(ws.lid);
          return ws.terminate();
        }

        ws.isAlive = false;
        // console.log("ping")
        ws.ping();
      });
    }, 4000);
  },

  async sendMessageWaitResponse(id, message) {
    const mid = this.sendMessage(id, message);

    return new Promise((resolve, reject) => {
      incomeMessages
        .pipe(
          filter(m => m.mid === mid),
          first(),
          takeUntil(timer(1000).pipe(tap(() => reject()))),
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
