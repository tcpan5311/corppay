// Returns an error string if the password is fewer than 8 characters, otherwise null.
export function validatePasswordLength(value: string): string | null
{
	if (value.length < 8) return 'Password must be at least 8 characters.'
	return null
}

// Returns an error string if the password contains no uppercase letter, otherwise null.
export function validatePasswordUppercase(value: string): string | null
{
	if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.'
	return null
}

// Returns an error string if the password contains no symbol character, otherwise null.
export function validatePasswordSymbol(value: string): string | null
{
	if (!/[^A-Za-z0-9]/.test(value)) return 'Password must contain at least one symbol.'
	return null
}

// Returns the first failing rule error string for the given password, or null when all rules pass.
export function validateAdminPassword(value: string): string | null
{
	const lengthError    = validatePasswordLength(value)
	if (lengthError !== null) return lengthError

	const uppercaseError = validatePasswordUppercase(value)
	if (uppercaseError !== null) return uppercaseError

	const symbolError    = validatePasswordSymbol(value)
	if (symbolError !== null) return symbolError

	return null
}

// Returns an error string if the confirmation value does not match the password, otherwise null.
export function validatePasswordConfirmation(password: string, confirm: string): string | null
{
	if (confirm === '')        return 'Please confirm your password.'
	if (confirm !== password)  return 'Passwords do not match.'
	return null
}