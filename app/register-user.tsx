import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Animated,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import {
	FormErrors,
	TouchedFields,
	createFormErrors,
	createTouchedFields,
	hasErrors,
	touchAllFields,
	validateAllFields,
	validateDateOfBirth,
	validateDocumentType,
	validateEmail,
	validateFullAddress,
	validateFullName,
	validateGender,
	validateMobileNumber,
	validateNationality,
	validateTargetCompany,
	validateUploadedFile
} from '../corppay-backend/src/validation/registerUserValidation';

type Gender       = 'male' | 'female'
type DocumentType = 'passport' | 'national_id' | 'drivers_license'

type CompanyOption =
{
	companyId:   string
	companyName: string
}

// Creates a fully initialized CompanyOption with empty string defaults.
function createCompanyOption(): CompanyOption
{
	return { companyId: '', companyName: '' }
}

type UploadedFile =
{
	name:     string | null
	size:     string | null
	uri:      string | null
	mimeType: string | null
	bytes:    number | null
	webFile:  File | null
}

// Creates a fully initialized UploadedFile with all fields set to null.
function createUploadedFile(): UploadedFile
{
	return {
		name:     null,
		size:     null,
		uri:      null,
		mimeType: null,
		bytes:    null,
		webFile:  null,
	}
}

type SectionHeaderProps =
{
	icon:      React.ComponentProps<typeof MaterialCommunityIcons>['name'] | null
	label:     string | null
	iconBg:    string | null
	iconColor: string | null
}

// Creates a fully initialized SectionHeaderProps with all fields set to null.
function createSectionHeaderProps(): SectionHeaderProps
{
	return { icon: null, label: null, iconBg: null, iconColor: null }
}

type FieldLabelProps =
{
	label:    string | null
	optional: boolean | null
}

// Creates a fully initialized FieldLabelProps with all fields set to null.
function createFieldLabelProps(): FieldLabelProps
{
	return { label: null, optional: null }
}

type TextFieldInputProps =
{
	icon:           React.ComponentProps<typeof MaterialCommunityIcons>['name'] | null
	placeholder:    string | null
	value:          string | null
	onChangeText:   ((v: string) => void) | null
	onBlur:         (() => void) | null
	keyboardType:   React.ComponentProps<typeof TextInput>['keyboardType'] | null
	autoCapitalize: React.ComponentProps<typeof TextInput>['autoCapitalize'] | null
	multiline:      boolean | null
	numberOfLines:  number | null
	error:          string | null
}

// Creates a fully initialized TextFieldInputProps with all fields set to null.
function createTextFieldInputProps(): TextFieldInputProps
{
	return {
		icon:           null,
		placeholder:    null,
		value:          null,
		onChangeText:   null,
		onBlur:         null,
		keyboardType:   null,
		autoCapitalize: null,
		multiline:      null,
		numberOfLines:  null,
		error:          null,
	}
}

type SegmentOptionItem<T> =
{
	value: T | null
	label: string | null
	icon:  React.ComponentProps<typeof MaterialCommunityIcons>['name'] | null
}

// Creates a fully initialized SegmentOptionItem with all fields set to null.
function createSegmentOptionItem<T>(): SegmentOptionItem<T>
{
	return { value: null, label: null, icon: null }
}

type SegmentedControlProps<T extends string> =
{
	options:  SegmentOptionItem<T>[]
	value:    T | null
	onChange: ((v: T) => void) | null
	error:    string | null
}

// Creates a fully initialized SegmentedControlProps with an empty options array and null fields.
function createSegmentedControlProps<T extends string>(): SegmentedControlProps<T>
{
	return { options: [], value: null, onChange: null, error: null }
}

type UploadBoxProps =
{
	file:     UploadedFile | null
	onPress:  (() => void) | null
	onRemove: (() => void) | null
	error:    string | null
}

// Creates a fully initialized UploadBoxProps with all fields set to null.
function createUploadBoxProps(): UploadBoxProps
{
	return { file: null, onPress: null, onRemove: null, error: null }
}

type SubmitRegistrationParams =
{
	fullName:     string | null
	dateOfBirth:  string | null
	nationality:  string | null
	gender:       Gender | null
	email:        string | null
	mobileNumber: string | null
	fullAddress:  string | null
	documentType: DocumentType | null
	targetCompanyId: string | null
	idDoc:        UploadedFile | null
}

// Creates a fully initialized SubmitRegistrationParams with all fields set to null.
function createSubmitRegistrationParams(): SubmitRegistrationParams
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

type SubmitResubmissionParams =
{
	resubmissionToken: string | null
	fullName:          string | null
	dateOfBirth:       string | null
	nationality:       string | null
	gender:            Gender | null
	mobileNumber:      string | null
	fullAddress:       string | null
	documentType:      DocumentType | null
	idDoc:             UploadedFile | null
}

// Creates a fully initialized SubmitResubmissionParams with all fields set to null.
function createSubmitResubmissionParams(): SubmitResubmissionParams
{
	return {
		resubmissionToken: null,
		fullName:          null,
		dateOfBirth:       null,
		nationality:       null,
		gender:            null,
		mobileNumber:      null,
		fullAddress:       null,
		documentType:      null,
		idDoc:             null,
	}
}

type ToastProps =
{
	visible: boolean
	message: string
}

// Creates a fully initialized ToastProps with visible set to false and an empty message.
function createToastProps(): ToastProps
{
	return { visible: false, message: '' }
}

