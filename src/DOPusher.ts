import { DurableObject } from "cloudflare:workers";
import { Env } from ".";

interface WsAttachment {
    subscriptions: Set<string>
}

export class DOPusher extends DurableObject {
  currentlyConnectedWebSockets: number;
  channels: Map<string, Set<string>>;
  
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.currentlyConnectedWebSockets = 0;
    this.channels = new Map()
    this.ctx.getWebSockets().forEach(ws => {
        const wsAttachment = ws.deserializeAttachment() as WsAttachment
        const [clientId] = this.ctx.getTags(ws)

        wsAttachment.subscriptions.forEach((channel) => {
            if (!this.channels.get(channel)) {
                this.channels.set(channel, new Set([clientId]))
            } else {
                this.channels.get(channel)!.add(clientId)
            }
        })
    })
    console.log(`constructor`, this.channels)
  }

  async fetch(request: Request): Promise<Response> {
    // Creates two ends of a WebSocket connection.
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
  
    // Calling `accept()` tells the runtime that this WebSocket is to begin terminating
    // request within the Durable Object. It has the effect of "accepting" the connection,
    // and allowing the WebSocket to send and receive messages.

    const socketId = this.#generateSocketId()
    this.ctx.acceptWebSocket(server, [socketId])
    this.currentlyConnectedWebSockets += 1;

    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"event":"pusher:ping","data":{}}','{"event":"pusher:pong"}'))
    
    server.serializeAttachment({subscriptions: new Set()} as WsAttachment)
    server.send(JSON.stringify({
        event: 'pusher:connection_established',
        data: JSON.stringify({
            socket_id: socketId,
            activity_timeout: 120
        })
    }));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }


  webSocketMessage(ws: WebSocket, eventData: String | ArrayBuffer): void | Promise<void> {
    console.log(`webSocketMessage ${eventData}`)
    const message = JSON.parse(eventData.toString());
    const { event: type, channel, data } = message as {event: string, channel?: string, data?: any};
    switch (type) {
      case 'pusher:subscribe':
        this.#handleSubscription(ws, data);
        break;
      case 'pusher:unsubscribe':
        this.#handleUnsubscription(ws, data);
        break;
      default:
        if (type.startsWith('client-')) {
            //TODO: Only auth can do this
            this.#broadcastToChannel(ws, type, channel!, data);
        } else {
            console.warn('Unhandled message type:', type);
        }
    }
    // ws.send(`[Durable Object] currentlyConnectedWebSockets: ${this.currentlyConnectedWebSockets}`);
  }
  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
    console.log(`webSocketClose ${code} ${reason} ${wasClean}`)
    this.currentlyConnectedWebSockets -= 1;
    //TODO: handle cleanup
    const [clientId] = this.ctx.getTags(ws)
    const wsAttachment = ws.deserializeAttachment() as WsAttachment

    console.log(wsAttachment)

    wsAttachment.subscriptions.forEach((channel) => {
        this.channels.get(channel)?.delete(clientId)
    })

    ws.close(code, "Durable Object is closing WebSocket");
  }
  webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {
    console.log(`webSocketError ${error}`)
  }

  #generateSocketId() {
    return `${this.ctx.id.toString()}--${Date.now()}`;
  }


  #handleSubscription(ws: WebSocket, data: any) {
    const {channel, auth} = data
    if (channel.startsWith('private-') || channel.startsWith('presence-')) {
        // TODO: For private and presence channels, handle subscription via authentication
        // this.#handlePrivateOrPresenceSubscription(ws, clientId, channel, auth);
    } else {
        // For public channels
        this.#subscribeToChannel(ws, channel);
    }
}

// #handlePrivateOrPresenceSubscription(ws, message) {
//     const channel = message.data.channel;
//     const authData = message.data.auth;

