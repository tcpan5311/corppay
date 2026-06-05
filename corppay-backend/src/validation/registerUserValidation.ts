export type FormErrors =
{
	fullName:     string | null
	dateOfBirth:  string | null
	nationality:  string | null
	gender:       string | null
	email:        string | null
	mobileNumber: string | null
	fullAddress:  string | null
	documentType: string | null
	targetCompanyId: string | null
	idDoc:        string | null
}

// Creates a fully initialized FormErrors with every field set to null.
export function createFormErrors(): FormErrors
{
	return {
		fullName:     null,
		dateOfBirth:  null,
		nationality:  null,
		gender:       null,
		email:        null,
		mobileNumber: null,
		fullAddress:  null,
		documentType: null,
		targetCompanyId: null,
		idDoc:        null,
	}
}

export type TouchedFields =
{
	fullName:     boolean
	dateOfBirth:  boolean
	nationality:  boolean
	gender:       boolean
	email:        boolean
	mobileNumber: boolean
	fullAddress:  boolean
	documentType: boolean
	targetCompanyId: boolean
	idDoc:        boolean
}

// Creates a fully initialized TouchedFields with every field set to false.
export function createTouchedFields(): TouchedFields
{
	return {
		fullName:     false,
		dateOfBirth:  false,
		nationality:  false,
		gender:       false,
		email:        false,
		mobileNumber: false,
		fullAddress:  false,
		documentType: false,
		targetCompanyId: false,
		idDoc:        false,
	}
}

// Creates a TouchedFields with every field set to true to force full-form validation on submit.
export function touchAllFields(): TouchedFields
{
	return {
		fullName:     true,
		dateOfBirth:  true,
		nationality:  true,
		gender:       true,
		email:        true,
		mobileNumber: true,
		fullAddress:  true,
		documentType: true,
		targetCompanyId: true,
		idDoc:        true,
	}
}

export const GENDER_VALUES: string[] = ['male', 'female']

export const DOCUMENT_TYPE_VALUES: string[] = ['passport', 'national_id', 'drivers_license']

// Returns an error string if the full name is blank or exceeds 100 characters, otherwise null.
export function validateFullName(value: string): string | null
{
	if (value.trim() === '')          return 'Full name is required.'
	if (value.trim().length > 100)    return 'Full name must be 100 characters or less.'
	return null
}

// Returns the difference in whole years between the given birth date and the reference date.
function computeAgeInYears(birth: Date, reference: Date): number
{
	let age = reference.getFullYear() - birth.getFullYear()
	const monthDelta = reference.getMonth() - birth.getMonth()
	const dayDelta   = reference.getDate() - birth.getDate()
	if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0))
	{
		age = age - 1
	}
	return age
}

// Returns an error string if the date of birth is missing, malformed, in the future, or under 18 years of age, otherwise null.
export function validateDateOfBirth(value: string): string | null
{
	const trimmed = value.trim()
	if (trimmed === '')                          return 'Date of birth is required.'
	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed))    return 'Use the format YYYY-MM-DD (e.g. 1990-05-21).'

	const parsed = new Date(`${trimmed}T00:00:00`)
	if (isNaN(parsed.getTime()))                 return 'Enter a valid calendar date.'

	const now = new Date()
	if (parsed.getTime() > now.getTime())        return 'Date of birth cannot be in the future.'

	const age = computeAgeInYears(parsed, now)
	if (age < 18)                                return 'You must be at least 18 years old to register.'
	if (age > 120)                               return 'Enter a valid date of birth.'
	return null
}

// Returns an error string if the nationality is blank or exceeds 60 characters, otherwise null.
export function validateNationality(value: string): string | null
{
	if (value.trim() === '')          return 'Nationality is required.'
	if (value.trim().length > 60)     return 'Nationality must be 60 characters or less.'
	return null
}

