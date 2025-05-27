import {WebSocketServer} from "ws";

import {Subject, timer, filter, first, takeUntil, tap} from "rxjs";

import {randomText} from "../utils";
import {models} from "../models";
import {Server} from "node:http";

let wss: WebSocketServer | undefined = undefined, intervalId: number;

const incomeMessages = new Subject();
const connectedDevices = new Set();

const wepSocketInstance = {
    wss,
    incomeMessages,
    connectedDevices,

    stop: async () => {
        clearInterval(intervalId);
        return new Promise(resolve => wss?.close(resolve));
    },

    startWebSocket: async (server: Server) => {
        wss = new WebSocketServer({server});

        // update all devices to off
        await models.Device.updateMany({}, {params: {on: false}});

        wss.on('connection', (ws: any) => {
            console.log('NEW CONNECTION');
            ws.isAlive = true;

            ws.on('pong', function () {
                console.log('pong')
                ws.isAlive = true;
            });

            ws.on('message', async (message: any) => {
                console.log(message.toString());

                try {
                    /**
                     * @type {{ mid: string, messageType: string, payload: {id: string, on: boolean, type: string, name: {name: string}}} | any}
                     */
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

        intervalId = +setInterval(() => {
            wss?.clients.forEach((ws: any) => {

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

    async sendMessageWaitResponse(id: string, message: any) {
        const mid = this.sendMessage(id, message);

        return new Promise((resolve, reject) => {
            incomeMessages
                .pipe(
                    filter((m: any) => m.mid === mid),
                    first(),
                    takeUntil(timer(1000).pipe(tap(() => reject()))),
                )
                .subscribe(m => {
                    resolve(m);
                });
        });
    },

    sendMessage: (id: string, message: any) => {
        const mid = randomText(20);

        wss?.clients.forEach((ws: any) => {
            if (ws.lid === id) {
                ws.send(JSON.stringify({...message, mid}));
            }
        });

        return mid;
    },

    broadcastMessage(message: string) {
        wss?.clients.forEach(ws => {
            ws.send(JSON.stringify(message));
        });
    }
};

export default wepSocketInstance;
