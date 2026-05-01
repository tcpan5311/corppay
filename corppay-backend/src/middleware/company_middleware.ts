import { NextFunction, Request, Response } from 'express'

const WINDOW_MS    = 15 * 60 * 1000
const MAX_REQUESTS = 50

type RateLimitEntry =
{
	count:       number
	windowStart: number
}

// Creates a new rate limit entry with count initialised to 1 for the given window start time.
function createRateLimitEntry(windowStart: number): RateLimitEntry
{
	return {
		count:       1,
		windowStart: windowStart,
	}
}

const ipMap = new Map<string, RateLimitEntry>()

// Express middleware that enforces a per-IP sliding-window rate limit on incoming requests.
export function companyRateLimit(req: Request, res: Response, next: NextFunction): void
{
	let ip = req.ip

	if (!ip)
	{
		ip = req.socket.remoteAddress
	}

	if (!ip)
	{
		ip = 'unknown'
	}

	const now = Date.now()

	if (!ipMap.has(ip))
	{
		ipMap.set(ip, createRateLimitEntry(now))
		next()
		return
	}

	const existing     = ipMap.get(ip) as RateLimitEntry
	const windowExpired = now - existing.windowStart >= WINDOW_MS

	if (windowExpired)
	{
		ipMap.set(ip, createRateLimitEntry(now))
		next()
		return
	}

	if (existing.count >= MAX_REQUESTS)
	{
		res.status(429).json({ error: 'Too many requests. Please try again later.' })
		return
	}

	existing.count += 1
	next()
}