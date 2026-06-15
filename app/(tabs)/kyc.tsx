import { useAuth } from '@/context/auth_context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
	ActivityIndicator,
	Modal,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native'

const API_BASE = process.env.EXPO_PUBLIC_API_URL

type DocumentRecord =
{
	fieldName:    string | null
	originalName: string | null
	storagePath:  string | null
	mimeType:     string | null
	sizeBytes:    number | null
	uploadedAt:   string | null
}

// Creates a fully initialized DocumentRecord with all fields set to null.
function createDocumentRecord(): DocumentRecord
{
	return {
		fieldName:    null,
		originalName: null,
		storagePath:  null,
		mimeType:     null,
		sizeBytes:    null,
		uploadedAt:   null,
	}
}

type ApplicationRecord =
{
	_id:                string
	fullName:           string
	dateOfBirth:        string
	nationality:        string
	gender:             string
	email:              string
	mobileNumber:       string
	fullAddress:        string
	documentType:       string
	documents:          DocumentRecord[]
	status:             string
	assignedRole:       string | null
	assignedDepartment: string | null
	reviewNote:         string | null
	createdAt:          string
}

// Creates a fully initialized ApplicationRecord with empty string defaults.
function createApplicationRecord(): ApplicationRecord
{
	return {
		_id:                '',
		fullName:           '',
		dateOfBirth:        '',
		nationality:        '',
		gender:             '',
		email:              '',
		mobileNumber:       '',
		fullAddress:        '',
		documentType:       '',
		documents:          [],
		status:             '',
		assignedRole:       null,
		assignedDepartment: null,
		reviewNote:         null,
		createdAt:          '',
	}
}

type DocPreviewState =
{
	visible:  boolean
	blobUrl:  string
	filename: string
	loading:  boolean
	error:    string
}

// Creates a fully initialized DocPreviewState defaulting to hidden with empty strings.
function createDocPreviewState(): DocPreviewState
{
	return { visible: false, blobUrl: '', filename: '', loading: false, error: '' }
}

type StatsCardProps =
{
	label: string
	count: number
	color: string
}

type ApplicationReviewCardProps =
{
	application:  ApplicationRecord
	accessToken:  string
	onPreviewDoc: (doc: DocumentRecord, token: string) => void
	onRefresh:    () => void
}

// Creates a fully initialized ApplicationReviewCardProps with a blank application and no-op handlers.
function createApplicationReviewCardProps(): ApplicationReviewCardProps
{
	return {
		application:  createApplicationRecord(),
		accessToken:  '',
		onPreviewDoc: (_doc, _token) => {},
		onRefresh:    () => {},
	}
}

// Formats an ISO date string into a readable local date, or an em dash when absent.
function formatDate(iso: string): string
{
	if (iso === '') return '—'
	const d = new Date(iso)
	if (isNaN(d.getTime())) return '—'
	return d.toLocaleDateString()
}

