import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';

export interface ModelSchema {
    [key: string]: {
        type: ITypeData; 
        allowNull?: boolean;
        defaultValue?: any;
        unique?: boolean;
        primaryKey?: boolean
        validate?: {
            [key: string]: any;
        };
    };
}

export const type_data = [
    "UUID",
    "SMALLINT",
    "BIGINT",
    "INTEGER",

    "VARCHAR",

    "DATE",
    "TEXT",

    "BOOLEAN",

    "CIDR",
    "INET",
    "MACADDR",

    "JSON",
    "JSONB",
    "XML",


    "UUID[]",
    "SMALLINT[]",
    "BIGINT[]",
    "INTEGER[]",

    "VARCHAR[]",

    "DATE[]",
    "TEXT[]",

    "BOOLEAN[]",

    "CIDR[]",
    "INET[]",
    "MACADDR[]",

    "JSON[]",
    "JSONB[]",
    "XML[]"
] as const;

export type ITypeData = typeof type_data[number]

export const hooks = [
    "beforeCreate",
    "afterCreate",

    "beforeUpdate",
    "afterUpdate",

    "beforeDestroy",
    "afterDestroy",

    "beforeSave",
    "afterSave",

    "beforeUpsert",
    "afterUpsert",

    "beforeBulkCreate",
    "afterBulkCreate",

    "beforeBulkUpdate",
    "afterBulkUpdate",

    "beforeBulkDestroy",
    "afterBulkDestroy",

    "beforeCreateTable",
    "afterCreateTable",

    "beforeDropTable",
    "afterDropTable",

    "beforeValidate",
    "afterValidate",

    "beforeSave",
    "afterSave",

    "beforeDestroy",
    "afterDestroy",

    "beforeCount",
    "afterCount",

    "beforeQuery",

    "beforeFindOne",
    "afterFindOne",
] as const;

export type IHooks = typeof hooks[number]


export type IModelAttributesAsList<T> = {
    [K in keyof T]: T[K][];
};

export class HookManager {
    private hooks: Map<IHooks, Function[]> = new Map();

    public async runHooks(hookName: IHooks, ...args: any[]): Promise<void> {

        if (this.hooks.has(hookName)) {

            const hooks: Function[] = this.hooks.get(hookName)!;

            for (const hook of hooks) {
                await hook(...args);
            }
        }
    }

    public addHook(hookName: IHooks, hookFn: Function): void {

        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }

        const prev: Function[] = this.hooks.get(hookName)!;

        this.hooks.set(hookName, [...prev, hookFn]);
    }
}

class Cortex<T> {
    private pool: Pool
    private tableName: string;
    private schema: ModelSchema;
    private hooks: HookManager

    constructor(tableName: string, schema: ModelSchema, hooks: HookManager) {

        const config: PoolConfig = {
            user: process.env.DB_USERNAME,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        }

        this.pool = new Pool(config);

        this.tableName = `cortex_${tableName}`;

        this.schema = schema;

        this.hooks = hooks
    }

    async close() {
        this.pool.end()
    }

    private async query(queryText: string, params: any[] = []): Promise<any[]> {

        const client: PoolClient = await this.pool.connect();

        try {

            await this.hooks.runHooks('beforeQuery', { queryText, params });

            const result: QueryResult<any> = await client.query(queryText, params);

            return result.rows;

        } catch (error) {

            throw error; // Rethrow error to be handled elsewhere if needed

        } finally {
            client.release();
        }
    }

    /**
     * 
     * @param where 
     * @param index add offset for params of values
     * @returns 
     */
    private whereClause(where: Partial<T>, offset?: number): string {

        return Object.entries(where)
            .map(([key, value], i) => {
                if (Array.isArray(value)) {
                    return `${key} IN (${value.map((_, j) => `$${i * value.length + j + 1}`).join(', ')})`;
                } else {
                    return `${key} = $${offset + 1 || i + 1}`;
                }
            })
            .join(' AND ');
    }

    async createTable(): Promise<void> {

        await this.hooks.runHooks('beforeCreateTable');

        const columns: string[] = []

        for (const [key, constraints] of Object.entries(this.schema)) {

            let columnDefinition: string = `${key} ${constraints.type}`;

            if (constraints.allowNull === false) {
                columnDefinition += ' NOT NULL';
            }

            if (constraints.defaultValue !== undefined) {
                columnDefinition += ` DEFAULT ${constraints.defaultValue}`;
            }

            if (constraints.unique) {
                columnDefinition += ' UNIQUE';
            }

            columns.push(columnDefinition)
        }

        const queryText: string = `CREATE TABLE IF NOT EXISTS ${this.tableName} (${columns.join(', ')})`;

        await this.query(queryText);

        await this.hooks.runHooks('afterCreateTable');
    }

    async dropTable(): Promise<void> {

        await this.hooks.runHooks('beforeDropTable');

        const queryText: string = `DROP TABLE IF EXISTS ${this.tableName}`;

        await this.query(queryText);

        await this.hooks.runHooks('afterDropTable');
    }

