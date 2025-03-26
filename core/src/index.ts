export const statusCode = [
  'success',
  'error',
  'not found',
  'not permitted',
  'validation error',
  'not authenticated'
] as const

export type IStatusCode = typeof statusCode[number]

export const protocols = ['WS', 'GRPC', 'HTTP', 'JSONRPC'] as const

export type IProtocols = typeof protocols[number]

export type uuid = string

export type uri = string

export type INullable<T> = T | null;

export type PartialNullable<T> = { [P in keyof T]: INullable<P>; }

export type IResponse<T> = { statusCode: IStatusCode, data?: T, message?: string }

export type IPromiseResponse<T> = Promise<IResponse<T>>

export type IMetadata = {
  id: string
  token?: string
  protocol: IProtocols
  ip: string
}

export interface IPaginate<T> {
  data: T[]
  pageCount: number
  itemCount: number
}

export interface IRequestLogic<T> {
  params: T
  metaData: IMetadata
}

export type IKeyValue = {
  key: string
  value: string
}

export const codeHttp = {
  'success': 200,
  'error': 500,
  'not found': 404,
  'not permitted': 405,
  'validation error': 400,
  'not authenticated': 401,
}

export const isDev: boolean = process.env.NODE_ENV !== 'production'


export class InternalError extends Error {

  statusCode: IStatusCode[1]

  constructor(message: string) {
    super(message)
    this.message = message
    this.statusCode = statusCode[1]
  }
}

export class NotFoundError extends Error {

  statusCode: IStatusCode[2]

  constructor(message: string) {
    super(message)
    this.message = message
    this.statusCode = statusCode[2]
  }
}

export class NotPermitted extends Error {

  statusCode: IStatusCode[3]

  constructor(message: string) {
    super(message)
    this.message = message
    this.statusCode = statusCode[3]
  }
}

export class ValidationError extends Error {

  statusCode: IStatusCode[4]

  constructor(message: string) {
    super(message)
    this.message = message
    this.statusCode = statusCode[4]
  }
}

export class NotAuthenticated extends Error {

  statusCode: IStatusCode[5]

  constructor(message: string) {
    super(message)
    this.message = message
    this.statusCode = statusCode[5]
  }
}

export const internalError: string = "We are unable to process your request, please try again later"