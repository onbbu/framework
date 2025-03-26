import { createClient, RedisClientOptions, RedisFunctions, RedisModules, RedisScripts } from "redis";

export class Base {
  client: ReturnType<typeof createClient>;

  constructor(options?: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>) {

    this.client = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      password: process.env.REDIS_PASS,
      ...options
    });

    if (!this.client.isOpen) {
      this.client.connect();
    }

    this.client.on("error", (err) => console.log("Redis Client Error", err));
  }
}

export class ZSetRedis<T> extends Base {
  key: string;

  constructor(key: string, options?: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>) {
      super(options);
      this.key = key;
  }

  async add(value: T) {

      const score = await this.client.zCard(this.key);

      await this.client.zAdd(this.key, { score: score + 1, value: JSON.stringify(value) });
  }

  async get(): Promise<T[]> {

      const raw: string[] = await this.client.zRange(this.key, 0, -1);

      return raw.map(v => JSON.parse(v));
  }

  async update(value: T, newScore: number) {
      await this.client.zAdd(this.key, { score: newScore, value: JSON.stringify(value) });
  }

  async destroy(value: T) {
      await this.client.zRem(this.key, JSON.stringify(value));
  }

  async drop() {
      await this.client.del(this.key);
  }

  async rank(value: T): Promise<number | null> {
      return await this.client.zRank(this.key, JSON.stringify(value));
  }
}

export class ListRedis<T> extends Base {
  key: string;

  constructor(key: string, options?: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>) {

    super(options)

    this.key = key
  }

  async add(value: T) {

    await this.client.rPush(this.key, JSON.stringify(value));
  }

  async get(): Promise<T[]> {

    const raw: string[] = await this.client.lRange(this.key, 0, -1);

    return raw.map(v => JSON.parse(v));
  }

  async update(index: number, value: T) {

    await this.client.lSet(this.key, index, JSON.stringify(value));
  }

  async destroy(value: T) {

    await this.client.lRem(this.key, 1, JSON.stringify(value));
  }

  async drop() {

    await this.client.del(this.key);
  }

}

export class AdapterRedis<T> extends Base {
  private prefix: string;
  private field_key: string;

  constructor(prefix: string, field_key: string, options?: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>) {

    super(options)

    this.prefix = prefix
    this.field_key = field_key
  }

  private addPrefix(key: string): string {

    return `${this.prefix}::${key}`;
  }

  private removePrefix(value: T): T {

    value[this.field_key] = value[this.field_key].replace(`${this.prefix}::`, "");

    return value;
  }

  async create(key: string, value: T): Promise<T> {

    const _key: string = this.addPrefix(key);

    const payload: T = { ...value, id: _key };

    await this.client.set(_key, JSON.stringify(payload));

    return this.removePrefix(payload);
  }

  async readAll(): Promise<T[]> {

    const keys: string[] = [];

    const instances: T[] = [];

    const pattern: string = `${this.prefix}::*`;

    for await (const key of this.client.scanIterator({ MATCH: pattern })) {
      keys.push(key);
    }

    if (keys.length > 0) {

      for (const x of keys) {

        const value: string | null = await this.client.get(x);

        if (value) {

          const payload: T = JSON.parse(value);

          instances.push(this.removePrefix(payload));
        }
      }
    }

    return instances;
  }

  async read(key: string): Promise<T | null> {

    const _key: string = this.addPrefix(key);

    const value: string | null = await this.client.get(_key);

    if (value === null) {

      return null;
    }

    return this.removePrefix(JSON.parse(value));
  }

  async has(key: string): Promise<boolean> {

    const _key: string = this.addPrefix(key);

    const exists: number = await this.client.exists(_key);

    return exists === 1;
  }

  async update(key: string, value: Partial<T>): Promise<T | null> {

    const _key: string = this.addPrefix(key);

    const match: boolean = await this.has(key);

    if (!match) {

      return null;
    }

    const previous: T = await this.read(key);

    const payload: T = { ...previous, ...value };

    await this.client.set(_key, JSON.stringify(payload));

    return payload;
  }

  async destroy(key: string[]): Promise<void> {

    const keys: string[] = key.map(v => this.addPrefix(v));

    await this.client.del(keys);
  }

  async drop(): Promise<void> {

    const keys: string[] = [];

    const pattern: string = `${this.prefix}*`;

    for await (const key of this.client.scanIterator({ MATCH: pattern })) {
      keys.push(key);
    }

    if (keys.length > 0) {

      await this.client.del(keys);

    }
  }
}

export class Conjunct<ModelAttributes> extends Base {
  key: string;

  constructor(key: string, options?: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>) {

    super(options)

    this.key = key
  }

  async create(key: string, instances: Partial<ModelAttributes>[], expire?: number): Promise<Partial<ModelAttributes>[]> {

    const result: string[] = await this.client.sMembers(key);

    const data: Partial<ModelAttributes>[] = instances.map((v, i) => ({
      id: result.length + (i + 1),
      ...v,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await this.client.sAdd(key, data.map(v => JSON.stringify(v)));

    if (expire) await this.client.expire(key, expire);

    return data
  }

  async update(key: string) {

  }

  async destroy(key: string, where: { id: string[] }): Promise<number> {

    const affected: string[] = await this.client.sMembers(key);

    if (where.id === undefined) {

      await this.client.SMEMBERS(key);

      return affected.length
    }

    const data: Partial<ModelAttributes>[] = affected.map(v => JSON.parse(v));

    let counter = 0;

    for (const x of where.id) {

      //@ts-ignore
      const match: Partial<ModelAttributes> = data.find(el => el.id === x);

      if (!match) { continue; }

      await this.client.sRem(key, JSON.stringify(match));

      counter++;
    }

    return counter
  }

  async view(key: string): Promise<ModelAttributes[]> {

    const result: string[] = await this.client.sMembers(key);

    const data: ModelAttributes[] = result.map(v => JSON.parse(v)).sort((a, b) => a.id - b.id);

    return data
  }
}

export class Subscribe extends Base {
  private listeners: Map<string, ((message: any) => Promise<void>)[]>

  constructor(options?: RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>) {

    super(options)

    this.listeners = new Map<string, ((message: any) => Promise<void>)[]>();
  }

  public use(endpoint: string, ...fn: ((message: any) => Promise<void>)[]): void {

    this.listeners.set(endpoint as unknown as string, fn)
  }

  async run() {

    await this.client.connect()

    for (let [key, fns] of this.listeners) {

      this.client.subscribe(key, (message) => fns.forEach(fn => fn(JSON.parse(message))))
    }
  }

  async stop() {

    this.client.pUnsubscribe()
  }
}