import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export function authenticate(request: Request, response: Response, next: NextFunction)
{
    const header = request.headers.authorization

    if (!header?.startsWith('Bearer '))
    {
        return response.status(401).json({ error: 'Unauthorized' })
    }

    try
    {
        const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET!)
        ;(request as any).user = payload
        next()
    }
    catch
    {
        response.status(401).json
        ({ 
            error: 'Token expired or invalid' 
        })
    }
}

export function requireRole(...roles: string[])
{
    return (request: Request, result: Response, next: NextFunction) =>
    {
        if (!roles.includes((request as any).user?.role))
        {
            return result.status(403).json({ error: 'Forbidden' })
        }
        next()
    }
}