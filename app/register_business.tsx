import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

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

function createSectionHeaderProps(): SectionHeaderProps
{
	return {
		icon:      null,
		label:     null,
		iconBg:    null,
		iconColor: null,
	}
}

type FieldLabelProps =
{
	label:    string | null
	optional: boolean | null
}

function createFieldLabelProps(): FieldLabelProps
{
	return {
		label:    null,
		optional: null,
	}
}

type TextFieldInputProps =
{
	icon:           React.ComponentProps<typeof MaterialCommunityIcons>['name'] | null
	placeholder:    string | null
	value:          string | null
	onChangeText:   ((v: string) => void) | null
	keyboardType:   React.ComponentProps<typeof TextInput>['keyboardType'] | null
	autoCapitalize: React.ComponentProps<typeof TextInput>['autoCapitalize'] | null
	multiline:      boolean | null
	numberOfLines:  number | null
}

function createTextFieldInputProps(): TextFieldInputProps
{
	return {
		icon:           null,
		placeholder:    null,
		value:          null,
		onChangeText:   null,
		keyboardType:   null,
		autoCapitalize: null,
		multiline:      null,
		numberOfLines:  null,
	}
}

type SegmentOptionItem<T> =
{
	value: T | null
	label: string | null
	icon:  React.ComponentProps<typeof MaterialCommunityIcons>['name'] | null
}

function createSegmentOptionItem<T>(): SegmentOptionItem<T>
{
	return {
		value: null,
		label: null,
		icon:  null,
	}
}

type SegmentedControlProps<T extends string> =
{
	options:  SegmentOptionItem<T>[]
	value:    T | null
	onChange: ((v: T) => void) | null
}

function createSegmentedControlProps<T extends string>(): SegmentedControlProps<T>
{
	return {
		options:  [],
		value:    null,
		onChange: null,
	}
}

type UploadBoxProps =
{
	file:    UploadedFile | null
	onPress: (() => void) | null
}

