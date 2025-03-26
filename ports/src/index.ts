import { randomUUID } from 'crypto';
import { createServer, createConnection, Socket, Server } from 'net';

interface IPayload {
    PORT_TO_LISTEN: number;
    FORWARD_HOST: string;
    FORWARD_PORT: number;
}

class Service {
    private raw: Map<string, { server: Server, payload: IPayload }>

    constructor() {

        this.raw = new Map()
    }

    use(payload: IPayload): void {

        if (payload.PORT_TO_LISTEN <= 0 || payload.FORWARD_PORT <= 0) {
            throw new Error('Los puertos deben ser números positivos.');
        }

        const server: Server = createServer((clientSocket: Socket) => {

            const remoteSocket: Socket = createConnection(payload.FORWARD_PORT, payload.FORWARD_HOST, () => {
                console.log(`Conectado a ${payload.FORWARD_HOST}:${payload.FORWARD_PORT}`);
            });

            clientSocket.pipe(remoteSocket);

            remoteSocket.pipe(clientSocket);


            clientSocket.on('data', (data) => {
                console.error('data en clientSocket:', data.toString());
            });

            remoteSocket.on('data', (data) => {
                console.error('data en remoteSocket:', data.toString());
            });


            clientSocket.on('error', (err) => {
                console.error('Error en cliente:', err);
            });

            remoteSocket.on('error', (err) => {
                console.error('Error en remoto:', err);
            });

            clientSocket.on('close', () => {
                console.log('Cliente desconectado');
                remoteSocket.end();
            });

            remoteSocket.on('close', () => {
                console.log('Conexión remota cerrada');
                clientSocket.end();
            });
        });

        this.raw.set(randomUUID(), { server, payload })
    }

    live(id: string): void {

        if (!this.raw.has(id)) {

            return console.error(`No se encontró un servidor con el ID: ${id}`);
        }

        const { payload, server } = this.raw.get(id);

        server.listen(payload.PORT_TO_LISTEN, () => {
            console.log(`Servidor escuchando en el puerto ${payload.PORT_TO_LISTEN}`);
        })
    }

    liveAll(): void {

        for (const [_, { payload, server }] of this.raw) {

            server.listen(payload.PORT_TO_LISTEN, () => {
                console.log(`Servidor escuchando en el puerto ${payload.PORT_TO_LISTEN}`);
            });
        }
    }

    die() {
        for (const [_, { server }] of this.raw) {
            if (server.listening) {
                server.close();
            }
        }
    }
}

export default Service

/*
const service = new Service()

service.use({
    PORT_TO_LISTEN: 7777,
    FORWARD_HOST: '192.168.1.37',
    FORWARD_PORT: 81,
})

service.liveAll()*/