// Formats a byte count into a human-readable string with the appropriate size unit.
function formatBytes(bytes: number | null): string
{
	if (bytes === null)  return '0 B'
	if (bytes < 1024)    return `${bytes} B`
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1048576).toFixed(1)} MB`
}

// Returns the asset size as a number, defaulting to zero when the value is absent.
function resolveAssetSize(value: number | null): number
{
	if (value === null) return 0
	return value
}

// Returns the asset MIME type string, defaulting to octet-stream when the value is absent.
function resolveAssetMimeType(value: string | null): string
{
	if (value === null) return 'application/octet-stream'
	return value
}

// Extracts a user-friendly error message from an unknown thrown value.
function resolveErrorMessage(e: unknown): string
{
	if (e !== null && typeof e === 'object' && 'message' in e)
	{
		const record = e as Record<string, unknown>
		const msg    = record['message']
		if (typeof msg === 'string') return msg
	}
	return 'Registration failed. Please try again.'
}

// Extracts a user-friendly error message from an API error response body.
function resolveApiErrorMessage(data: unknown): string
{
	if (data === null || typeof data !== 'object') return 'Registration failed. Please try again.'
	const record = data as Record<string, unknown>
	if (typeof record['error'] === 'string') return record['error']
	const errorList = record['errors']
	if (Array.isArray(errorList) && errorList.length > 0)
	{
		const first = errorList[0]
		if (first !== null && typeof first === 'object')
		{
			const firstRecord = first as Record<string, unknown>
			if (typeof firstRecord['msg'] === 'string') return firstRecord['msg']
		}
	}
	return 'Registration failed. Please try again.'
}

// Opens a platform-appropriate document picker and passes the selected file to the setter.
async function pickDocument(setter: (f: UploadedFile) => void): Promise<void>
{
	if (Platform.OS === 'web')
	{
		await new Promise<void>(
			(resolve) =>
			{
				const input  = document.createElement('input')
				input.type   = 'file'
				input.accept = 'application/pdf,image/jpeg,image/png'

				let settled = false

				// Resolves the Promise exactly once and prevents duplicate invocations.
				const settle = () =>
				{
					if (!settled)
					{
						settled = true
						resolve()
					}
				}

				window.addEventListener('focus', settle, { once: true })

				input.onchange = (e: Event) =>
				{
					settled        = true
					const inputEl  = e.target as HTMLInputElement
					const fileList = inputEl.files
					if (fileList !== null && fileList.length > 0)
					{
						const file   = fileList[0]
						const result = createUploadedFile()
						result.name     = file.name
						result.size     = formatBytes(file.size)
						result.uri      = URL.createObjectURL(file)
						result.mimeType = file.type !== '' ? file.type : 'application/octet-stream'
						result.bytes    = file.size
						result.webFile  = file
						setter(result)
					}
					resolve()
				}

				input.click()
			}
		)
	}
	else
	{
		try
		{
			const DocumentPicker = await import('expo-document-picker')
			const result = await DocumentPicker.getDocumentAsync({
				type:                 ['application/pdf', 'image/*'],
				copyToCacheDirectory: true,
				multiple:             false,
			})
			if (result.canceled) return
			const asset        = result.assets[0]
			const assetSize    = resolveAssetSize(typeof asset.size === 'number' ? asset.size : null)
			const assetMime    = resolveAssetMimeType(typeof asset.mimeType === 'string' ? asset.mimeType : null)
			const uploadedFile = createUploadedFile()
			uploadedFile.name     = asset.name
			uploadedFile.size     = formatBytes(assetSize)
			uploadedFile.uri      = asset.uri
			uploadedFile.mimeType = assetMime
			uploadedFile.bytes    = assetSize
			uploadedFile.webFile  = null
			setter(uploadedFile)
		}
		catch (err)
		{
			console.warn('pickDocument native picker error:', err)
		}
	}
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL

// Appends an uploaded file to a FormData object under the given field name, handling both web and native sources.
function appendFile(form: FormData, field: string, file: UploadedFile): void
{
	if (file.webFile !== null)
	{
		form.append(field, file.webFile, file.webFile.name)
	}
	else if (file.uri !== null)
	{
		form.append(field, {
			uri:  file.uri,
			name: file.name !== null ? file.name : 'file',
			type: file.mimeType !== null ? file.mimeType : 'application/octet-stream',
		} as unknown as Blob)
	}
}

// Fetches the list of approved companies an applicant may apply to join.
async function fetchAvailableCompanies(): Promise<CompanyOption[]>
{
	const response = await fetch(`${API_BASE}/users/available-companies`)
	if (!response.ok) return []

	const data    = (await response.json()) as Record<string, unknown>
	const rawList = data['companies']
	if (!Array.isArray(rawList)) return []

	const result: CompanyOption[] = []
	for (const raw of rawList)
	{
		if (raw === null || typeof raw !== 'object') continue
		const record = raw as Record<string, unknown>
		const id     = typeof record['companyId']   === 'string' ? record['companyId']   : ''
		const name   = typeof record['companyName'] === 'string' ? record['companyName'] : ''
		if (id === '' || name === '') continue
		const option       = createCompanyOption()
		option.companyId   = id
		option.companyName = name
		result.push(option)
	}
	return result
}

// Submits the registration form to the email-verification endpoint, which gates application creation behind email confirmation.
async function initiateRegistration(params: SubmitRegistrationParams): Promise<unknown>
{
	const form = new FormData()

	if (params.fullName !== null)     form.append('fullName',     params.fullName)
	if (params.dateOfBirth !== null)  form.append('dateOfBirth',  params.dateOfBirth)
	if (params.nationality !== null)  form.append('nationality',  params.nationality)
	if (params.gender !== null)       form.append('gender',       params.gender)
	if (params.email !== null)        form.append('email',        params.email)
	if (params.mobileNumber !== null) form.append('mobileNumber', params.mobileNumber)
	if (params.fullAddress !== null)  form.append('fullAddress',  params.fullAddress)
	if (params.documentType !== null) form.append('documentType', params.documentType)
	if (params.targetCompanyId !== null) form.append('targetCompanyId', params.targetCompanyId)
	if (params.idDoc !== null)        appendFile(form, 'idDoc', params.idDoc)

	const response = await fetch(`${API_BASE}/users/initiate-register`, {
		method: 'POST',
		body:   form,
	})

	const data: unknown = (await response.json()) as unknown

	if (!response.ok)
	{
		throw new Error(resolveApiErrorMessage(data))
	}

	return data
}

// Submits updated user fields and the identity document to the resubmission endpoint, authenticated by the resubmission token.
async function submitResubmission(params: SubmitResubmissionParams): Promise<unknown>
{
	const form = new FormData()

	if (params.resubmissionToken !== null) form.append('token',        params.resubmissionToken)
	if (params.fullName !== null)          form.append('fullName',     params.fullName)
	if (params.dateOfBirth !== null)       form.append('dateOfBirth',  params.dateOfBirth)
	if (params.nationality !== null)       form.append('nationality',  params.nationality)
	if (params.gender !== null)            form.append('gender',       params.gender)
	if (params.mobileNumber !== null)      form.append('mobileNumber', params.mobileNumber)
	if (params.fullAddress !== null)       form.append('fullAddress',  params.fullAddress)
	if (params.documentType !== null)      form.append('documentType', params.documentType)
	if (params.idDoc !== null)             appendFile(form, 'idDoc', params.idDoc)

	const response = await fetch(`${API_BASE}/user-resubmit`, {
		method: 'POST',
		body:   form,
	})

	const data: unknown = (await response.json()) as unknown

	if (!response.ok)
	{
		throw new Error(resolveApiErrorMessage(data))
	}

	return data
}

// Renders a labeled section header with a colored icon badge.
function SectionHeader(props: SectionHeaderProps)
{
	return (
		<View className="flex-row items-center mb-5">
			<View
				className="w-9 h-9 rounded-xl items-center justify-center mr-3"
				style={{ backgroundColor: props.iconBg !== null ? props.iconBg : '' }}
			>
				{props.icon !== null && (
					<MaterialCommunityIcons
						name={props.icon}
						size={18}
						color={props.iconColor !== null ? props.iconColor : ''}
					/>
				)}
			</View>
			<Text className="text-gray-800 text-base font-bold">
				{props.label !== null ? props.label : ''}
			</Text>
		</View>
	)
}

// Renders a form field label with an optional indicator when the field is not required.
function FieldLabel(props: FieldLabelProps)
{
	return (
		<Text className="text-gray-700 text-sm font-medium mb-2">
			{props.label !== null ? props.label : ''}{' '}
			{props.optional === true && (
				<Text className="text-gray-400 font-normal">(Optional)</Text>
			)}
		</Text>
	)
}

// Renders an inline field error message with a warning icon.
function FieldError({ message }: { message: string | null })
{
	if (message === null) return null

	return (
		<View className="flex-row items-center mt-1.5 ml-1">
			<MaterialCommunityIcons
				name="alert-circle-outline"
				size={13}
				color="#DC2626"
				style={{ marginRight: 4 }}
			/>
			<Text
				className="text-red-600 text-xs flex-1"
				accessibilityRole="alert"
				accessibilityLiveRegion="polite"
			>
				{message}
			</Text>
		</View>
	)
}

// Renders a styled text input field with an optional leading icon, blur handler, and inline error.
function TextFieldInput(props: TextFieldInputProps)
{
	const isMultiline          = props.multiline === true
	const resolvedCapitalize   = props.autoCapitalize !== null ? props.autoCapitalize : 'none'
	const resolvedKeyboardType = props.keyboardType !== null ? props.keyboardType : 'default'
	const resolvedLines        = props.numberOfLines !== null ? props.numberOfLines : 1
	const resolvedPlaceholder  = props.placeholder !== null ? props.placeholder : ''
	const resolvedValue        = props.value !== null ? props.value : ''
	const hasError             = props.error !== null

	// A no-op change handler used when no handler is provided.
	const noopChangeHandler = (_v: string) => {}

	// A no-op blur handler used when no handler is provided.
	const noopBlurHandler = () => {}

	const resolvedOnChange = props.onChangeText !== null ? props.onChangeText : noopChangeHandler
	const resolvedOnBlur   = props.onBlur       !== null ? props.onBlur       : noopBlurHandler

	return (
		<View>
			<View
				className={`flex-row items-${isMultiline ? 'start' : 'center'} bg-gray-50 border rounded-xl px-4 py-3.5 ${
					hasError ? 'border-red-400 bg-red-50' : 'border-gray-200'
				}`}
			>
				{props.icon !== null && (
					<MaterialCommunityIcons
						name={props.icon}
						size={18}
						color={hasError ? '#F87171' : '#9CA3AF'}
						style={{ marginRight: 10, marginTop: isMultiline ? 2 : 0 }}
					/>
				)}
				<TextInput
					className="flex-1 text-gray-800 text-sm"
					placeholder={resolvedPlaceholder}
					placeholderTextColor="#9CA3AF"
					value={resolvedValue}
					onChangeText={resolvedOnChange}
					onBlur={resolvedOnBlur}
					keyboardType={resolvedKeyboardType}
					autoCapitalize={resolvedCapitalize}
					autoCorrect={false}
					multiline={isMultiline}
					numberOfLines={resolvedLines}
					textAlignVertical={isMultiline ? 'top' : 'center'}
					accessibilityLabel={resolvedPlaceholder}
					{...(Platform.OS === 'web' ? { autoComplete: 'off' } : {})}
				/>
			</View>
			<FieldError message={props.error} />
		</View>
	)
}

// Renders a segmented toggle control allowing selection of one option from a predefined set.
function SegmentedControl<T extends string>(props: SegmentedControlProps<T>)
{
	return (
		<View>
			<View
				className={`flex-row bg-gray-100 rounded-full p-1 ${
					props.error !== null ? 'border border-red-400' : ''
				}`}
			>
				{props.options.map(
					(opt) =>
					{
						const active = props.value !== null && opt.value !== null && props.value === opt.value

						// Fires the onChange callback when a segment option is pressed.
						const handleOptionPress = () =>
						{
							if (props.onChange !== null && opt.value !== null)
							{
								props.onChange(opt.value)
							}
						}

						return (
							<TouchableOpacity
							key={String(opt.value)}
							onPress={handleOptionPress}
							style={{
								flex: 1,
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'center',
								paddingVertical: 10,
								borderRadius: 999,
								backgroundColor: active ? '#FFFFFF' : 'transparent',
							}}
							accessibilityRole="radio"
							accessibilityState={{ selected: active }}
							accessibilityLabel={opt.label !== null ? opt.label : ''}
							>
							{opt.icon !== null && (
								<MaterialCommunityIcons
								name={opt.icon}
								size={16}
								color={active ? '#374151' : '#9CA3AF'}
								style={{ marginRight: 5 }}
								/>
							)}

							<Text
								style={{
								fontSize: 13,
								fontWeight: '500',
								color: active ? '#374151' : '#9CA3AF',
								}}
							>
								{opt.label !== null ? opt.label : ''}
							</Text>
							</TouchableOpacity>
						)
					}
				)}
			</View>
			<FieldError message={props.error} />
		</View>
	)
}

// Renders a dashed upload area showing the selected file or a prompt, with a remove control and inline error.
function UploadBox(props: UploadBoxProps)
{
	const webCursorStyle: Record<string, string> | null =
		Platform.OS === 'web' ? { cursor: 'pointer' } : null
	const hasError = props.error !== null

	const noopPressHandler = () => {}

	return (
		<View>
			<TouchableOpacity
				onPress={props.onPress !== null ? props.onPress : noopPressHandler}
				className={`border border-dashed rounded-xl py-6 items-center justify-center ${
					hasError
						? 'bg-red-50 border-red-400'
						: 'bg-gray-50 border-gray-300'
				}`}
				activeOpacity={0.7}
				style={webCursorStyle as object}
				accessibilityRole="button"
			>
				{props.file !== null ? (
					<>
						<View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mb-2">
							<MaterialCommunityIcons name="file-check-outline" size={22} color="#2563EB" />
						</View>
						<Text className="text-gray-800 text-sm font-medium">
							{props.file.name !== null ? props.file.name : ''}
						</Text>
						<Text className="text-gray-400 text-xs mt-1">
							{props.file.size !== null ? props.file.size : ''}
						</Text>
					</>
				) : (
					<>
						<View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${hasError ? 'bg-red-100' : 'bg-gray-100'}`}>
							<MaterialCommunityIcons
								name="upload-outline"
								size={22}
								color={hasError ? '#F87171' : '#9CA3AF'}
							/>
						</View>
						<Text className="text-gray-600 text-sm font-medium">
							{Platform.OS === 'web' ? 'Click to upload or drag and drop' : 'Tap to select a file'}
						</Text>
						<Text className="text-gray-400 text-xs mt-1">PDF, JPG or PNG (Max 5 MB)</Text>
					</>
				)}
			</TouchableOpacity>

			{props.file !== null && props.onRemove !== null && (
				<TouchableOpacity
					onPress={props.onRemove}
					className="flex-row items-center justify-center mt-2 py-1"
					accessibilityRole="button"
					accessibilityLabel="Remove uploaded file"
					style={Platform.OS === 'web' ? { cursor: 'pointer' } as object : undefined}
				>
					<MaterialCommunityIcons
						name="close-circle-outline"
						size={14}
						color="#6B7280"
						style={{ marginRight: 4 }}
					/>
					<Text className="text-gray-500 text-xs">Remove file</Text>
				</TouchableOpacity>
			)}

			<FieldError message={props.error} />
		</View>
	)
}

