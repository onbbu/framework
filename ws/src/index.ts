import { WebSocketServer, WebSocket, RawData, Server as ServerWs } from "ws";
import { Server as ServerHttps } from "node:https";
import { Server as ServerHttp, IncomingMessage } from "node:http";
import { internalError, IResponse } from "onbbu-core";
import { Presynaptic } from "onbbu-axon";
import z from "zod";
import { randomUUID } from "node:crypto";

export type WSS = ServerWs<typeof WebSocket, typeof IncomingMessage>

interface IRoute {
  name: string
  contracts: {
    event_in: string
    event_out: string
    name: string;
  }[];
}

class Server {
  wss: WSS
  interval: NodeJS.Timeout
  route: Map<string, (params: unknown, ip: string, token?: string) => Promise<string>>
  socket: Map<string, WebSocket>

  constructor(server: ServerHttp | ServerHttps) {

    this.wss = new WebSocketServer({ noServer: true, server });

    this.interval = setInterval(() => {

      this.wss.clients.forEach((ws: WebSocket) => {

        //@ts-ignore
        if (ws.isAlive === false) {

          return ws.terminate();
        }

        //@ts-ignore
        ws.isAlive = false;

        ws.ping();
      });
    }, 30000);
  }

  private async handleClose() {
    clearInterval(this.interval)
  }

  live() {

    this.wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {

      //@ts-ignore
      ws.isAlive = true;

      //@ts-ignore
      ws.on("pong", () => ws.isAlive = true);

      const ip: string = req.socket.remoteAddress; //|| req.headers['x-forwarded-for'].split(',')[0].trim();

      const id: string = Date.now().toString() + "::" + randomUUID();

      this.socket.set(`${id}::${ip}`, ws)

      ws.on("close", () => {
        this.socket.delete(`${id}::${ip}`)
      });

      ws.on("message", async (data: RawData, isBinary: boolean) => {

        let raw_data: string = ""

        if (isBinary) {

          /* ??? */

        } else {

          raw_data = data.toString()
        }

        try {

          const pureDataSchema = z.lazy(() =>
            z.union([
              z.string(),
              z.number(),
              z.boolean(),
              z.array(pureDataSchema),
              z.record(pureDataSchema)
            ])
          );

          const schema = z.object({
            event: z.string().min(8).max(128),
            payload: z.record(pureDataSchema)
          });

          const result = schema.safeParse(JSON.parse(raw_data));

          if (!result.success) {
            return
          }

          const { event, payload } = result.data

          if (!this.route.has(event)) {
            return
          }

          const handler = this.route.get(event)

          const response: string = await handler(payload, ip, "token")

          ws.send(response);

        } catch (error) {

          ws.send(JSON.stringify(internalError));
        }
      })
    });

    this.wss.on("close", this.handleClose);
  }

  define_routes(routes: IRoute[]) {

    for (const endpoint of routes) {

      const instance: Presynaptic = new Presynaptic(endpoint.name)

      for (const contract of endpoint.contracts) {

        this.route.set(contract.event_in, async (params: unknown, ip: string, token?: string) => {

          const response: IResponse<unknown> = await instance.sendSignal({
            params,
            metaData: {
              id: '0',
              protocol: 'WS',
              ip,
              token
            }
          }, contract.name);

          return JSON.stringify({ event: contract.event_out, payload: response });
        })

      }
    }
  }
}

export default Server