// Returns an error string if the gender is null or not one of the accepted values, otherwise null.
export function validateGender(value: string | null): string | null
{
	if (value === null)                    return 'Please select a gender.'
	if (!GENDER_VALUES.includes(value))    return 'Please select a gender.'
	return null
}

// Returns an error string if the email is blank or not a structurally valid address, otherwise null.
export function validateEmail(value: string): string | null
{
	if (value.trim() === '')          return 'Email address is required.'
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	if (!emailRegex.test(value.trim()))
	{
		return 'Please enter a valid email address.'
	}
	return null
}

// Normalizes a mobile number by stripping spaces, hyphens, parentheses, and dots while preserving a leading plus.
export function normalizeMobileNumber(value: string): string
{
	return value.replace(/[\s\-().]/g, '')
}

// Returns an error string if the mobile number is blank or does not contain 7 to 15 digits, otherwise null.
export function validateMobileNumber(value: string): string | null
{
	if (value.trim() === '')          return 'Mobile number is required.'
	const normalized = normalizeMobileNumber(value)
	if (!/^\+?\d{7,15}$/.test(normalized))
	{
		return 'Enter a valid mobile number with 7 to 15 digits.'
	}
	return null
}

// Returns an error string if the full address is blank or exceeds 200 characters, otherwise null.
export function validateFullAddress(value: string): string | null
{
	if (value.trim() === '')          return 'Full address is required.'
	if (value.trim().length > 200)    return 'Address must be 200 characters or less.'
	return null
}

// Returns an error string if the document type is null or not one of the accepted values, otherwise null.
export function validateDocumentType(value: string | null): string | null
{
	if (value === null)                          return 'Please select a document type.'
	if (!DOCUMENT_TYPE_VALUES.includes(value))   return 'Please select a document type.'
	return null
}

// Returns an error string if no company has been selected or the identifier is not a 24-character hex string, otherwise null.
export function validateTargetCompany(value: string | null): string | null
{
	if (value === null || value.trim() === '')   return 'Please select the company you are joining.'
	if (!/^[a-fA-F0-9]{24}$/.test(value.trim()))  return 'Please select a valid company.'
	return null
}

export type UploadFileValidatable =
{
	bytes:    number | null
	mimeType: string | null
} | null

const ALLOWED_MIME_TYPES: string[] = [
	'application/pdf',
	'image/jpeg',
	'image/jpg',
	'image/png',
]
const MAX_FILE_BYTES = 5 * 1024 * 1024

// Returns an error string if the uploaded file is missing, of a disallowed type, or larger than 5 MB, otherwise null.
export function validateUploadedFile(file: UploadFileValidatable, label: string): string | null
{
	if (file === null || file.bytes === null)
	{
		return `${label} is required.`
	}
	const mime = file.mimeType !== null ? file.mimeType : ''
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

// Validates every user registration field at once and returns a fully populated FormErrors object.
export function validateAllFields(
	fullName:     string,
	dateOfBirth:  string,
	nationality:  string,
	gender:       string | null,
	email:        string,
	mobileNumber: string,
	fullAddress:  string,
	documentType: string | null,
	targetCompanyId: string | null,
	idDoc:        UploadFileValidatable,
): FormErrors
{
	return {
		fullName:     validateFullName(fullName),
		dateOfBirth:  validateDateOfBirth(dateOfBirth),
		nationality:  validateNationality(nationality),
		gender:       validateGender(gender),
		email:        validateEmail(email),
		mobileNumber: validateMobileNumber(mobileNumber),
		fullAddress:  validateFullAddress(fullAddress),
		documentType: validateDocumentType(documentType),
		targetCompanyId: validateTargetCompany(targetCompanyId),
		idDoc:        validateUploadedFile(idDoc, 'Identity document'),
	}
}

// Returns true when any field in the given FormErrors object holds a non-null error message.
export function hasErrors(errors: FormErrors): boolean
{
	return Object.values(errors).some((v) => v !== null)
}