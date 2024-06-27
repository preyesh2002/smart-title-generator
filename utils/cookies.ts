// utils/cookies.ts
import { serialize } from 'cookie';
import { NextRequest } from 'next/server';

export const setCookie = (res: NextResponse, name: string, value: unknown, options: any = {}) => {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    if (typeof options.maxAge === 'number') {
        options.expires = new Date(Date.now() + options.maxAge * 1000);
    }

    res.cookies.set(name, serialize(name, String(stringValue), options));
};

export const parseCookies = (req: NextRequest) => {
    const cookie = req.headers.get('cookie') || '';
    return Object.fromEntries(cookie.split('; ').map(c => c.split('=').map(decodeURIComponent)));
};
