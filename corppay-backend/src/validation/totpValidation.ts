const TOTP_DIGIT_REGEX    = /^\d+$/
const TOTP_COMPLETE_REGEX = /^\d{6}$/

// Returns an error string if the TOTP input is absent, non-numeric, or not exactly 6 digits, otherwise null.
export function validateTotpInput(value: string): string | null
{
	const trimmed = value.trim()
	if (trimmed === '')                  return 'Please enter the 6-digit authenticator code.'
	if (!TOTP_DIGIT_REGEX.test(trimmed)) return 'Code must contain digits only (0–9).'
	if (trimmed.length !== 6)            return 'Code must be exactly 6 digits.'
	return null
}

// Returns true when the value is exactly 6 numeric digits and ready for submission.
export function isTotpInputComplete(value: string): boolean
{
	return TOTP_COMPLETE_REGEX.test(value.trim())
}