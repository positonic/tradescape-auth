declare module 'asana' {
    export interface ApiClient {
        instance: {
            authentications: {
                token: {
                    accessToken: string;
                }
            };
            callApi(
                path: string,
                method: string,
                pathParams: object,
                queryParams: object,
                headerParams: object,
                formParams: object,
                bodyParam: object,
                authNames: string[],
                contentTypes: string[],
                accepts: string[],
                returnType: string
            ): Promise<any>;
        }
    }
    
    const ApiClient: ApiClient;
    export { ApiClient };

    export class Client {
        static create(options: { defaultHeaders?: Record<string, string>; logAsanaChangeWarnings?: boolean }): Client;
        useAccessToken(token: string): Client;
        tasks: any;
    }
} 