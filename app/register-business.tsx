import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
    normalizeIcPassport,
    touchAllFields,
    validateAllFields,
    validateCompanyName,
    validateDirectorRole,
    validateEntityType,
    validateIcPassport,
    validateOwnershipPct,
    validateRegisteredAddress,
    validateRegisteredEmail,
    validateSsmNumber,
    validateUploadedFile,
} from '../corppay-backend/src/validation/registerBusinessValidation';

type EntityType   = 'sdn_bhd' | 'sole_proprietor'
type DirectorRole = 'director' | 'owner'

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
	file:    UploadedFile | null
	onPress: (() => void) | null
	error:   string | null
}

// Creates a fully initialized UploadBoxProps with all fields set to null.
function createUploadBoxProps(): UploadBoxProps
{
	return { file: null, onPress: null, error: null }
}

type SubmitRegistrationParams =
{
	accessToken:       string | null
	companyName:       string | null
	ssmNumber:         string | null
	entityType:        EntityType | null
	registeredAddress: string | null
	icPassport:        string | null
	directorRole:      DirectorRole | null
	ownershipPct:      string | null
	submittedBy:       string | null
	ssmDoc:            UploadedFile | null
	icDoc:             UploadedFile | null
}

// Creates a fully initialized SubmitRegistrationParams with all fields set to null.
function createSubmitRegistrationParams(): SubmitRegistrationParams
{
	return {
		accessToken:       null,
		companyName:       null,
		ssmNumber:         null,
		entityType:        null,
		registeredAddress: null,
		icPassport:        null,
		directorRole:      null,
		ownershipPct:      null,
		submittedBy:       null,
		ssmDoc:            null,
		icDoc:             null,
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
			const assetSize    = resolveAssetSize(asset.size !== undefined ? asset.size : null)
			const assetMime    = resolveAssetMimeType(asset.mimeType !== undefined ? asset.mimeType : null)
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

// Submits the company registration form data and uploaded documents to the API directly (legacy route).
async function submitRegistration(params: SubmitRegistrationParams): Promise<unknown>
{
	const form = new FormData()

	if (params.companyName !== null)       form.append('name',                params.companyName)
	if (params.ssmNumber !== null)         form.append('ssmNumber',           params.ssmNumber)
	if (params.entityType !== null)        form.append('entityType',          params.entityType)
	if (params.registeredAddress !== null) form.append('registeredAddress',   params.registeredAddress)
	if (params.icPassport !== null)        form.append('director.icPassport', params.icPassport)
	if (params.directorRole !== null)      form.append('director.role',       params.directorRole)
	if (params.submittedBy !== null)       form.append('submittedBy',         params.submittedBy)

	if (params.ownershipPct !== null && params.ownershipPct.trim() !== '')
	{
		form.append('director.ownershipPct', params.ownershipPct.trim())
	}

	if (params.ssmDoc !== null)
	{
		if (params.ssmDoc.webFile !== null)
		{
			form.append('ssmDoc', params.ssmDoc.webFile, params.ssmDoc.webFile.name)
		}
		else if (params.ssmDoc.uri !== null)
		{
			form.append('ssmDoc', {
				uri:  params.ssmDoc.uri,
				name: params.ssmDoc.name !== null ? params.ssmDoc.name : 'file',
				type: params.ssmDoc.mimeType !== null ? params.ssmDoc.mimeType : 'application/octet-stream',
			} as unknown as Blob)
		}
	}

	if (params.icDoc !== null)
	{
		if (params.icDoc.webFile !== null)
		{
			form.append('icDoc', params.icDoc.webFile, params.icDoc.webFile.name)
		}
		else if (params.icDoc.uri !== null)
		{
			form.append('icDoc', {
				uri:  params.icDoc.uri,
				name: params.icDoc.name !== null ? params.icDoc.name : 'file',
				type: params.icDoc.mimeType !== null ? params.icDoc.mimeType : 'application/octet-stream',
			} as unknown as Blob)
		}
	}

	const authHeader = params.accessToken !== null ? `Bearer ${params.accessToken}` : ''

	const response = await fetch(`${API_BASE}/companies/register`, {
		method:  'POST',
		headers: { Authorization: authHeader },
		body:    form,
	})

	const data: unknown = (await response.json()) as unknown

	if (!response.ok)
	{
		throw new Error(resolveApiErrorMessage(data))
	}

	return data
}

// Submits the registration form to the email-verification endpoint, which gates company creation behind email confirmation.
async function initiateRegistration(params: SubmitRegistrationParams): Promise<unknown>
{
	const form = new FormData()

	if (params.companyName !== null)       form.append('name',                params.companyName)
	if (params.ssmNumber !== null)         form.append('ssmNumber',           params.ssmNumber)
	if (params.entityType !== null)        form.append('entityType',          params.entityType)
	if (params.registeredAddress !== null) form.append('registeredAddress',   params.registeredAddress)
	if (params.icPassport !== null)        form.append('director.icPassport', params.icPassport)
	if (params.directorRole !== null)      form.append('director.role',       params.directorRole)
	if (params.submittedBy !== null)       form.append('submittedBy',         params.submittedBy)

	if (params.ownershipPct !== null && params.ownershipPct.trim() !== '')
	{
		form.append('director.ownershipPct', params.ownershipPct.trim())
	}

	if (params.ssmDoc !== null)
	{
		if (params.ssmDoc.webFile !== null)
		{
			form.append('ssmDoc', params.ssmDoc.webFile, params.ssmDoc.webFile.name)
		}
		else if (params.ssmDoc.uri !== null)
		{
			form.append('ssmDoc', {
				uri:  params.ssmDoc.uri,
				name: params.ssmDoc.name !== null ? params.ssmDoc.name : 'file',
				type: params.ssmDoc.mimeType !== null ? params.ssmDoc.mimeType : 'application/octet-stream',
			} as unknown as Blob)
		}
	}

	if (params.icDoc !== null)
	{
		if (params.icDoc.webFile !== null)
		{
			form.append('icDoc', params.icDoc.webFile, params.icDoc.webFile.name)
		}
		else if (params.icDoc.uri !== null)
		{
			form.append('icDoc', {
				uri:  params.icDoc.uri,
				name: params.icDoc.name !== null ? params.icDoc.name : 'file',
				type: params.icDoc.mimeType !== null ? params.icDoc.mimeType : 'application/octet-stream',
			} as unknown as Blob)
		}
	}

	const authHeader = params.accessToken !== null ? `Bearer ${params.accessToken}` : ''

	const response = await fetch(`${API_BASE}/companies/initiate-register`, {
		method:  'POST',
		headers: { Authorization: authHeader },
		body:    form,
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
								key={opt.value !== null ? opt.value : ''}
								className={`flex-1 flex-row items-center justify-center py-2.5 rounded-full ${
									active ? 'bg-white shadow-sm' : 'bg-transparent'
								}`}
								onPress={handleOptionPress}
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
								<Text className={`text-sm font-medium ${active ? 'text-gray-800' : 'text-gray-400'}`}>
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

// Renders a file upload drop zone that displays file details once a file has been selected.
function UploadBox(props: UploadBoxProps)
{
	const webCursorStyle: Record<string, string> | null =
		Platform.OS === 'web' ? { cursor: 'pointer' } : null
	const hasError = props.error !== null

	// A no-op press handler used when no handler is provided.
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

// Renders the full business registration screen with company, director, and document upload sections.
export default function RegisterBusinessScreen()
{
	const router = useRouter()

	const [companyName,       setCompanyName]       = useState<string>('')
	const [ssmNumber,         setSsmNumber]         = useState<string>('')
	const [entityType,        setEntityType]        = useState<EntityType | null>(null)
	const [registeredAddress, setRegisteredAddress] = useState<string>('')
	const [icPassport,        setIcPassport]        = useState<string>('')
	const [directorRole,      setDirectorRole]      = useState<DirectorRole | null>(null)
	const [ownershipPct,      setOwnershipPct]      = useState<string>('')
	const [registeredEmail,   setRegisteredEmail]   = useState<string>('')
	const [ssmDoc,            setSsmDoc]            = useState<UploadedFile | null>(null)
	const [icDoc,             setIcDoc]             = useState<UploadedFile | null>(null)
	const [isSubmitting,    setIsSubmitting]    = useState<boolean>(false)
	const [errorMessage,    setErrorMessage]    = useState<string | null>(null)
	const [emailSentBanner, setEmailSentBanner] = useState<boolean>(false)
	const [toastVisible,    setToastVisible]    = useState<boolean>(false)
	const [errors,  setErrors]  = useState<FormErrors>(createFormErrors())
	const [touched, setTouched] = useState<TouchedFields>(createTouchedFields())

	// Recomputes every field error from the latest form values.
	function revalidateAll(
		cn:   string,
		ssm:  string,
		et:   EntityType | null,
		addr: string,
		email: string,
		ic:   string,
		role: DirectorRole | null,
		pct:  string,
		sDoc: UploadedFile | null,
		iDoc: UploadedFile | null,
	): FormErrors
	{
		return validateAllFields(cn, ssm, et, addr, email, ic, role, pct, sDoc, iDoc)
	}

	// Marks a single field as touched and re-validates that field immediately.
	function handleBlur(field: keyof TouchedFields)
	{
		setTouched((prev) => ({ ...prev, [field]: true }))
		const next = revalidateAll(
			companyName, ssmNumber, entityType, registeredAddress,
			registeredEmail, icPassport, directorRole, ownershipPct, ssmDoc, icDoc,
		)
		setErrors(next)
	}

	// Returns the error message for a field only if that field has been touched.
	function visibleError(field: keyof FormErrors): string | null
	{
		if (!touched[field]) return null
		return errors[field]
	}

	// Updates company name state and validates the field if it has been touched.
	const handleCompanyNameChange = (v: string) =>
	{
		setCompanyName(v)
		if (touched.companyName)
		{
			setErrors((prev) => ({ ...prev, companyName: validateCompanyName(v) }))
		}
	}

	// Updates SSM number state and validates the field if it has been touched.
	const handleSsmNumberChange = (v: string) =>
	{
		setSsmNumber(v)
		if (touched.ssmNumber)
		{
			setErrors((prev) => ({ ...prev, ssmNumber: validateSsmNumber(v) }))
		}
	}

	// Sets entity type, marks the field touched, and validates immediately.
	const handleEntityTypeChange = (v: EntityType) =>
	{
		setEntityType(v)
		setTouched((prev) => ({ ...prev, entityType: true }))
		setErrors((prev) => ({ ...prev, entityType: validateEntityType(v) }))
	}

	// Sets director role, marks the field touched, and validates immediately.
	const handleDirectorRoleChange = (v: DirectorRole) =>
	{
		setDirectorRole(v)
		setTouched((prev) => ({ ...prev, directorRole: true }))
		setErrors((prev) => ({ ...prev, directorRole: validateDirectorRole(v) }))
	}

	// Updates registered address state and validates the field if it has been touched.
	const handleRegisteredAddressChange = (v: string) =>
	{
		setRegisteredAddress(v)
		if (touched.registeredAddress)
		{
			setErrors((prev) => ({ ...prev, registeredAddress: validateRegisteredAddress(v) }))
		}
	}

	// Updates registered email state and validates the field if it has been touched.
	const handleRegisteredEmailChange = (v: string) =>
	{
		setRegisteredEmail(v)
		if (touched.registeredEmail)
		{
			setErrors((prev) => ({ ...prev, registeredEmail: validateRegisteredEmail(v) }))
		}
	}

	// Normalizes and updates the IC/Passport field, validating if the field has been touched.
	const handleIcPassportChange = (v: string) =>
	{
		const normalized = normalizeIcPassport(v)
		setIcPassport(normalized)
		if (touched.icPassport)
		{
			setErrors((prev) => ({ ...prev, icPassport: validateIcPassport(normalized) }))
		}
	}

	// Updates ownership percentage state and validates the field if it has been touched.
	const handleOwnershipPctChange = (v: string) =>
	{
		setOwnershipPct(v)
		if (touched.ownershipPct)
		{
			setErrors((prev) => ({ ...prev, ownershipPct: validateOwnershipPct(v) }))
		}
	}

	// Opens the document picker and updates the file state and error for the specified field.
	const handlePickDocument = async (
		setter:   (f: UploadedFile) => void,
		errorKey: 'ssmDoc' | 'icDoc',
	) =>
	{
		await pickDocument(
			(file) =>
			{
				setter(file)
				setTouched((prev) => ({ ...prev, [errorKey]: true }))
				setErrors((prev) => ({
					...prev,
					[errorKey]: validateUploadedFile(
						file,
						errorKey === 'ssmDoc'
							? 'Certificate of Incorporation'
							: 'Director IC / Passport Copy',
					),
				}))
			}
		)
	}

	// Triggers the document picker for the SSM certificate upload field.
	const handlePickSsmDoc = () =>
	{
		handlePickDocument(setSsmDoc, 'ssmDoc')
	}

	// Triggers the document picker for the director IC/Passport upload field.
	const handlePickIcDoc = () =>
	{
		handlePickDocument(setIcDoc, 'icDoc')
	}

	// Navigates the user to the login screen.
	const handleLoginNavigation = () =>
	{
		router.replace('/login' as never)
	}

	// Validates every field, blocks submission on errors, then calls the email-verification initiation endpoint, shows a success banner and toast before redirecting to login.
	async function handleSubmit()
	{
		setTouched(touchAllFields())

		const currentErrors = revalidateAll(
			companyName, ssmNumber, entityType, registeredAddress,
			registeredEmail, icPassport, directorRole, ownershipPct, ssmDoc, icDoc,
		)
		setErrors(currentErrors)
		if (hasErrors(currentErrors)) return

		setErrorMessage(null)
		setIsSubmitting(true)

		try
		{
			const globalRecord = global as Record<string, unknown>
			const globalToken  = globalRecord['__accessToken']
			const accessToken  = typeof globalToken === 'string'
				? globalToken
				: 'REPLACE_WITH_REAL_TOKEN'

			const params = createSubmitRegistrationParams()
			params.accessToken       = accessToken
			params.companyName       = companyName
			params.ssmNumber         = ssmNumber
			params.entityType        = entityType
			params.registeredAddress = registeredAddress
			params.icPassport        = icPassport
			params.directorRole      = directorRole
			params.ownershipPct      = ownershipPct
			params.submittedBy       = registeredEmail
			params.ssmDoc            = ssmDoc !== null ? ssmDoc : createUploadedFile()
			params.icDoc             = icDoc  !== null ? icDoc  : createUploadedFile()

			await initiateRegistration(params)

			setEmailSentBanner(true)
			setToastVisible(true)

			setTimeout(() =>
			{
				setToastVisible(false)
				router.replace('/login' as never)
			}, 2400)
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

	const isFormValid = !hasErrors(
		revalidateAll(
			companyName, ssmNumber, entityType, registeredAddress,
			registeredEmail, icPassport, directorRole,
			ownershipPct, ssmDoc, icDoc,
		)
	)

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

							<Text className="text-white text-4xl font-bold mb-2">Register Business</Text>
							<Text className="text-blue-200 text-sm">Complete the form to register your entity</Text>
						</View>

						<View className="flex-1 px-6 pt-8 pb-8">

							<SectionHeader
								icon="office-building-outline"
								label="Company Information"
								iconBg="#EFF6FF"
								iconColor="#2563EB"
							/>

							<View className="mb-5">
								<FieldLabel label="Company Name" optional={null} />
								<TextFieldInput
									icon="office-building-outline"
									placeholder="Enter company name"
									value={companyName}
									onChangeText={handleCompanyNameChange}
									onBlur={() => handleBlur('companyName')}
									autoCapitalize="words"
									keyboardType={null}
									multiline={null}
									numberOfLines={null}
									error={visibleError('companyName')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Company Registration Number (SSM)" optional={null} />
								<TextFieldInput
									icon="pound"
									placeholder="e.g., 202301234567"
									value={ssmNumber}
									onChangeText={handleSsmNumberChange}
									onBlur={() => handleBlur('ssmNumber')}
									keyboardType="default"
									autoCapitalize={null}
									multiline={null}
									numberOfLines={null}
									error={visibleError('ssmNumber')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Entity Type" optional={null} />
								<SegmentedControl<EntityType>
									options={[
										{ value: 'sdn_bhd',         label: 'Sdn Bhd',        icon: null },
										{ value: 'sole_proprietor', label: 'Sole Proprietor', icon: null },
									]}
									value={entityType}
									onChange={handleEntityTypeChange}
									error={visibleError('entityType')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Registered Address" optional={null} />
								<TextFieldInput
									icon="map-marker-outline"
									placeholder="Enter registered business address"
									value={registeredAddress}
									onChangeText={handleRegisteredAddressChange}
									onBlur={() => handleBlur('registeredAddress')}
									autoCapitalize="sentences"
									keyboardType={null}
									multiline={true}
									numberOfLines={3}
									error={visibleError('registeredAddress')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Registered Email" optional={null} />
								<TextFieldInput
									icon="email-outline"
									placeholder="Enter your registered email address"
									value={registeredEmail}
									onChangeText={handleRegisteredEmailChange}
									onBlur={() => handleBlur('registeredEmail')}
									keyboardType="email-address"
									autoCapitalize="none"
									multiline={null}
									numberOfLines={null}
									error={visibleError('registeredEmail')}
								/>
							</View>

							<View className="h-px bg-gray-200 my-6" />

							<SectionHeader
								icon="account-outline"
								label="Director Information"
								iconBg="#F5F3FF"
								iconColor="#7C3AED"
							/>

							<View className="mb-5">
								<FieldLabel label="IC / Passport Number" optional={null} />
								<TextFieldInput
									icon="card-account-details-outline"
									placeholder="Enter IC or Passport number"
									value={icPassport}
									onChangeText={handleIcPassportChange}
									onBlur={() => handleBlur('icPassport')}
									keyboardType={null}
									autoCapitalize="characters"
									multiline={null}
									numberOfLines={null}
									error={visibleError('icPassport')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Role" optional={null} />
								<SegmentedControl<DirectorRole>
									options={[
										{ value: 'director', label: 'Director', icon: 'shield-account-outline' },
										{ value: 'owner',    label: 'Owner',    icon: 'account-outline' },
									]}
									value={directorRole}
									onChange={handleDirectorRoleChange}
									error={visibleError('directorRole')}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Ownership Percentage" optional={null} />
								<TextFieldInput
									icon="percent-outline"
									placeholder="e.g., 100"
									value={ownershipPct}
									onChangeText={handleOwnershipPctChange}
									onBlur={() => handleBlur('ownershipPct')}
									keyboardType="numeric"
									autoCapitalize={null}
									multiline={null}
									numberOfLines={null}
									error={visibleError('ownershipPct')}
								/>
							</View>

							<View className="h-px bg-gray-200 my-6" />

							<SectionHeader
								icon="upload-outline"
								label="Document Upload"
								iconBg="#ECFDF5"
								iconColor="#059669"
							/>

							<View className="mb-5">
								<FieldLabel label="Certificate of Incorporation (SSM)" optional={null} />
								<UploadBox
									file={ssmDoc}
									onPress={handlePickSsmDoc}
									error={visibleError('ssmDoc')}
								/>
							</View>

							<View className="mb-6">
								<FieldLabel label="Director IC / Passport Copy" optional={null} />
								<UploadBox
									file={icDoc}
									onPress={handlePickIcDoc}
									error={visibleError('icDoc')}
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
											<Text className="font-semibold">{registeredEmail}</Text>.
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
											Submit Registration
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
				message="Registration submitted! Redirecting…"
			/>
		</View>
	)
}