function createUploadBoxProps(): UploadBoxProps
{
	return {
		file:    null,
		onPress: null,
	}
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

function formatBytes(bytes: number | null): string
{
	if (bytes === null)  return '0 B'
	if (bytes < 1024)    return `${bytes} B`
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1048576).toFixed(1)} MB`
}

function resolveAssetSize(value: number | null | undefined): number
{
	if (value === null || value === undefined) return 0
	return value
}

function resolveAssetMimeType(value: string | null | undefined): string
{
	if (value === null || value === undefined) return 'application/octet-stream'
	return value
}

function resolveErrorMessage(e: unknown): string
{
	const err = e as any
	if (err !== null && err.message !== null)
	{
		return err.message as string
	}
	return 'Registration failed. Please try again.'
}

function resolveApiErrorMessage(data: any): string
{
	if (data !== null && data.error !== null)
	{
		return data.error as string
	}
	if (data !== null && Array.isArray(data.errors) && data.errors.length > 0)
	{
		const first = data.errors[0]
		if (first !== null && first.msg !== null)
		{
			return first.msg as string
		}
	}
	return 'Registration failed. Please try again.'
}

async function pickDocument(setter: (f: UploadedFile) => void): Promise<void>
{
	if (Platform.OS === 'web')
	{
		await new Promise<void>((resolve) =>
		{
			const input  = document.createElement('input')
			input.type   = 'file'
			input.accept = 'application/pdf,image/jpeg,image/png'

			let settled = false
			const settle = () =>
			{
				if (!settled)
				{
					settled = true
					resolve()
				}
			}
			window.addEventListener('focus', settle, { once: true })

			input.onchange = (e) =>
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
		})
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
			const assetSize    = resolveAssetSize(asset.size)
			const assetMime    = resolveAssetMimeType(asset.mimeType)
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

async function submitRegistration(params: SubmitRegistrationParams): Promise<any>
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

	const data = await response.json()

	if (!response.ok)
	{
		throw new Error(resolveApiErrorMessage(data))
	}

	return data
}

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

function TextFieldInput(props: TextFieldInputProps)
{
	const isMultiline          = props.multiline === true
	const resolvedCapitalize   = props.autoCapitalize !== null ? props.autoCapitalize : 'none'
	const resolvedKeyboardType = props.keyboardType !== null ? props.keyboardType : 'default'
	const resolvedLines        = props.numberOfLines !== null ? props.numberOfLines : 1
	const resolvedPlaceholder  = props.placeholder !== null ? props.placeholder : ''
	const resolvedValue        = props.value !== null ? props.value : ''
	const resolvedOnChange     = props.onChangeText !== null ? props.onChangeText : (_v: string) =>
	{
	}

	return (
		<View className={`flex-row items-${isMultiline ? 'start' : 'center'} bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5`}>
			{props.icon !== null && (
				<MaterialCommunityIcons
					name={props.icon}
					size={18}
					color="#9CA3AF"
					style={{ marginRight: 10, marginTop: isMultiline ? 2 : 0 }}
				/>
			)}
			<TextInput
				className="flex-1 text-gray-800 text-sm"
				placeholder={resolvedPlaceholder}
				placeholderTextColor="#9CA3AF"
				value={resolvedValue}
				onChangeText={resolvedOnChange}
				keyboardType={resolvedKeyboardType}
				autoCapitalize={resolvedCapitalize}
				autoCorrect={false}
				multiline={isMultiline}
				numberOfLines={resolvedLines}
				textAlignVertical={isMultiline ? 'top' : 'center'}
				{...(Platform.OS === 'web' ? { autoComplete: 'off' } : {})}
			/>
		</View>
	)
}

function SegmentedControl<T extends string>(props: SegmentedControlProps<T>)
{
	return (
		<View className="flex-row bg-gray-100 rounded-full p-1">
			{props.options.map((opt) =>
			{
				const active = props.value !== null && opt.value !== null && props.value === opt.value
				return (
					<TouchableOpacity
						key={opt.value !== null ? opt.value : ''}
						className={`flex-1 flex-row items-center justify-center py-2.5 rounded-full ${
							active ? 'bg-white shadow-sm' : 'bg-transparent'
						}`}
						onPress={() =>
						{
							if (props.onChange !== null && opt.value !== null)
							{
								props.onChange(opt.value)
							}
						}}
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
			})}
		</View>
	)
}

function UploadBox(props: UploadBoxProps)
{
	const webCursorStyle = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null

	return (
		<TouchableOpacity
			onPress={props.onPress !== null ? props.onPress : () =>
			{
			}}
			className="bg-gray-50 border border-dashed border-gray-300 rounded-xl py-6 items-center justify-center"
			activeOpacity={0.7}
			style={webCursorStyle}
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
					<View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mb-2">
						<MaterialCommunityIcons name="upload-outline" size={22} color="#9CA3AF" />
					</View>
					<Text className="text-gray-600 text-sm font-medium">
						{Platform.OS === 'web' ? 'Click to upload or drag and drop' : 'Tap to select a file'}
					</Text>
					<Text className="text-gray-400 text-xs mt-1">PDF, JPG or PNG (Max 5 MB)</Text>
				</>
			)}
		</TouchableOpacity>
	)
}

export default function RegisterBusinessScreen()
{
	const router = useRouter()

	const [companyName,       setCompanyName]       = useState<string>('')
	const [ssmNumber,         setSsmNumber]         = useState<string>('')
	const [entityType,        setEntityType]        = useState<EntityType>('sdn_bhd')
	const [registeredAddress, setRegisteredAddress] = useState<string>('')
	const [icPassport,        setIcPassport]        = useState<string>('')
	const [directorRole,      setDirectorRole]      = useState<DirectorRole>('director')
	const [ownershipPct,      setOwnershipPct]      = useState<string>('')
	const [registeredEmail,   setRegisteredEmail]   = useState<string>('')
	const [ssmDoc,            setSsmDoc]            = useState<UploadedFile | null>(null)
	const [icDoc,             setIcDoc]             = useState<UploadedFile | null>(null)
	const [isSubmitting,      setIsSubmitting]      = useState<boolean>(false)
	const [errorMessage,      setErrorMessage]      = useState<string | null>(null)
	const [successBanner,     setSuccessBanner]     = useState<boolean>(false)

	async function handlePickDocument(setter: (f: UploadedFile) => void)
	{
		await pickDocument(setter)
	}

	async function handleSubmit()
	{
		setErrorMessage(null)
		setIsSubmitting(true)

		try
		{
			const globalAny   = global as any
			const globalToken = globalAny.__accessToken
			const accessToken = globalToken !== null
				? (globalToken as string)
				: 'REPLACE_WITH_REAL_TOKEN'

			const params             = createSubmitRegistrationParams()
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
			params.icDoc             = icDoc !== null ? icDoc : createUploadedFile()

			await submitRegistration(params)
			setSuccessBanner(true)
			setTimeout(() => router.replace('/' as any), 1800)
		}
		catch (e)
		{
			setErrorMessage(resolveErrorMessage(e))
		}
		finally
		{
			setIsSubmitting(false)
		}
	}

	const webContainerClass = Platform.OS === 'web' ? 'max-w-[680px] w-full self-center pb-6' : ''
	const webSubmitStyle    = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null

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
									onChangeText={setCompanyName}
									autoCapitalize="words"
									keyboardType={null}
									multiline={null}
									numberOfLines={null}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Company Registration Number (SSM)" optional={null} />
								<TextFieldInput
									icon="pound"
									placeholder="e.g., 202301234567"
									value={ssmNumber}
									onChangeText={setSsmNumber}
									keyboardType="default"
									autoCapitalize={null}
									multiline={null}
									numberOfLines={null}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Entity Type" optional={null} />
								<SegmentedControl<EntityType>
									options={[
										{ value: 'sdn_bhd',        label: 'Sdn Bhd',         icon: null },
										{ value: 'sole_proprietor', label: 'Sole Proprietor',  icon: null },
									]}
									value={entityType}
									onChange={setEntityType}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Registered Address" optional={null} />
								<TextFieldInput
									icon="map-marker-outline"
									placeholder="Enter registered business address"
									value={registeredAddress}
									onChangeText={setRegisteredAddress}
									autoCapitalize="sentences"
									keyboardType={null}
									multiline={true}
									numberOfLines={3}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Registered Email" optional={null} />
								<TextFieldInput
									icon="email-outline"
									placeholder="Enter your registered email address"
									value={registeredEmail}
									onChangeText={setRegisteredEmail}
									keyboardType="email-address"
									autoCapitalize="none"
									multiline={null}
									numberOfLines={null}
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
									onChangeText={setIcPassport}
									keyboardType={null}
									autoCapitalize={null}
									multiline={null}
									numberOfLines={null}
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
									onChange={setDirectorRole}
								/>
							</View>

							<View className="mb-5">
								<FieldLabel label="Ownership Percentage" optional={true} />
								<TextFieldInput
									icon="percent-outline"
									placeholder="e.g., 100"
									value={ownershipPct}
									onChangeText={setOwnershipPct}
									keyboardType="numeric"
									autoCapitalize={null}
									multiline={null}
									numberOfLines={null}
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
									onPress={() => handlePickDocument(setSsmDoc)}
								/>
							</View>

							<View className="mb-6">
								<FieldLabel label="Director IC / Passport Copy" optional={null} />
								<UploadBox
									file={icDoc}
									onPress={() => handlePickDocument(setIcDoc)}
								/>
							</View>

							{successBanner && (
								<View className="mb-5 px-4 py-3 bg-green-50 border border-green-200 rounded-xl flex-row items-center">
									<MaterialCommunityIcons
										name="check-circle-outline"
										size={18}
										color="#16a34a"
										style={{ marginRight: 8 }}
									/>
									<Text className="text-green-700 text-sm font-medium flex-1">
										Registration submitted! Redirecting…
									</Text>
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

							<TouchableOpacity
								className="bg-blue-600 rounded-2xl py-4 items-center mb-6 shadow-md shadow-blue-300"
								onPress={handleSubmit}
								disabled={isSubmitting || successBanner}
								style={webSubmitStyle}
							>
								{isSubmitting ? (
									<ActivityIndicator color="#fff" />
								) : (
									<Text className="text-white text-base font-semibold tracking-wide">
										Submit Registration
									</Text>
								)}
							</TouchableOpacity>

							<View className="flex-row justify-center">
								<Text className="text-gray-500 text-sm">Already have an account? </Text>
								<TouchableOpacity onPress={() => router.replace('/login' as any)}>
									<Text className="text-blue-600 text-sm font-semibold">Sign In</Text>
								</TouchableOpacity>
							</View>

						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</View>
	)
}