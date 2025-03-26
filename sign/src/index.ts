import jwt, { JsonWebTokenError } from "jsonwebtoken";
import { IResponse } from "onbbu-core";

class Sign<IPayload extends jwt.JwtPayload> {

    private SECRET_KEY: string;

    constructor(secretKey?: string) {

        this.SECRET_KEY = secretKey || process.env.SECRET_KEY;
    }

    sign_token(payload: IPayload, expiresIn: string = "360d"): string {

        const token: string = jwt.sign(payload, this.SECRET_KEY, { expiresIn });

        return token;
    }

    private error_response(): IResponse<IPayload> {
        return { statusCode: "not authenticated", message: "Unauthorized, Invalid Token" };
    }

    verify_token(token?: string): IResponse<IPayload> {

        if (token === undefined) {
            return this.error_response()
        }

        try {

            const data: IPayload = jwt.verify(token, this.SECRET_KEY) as IPayload;

            const now: number = Math.floor(Date.now() / 1000); // Tiempo actual en segundos

            if (data.exp <= now) {
                return this.error_response();
            }

            const response: IPayload = {
                ...data,
                exp: new Date(data.exp * 1000).toISOString(),
                iat: new Date(data.iat * 1000).toISOString(),
            };

            return { statusCode: "success", data: response };

        } catch (error) {

            if (error instanceof JsonWebTokenError) {

                return this.error_response()
            }

            return this.error_response()
        }
    }
}

export default Sign;