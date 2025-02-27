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
                pathParams: Record<string, unknown>,
                queryParams: Record<string, unknown>,
                headerParams: Record<string, string>,
                formParams: Record<string, unknown>,
                bodyParam: Record<string, unknown>,
                authNames: string[],
                contentTypes: string[],
                accepts: string[],
                returnType: string
            ): Promise<unknown>;
        }
    }
    
    const ApiClient: ApiClient;
    export { ApiClient };

    export interface TasksClient {
        create(data: Record<string, unknown>): Promise<Record<string, unknown>>;
        findAll(options?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
        findById(taskId: string): Promise<Record<string, unknown>>;
        update(taskId: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
        delete(taskId: string): Promise<void>;
    }

    export class Client {
        static create(options: { defaultHeaders?: Record<string, string>; logAsanaChangeWarnings?: boolean }): Client;
        useAccessToken(token: string): Client;
        tasks: TasksClient;
    }
} 