// Formats a byte count into a human-readable string with the appropriate unit.
function formatBytes(bytes: number | null): string
{
	if (bytes === null)  return '—'
	if (bytes < 1024)    return `${bytes} B`
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1048576).toFixed(1)} MB`
}

// Extracts the trailing filename component from a stored document path.
function extractFilename(storagePath: string | null): string
{
	if (storagePath === null || storagePath === '') return ''
	const parts = storagePath.split(/[/\\]/)
	return parts.length > 0 ? parts[parts.length - 1] : ''
}

// Returns a friendly label for a stored document field name.
function resolveDocLabel(fieldName: string | null): string
{
	if (fieldName === 'identity_doc') return 'Identity Document'
	if (fieldName === null || fieldName === '') return 'Document'
	return fieldName
}

// Returns an accent color for the given application status.
function resolveStatusColor(status: string): string
{
	if (status === 'approved') return '#059669'
	if (status === 'rejected') return '#DC2626'
	if (status === 'awaiting_resubmit') return '#7C3AED'
	return '#D97706'
}

// Returns a background tint for the given application status.
function resolveStatusBg(status: string): string
{
	if (status === 'approved') return '#ECFDF5'
	if (status === 'rejected') return '#FEF2F2'
	if (status === 'awaiting_resubmit') return '#F5F3FF'
	return '#FFFBEB'
}

// Returns a human-readable label for an identity document type value.
function resolveDocumentTypeLabel(value: string): string
{
	if (value === 'passport')        return 'Passport'
	if (value === 'national_id')     return 'National ID'
	if (value === 'drivers_license') return "Driver's License"
	return value
}

// Returns a human-readable label for a gender value.
function resolveGenderLabel(value: string): string
{
	if (value === 'male')   return 'Male'
	if (value === 'female') return 'Female'
	return value
}

// Extracts a user-friendly error message from an unknown thrown value.
function resolveErrorMessage(e: unknown): string
{
	if (e !== null && typeof e === 'object' && 'message' in e)
	{
		const msg = (e as Record<string, unknown>)['message']
		if (typeof msg === 'string') return msg
	}
	return 'An unexpected error occurred.'
}

// Fetches the KYC applications targeted at the signed-in admin's own company.
async function fetchApplications(token: string): Promise<ApplicationRecord[]>
{
	const response = await fetch(`${API_BASE}/portal/applications`, {
		headers: { 'Authorization': `Bearer ${token}` },
	})

	if (!response.ok)
	{
		const data = (await response.json()) as Record<string, unknown>
		const msg  = typeof data['error'] === 'string' ? data['error'] : 'Failed to load applications.'
		throw new Error(msg)
	}

	const data    = (await response.json()) as Record<string, unknown>
	const rawList = data['applications']
	if (!Array.isArray(rawList)) return []
	return rawList as ApplicationRecord[]
}

// Fetches a scoped KYC document file and returns a blob object URL for inline display.
async function fetchApplicationFileBlob(token: string, filename: string): Promise<string>
{
	const response = await fetch(`${API_BASE}/portal/applications/file/${filename}`, {
		headers: { 'Authorization': `Bearer ${token}` },
	})

	if (!response.ok)
	{
		throw new Error('Failed to load document. The file may have been moved or deleted.')
	}

	const blob = await response.blob()
	return URL.createObjectURL(blob)
}

// Approves a KYC application for the admin's company, assigning role and department.
async function approveApplication(token: string, id: string, role: string, department: string): Promise<void>
{
	const response = await fetch(`${API_BASE}/portal/applications/${id}/approve`, {
		method:  'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type':  'application/json',
		},
		body: JSON.stringify({ role, department }),
	})

	if (!response.ok)
	{
		const data = (await response.json()) as Record<string, unknown>
		const msg  = typeof data['error'] === 'string' ? data['error'] : 'Approval failed.'
		throw new Error(msg)
	}
}

// Rejects a KYC application for the admin's company, persisting an optional review note.
async function rejectApplication(token: string, id: string, reviewNote: string): Promise<void>
{
	const response = await fetch(`${API_BASE}/portal/applications/${id}/reject`, {
		method:  'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type':  'application/json',
		},
		body: JSON.stringify({ reviewNote }),
	})

	if (!response.ok)
	{
		const data = (await response.json()) as Record<string, unknown>
		const msg  = typeof data['error'] === 'string' ? data['error'] : 'Rejection failed.'
		throw new Error(msg)
	}
}

// Re-enables a rejected KYC application for resubmission.
async function reenableApplication(token: string, id: string): Promise<void>
{
	const response = await fetch(`${API_BASE}/portal/applications/${id}/reenable`, {
		method:  'POST',
		headers: { 'Authorization': `Bearer ${token}` },
	})

	if (!response.ok)
	{
		const data = (await response.json()) as Record<string, unknown>
		const msg  = typeof data['error'] === 'string' ? data['error'] : 'Re-enable failed.'
		throw new Error(msg)
	}
}

// Renders a statistics summary card showing a label, count, and accent color.
function StatsCard(props: StatsCardProps)
{
	return (
		<View className="flex-1 bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm items-center min-w-[64px]">
			<Text className="text-gray-500 text-xs mb-1">{props.label}</Text>
			<Text className="text-xl font-bold" style={{ color: props.color }}>{props.count}</Text>
		</View>
	)
}

// Renders a labeled detail row used inside applicant info sections.
function DetailRow({ label, value }: { label: string; value: string })
{
	return (
		<View className="mb-2">
			<Text className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">{label}</Text>
			<Text className="text-gray-800 text-sm">{value !== '' ? value : '—'}</Text>
		</View>
	)
}

// Renders a single KYC application with applicant info, document preview, and approve/reject/reenable actions.
function ApplicationReviewCard(props: ApplicationReviewCardProps)
{
	const { application, accessToken, onPreviewDoc, onRefresh } = props

	const [isApproving,  setIsApproving]  = useState<boolean>(false)
	const [approveError, setApproveError] = useState<string>('')
	const [isRejecting,  setIsRejecting]  = useState<boolean>(false)
	const [rejectError,  setRejectError]  = useState<string>('')
	const [rejectNote,   setRejectNote]   = useState<string>('')
	const [isReenabling,  setIsReenabling]  = useState<boolean>(false)
	const [reenableError, setReenableError] = useState<string>('')
	const [roleInput,       setRoleInput]       = useState<string>('')
	const [departmentInput, setDepartmentInput] = useState<string>('')

	const statusColor = resolveStatusColor(application.status)
	const statusBg    = resolveStatusBg(application.status)
	const isWeb       = Platform.OS === 'web'

	const isApproveReady = roleInput.trim() !== '' && departmentInput.trim() !== '' && !isApproving && !isRejecting

	// Validates the assignment fields, calls the approve endpoint, and refreshes the list on success.
	async function handleApprove(): Promise<void>
	{
		if (!isApproveReady) return
		setIsApproving(true)
		setApproveError('')
		try
		{
			await approveApplication(accessToken, application._id, roleInput.trim(), departmentInput.trim())
			onRefresh()
		}
		catch (e)
		{
			setApproveError(resolveErrorMessage(e))
			setIsApproving(false)
		}
	}

	// Calls the reject endpoint with the current note and refreshes the list on success.
	async function handleReject(): Promise<void>
	{
		setIsRejecting(true)
		setRejectError('')
		try
		{
			await rejectApplication(accessToken, application._id, rejectNote)
			onRefresh()
		}
		catch (e)
		{
			setRejectError(resolveErrorMessage(e))
			setIsRejecting(false)
		}
	}

	// Calls the re-enable endpoint and refreshes the list on success.
	async function handleReenable(): Promise<void>
	{
		setIsReenabling(true)
		setReenableError('')
		try
		{
			await reenableApplication(accessToken, application._id)
			onRefresh()
		}
		catch (e)
		{
			setReenableError(resolveErrorMessage(e))
			setIsReenabling(false)
		}
	}

	return (
		<View className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">

			<View className="px-5 py-4 border-b border-gray-100 flex-row items-start justify-between">
				<View className="flex-1 mr-3">
					<Text className="text-gray-900 text-base font-bold" numberOfLines={1}>{application.fullName}</Text>
					<Text className="text-gray-400 text-xs mt-0.5">{application.email}</Text>
				</View>
				<View className="rounded-full px-3 py-1" style={{ backgroundColor: statusBg }}>
					<Text className="text-xs font-semibold capitalize" style={{ color: statusColor }}>
						{application.status.replace('_', ' ')}
					</Text>
				</View>
			</View>

			<View className="px-5 py-4">

				<View className="mb-4">
					<View className="flex-row items-center mb-3">
						<View className="w-6 h-6 bg-blue-50 rounded-lg items-center justify-center mr-2">
							<MaterialCommunityIcons name="account-outline" size={14} color="#2563EB" />
						</View>
						<Text className="text-gray-700 text-sm font-semibold">Applicant Information</Text>
					</View>

					<View className="bg-gray-50 rounded-xl px-4 py-3">
						<DetailRow label="Date of Birth" value={application.dateOfBirth} />
						<DetailRow label="Nationality"   value={application.nationality} />
						<DetailRow label="Gender"        value={resolveGenderLabel(application.gender)} />
						<DetailRow label="Mobile Number" value={application.mobileNumber} />
						<DetailRow label="Full Address"  value={application.fullAddress} />
						<DetailRow label="Document Type" value={resolveDocumentTypeLabel(application.documentType)} />
						<DetailRow label="Submitted At"  value={formatDate(application.createdAt)} />
					</View>
				</View>

				{application.status === 'approved' &&
				(
					<View className="mb-4 bg-gray-50 rounded-xl px-4 py-3">
						<DetailRow label="Assigned Role"       value={application.assignedRole !== null ? application.assignedRole : ''} />
						<DetailRow label="Assigned Department" value={application.assignedDepartment !== null ? application.assignedDepartment : ''} />
					</View>
				)}

				{application.documents.length > 0 &&
				(
					<View>
						<View className="flex-row items-center mb-3">
							<View className="w-6 h-6 bg-green-50 rounded-lg items-center justify-center mr-2">
								<MaterialCommunityIcons name="file-document-outline" size={14} color="#059669" />
							</View>
							<Text className="text-gray-700 text-sm font-semibold">Documents</Text>
						</View>

						{application.documents.map
						(
							(doc, idx) =>
							{
								const filename = extractFilename(doc.storagePath)
								const label    = resolveDocLabel(doc.fieldName)

								return (
									<View
										key={`${application._id}-doc-${idx}`}
										className="bg-gray-50 rounded-xl px-4 py-3 mb-2 flex-row items-center"
									>
										<View className="w-9 h-9 bg-blue-50 rounded-xl items-center justify-center mr-3">
											<MaterialCommunityIcons name="file-outline" size={18} color="#2563EB" />
										</View>

										<View className="flex-1 mr-2">
											<Text className="text-gray-800 text-sm font-medium">{label}</Text>
											<Text className="text-gray-400 text-xs" numberOfLines={1}>
												{doc.originalName !== null ? doc.originalName : filename}
											</Text>
											<Text className="text-gray-400 text-xs">{formatBytes(doc.sizeBytes)}</Text>
										</View>

										{isWeb && filename !== '' &&
										(
											<TouchableOpacity
												onPress={() => onPreviewDoc(doc, accessToken)}
												className="bg-blue-600 rounded-xl px-3 py-2 flex-row items-center"
												style={{ cursor: 'pointer' } as object}
												accessibilityRole="button"
												accessibilityLabel={`Preview ${label}`}
											>
												<MaterialCommunityIcons name="eye-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
												<Text className="text-white text-xs font-semibold">Preview</Text>
											</TouchableOpacity>
										)}

										{!isWeb && filename !== '' &&
										(
											<View className="bg-gray-200 rounded-xl px-3 py-2">
												<Text className="text-gray-500 text-xs">Web only</Text>
											</View>
										)}
									</View>
								)
							}
						)}
					</View>
				)}

				{application.reviewNote !== null &&
				(
					<View className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
						<Text className="text-amber-700 text-xs font-semibold mb-1">Review Note</Text>
						<Text className="text-amber-800 text-sm">{application.reviewNote}</Text>
					</View>
				)}

				{application.status === 'pending' &&
				(
					<View className="mt-4">

						<Text className="text-gray-400 text-xs uppercase tracking-wide mb-1.5">Role</Text>
						<TextInput
							value={roleInput}
							onChangeText={setRoleInput}
							placeholder="e.g., Finance Officer"
							placeholderTextColor="#9CA3AF"
							editable={!isApproving && !isRejecting}
							className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-3"
						/>

						<Text className="text-gray-400 text-xs uppercase tracking-wide mb-1.5">Department</Text>
						<TextInput
							value={departmentInput}
							onChangeText={setDepartmentInput}
							placeholder="e.g., Finance"
							placeholderTextColor="#9CA3AF"
							editable={!isApproving && !isRejecting}
							className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-3"
						/>

						{approveError !== '' &&
						(
							<View className="mb-3 flex-row items-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
								<MaterialCommunityIcons name="alert-circle-outline" size={14} color="#DC2626" style={{ marginRight: 8 }} />
								<Text className="text-red-600 text-xs flex-1">{approveError}</Text>
							</View>
						)}
						<TouchableOpacity
							onPress={handleApprove}
							disabled={!isApproveReady}
							className={`rounded-xl py-3 flex-row items-center justify-center mb-4 ${isApproveReady ? 'bg-emerald-600' : 'bg-gray-200'}`}
							style={isWeb ? { cursor: 'pointer' } as object : {}}
							accessibilityRole="button"
							accessibilityLabel="Approve application"
						>
							{isApproving
								? (
									<ActivityIndicator size="small" color="#6B7280" />
								)
								: (
									<>
										<MaterialCommunityIcons name="check-circle-outline" size={16} color={isApproveReady ? '#FFFFFF' : '#9CA3AF'} style={{ marginRight: 6 }} />
										<Text className={`text-sm font-semibold ${isApproveReady ? 'text-white' : 'text-gray-400'}`}>Approve Application</Text>
									</>
								)}
						</TouchableOpacity>

						<View className="border-t border-gray-100 mb-4" />

						<Text className="text-gray-400 text-xs uppercase tracking-wide mb-1.5">Rejection Reason (optional)</Text>
						<TextInput
							value={rejectNote}
							onChangeText={setRejectNote}
							placeholder="Describe why this application is being rejected…"
							placeholderTextColor="#9CA3AF"
							multiline
							numberOfLines={2}
							editable={!isRejecting && !isApproving}
							className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-3"
							style={{ textAlignVertical: 'top' }}
						/>

						{rejectError !== '' &&
						(
							<View className="mb-3 flex-row items-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
								<MaterialCommunityIcons name="alert-circle-outline" size={14} color="#DC2626" style={{ marginRight: 8 }} />
								<Text className="text-red-600 text-xs flex-1">{rejectError}</Text>
							</View>
						)}
						<TouchableOpacity
							onPress={handleReject}
							disabled={isRejecting || isApproving}
							className={`rounded-xl py-3 flex-row items-center justify-center ${isRejecting || isApproving ? 'bg-gray-200' : 'bg-red-600'}`}
							style={isWeb ? { cursor: 'pointer' } as object : {}}
							accessibilityRole="button"
							accessibilityLabel="Reject application"
						>
							{isRejecting
								? (
									<ActivityIndicator size="small" color="#6B7280" />
								)
								: (
									<>
										<MaterialCommunityIcons name="close-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
										<Text className="text-white text-sm font-semibold">Reject Application</Text>
									</>
								)}
						</TouchableOpacity>
					</View>
				)}

				{application.status === 'rejected' &&
				(
					<View className="mt-4">
						{reenableError !== '' &&
						(
							<View className="mb-3 flex-row items-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">
								<MaterialCommunityIcons name="alert-circle-outline" size={14} color="#DC2626" style={{ marginRight: 8 }} />
								<Text className="text-red-600 text-xs flex-1">{reenableError}</Text>
							</View>
						)}
						<TouchableOpacity
							onPress={handleReenable}
							disabled={isReenabling}
							className={`rounded-xl py-3 flex-row items-center justify-center ${isReenabling ? 'bg-gray-200' : 'bg-violet-600'}`}
							style={isWeb ? { cursor: 'pointer' } as object : {}}
							accessibilityRole="button"
							accessibilityLabel="Re-enable application for resubmission"
						>
							{isReenabling
								? (
									<ActivityIndicator size="small" color="#6B7280" />
								)
								: (
									<>
										<MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
										<Text className="text-white text-sm font-semibold">Re-enable for Resubmission</Text>
									</>
								)}
						</TouchableOpacity>
					</View>
				)}

			</View>
		</View>
	)
}

// Renders the company-admin KYC review portal, scoped to the signed-in admin's own company.
export default function KycReviewScreen()
{
	const { user, accessToken } = useAuth()
	const router                = useRouter()

	const [applications, setApplications] = useState<ApplicationRecord[]>([])
	const [loading,      setLoading]      = useState<boolean>(true)
	const [fetchError,   setFetchError]   = useState<string>('')
	const [preview,      setPreview]      = useState<DocPreviewState>(createDocPreviewState())

	const isAdmin = user !== null && user.role === 'admin'

	useEffect
	(
		() =>
		{
			if (!isAdmin) return
			loadApplications()
		},
		[]
	)

	// Loads the company-scoped applications from the portal API and updates state.
	async function loadApplications(): Promise<void>
	{
		setLoading(true)
		setFetchError('')
		try
		{
			const result = await fetchApplications(accessToken)
			setApplications(result)
		}
		catch (e)
		{
			setFetchError(resolveErrorMessage(e))
		}
		finally
		{
			setLoading(false)
		}
	}

	// Fetches a document blob through the scoped portal endpoint and opens the preview modal.
	async function handlePreviewDoc(doc: DocumentRecord, token: string): Promise<void>
	{
		const filename = extractFilename(doc.storagePath)
		if (filename === '') return

		setPreview({ visible: true, blobUrl: '', filename, loading: true, error: '' })

		try
		{
			const blobUrl = await fetchApplicationFileBlob(token, filename)
			setPreview((prev) => ({ ...prev, blobUrl, loading: false }))
		}
		catch (e)
		{
			setPreview((prev) => ({ ...prev, loading: false, error: resolveErrorMessage(e) }))
		}
	}

	// Closes the preview modal and revokes the blob URL to free memory.
	function handleClosePreview(): void
	{
		if (preview.blobUrl !== '')
		{
			URL.revokeObjectURL(preview.blobUrl)
		}
		setPreview(createDocPreviewState())
	}

	// Navigates back to the home screen.
	function handleBackHome(): void
	{
		router.replace('/' as never)
	}

	const pendingCount  = applications.filter((a) => a.status === 'pending').length
	const approvedCount = applications.filter((a) => a.status === 'approved').length
	const rejectedCount = applications.filter((a) => a.status === 'rejected').length
	const webCursor     = Platform.OS === 'web' ? { cursor: 'pointer' } : null

	// Renders an access-restricted notice for non-admin users.
	if (!isAdmin)
	{
		return (
			<View className="flex-1 bg-[#F9FAFB] items-center justify-center px-6">
				<View className="w-16 h-16 bg-gray-100 rounded-2xl items-center justify-center mb-4">
					<MaterialCommunityIcons name="lock-outline" size={32} color="#9CA3AF" />
				</View>
				<Text className="text-gray-900 text-lg font-bold text-center mb-1">Admins only</Text>
				<Text className="text-gray-500 text-sm text-center mb-6">
					KYC review is available to company administrators.
				</Text>
				<TouchableOpacity
					onPress={handleBackHome}
					className="bg-blue-600 rounded-2xl px-6 py-3"
					style={webCursor as object}
					accessibilityRole="button"
				>
					<Text className="text-white text-sm font-semibold">Back to Home</Text>
				</TouchableOpacity>
			</View>
		)
	}

	return (
		<View className="flex-1 bg-[#F9FAFB]">

			<View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
				<View>
					<Text className="text-gray-900 text-xl font-bold">KYC Review</Text>
					<Text className="text-gray-400 text-sm mt-0.5">Applications to join your company</Text>
				</View>
				<TouchableOpacity
					onPress={loadApplications}
					className="w-9 h-9 bg-gray-100 rounded-xl items-center justify-center"
					style={webCursor as object}
					accessibilityRole="button"
					accessibilityLabel="Refresh"
				>
					<MaterialCommunityIcons name="refresh" size={18} color="#6B7280" />
				</TouchableOpacity>
			</View>

			<ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
				<View className="px-6 pt-6 pb-12">

					<View className="flex-row mb-6 gap-2.5">
						<StatsCard label="Total"    count={applications.length} color="#2563EB" />
						<StatsCard label="Pending"  count={pendingCount}        color="#D97706" />
						<StatsCard label="Approved" count={approvedCount}       color="#059669" />
						<StatsCard label="Rejected" count={rejectedCount}       color="#DC2626" />
					</View>

					{loading &&
					(
						<View className="flex-1 items-center justify-center py-24">
							<ActivityIndicator size="large" color="#2563EB" />
							<Text className="text-gray-500 mt-4 text-sm">Loading applications…</Text>
						</View>
					)}

					{!loading && fetchError !== '' &&
					(
						<View className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-5 flex-row items-start">
							<MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
							<View className="flex-1">
								<Text className="text-red-700 text-sm font-semibold mb-1">Failed to load data</Text>
								<Text className="text-red-600 text-sm">{fetchError}</Text>
							</View>
						</View>
					)}

					{!loading && fetchError === '' && applications.length === 0 &&
					(
						<View className="items-center justify-center py-24">
							<View className="w-16 h-16 bg-gray-100 rounded-2xl items-center justify-center mb-4">
								<MaterialCommunityIcons name="inbox-outline" size={32} color="#D1D5DB" />
							</View>
							<Text className="text-gray-500 text-base font-medium">No applications yet</Text>
							<Text className="text-gray-400 text-sm mt-1">Applications to join your company will appear here</Text>
						</View>
					)}

					{!loading && fetchError === '' && applications.map
					(
						(application) =>
						(
							<ApplicationReviewCard
								key={application._id}
								application={application}
								accessToken={accessToken}
								onPreviewDoc={handlePreviewDoc}
								onRefresh={loadApplications}
							/>
						)
					)}

				</View>
			</ScrollView>

			{Platform.OS === 'web' &&
			(
				<Modal transparent animationType="fade" visible={preview.visible} onRequestClose={handleClosePreview}>
					<View className="flex-1 bg-black/75 items-center justify-center p-6">
						<View className="bg-white rounded-2xl w-full max-w-[820px] h-[88%] overflow-hidden">
							<View className="flex-row items-center justify-between px-5 py-3.5 border-b border-gray-200">
								<View className="flex-row items-center flex-1 mr-3">
									<MaterialCommunityIcons name="file-document-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
									<Text className="text-sm font-semibold text-gray-800 flex-1" numberOfLines={1}>{preview.filename}</Text>
								</View>
								<TouchableOpacity
									onPress={handleClosePreview}
									className="p-1"
									style={{ cursor: 'pointer' } as object}
									accessibilityRole="button"
									accessibilityLabel="Close preview"
								>
									<MaterialCommunityIcons name="close" size={22} color="#6B7280" />
								</TouchableOpacity>
							</View>

							<View className="flex-1">
								{preview.loading &&
								(
									<View className="flex-1 items-center justify-center">
										<ActivityIndicator size="large" color="#2563EB" />
										<Text className="text-gray-500 mt-3 text-sm">Loading document…</Text>
									</View>
								)}

								{!preview.loading && preview.error !== '' &&
								(
									<View className="flex-1 items-center justify-center p-6">
										<MaterialCommunityIcons name="alert-circle-outline" size={40} color="#DC2626" />
										<Text className="text-red-600 mt-3 text-sm text-center">{preview.error}</Text>
									</View>
								)}

								{!preview.loading && preview.error === '' && preview.blobUrl !== '' &&
								(
									// @ts-ignore
									<iframe src={preview.blobUrl} title={preview.filename} style={{ width: '100%', height: '100%', border: 'none' }} />
								)}
							</View>
						</View>
					</View>
				</Modal>
			)}

		</View>
	)
}