//     // Verify the authentication
//     const [key, token] = authData.split(':');
//     if (key !== pusherKey) {
//         ws.send(JSON.stringify({
//             event: 'pusher:error',
//             data: {
//                 message: 'Invalid key'
//             }
//         }));
//         return;
//     }

//     try {
//         const decoded = jwt.verify(token, pusherSecret);
//         if (decoded.channel === channel && decoded.socket_id === ws.id) {
//             if (channel.startsWith('presence-')) {
//                 handlePresenceSubscription(ws, message, decoded);
//             } else {
//                 subscribeToChannel(ws, channel);
//             }
//         } else {
//             throw new Error('Invalid token');
//         }
//     } catch (error) {
//         ws.send(JSON.stringify({
//             event: 'pusher:error',
//             data: {
//                 message: 'Invalid auth'
//             }
//         }));
//     }
// }

// #handlePresenceSubscription(ws, message, decoded) {
//     const channel = message.data.channel;
//     const user_id = decoded.user_id;

//     if (!clients.has(ws.id)) {
//         clients.set(ws.id, { ws, channels: new Set(), user_id });
//     }

//     const clientInfo = clients.get(ws.id);
//     clientInfo.user_id = user_id;
//     subscribeToChannel(ws, channel);

//     ws.send(JSON.stringify({
//         event: 'pusher_internal:subscription_succeeded',
//         channel: channel,
//         data: JSON.stringify({
//             presence: {
//                 count: 1, // Simulated count, adjust as needed
//                 ids: [user_id],
//                 hash: { [user_id]: clientInfo }
//             }
//         })
//     }));
// }

#subscribeToChannel(ws: WebSocket, channel: string) {
    const [clientId] = this.ctx.getTags(ws)
    const wsAttachment = ws.deserializeAttachment() as WsAttachment
    wsAttachment.subscriptions.add(channel)
    // save channel to attachment
    ws.serializeAttachment(wsAttachment)
    
    // save channel to channel map
    if (!this.channels.get(channel)) {
        this.channels.set(channel, new Set(clientId))
    } else {
        this.channels.get(channel)?.add(clientId)
    }

    ws.send(JSON.stringify({
        event: 'pusher_internal:subscription_succeeded',
        channel: channel
    }));
}

#handleUnsubscription(ws: WebSocket, data: any) {
    const {channel} = data  
    const [clientId] = this.ctx.getTags(ws)
    this.channels.get(channel)?.delete(clientId)

    const wsAttachment = ws.deserializeAttachment() as WsAttachment
    wsAttachment.subscriptions.delete(channel)
    ws.serializeAttachment(wsAttachment)
}

// #handleClientEvent(ws, message) {
//     const eventName = message.event;
//     const data = message.data;
//     const channel = message.channel;

//     if (!clients.has(ws.id)) return;
//     const clientChannels = clients.get(ws.id).channels;

//     if (clientChannels.has(channel)) {
//         broadcastToChannel(channel, {
//             event: eventName,
//             channel: channel,
//             data: data
//         });
//     }
// }

// #handleAuth(ws, message) {
//     const socketId = ws.id;
//     const channel = message.data.channel;
//     const auth = message.data.auth;

//     // Implement your authentication logic here
//     if (auth === 'YOUR_AUTH_SIGNATURE') {
//         ws.send(JSON.stringify({
//             event: 'pusher:subscription_succeeded',
//             channel: channel
//         }));
//     } else {
//         ws.send(JSON.stringify({
//             event: 'pusher:error',
//             data: {
//                 message: 'Authentication failed'
//             }
//         }));
//     }
// }


    #broadcastToChannel(ws: WebSocket, event: string, channel: string, data: any) {
        const message = {
                event,
                data,
                channel
              }
        // channel, , clientId
        this.channels.get(channel)?.forEach((clientId)=> {
            this.ctx.getWebSockets(clientId).forEach((subWs)=> {
                subWs.send(JSON.stringify(message))
            })
        })
        
    }
}

