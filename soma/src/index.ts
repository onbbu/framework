import { IPromiseResponse } from "onbbu-core"
import { IExceptions, Postsynaptic } from "onbbu-axon";
import Cortex from "onbbu-cortex";

class Contract<T> {
    name: string

    constructor() {

        this.name = "xxx"
    }

    async validate(data: T): Promise<unknown> {

        return data
    }

    async service(data: T): IPromiseResponse<unknown> {

        return { statusCode: 'success', data: "" }
    }

    async middleware(data: T): Promise<unknown> {

        return data
    }
}

class Soma {
    private instance: Postsynaptic
    private _cortex?: Cortex<unknown>

    constructor(name: string) {

        this.instance = new Postsynaptic(name)
    }

    exceptions(fn: IExceptions): void {

        this.instance.exceptions = fn
    }

    use(contracts: Contract<unknown>[]): void {

        contracts.forEach(contract => this.instance.contract(contract.name, {
            validate: contract.validate,
            middleware: contract.middleware,
            service: contract.service,
        }))
    }

    async cortex<T>(cortex: Cortex<T>): Promise<void> {

        this._cortex = cortex

        await this._cortex.createTable()
    }

    async live(): Promise<void> {

        await this.instance.live()
    }

    async die(): Promise<void> {

        await this.instance.die()

        if (this._cortex !== undefined) {

            await this._cortex.close()
        }
    }
}


export default Soma