    async find(opts: { where: Partial<T>, limit?: number, offset?: number }, client?: PoolClient): Promise<T[]> {

        let queryText: string = `SELECT * FROM ${this.tableName}`;

        if (Object.keys(opts.where).length > 0) {

            const conditions: string = Object
                .entries(opts.where)
                .map(([key, _], i) => `${key} = $${i + 1}`).join(' AND ');

            queryText += ` WHERE ${conditions}`;
        }

        queryText += ` LIMIT ${opts.limit || 50}`;

        queryText += ` OFFSET ${opts.offset || 0}`;

        const params = Object.values(opts.where || {})

        const result: T[] = client
            ? (await client.query(queryText, params)).rows
            : await this.query(queryText, params);

        return result
    }

    async create(data: T, client?: PoolClient): Promise<T> {

        await this.hooks.runHooks('beforeCreate', data);

        this.validate(data);


        const keys: string[] = Object.keys(data);

        const params = Object.values(data);

        const queryText: string = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;


        const result: T[] = client
            ? (await client.query(queryText, params)).rows
            : await this.query(queryText, params);

        await this.hooks.runHooks('afterCreate', result);

        return result[0];
    }

    async count(where: Partial<T> = {}, client?: PoolClient): Promise<number> {

        await this.hooks.runHooks('beforeCount', where);

        let queryText: string = `SELECT COUNT(*) FROM ${this.tableName}`

        const query_where: string = this.whereClause(where)

        if (query_where) {
            queryText += ` WHERE ${query_where}`
        }

        const params = Object.values(where)

        const result: T[] = client
            ? (await client.query(queryText, params)).rows
            : await this.query(queryText, params);

        //@ts-ignore
        const count: number = parseInt(result[0].count, 10);

        await this.hooks.runHooks('afterCount', count);

        return count;
    }

    async findOne(where: Partial<T> = {}, client?: PoolClient): Promise<T | undefined> {

        await this.hooks.runHooks('beforeFindOne', where);

        const whereClause: string = this.whereClause(where);

        if (!whereClause) {
            throw new Error('No valid WHERE clause provided');
        }

        const queryText: string = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1;`;

        const params = Object.values(where)

        const result: T[] = client
            ? (await client.query(queryText, params)).rows
            : await this.query(queryText, params);

        await this.hooks.runHooks('afterFindOne', result);

        return result.length > 0 ? result[0] : undefined
    }

    async update(where: Partial<T>, data: Partial<T>, client?: PoolClient): Promise<T[]> {

        await this.hooks.runHooks('beforeUpdate', data);

        if (Object.keys(data).length === 0) {
            throw new Error('No data provided for update');
        }

        const keys: string[] = Object.keys(data);

        const setClause: string = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

        const whereClause: string = this.whereClause(where, keys.length);

        if (!whereClause) {
            throw new Error('No valid WHERE clause provided');
        }

        const queryText: string = `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereClause} RETURNING *;`;

        const params: unknown[] = [...Object.values(data), ...Object.values(where)];

        const result: T[] = client
            ? (await client.query(queryText, params)).rows
            : await this.query(queryText, params);

        await this.hooks.runHooks('afterUpdate', result);

        return result
    }

    async destroy(where: Partial<T> = {}, client?: PoolClient) {

        await this.hooks.runHooks('beforeDestroy');

        const whereClause: string = this.whereClause(where);

        if (!whereClause) {
            throw new Error('No valid WHERE clause provided');
        }

        const queryText: string = `DELETE FROM ${this.tableName} WHERE ${whereClause} RETURNING *;`;

        const params = Object.values(where)

        const result: T[] = client
            ? (await client.query(queryText, params)).rows
            : await this.query(queryText, params);

        await this.hooks.runHooks('afterDestroy', result);

        return result;
    }

    async bulkDestroy(where: Partial<IModelAttributesAsList<T>> = {}, client?: PoolClient) {

        await this.hooks.runHooks('beforeBulkDestroy');

        const params: unknown[] = Object.values(where)

        const whereClause: string[] = Object.entries(where)
            .map(([key, _], i) => `${key} = ANY($${i + 1})`)

        if (!whereClause) {
            throw new Error('No valid WHERE clause provided');
        }

        const queryText: string = `DELETE FROM ${this.tableName} WHERE ${whereClause.join(' OR ')} RETURNING *;`;

        const result: T[] = client
            ? (await client.query(queryText, params)).rows
            : await this.query(queryText, params);

        await this.hooks.runHooks('afterBulkDestroy', result);

        return result;
    }

    async withTransaction<R>(callback: (client: PoolClient) => Promise<R>): Promise<R> {

        const client: PoolClient = await this.pool.connect();

        try {

            await client.query('BEGIN');

            const result: Awaited<R> = await callback(client);

            await client.query('COMMIT');

            return result;

        } catch (err) {

            await client.query('ROLLBACK');

            throw err;

        } finally {

            client.release();
        }
    }

    private validate(data: Partial<T>) {

        for (const [key, constraints] of Object.entries(this.schema)) {

            const value = data[key];

            if (constraints.allowNull === false && (value === undefined || value === null)) {
                throw new Error(`${key} cannot be null`);
            }

            if (constraints.validate && typeof constraints.validate === 'function') {

                if (!constraints.validate(value)) {

                    throw new Error(`${key} failed validation`);
                }
            }
        }
    }
}

export default Cortex