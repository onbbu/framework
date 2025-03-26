import Fastify, { FastifyRequest, FastifyReply, FastifyInstance, RawServerDefault } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyFormbody from '@fastify/formbody';
import fastifyRateLimit from '@fastify/rate-limit';
import fs from "fs"
import { ServerOptions } from 'https';
import { IncomingMessage, ServerResponse } from 'http';
import { Presynaptic } from 'onbbu-axon';
import { IResponse } from 'onbbu-core';

const codeHttp = {
    "success": 200,
    "error": 500,
    "not found": 404,
    "not permitted": 400,
    "validation error": 400,
    "not authenticated": 400,
}

interface IRoute {
    name: string
    contracts: {
        method: 'GET' | 'POST' | 'PUT' | 'DELETE'
        url: string
        name: string;
    }[];
}

class Server {
    private fastify: FastifyInstance
    private isSecure: boolean
    private port: number

    constructor(isSecure: boolean, port?: number) {

        this.isSecure = isSecure

        if (port === undefined) {

            this.port = this.isSecure ? 443 : 8000

        } else {
            this.port = port
        }

        const opts = {}

        if (this.isSecure) {

            const https: ServerOptions<typeof IncomingMessage, typeof ServerResponse> = {
                key: fs.readFileSync(process.env.KEY),
                cert: fs.readFileSync(process.env.CERT)
            }

            opts['https'] = https
        }

        this.fastify = Fastify({ logger: true, ...opts });

        this.fastify.register(fastifyCors, {
            origin: ['*'],
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
        });

        this.fastify.register(fastifyFormbody);

        this.fastify.register(fastifyRateLimit, {
            max: 5,
            timeWindow: '1 minute',
            keyGenerator: (request: FastifyRequest) => request.ip,
            errorResponseBuilder: (req: FastifyRequest, context: any) => {
                return {
                    code: 429,
                    error: 'Too Many Requests',
                    message: `You have exceeded the request limit of ${context.max} requests per ${context.after}. Try again later.`,
                };
            }
        });
    }

    live() {
        this.fastify.listen({ port: this.port }, (err, address) => {

            if (err) {
                this.fastify.log.error(err);
            }

            this.fastify.log.info(`Server listening on ${address}`);
        });
    }

    die() {
        this.fastify.close()
    }

    define_routes(routes: IRoute[]) {

        for (const endpoint of routes) {

            const instance: Presynaptic = new Presynaptic(endpoint.name)

            for (const contract of endpoint.contracts) {

                this.fastify.route({
                    method: contract.method,
                    url: contract.url,
                    handler: async (request: FastifyRequest, reply: FastifyReply) => {

                        let params = {}

                        if (contract.method === 'POST' || contract.method === 'PUT') {
                            params = request.body
                        }

                        if (contract.method === 'DELETE' || contract.method === 'GET') {
                            params = request.query
                        }

                        const response: IResponse<unknown> = await instance.sendSignal({
                            params,
                            metaData: {
                                id: '0',
                                protocol: 'HTTP',
                                ip: request.ip,
                                token: request.headers.authorization || null,
                            }
                        }, contract.name);

                        reply
                            .status(codeHttp[response.statusCode])
                            .send(response.data ? response.data : response.message);
                    }
                })
            }
        }
    }

    get server(): RawServerDefault {

        return this.fastify.server
    }
}

export default Server