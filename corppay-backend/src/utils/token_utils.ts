import crypto from 'crypto'

// Generates a cryptographically secure 64-character hex token (256 bits of entropy).
export function generateSecureToken(): string
{
	return crypto.randomBytes(32).toString('hex')
}

// Hashes a raw token with SHA-256 for at-rest storage and lookup.
export function hashToken(raw: string): string
{
	return crypto.createHash('sha256').update(raw).digest('hex')
}