import { NextFunction, Request, Response } from 'express'

const WINDOW_MS    = 15 * 60 * 1000
const MAX_REQUESTS = 50

type RateLimitEntry =
{
	count:       number | null
	windowStart: number | null
}

// Creates a new RateLimitEntry initialized with a count of one and the given window start time.
function createRateLimitEntry(windowStart: number): RateLimitEntry
{
	return { count: 1, windowStart: windowStart }
}

const ipMap = new Map<string, RateLimitEntry>()

// Enforces a sliding-window rate limit per IP address, rejecting requests that exceed the threshold.
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

	const existing = ipMap.get(ip) as RateLimitEntry

	const windowExpired = existing.windowStart !== null && now - existing.windowStart >= WINDOW_MS

	if (windowExpired)
	{
		ipMap.set(ip, createRateLimitEntry(now))
		next()
		return
	}

	if (existing.count !== null && existing.count >= MAX_REQUESTS)
	{
		res.status(429).json({ error: 'Too many requests. Please try again later.' })
		return
	}

	if (existing.count !== null)
	{
		existing.count += 1
	}

	next()
}