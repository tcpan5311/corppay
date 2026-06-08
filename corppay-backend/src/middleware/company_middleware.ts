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
	return { count: 1, windowStart }
}

// Resolves the client IP address from the request, falling back through socket address to 'unknown'.
function resolveIp(req: Request): string
{
	if (req.ip !== undefined)                         return req.ip
	if (req.socket.remoteAddress !== undefined)       return req.socket.remoteAddress
	return 'unknown'
}

const ipMap = new Map<string, RateLimitEntry>()
let lastSweep = Date.now()

// Removes entries whose window has fully expired so the in-memory map cannot grow without bound.
function sweepExpired(now: number): void
{
	for (const [ip, entry] of ipMap)
	{
		if (entry.windowStart !== null && now - entry.windowStart >= WINDOW_MS)
		{
			ipMap.delete(ip)
		}
	}
}

// Enforces a sliding-window rate limit per IP address, rejecting requests that exceed the threshold.
export function companyRateLimit(req: Request, res: Response, next: NextFunction): void
{
	const ip  = resolveIp(req)
	const now = Date.now()

	// Sweep at most once per window to bound memory without per-request O(n) cost.
	if (now - lastSweep >= WINDOW_MS)
	{
		sweepExpired(now)
		lastSweep = now
	}

	if (!ipMap.has(ip))
	{
		ipMap.set(ip, createRateLimitEntry(now))
		next()
		return
	}

	const existing      = ipMap.get(ip) as RateLimitEntry
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