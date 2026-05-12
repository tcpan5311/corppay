import { authenticator } from 'otplib'

type TotpValidationResult =
{
	valid:  boolean
	reason: string
}

// Creates a fully initialized TotpValidationResult defaulting to invalid with an empty reason.
function createTotpValidationResult(): TotpValidationResult
{
	return { valid: false, reason: '' }
}

// Reads the base32 TOTP seed from the ADMIN_TOTP_SECRET environment variable.
function resolveTotpSecret(): string
{
	const secret = process.env.ADMIN_TOTP_SECRET
	return typeof secret === 'string' ? secret.trim() : ''
}

// Returns the otpauth URI for QR code enrollment using the configured TOTP secret.
export function buildTotpUri(issuer: string, account: string): string
{
	const secret = resolveTotpSecret()
	return authenticator.keyuri(account, issuer, secret)
}

// Validates a 6-digit TOTP code against the ADMIN_TOTP_SECRET and returns the result.
export function validateTotpCode(code: string): TotpValidationResult
{
	const result = createTotpValidationResult()
	const secret = resolveTotpSecret()

	if (secret === '')
	{
		result.reason = 'Admin TOTP is not configured on this server.'
		return result
	}

	if (code === '')
	{
		result.reason = 'One-time code is required.'
		return result
	}

	try
	{
		const isValid = authenticator.verify({ token: code, secret })

		if (!isValid)
		{
			result.reason = 'Invalid or expired code. Ensure your authenticator clock is synced.'
			return result
		}

		result.valid = true
		return result
	}
	catch
	{
		result.reason = 'Code validation failed.'
		return result
	}
}