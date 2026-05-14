export type FormErrors =
{
	companyName:       string | null
	ssmNumber:         string | null
	entityType:        string | null
	registeredAddress: string | null
	registeredEmail:   string | null
	icPassport:        string | null
    directorRole:      string | null
	ownershipPct:      string | null
	ssmDoc:            string | null
	icDoc:             string | null
}

export function createFormErrors(): FormErrors
{
	return {
		companyName:       null,
		ssmNumber:         null,
		entityType:        null,
		registeredAddress: null,
		registeredEmail:   null,
		icPassport:        null,
        directorRole:      null, 
		ownershipPct:      null,
		ssmDoc:            null,
		icDoc:             null,
	}
}

export type TouchedFields =
{
	companyName:       boolean
	ssmNumber:         boolean
	entityType:        boolean
	registeredAddress: boolean
	registeredEmail:   boolean
	icPassport:        boolean
    directorRole:      boolean 
	ownershipPct:      boolean
	ssmDoc:            boolean
	icDoc:             boolean
}

export function createTouchedFields(): TouchedFields
{
	return {
		companyName:       false,
		ssmNumber:         false,
		entityType:        false,
		registeredAddress: false,
		registeredEmail:   false,
		icPassport:        false,
        directorRole:      false, 
		ownershipPct:      false,
		ssmDoc:            false,
		icDoc:             false,
	}
}

export function touchAllFields(): TouchedFields
{
	return {
		companyName:       true,
		ssmNumber:         true,
		entityType:        true,
		registeredAddress: true,
		registeredEmail:   true,
		icPassport:        true,
        directorRole:      true, 
		ownershipPct:      true,
		ssmDoc:            true,
		icDoc:             true,
	}
}

export function validateCompanyName(value: string): string | null
{
	if (value.trim() === '')          return 'Company name is required.'
	if (value.trim().length > 100)    return 'Company name must be 100 characters or less.'
	return null
}

export function validateSsmNumber(value: string): string | null
{
	const trimmed = value.trim()
	if (trimmed === '')               return 'Registration number is required.'
	if (!/^\d{12}$/.test(trimmed))    return 'Must be exactly 12 digits (e.g. 202301234567).'

	const year = parseInt(trimmed.substring(0, 4), 10)
	const currentYear = new Date().getFullYear()
	if (year < 1900 || year > currentYear)
	{
		return `Year prefix must be between 1900 and ${currentYear}.`
	}

	return null
}

export function validateEntityType(value: string | null): string | null
{
	if (value === null) return 'Please select an entity type.'
	return null
}

export function validateDirectorRole(value: string | null): string | null
{
    if (value === null) return 'Please select a role.'
    return null
}

export function validateRegisteredAddress(value: string): string | null
{
	if (value.trim() === '')          return 'Registered address is required.'
	if (value.trim().length > 200)    return 'Address must be 200 characters or less.'
	return null
}

export function validateRegisteredEmail(value: string): string | null
{
	if (value.trim() === '')          return 'Email address is required.'
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	if (!emailRegex.test(value.trim()))
	{
		return 'Please enter a valid email address.'
	}
	return null
}

const NRIC_REGEX     = /^\d{12}$/
const PASSPORT_REGEX = /^[A-Z0-9]{6,12}$/

export function normalizeIcPassport(value: string): string
{
	return value.toUpperCase().replace(/\s/g, '')
}

export function validateIcPassport(value: string): string | null
{
	if (value.trim() === '')          return 'IC / Passport number is required.'
	const normalized = normalizeIcPassport(value)
	if (NRIC_REGEX.test(normalized) || PASSPORT_REGEX.test(normalized)) return null
	return 'Enter a valid 12-digit NRIC or 6–12 character passport number (A–Z, 0–9).'
}

export function validateOwnershipPct(value: string): string | null
{
	if (value.trim() === '')          return 'Ownership percentage is required.'

    if (!/^\d+$/.test(value.trim()))
    {
        return 'Enter a valid number between 0 and 100.'
    }

	const num = parseFloat(value)
	if (isNaN(num))                   return 'Enter a valid number.'
	if (num < 0)                      return 'Percentage cannot be negative.'
	if (num > 100)                    return 'Percentage cannot exceed 100.'
	return null
}

type UploadFileValidatable =
{
	bytes:    number | null
	mimeType: string | null
} | null

const ALLOWED_MIME_TYPES = [
	'application/pdf',
	'image/jpeg',
	'image/jpg',
	'image/png',
]
const MAX_FILE_BYTES = 5 * 1024 * 1024 

export function validateUploadedFile(file:  UploadFileValidatable, label: string,): string | null
{
	if (file === null || file.bytes === null)
	{
		return `${label} is required.`
	}
	const mime = file.mimeType ?? ''
	if (!ALLOWED_MIME_TYPES.includes(mime.toLowerCase()))
	{
		return 'Only PDF, JPG, or PNG files are accepted.'
	}
	if (file.bytes > MAX_FILE_BYTES)
	{
		return 'File must be 5 MB or less.'
	}
	return null
}

export function validateAllFields
(
	companyName:       string,
	ssmNumber:         string,
	entityType:        string | null,
	registeredAddress: string,
	registeredEmail:   string,
	icPassport:        string,
    directorRole:      string | null,
	ownershipPct:      string,
	ssmDoc:            UploadFileValidatable,
	icDoc:             UploadFileValidatable,
): 
FormErrors
{
	return {
		companyName:       validateCompanyName(companyName),
		ssmNumber:         validateSsmNumber(ssmNumber),
		entityType:        validateEntityType(entityType),
		registeredAddress: validateRegisteredAddress(registeredAddress),
		registeredEmail:   validateRegisteredEmail(registeredEmail),
		icPassport:        validateIcPassport(icPassport),
        directorRole:      validateDirectorRole(directorRole),
		ownershipPct:      validateOwnershipPct(ownershipPct),
		ssmDoc:            validateUploadedFile(ssmDoc, 'Certificate of Incorporation'),
		icDoc:             validateUploadedFile(icDoc, 'Director IC / Passport Copy'),
	}
}

export function hasErrors(errors: FormErrors): boolean
{
	return Object.values(errors).some((v) => v !== null)
}