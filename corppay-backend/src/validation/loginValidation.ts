// Returns an error string if the value is not a structurally valid email address, otherwise null.
export function validateLoginEmail(value: string): string | null
{
	if (value.trim() === '')              return 'Email is required.'
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'A valid email address is required.'
	return null
}

// Returns an error string if the password field is empty, otherwise null.
export function validateLoginPassword(value: string): string | null
{
	if (value === '') return 'Password is required.'
	return null
}

// Returns an error string if the role is not one of the permitted values, otherwise null.
export function validateLoginRole(value: string): string | null
{
	if (value !== 'user' && value !== 'admin') return 'Role must be either "user" or "admin".'
	return null
}

// Returns the first failing rule error string for the given login fields, or null when all rules pass.
export function validateLoginFields(email: string, password: string, role: string): string | null
{
	const emailError    = validateLoginEmail(email)
	if (emailError !== null) return emailError

	const passwordError = validateLoginPassword(password)
	if (passwordError !== null) return passwordError

	const roleError     = validateLoginRole(role)
	if (roleError !== null) return roleError

	return null
}