// Renders an animated floating toast notification that fades in and out at the bottom of the screen.
function Toast(props: ToastProps)
{
	const opacity = useRef(new Animated.Value(0)).current

	useEffect(
		() =>
		{
			if (props.visible)
			{
				Animated.sequence([
					Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
					Animated.delay(1800),
					Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
				]).start()
			}
			else
			{
				opacity.setValue(0)
			}
		},
		[props.visible]
	)

	if (!props.visible) return null

	return (
		<Animated.View
			className="absolute bottom-10 left-6 right-6 bg-gray-900 rounded-2xl px-5 py-4 flex-row items-center self-center shadow-lg z-[9999] max-w-[400px]"
			style={{ opacity, elevation: 20 }}
			pointerEvents="none"
		>
			<MaterialCommunityIcons
				name="check-circle-outline"
				size={20}
				color="#4ADE80"
				style={{ marginRight: 10 }}
			/>
			<Text className="text-white text-sm font-medium flex-1">
				{props.message}
			</Text>
		</Animated.View>
	)
}

// Extracts existing document metadata from a verify response and returns a populated UploadedFile, or null if absent.
function resolveDocumentFromResponse(data: Record<string, unknown>, key: string): UploadedFile | null
{
	const raw = data[key]
	if (raw === null || typeof raw !== 'object') return null
	const record   = raw as Record<string, unknown>
	const name     = typeof record['name']     === 'string' ? record['name']     : null
	const mimeType = typeof record['mimeType'] === 'string' ? record['mimeType'] : null
	const bytes    = typeof record['bytes']    === 'number' ? record['bytes']    : null
	if (name === null) return null
	const file    = createUploadedFile()
	file.name     = name
	file.mimeType = mimeType
	file.bytes    = bytes
	file.size     = bytes !== null ? formatBytes(bytes) : null
	return file
}

