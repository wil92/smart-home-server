import {WebSocketServer} from "ws";
import path from "path";
import fs from "fs";

import {Subject, timer, filter, first, takeUntil, tap} from "rxjs";
import ffmpeg from "fluent-ffmpeg";

import {randomText} from "../utils";
import {models} from "../models";
import {Server} from "node:http";

let wss: WebSocketServer | undefined = undefined, intervalId: number;

export interface WSMessage {
    mid: string;
    messageType: string;
    payload: {
        id: string;
        on: boolean;
        type: string;
        name: { name: string };
    };
}

export interface WSMessageResponse {
    payload: {
        messageType: string;
        command?: {
            on?: boolean;
            start?: boolean;
        }
    };
    mid?: string;
}

const incomeMessages = new Subject<WSMessage>();
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

            ws.on('error', (err: any) => {
                console.error('WebSocket error:', err);
            });

            ws.on('message', async (message: any, isBinary: boolean) => {
                if (!isBinary) {
                    try {
                        const messageObj = JSON.parse(message.toString());
                        console.log("JSON");

                        await models.Device.updateOrCreate(messageObj);
                        connectedDevices.add(messageObj.payload.id);
                        ws.lid = messageObj.payload.id;

                        incomeMessages.next(messageObj);
                    } catch (err) {
                    }
                } else {
                    // handle jpg file
                    console.log("JPG");
                    // mark the device as streaming
                    ws.isStreaming = true;
                    ws.lastFrame = new Date().getTime();

                    if (!ws.lastRequest) {
                        ws.lastRequest = new Date().getTime();
                    }

                    const streamDirectory = path.join(__dirname, '../../public/stream');
                    const streamFile = path.join(streamDirectory, ws.lid + '.jpg');
                    fs.writeFileSync(streamFile, message);

                    if (ws.fromGoogle) {
                        try {
                            const hlsFile = path.join(streamDirectory, ws.lid + '.m3u8');
                            await new Promise((resolve, reject) => {
                                ffmpeg(streamFile, {}).addOption([
                                    '-loop 1',
                                    // '-c:v libx264',
                                    // '-tune zerolatency',
                                    '-pix_fmt yuv420p',
                                    '-start_number 0',
                                    '-hls_time 10',
                                    '-hls_list_size 0',
                                    '-hls_flags delete_segments',
                                    '-f hls'
                                ]).output(hlsFile).on('end', (res, err) => {
                                    if (err) {
                                        return reject(err);
                                    }
                                    resolve(res);
                                }).run();
                            });
                        } catch (ignore) {
                        }
                    }
                    incomeMessages.next({
                        messageType: "JSON",
                        payload: {id: ws.lid}
                    } as WSMessage);
                }
            });
        });

        intervalId = +setInterval(() => {
            wss?.clients.forEach((ws: any) => {

                if (!ws.isAlive) {
                    connectedDevices.delete(ws.lid);
                    return ws.terminate();
                } else {
                    if (new Date().getTime() - ws.lastFrame > 3000) {
                        ws.isStreaming = false;
                    }
                    if (new Date().getTime() - ws.lastRequest > 10000) {
                        wepSocketInstance.sendMessage(ws.lid, {
                            payload: {
                                messageType: 'EXECUTE',
                                command: {
                                    on: false,
                                }
                            }
                        } as WSMessageResponse);
                    }
                }

                ws.isAlive = false;
                ws.ping();
            });
        }, 4000);
    },

    async sendMessageWaitResponse(id: string, message: WSMessageResponse) {
        const mid = this.sendMessage(id, message);

        return new Promise((resolve, reject) => {
            incomeMessages
                .pipe(
                    filter((m: WSMessage) => m.mid === mid),
                    first(),
                    takeUntil(timer(1000).pipe(tap(() => reject()))),
                )
                .subscribe(m => {
                    resolve(m);
                });
        });
    },

    sendMessage: (id: string, message: WSMessageResponse) => {
        const mid = randomText(20);

        wss?.clients.forEach((ws: any) => {
            if (ws.lid === id) {
                ws.send(JSON.stringify({...message, mid} as WSMessageResponse));
            }
        });

        return mid;
    },

    updateLastStreamingRequest: (id: string, fromGoogle: boolean = false) => {
        let isStreaming = false;
        wss?.clients.forEach((ws: any) => {
            if (ws.lid === id) {
                ws.lastRequest = new Date().getTime();
                ws.fromGoogle = fromGoogle;
            }
        });
        return isStreaming;
    },

    isWebSocketStreaming: (id: string) => {
        let isStreaming = false;
        wss?.clients.forEach((ws: any) => {
            if (ws.lid === id && ws.isStreaming) {
                isStreaming = true;
            }
        });
        return isStreaming;
    },

    broadcastMessage(message: string) {
        wss?.clients.forEach(ws => {
            ws.send(JSON.stringify(message));
        });
    }
};

export default wepSocketInstance;
