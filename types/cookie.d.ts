// types/cookie.d.ts
declare module 'cookie' {
    export function serialize(name: string, value: string, options?: any): string;
    export function parse(cookie: string): { [key: string]: string };
}