// Renders the full individual user registration screen with personal, contact, and identity document sections.
export default function RegisterUserScreen()
{
	const router = useRouter()

	const [fullName,     setFullName]     = useState<string>('')
	const [dateOfBirth,  setDateOfBirth]  = useState<string>('')
	const [nationality,  setNationality]  = useState<string>('')
	const [gender,       setGender]       = useState<Gender | null>(null)
	const [email,        setEmail]        = useState<string>('')
	const [mobileNumber, setMobileNumber] = useState<string>('')
	const [fullAddress,  setFullAddress]  = useState<string>('')
	const [documentType, setDocumentType] = useState<DocumentType | null>(null)
	const [idDoc,        setIdDoc]        = useState<UploadedFile | null>(null)
	const [targetCompanyId,   setTargetCompanyId]   = useState<string>('')
	const [targetCompanyName, setTargetCompanyName] = useState<string>('')
	const [availableCompanies, setAvailableCompanies] = useState<CompanyOption[]>([])

	const [isSubmitting,    setIsSubmitting]    = useState<boolean>(false)
	const [errorMessage,    setErrorMessage]    = useState<string | null>(null)
	const [emailSentBanner, setEmailSentBanner] = useState<boolean>(false)
	const [toastVisible,    setToastVisible]    = useState<boolean>(false)
	const [errors,  setErrors]  = useState<FormErrors>(createFormErrors())
	const [touched, setTouched] = useState<TouchedFields>(createTouchedFields())
	const [resubmissionToken, setResubmissionToken] = useState<string | null>(null)
	const isMountedRef   = useRef<boolean>(true)
	const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [isVerifyingToken,  setIsVerifyingToken]  = useState<boolean>(false)
	const [tokenError,        setTokenError]        = useState<string | null>(null)

	const searchParams = useLocalSearchParams()
	const queryToken   = typeof searchParams['token'] === 'string' ? searchParams['token'] : ''

	const [resubmissionSuccess, setResubmissionSuccess] = useState<boolean>(false)

	useEffect
	(
		() =>
		{
			const rawToken = typeof queryToken === 'string' ? queryToken.trim() : ''
			if (rawToken === '') return

			setIsVerifyingToken(true)

			fetch(`${API_BASE}/user-resubmit/verify?token=${encodeURIComponent(rawToken)}`)
				.then(async (res) =>
				{
					const data = (await res.json()) as Record<string, unknown>
					if (!res.ok)
					{
						const msg = typeof data['error'] === 'string' ? data['error'] : 'Invalid resubmission link.'
						setTokenError(msg)
						return
					}

					const emailRaw      = typeof data['email']        === 'string' ? data['email']        : ''
					const nameRaw       = typeof data['fullName']     === 'string' ? data['fullName']     : ''
					const dobRaw        = typeof data['dateOfBirth']  === 'string' ? data['dateOfBirth']  : ''
					const nationalRaw   = typeof data['nationality']  === 'string' ? data['nationality']  : ''
					const genderRaw     = typeof data['gender']       === 'string' ? data['gender']       : ''
					const mobileRaw     = typeof data['mobileNumber'] === 'string' ? data['mobileNumber'] : ''
					const addressRaw    = typeof data['fullAddress']  === 'string' ? data['fullAddress']  : ''
					const docTypeRaw    = typeof data['documentType'] === 'string' ? data['documentType'] : ''
					const targetIdRaw   = typeof data['targetCompanyId']   === 'string' ? data['targetCompanyId']   : ''
					const targetNameRaw = typeof data['targetCompanyName'] === 'string' ? data['targetCompanyName'] : ''
					const idDocData     = resolveDocumentFromResponse(data, 'idDoc')

					setResubmissionToken(rawToken)
					setEmail(emailRaw)
					setFullName(nameRaw)
					setDateOfBirth(dobRaw)
					setNationality(nationalRaw)
					setMobileNumber(mobileRaw)
					setFullAddress(addressRaw)
					setTargetCompanyId(targetIdRaw)
					setTargetCompanyName(targetNameRaw)

					if (genderRaw === 'male' || genderRaw === 'female')
					{
						setGender(genderRaw)
					}

					if (docTypeRaw === 'passport' || docTypeRaw === 'national_id' || docTypeRaw === 'drivers_license')
					{
						setDocumentType(docTypeRaw)
					}

					if (idDocData !== null) setIdDoc(idDocData)

					setTouched((prev) => ({
						...prev,
						email:        true,
						fullName:     nameRaw     !== '' ? true : prev.fullName,
						dateOfBirth:  dobRaw      !== '' ? true : prev.dateOfBirth,
						nationality:  nationalRaw !== '' ? true : prev.nationality,
						gender:       genderRaw   !== '' ? true : prev.gender,
						mobileNumber: mobileRaw   !== '' ? true : prev.mobileNumber,
						fullAddress:  addressRaw  !== '' ? true : prev.fullAddress,
						documentType: docTypeRaw  !== '' ? true : prev.documentType,
						targetCompanyId: targetIdRaw !== '' ? true : prev.targetCompanyId,
						idDoc:        idDocData   !== null ? true : prev.idDoc,
					}))
				})
				.catch(() => setTokenError('Could not verify your resubmission link. Please try again.'))
				.finally(() => setIsVerifyingToken(false))
		},
		[]
	)

	// Marks the component as unmounted and cancels any pending submit navigation timer.
	useEffect
	(
		() => () =>
		{
			isMountedRef.current = false
			if (submitTimerRef.current !== null)
			{
				clearTimeout(submitTimerRef.current)
			}
		},
		[],
	)

	// Loads the list of approved companies for the picker when not in resubmission mode.
	useEffect
	(
		() =>
		{
			const rawToken = typeof queryToken === 'string' ? queryToken.trim() : ''
			if (rawToken !== '') return

			fetchAvailableCompanies()
				.then((companies) => setAvailableCompanies(companies))
				.catch(() => setAvailableCompanies([]))
		},
		[]
	)

	// Recomputes every field error from the latest form values.
	function revalidateAll(
		name:    string,
		dob:     string,
		nat:     string,
		gen:     Gender | null,
		mail:    string,
		mobile:  string,
		addr:    string,
		docType: DocumentType | null,
		company: string,
		doc:     UploadedFile | null,
	): FormErrors
	{
		const companyArg = company !== '' ? company : null
		return validateAllFields(name, dob, nat, gen, mail, mobile, addr, docType, companyArg, doc)
	}

	// Marks a single field as touched and re-validates the whole form immediately.
	function handleBlur(field: keyof TouchedFields)
	{
		setTouched((prev) => ({ ...prev, [field]: true }))
		const next = revalidateAll(
			fullName, dateOfBirth, nationality, gender,
			email, mobileNumber, fullAddress, documentType, targetCompanyId, idDoc,
		)
		setErrors(next)
	}

	// Returns the error message for a field only if that field has been touched.
	function visibleError(field: keyof FormErrors): string | null
	{
		if (!touched[field]) return null
		return errors[field]
	}

	// Updates full name state and validates the field if it has been touched.
	const handleFullNameChange = (v: string) =>
	{
		setFullName(v)
		if (touched.fullName)
		{
			setErrors((prev) => ({ ...prev, fullName: validateFullName(v) }))
		}
	}

	// Updates date of birth state and validates the field if it has been touched.
	const handleDateOfBirthChange = (v: string) =>
	{
		setDateOfBirth(v)
		if (touched.dateOfBirth)
		{
			setErrors((prev) => ({ ...prev, dateOfBirth: validateDateOfBirth(v) }))
		}
	}

	// Updates nationality state and validates the field if it has been touched.
	const handleNationalityChange = (v: string) =>
	{
		setNationality(v)
		if (touched.nationality)
		{
			setErrors((prev) => ({ ...prev, nationality: validateNationality(v) }))
		}
	}

	// Sets gender, marks the field touched, and validates immediately.
	const handleGenderChange = (v: Gender) =>
	{
		setGender(v)
		setTouched((prev) => ({ ...prev, gender: true }))
		setErrors((prev) => ({ ...prev, gender: validateGender(v) }))
	}

	// Updates email state and validates the field if it has been touched.
	const handleEmailChange = (v: string) =>
	{
		setEmail(v)
		if (touched.email)
		{
			setErrors((prev) => ({ ...prev, email: validateEmail(v) }))
		}
	}

	// Updates mobile number state and validates the field if it has been touched.
	const handleMobileNumberChange = (v: string) =>
	{
		setMobileNumber(v)
		if (touched.mobileNumber)
		{
			setErrors((prev) => ({ ...prev, mobileNumber: validateMobileNumber(v) }))
		}
	}

	// Updates full address state and validates the field if it has been touched.
	const handleFullAddressChange = (v: string) =>
	{
		setFullAddress(v)
		if (touched.fullAddress)
		{
			setErrors((prev) => ({ ...prev, fullAddress: validateFullAddress(v) }))
		}
	}

	// Sets document type, marks the field touched, and validates immediately.
	const handleDocumentTypeChange = (v: DocumentType) =>
	{
		setDocumentType(v)
		setTouched((prev) => ({ ...prev, documentType: true }))
		setErrors((prev) => ({ ...prev, documentType: validateDocumentType(v) }))
	}

	// Opens the document picker and updates the identity document state and its error.
	const handlePickIdDoc = async () =>
	{
		await pickDocument(
			(file) =>
			{
				setIdDoc(file)
				setTouched((prev) => ({ ...prev, idDoc: true }))
				setErrors((prev) => ({ ...prev, idDoc: validateUploadedFile(file, 'Identity document') }))
			}
		)
	}

	// Clears the uploaded identity document and re-validates the field.
	const handleRemoveIdDoc = () =>
	{
		setIdDoc(null)
		setErrors((prev) => ({ ...prev, idDoc: validateUploadedFile(null, 'Identity document') }))
	}

	// Navigates the user to the login screen.
	const handleLoginNavigation = () =>
	{
		router.replace('/login' as never)
	}

	// Selects the target company, marks the field touched, and validates immediately.
	const handleSelectCompany = (companyId: string) =>
	{
		setTargetCompanyId(companyId)
		setTouched((prev) => ({ ...prev, targetCompanyId: true }))
		setErrors((prev) => ({ ...prev, targetCompanyId: validateTargetCompany(companyId) }))
	}

	// Validates every field, blocks submission on errors, then calls the verification or resubmission endpoint and surfaces the result.
	async function handleSubmit()
	{
		setTouched(touchAllFields())

		const currentErrors = revalidateAll(
			fullName, dateOfBirth, nationality, gender,
			email, mobileNumber, fullAddress, documentType, targetCompanyId, idDoc,
		)
		setErrors(currentErrors)
		if (hasErrors(currentErrors)) return

		setErrorMessage(null)
		setIsSubmitting(true)

		try
		{
			if (resubmissionToken !== null)
			{
				const params = createSubmitResubmissionParams()
				params.resubmissionToken = resubmissionToken
				params.fullName          = fullName
				params.dateOfBirth       = dateOfBirth
				params.nationality       = nationality
				params.gender            = gender
				params.mobileNumber      = mobileNumber
				params.fullAddress       = fullAddress
				params.documentType      = documentType
				params.idDoc             = idDoc !== null ? idDoc : createUploadedFile()

				await submitResubmission(params)

				setResubmissionSuccess(true)
			}
			else
			{
				const params = createSubmitRegistrationParams()
				params.fullName     = fullName
				params.dateOfBirth  = dateOfBirth
				params.nationality  = nationality
				params.gender       = gender
				params.email        = email
				params.mobileNumber = mobileNumber
				params.fullAddress  = fullAddress
				params.documentType = documentType
				params.targetCompanyId = targetCompanyId
				params.idDoc        = idDoc !== null ? idDoc : createUploadedFile()

				await initiateRegistration(params)

				setEmailSentBanner(true)
				setToastVisible(true)

				submitTimerRef.current = setTimeout(() =>
				{
					setToastVisible(false)
					router.replace('/login' as never)
				}, 2400)
			}
		}
		catch (e)
		{
			setErrorMessage(resolveErrorMessage(e))
			setIsSubmitting(false)
		}
	}

	const webContainerClass: string =
		Platform.OS === 'web' ? 'max-w-[680px] w-full self-center pb-6' : ''

	const webSubmitStyle: Record<string, string> | null =
		Platform.OS === 'web' ? { cursor: 'pointer' } : null

	const isFormValid = useMemo
	(
		() => !hasErrors(
			revalidateAll(
				fullName, dateOfBirth, nationality, gender,
				email, mobileNumber, fullAddress, documentType, targetCompanyId, idDoc,
			)
		),
		[
			fullName, dateOfBirth, nationality, gender,
			email, mobileNumber, fullAddress, documentType, targetCompanyId, idDoc,
		],
	)

	// Renders the resubmission success view, bypassing the full form, when the submission has completed.
	if (resubmissionSuccess)
	{
		return (
			<View className="flex-1 bg-[#F9FAFB] items-center justify-center px-6">
				<View className="w-16 h-16 bg-emerald-100 rounded-2xl items-center justify-center mb-4">
					<MaterialCommunityIcons
						name="check-circle-outline"
						size={32}
						color="#059669"
					/>
				</View>
				<Text className="text-gray-900 text-xl font-bold text-center mb-2">
					Resubmission Received
				</Text>
				<Text className="text-gray-500 text-sm text-center leading-5">
					Resubmission received! You may now close the browser.
				</Text>
			</View>
		)
	}

	return (
		<View className="flex-1 bg-[#F9FAFB]">
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			>
				<ScrollView
					className="flex-1"
					contentContainerStyle={{ flexGrow: 1 }}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<View className={webContainerClass}>

						<View className="bg-blue-600 rounded-b-3xl px-6 pt-14 pb-12 overflow-hidden">
							<View className="absolute top-4 right-4 w-32 h-32 rounded-full bg-blue-500 opacity-40" />
							<View className="absolute top-16 right-16 w-20 h-20 rounded-full bg-blue-400 opacity-30" />

							<View className="flex-row items-center mb-8">
								<View className="w-11 h-11 bg-white rounded-xl items-center justify-center mr-3">
									<View className="w-6 h-6 bg-blue-600 rounded-md" />
								</View>
								<Text className="text-white text-xl font-semibold tracking-wide">CorpPay</Text>
							</View>

							<Text className="text-white text-4xl font-bold mb-2">Create Account</Text>
							<Text className="text-blue-200 text-sm">
							{resubmissionToken !== null
								? 'Update your details and resubmit for review'
								: 'Complete the form to verify your identity'
							}
							</Text>
						</View>

						<View className="flex-1 px-6 pt-8 pb-8">

							{isVerifyingToken && (
								<View className="mb-5 px-4 py-4 bg-blue-50 border border-blue-200 rounded-xl flex-row items-center">
									<ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 10 }} />
									<Text className="text-blue-700 text-sm">Verifying your resubmission link…</Text>
								</View>
							)}

							{tokenError !== null && (
								<View className="mb-5 px-4 py-4 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
									<MaterialCommunityIcons
										name="alert-circle-outline"
										size={18}
										color="#DC2626"
										style={{ marginRight: 8, marginTop: 1 }}
									/>
									<Text className="text-red-600 text-sm flex-1">{tokenError}</Text>
								</View>
							)}

							<SectionHeader
								icon="office-building-outline"
								label="Company"
								iconBg="#EFF6FF"
								iconColor="#2563EB"
							/>

							<View className="mb-5">
								<FieldLabel label="Company you're joining" optional={null} />

								{resubmissionToken !== null ? (
									<View className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3.5 flex-row items-center">
										<MaterialCommunityIcons
											name="office-building-outline"
											size={18}
											color="#9CA3AF"
											style={{ marginRight: 10 }}
										/>
										<Text className="text-gray-600 text-sm flex-1">
											{targetCompanyName !== '' ? targetCompanyName : 'Selected company'}
										</Text>
										<MaterialCommunityIcons name="lock-outline" size={16} color="#9CA3AF" />
									</View>
								) : (
									<>
										{availableCompanies.length === 0 ? (
											<View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5">
												<Text className="text-gray-500 text-sm">No companies are currently available to join.</Text>
											</View>
										) : (
											availableCompanies.map(
												(company) => (
													<TouchableOpacity
														key={company.companyId}
														onPress={() => handleSelectCompany(company.companyId)}
														className={`border rounded-xl px-4 py-3.5 mb-2 flex-row items-center ${
															targetCompanyId === company.companyId
																? 'border-blue-500 bg-blue-50'
																: 'border-gray-200 bg-gray-50'
														}`}
														style={Platform.OS === 'web' ? { cursor: 'pointer' } as object : undefined}
														accessibilityRole="button"
														accessibilityLabel={`Join ${company.companyName}`}
													>
														<MaterialCommunityIcons
															name="office-building-outline"
															size={18}
															color={targetCompanyId === company.companyId ? '#2563EB' : '#9CA3AF'}
															style={{ marginRight: 10 }}
														/>
														<Text className={`flex-1 text-sm font-medium ${
															targetCompanyId === company.companyId ? 'text-blue-700' : 'text-gray-700'
														}`}>
															{company.companyName}
														</Text>
														{targetCompanyId === company.companyId && (
															<MaterialCommunityIcons name="check-circle" size={18} color="#2563EB" />
														)}
													</TouchableOpacity>
												)
											)
										)}
										<FieldError message={visibleError('targetCompanyId')} />
									</>
								)}
							</View>

							<View className="h-px bg-gray-200 my-6" />

							<SectionHeader
								icon="account-outline"
								label="Personal Information"
								iconBg="#EFF6FF"
								iconColor="#2563EB"
							/>

							<View className="mb-5">
								<FieldLabel label="Full Name" optional={null} />
								<TextFieldInput
									icon="account-outline"
									placeholder="Enter your full name"
									value={fullName}
									onChangeText={handleFullNameChange}
									onBlur={() => handleBlur('fullName')}
									autoCapitalize="words"
									keyboardType={null}
									multiline={null}
									numberOfLines={null}
									error={visibleError('fullName')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Date of Birth" optional={null} />
								<TextFieldInput
									icon="calendar-outline"
									placeholder="YYYY-MM-DD"
									value={dateOfBirth}
									onChangeText={handleDateOfBirthChange}
									onBlur={() => handleBlur('dateOfBirth')}
									keyboardType="numbers-and-punctuation"
									autoCapitalize={null}
									multiline={null}
									numberOfLines={null}
									error={visibleError('dateOfBirth')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Nationality" optional={null} />
								<TextFieldInput
									icon="flag-outline"
									placeholder="e.g., Malaysian"
									value={nationality}
									onChangeText={handleNationalityChange}
									onBlur={() => handleBlur('nationality')}
									autoCapitalize="words"
									keyboardType={null}
									multiline={null}
									numberOfLines={null}
									error={visibleError('nationality')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Gender" optional={null} />
								<SegmentedControl<Gender>
									options={[
										{ value: 'male',   label: 'Male',   icon: null },
										{ value: 'female', label: 'Female', icon: null },
									]}
									value={gender}
									onChange={handleGenderChange}
									error={visibleError('gender')}
								/>
							</View>

							<View className="h-px bg-gray-200 my-6" />

							<SectionHeader
								icon="card-account-phone-outline"
								label="Contact Information"
								iconBg="#F5F3FF"
								iconColor="#7C3AED"
							/>

							<View className="mb-5">
								<FieldLabel label="Email Address" optional={null} />
								<TextFieldInput
									icon="email-outline"
									placeholder="Enter your email address"
									value={email}
									onChangeText={resubmissionToken !== null ? null : handleEmailChange}
									onBlur={() => handleBlur('email')}
									keyboardType="email-address"
									autoCapitalize="none"
									multiline={null}
									numberOfLines={null}
									error={visibleError('email')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Mobile Number" optional={null} />
								<TextFieldInput
									icon="phone-outline"
									placeholder="e.g., +60123456789"
									value={mobileNumber}
									onChangeText={handleMobileNumberChange}
									onBlur={() => handleBlur('mobileNumber')}
									keyboardType="phone-pad"
									autoCapitalize={null}
									multiline={null}
									numberOfLines={null}
									error={visibleError('mobileNumber')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Full Address" optional={null} />
								<TextFieldInput
									icon="map-marker-outline"
									placeholder="Enter your full residential address"
									value={fullAddress}
									onChangeText={handleFullAddressChange}
									onBlur={() => handleBlur('fullAddress')}
									autoCapitalize="sentences"
									keyboardType={null}
									multiline={true}
									numberOfLines={3}
									error={visibleError('fullAddress')}
								/>
							</View>

							<View className="h-px bg-gray-200 my-6" />

							<SectionHeader
								icon="file-document-outline"
								label="Identity Document"
								iconBg="#ECFDF5"
								iconColor="#059669"
							/>

							<View className="mb-5">
								<FieldLabel label="Document Type" optional={null} />
								<SegmentedControl<DocumentType>
									options={[
										{ value: 'passport',        label: 'Passport',  icon: null },
										{ value: 'national_id',     label: 'National ID', icon: null },
										{ value: 'drivers_license', label: 'License',   icon: null },
									]}
									value={documentType}
									onChange={handleDocumentTypeChange}
									error={visibleError('documentType')}
								/>
							</View>

							<View className="mb-6">
								<FieldLabel label="Identity Document Upload" optional={null} />
								<UploadBox
									file={idDoc}
									onPress={handlePickIdDoc}
									onRemove={handleRemoveIdDoc}
									error={visibleError('idDoc')}
								/>
							</View>

							{emailSentBanner && (
								<View className="mb-5 px-4 py-4 bg-blue-50 border border-blue-200 rounded-xl flex-row items-start">
									<MaterialCommunityIcons
										name="email-check-outline"
										size={20}
										color="#2563EB"
										style={{ marginRight: 10, marginTop: 1 }}
									/>
									<View className="flex-1">
										<Text className="text-blue-800 text-sm font-semibold mb-1">
											Check your inbox
										</Text>
										<Text className="text-blue-700 text-sm">
											A verification link has been sent to{' '}
											<Text className="font-semibold">{email}</Text>.
											Please click the link within 15 minutes to complete your registration.
										</Text>
									</View>
								</View>
							)}

							{errorMessage !== null && (
								<View className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex-row items-start">
									<MaterialCommunityIcons
										name="alert-circle-outline"
										size={18}
										color="#dc2626"
										style={{ marginRight: 8, marginTop: 1 }}
									/>
									<Text className="text-red-600 text-sm flex-1">{errorMessage}</Text>
								</View>
							)}

							{!emailSentBanner && (
								<TouchableOpacity
									className={`rounded-2xl py-4 items-center mb-6 shadow-md ${
										isFormValid && !isSubmitting
											? 'bg-blue-600 shadow-blue-300'
											: 'bg-gray-300 shadow-gray-200'
									}`}
									onPress={handleSubmit}
									disabled={!isFormValid || isSubmitting}
									style={webSubmitStyle as object}
									accessibilityRole="button"
									accessibilityLabel="Submit Registration"
									accessibilityState={{ disabled: !isFormValid || isSubmitting }}
								>
									{isSubmitting ? (
										<ActivityIndicator color="#fff" />
									) : (
										<Text className={`text-base font-semibold tracking-wide ${
											isFormValid ? 'text-white' : 'text-gray-400'
										}`}>
											{resubmissionToken !== null ? 'Resubmit Application' : 'Submit Registration'}
										</Text>
									)}
								</TouchableOpacity>
							)}

							<View className="flex-row justify-center">
								<Text className="text-gray-500 text-sm">Already have an account? </Text>
								<TouchableOpacity onPress={handleLoginNavigation} accessibilityRole="link">
									<Text className="text-blue-600 text-sm font-semibold">Sign In</Text>
								</TouchableOpacity>
							</View>

						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>

			<Toast
				visible={toastVisible}
				message={
					resubmissionToken !== null
						? 'Resubmission received!'
						: 'Registration submitted! Redirecting…'
				}
			/>
		</View>
	)
}