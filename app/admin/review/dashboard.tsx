import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
	ActivityIndicator,
	Modal,
	Platform,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from 'react-native'

const API_BASE = process.env.EXPO_PUBLIC_API_URL

// ─── Domain types ─────────────────────────────────────────────────────────────

type DirectorRecord =
{
	icPassport:   string | null
	role:         string | null
	ownershipPct: number | null
}

// Creates a fully initialized DirectorRecord with all fields set to null.
function createDirectorRecord(): DirectorRecord
{
	return { icPassport: null, role: null, ownershipPct: null }
}

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

type CompanyRecord =
{
	_id:               string
	name:              string
	ssmNumber:         string
	entityType:        string
	registeredAddress: string
	director:          DirectorRecord
	documents:         DocumentRecord[]
	status:            string
	submittedBy:       string
	reviewedBy:        string | null
	reviewedAt:        string | null
	reviewNote:        string | null
	createdAt:         string
	updatedAt:         string
}

// Creates a fully initialized CompanyRecord with empty string defaults and a null director.
function createCompanyRecord(): CompanyRecord
{
	return {
		_id:               '',
		name:              '',
		ssmNumber:         '',
		entityType:        '',
		registeredAddress: '',
		director:          createDirectorRecord(),
		documents:         [],
		status:            '',
		submittedBy:       '',
		reviewedBy:        null,
		reviewedAt:        null,
		reviewNote:        null,
		createdAt:         '',
		updatedAt:         '',
	}
}

type DocPreviewState =
{
	visible:  boolean
	blobUrl:  string
	filename: string
	mimeType: string
	loading:  boolean
	error:    string
}

// Creates a fully initialized DocPreviewState defaulting to hidden with empty strings.
function createDocPreviewState(): DocPreviewState
{
	return {
		visible:  false,
		blobUrl:  '',
		filename: '',
		mimeType: '',
		loading:  false,
		error:    '',
	}
}

type StatsCardProps =
{
	label: string
	count: number
	color: string
}

// Creates a fully initialized StatsCardProps with empty label, zero count and empty color.
function createStatsCardProps(): StatsCardProps
{
	return { label: '', count: 0, color: '' }
}

type CompanyCardProps =
{
	company:      CompanyRecord
	adminToken:   string
	onPreviewDoc: (doc: DocumentRecord, token: string) => void
}

// Creates a fully initialized CompanyCardProps with a blank company record and no-op handler.
function createCompanyCardProps(): CompanyCardProps
{
	return {
		company:      createCompanyRecord(),
		adminToken:   '',
		onPreviewDoc: (_doc, _token) => {},
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Reads the admin token stored on the global object, returning an empty string when absent.
function resolveAdminToken(): string
{
	const g     = global as Record<string, unknown>
	const token = g['__adminToken']
	return typeof token === 'string' ? token : ''
}

// Clears the admin token from the global object.
function clearAdminToken(): void
{
	const g                = global as Record<string, unknown>
	g['__adminToken']      = ''
}

// Formats an ISO date string into a locale-aware readable string, returning an em-dash on failure.
function formatDate(iso: string): string
{
	if (iso === '') return '—'
	try   { return new Date(iso).toLocaleString() }
	catch { return iso }
}

// Returns the hex color string associated with the given registration status.
function resolveStatusColor(status: string): string
{
	if (status === 'approved') return '#059669'
	if (status === 'rejected') return '#DC2626'
	return '#D97706'
}

// Returns the background color string associated with the given registration status.
function resolveStatusBg(status: string): string
{
	if (status === 'approved') return '#ECFDF5'
	if (status === 'rejected') return '#FEF2F2'
	return '#FFFBEB'
}

// Returns a human-readable entity type label for display.
function resolveEntityLabel(entityType: string): string
{
	if (entityType === 'sdn_bhd')         return 'Sdn Bhd'
	if (entityType === 'sole_proprietor') return 'Sole Proprietor'
	return entityType
}

// Returns a human-readable document label derived from the stored field name.
function resolveDocLabel(fieldName: string | null): string
{
	if (fieldName === 'ssm_cert')    return 'SSM Certificate'
	if (fieldName === 'director_ic') return 'Director IC / Passport'
	return fieldName !== null ? fieldName : 'Document'
}

// Extracts the filename component from a storage path string, returning empty string on failure.
function extractFilename(storagePath: string | null): string
{
	if (!storagePath) return ''

	return storagePath
		.split(/[/\\]/)   // handles BOTH / and \
		.pop() ?? ''
}

// Formats a byte count as a human-readable size string.
function formatBytes(bytes: number | null): string
{
	if (bytes === null || bytes === 0) return '—'
	if (bytes < 1024)                  return `${bytes} B`
	if (bytes < 1048576)               return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1048576).toFixed(1)} MB`
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

// ─── API ──────────────────────────────────────────────────────────────────────

// Fetches all company records from the admin API using the given token.
async function fetchCompanies(token: string): Promise<CompanyRecord[]>
{
	const response = await fetch(`${API_BASE}/admin/review/companies`, {
		headers: { 'x-admin-token': token },
	})

	if (!response.ok)
	{
		const data = (await response.json()) as Record<string, unknown>
		const msg  = typeof data['error'] === 'string' ? data['error'] : 'Failed to load companies.'
		throw new Error(msg)
	}

	const data    = (await response.json()) as Record<string, unknown>
	const rawList = data['companies']
	if (!Array.isArray(rawList)) return []
	return rawList as CompanyRecord[]
}

// Fetches a document file by filename and returns a blob object URL for inline display.
async function fetchDocumentBlob(token: string, filename: string): Promise<string>
{
	const response = await fetch(`${API_BASE}/admin/review/file/${filename}`, {
		headers: { 'x-admin-token': token },
	})

	if (!response.ok)
	{
		throw new Error('Failed to load document. The file may have been moved or deleted.')
	}

	const blob = await response.blob()
	return URL.createObjectURL(blob)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Renders a statistics summary card showing a label, count, and accent color.
function StatsCard(props: StatsCardProps)
{
	return (
		<View
			className="flex-1 bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm items-center"
			style={{ minWidth: 72 }}
		>
			<Text className="text-gray-500 text-xs mb-1">{props.label}</Text>
			<Text className="text-xl font-bold" style={{ color: props.color }}>
				{props.count}
			</Text>
		</View>
	)
}

// Renders a labeled detail row used inside company info sections.
function DetailRow({ label, value }: { label: string; value: string })
{
	return (
		<View className="mb-2">
			<Text className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">{label}</Text>
			<Text className="text-gray-800 text-sm">{value !== '' ? value : '—'}</Text>
		</View>
	)
}

// Renders a single company registration as a card with all fields and document preview controls.
function CompanyCard(props: CompanyCardProps)
{
	const { company, adminToken, onPreviewDoc } = props

	const statusColor = resolveStatusColor(company.status)
	const statusBg    = resolveStatusBg(company.status)
	const isWeb       = Platform.OS === 'web'

	return (
		<View className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">

			{/* Card header */}
			<View className="px-5 py-4 border-b border-gray-100 flex-row items-start justify-between">
				<View className="flex-1 mr-3">
					<Text className="text-gray-900 text-base font-bold" numberOfLines={1}>
						{company.name}
					</Text>
					<Text className="text-gray-400 text-xs mt-0.5">{company.ssmNumber}</Text>
				</View>
				<View
					className="rounded-full px-3 py-1"
					style={{ backgroundColor: statusBg }}
				>
					<Text className="text-xs font-semibold capitalize" style={{ color: statusColor }}>
						{company.status}
					</Text>
				</View>
			</View>

			<View className="px-5 py-4">

				{/* Company information */}
				<View className="mb-4">
					<View className="flex-row items-center mb-3">
						<View className="w-6 h-6 bg-blue-50 rounded-lg items-center justify-center mr-2">
							<MaterialCommunityIcons name="office-building-outline" size={14} color="#2563EB" />
						</View>
						<Text className="text-gray-700 text-sm font-semibold">Company Information</Text>
					</View>

					<View className="bg-gray-50 rounded-xl px-4 py-3">
						<DetailRow label="Entity Type"         value={resolveEntityLabel(company.entityType)} />
						<DetailRow label="Registered Address"  value={company.registeredAddress} />
						<DetailRow label="Submitted By"        value={company.submittedBy} />
						<DetailRow label="Submitted At"        value={formatDate(company.createdAt)} />
					</View>
				</View>

				{/* Director information */}
				<View className="mb-4">
					<View className="flex-row items-center mb-3">
						<View className="w-6 h-6 bg-purple-50 rounded-lg items-center justify-center mr-2">
							<MaterialCommunityIcons name="account-outline" size={14} color="#7C3AED" />
						</View>
						<Text className="text-gray-700 text-sm font-semibold">Director Information</Text>
					</View>

					<View className="bg-gray-50 rounded-xl px-4 py-3">
						<DetailRow
							label="IC / Passport"
							value={company.director.icPassport !== null ? company.director.icPassport : ''}
						/>
						<DetailRow
							label="Role"
							value={company.director.role !== null ? company.director.role : ''}
						/>
						<DetailRow
							label="Ownership %"
							value={
								company.director.ownershipPct !== null
									? `${company.director.ownershipPct}%`
									: 'Not specified'
							}
						/>
					</View>
				</View>

				{/* Documents */}
				{company.documents.length > 0 && (
					<View>
						<View className="flex-row items-center mb-3">
							<View className="w-6 h-6 bg-green-50 rounded-lg items-center justify-center mr-2">
								<MaterialCommunityIcons name="file-document-outline" size={14} color="#059669" />
							</View>
							<Text className="text-gray-700 text-sm font-semibold">Documents</Text>
						</View>

						{company.documents.map(
							(doc, idx) =>
							{
								const filename = extractFilename(doc.storagePath)
								const label    = resolveDocLabel(doc.fieldName)

								return (
									<View
										key={`${company._id}-doc-${idx}`}
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
											<Text className="text-gray-400 text-xs">
												{formatBytes(doc.sizeBytes)}
											</Text>
										</View>

										{isWeb && filename !== '' && (
											<TouchableOpacity
												onPress={() => onPreviewDoc(doc, adminToken)}
												className="bg-blue-600 rounded-xl px-3 py-2 flex-row items-center"
												style={{ cursor: 'pointer' } as object}
												accessibilityRole="button"
												accessibilityLabel={`Preview ${label}`}
											>
												<MaterialCommunityIcons
													name="eye-outline"
													size={14}
													color="#FFFFFF"
													style={{ marginRight: 4 }}
												/>
												<Text className="text-white text-xs font-semibold">Preview</Text>
											</TouchableOpacity>
										)}

										{!isWeb && filename !== '' && (
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

				{/* Review note */}
				{company.reviewNote !== null && (
					<View className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
						<Text className="text-amber-700 text-xs font-semibold mb-1">Review Note</Text>
						<Text className="text-amber-800 text-sm">{company.reviewNote}</Text>
					</View>
				)}

			</View>
		</View>
	)
}

// ─── Screen ───────────────────────────────────────────────────────────────────

// Renders the admin review dashboard displaying all company registrations with document preview support.
export default function AdminDashboardScreen()
{
	const router = useRouter()

	const [companies,  setCompanies]  = useState<CompanyRecord[]>([])
	const [loading,    setLoading]    = useState<boolean>(true)
	const [fetchError, setFetchError] = useState<string>('')
	const [preview,    setPreview]    = useState<DocPreviewState>(createDocPreviewState())

	const adminToken = resolveAdminToken()

	useEffect(
		() =>
		{
			if (adminToken === '')
			{
				router.replace('/admin/review' as never)
				return
			}
			loadCompanies()
		},
		[]
	)

	// Loads all companies from the API and updates state.
	async function loadCompanies(): Promise<void>
	{
		setLoading(true)
		setFetchError('')
		try
		{
			const result = await fetchCompanies(adminToken)
			setCompanies(result)
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

	// Initiates the document preview flow by fetching the file blob and opening the preview modal.
	async function handlePreviewDoc(doc: DocumentRecord, token: string): Promise<void>
	{
		const filename = extractFilename(doc.storagePath)
		if (filename === '') return

		const mimeType = doc.mimeType !== null ? doc.mimeType : 'application/octet-stream'

		setPreview({
			visible:  true,
			blobUrl:  '',
			filename,
			mimeType,
			loading:  true,
			error:    '',
		})

		try
		{
			const blobUrl = await fetchDocumentBlob(token, filename)
			setPreview((prev) => ({ ...prev, blobUrl, loading: false }))
		}
		catch (e)
		{
			setPreview((prev) => ({
				...prev,
				loading: false,
				error:   resolveErrorMessage(e),
			}))
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

	// Clears the stored admin token and navigates back to the token gate.
	function handleLogout(): void
	{
		clearAdminToken()
		router.replace('/admin/review' as never)
	}

	const pendingCount  = companies.filter((c) => c.status === 'pending').length
	const approvedCount = companies.filter((c) => c.status === 'approved').length
	const rejectedCount = companies.filter((c) => c.status === 'rejected').length

	const webContainerCls  = Platform.OS === 'web' ? 'max-w-[900px] w-full self-center' : ''
	const webLogoutCursor  = Platform.OS === 'web' ? { cursor: 'pointer' } : null
	const webRefreshCursor = Platform.OS === 'web' ? { cursor: 'pointer' } : null

	return (
		<View className="flex-1 bg-[#F9FAFB]">

			{/* Header */}
			<View className="bg-gray-900 px-6 pt-12 pb-5 flex-row items-center justify-between">
				<View>
					<Text className="text-white text-xl font-bold">Admin Review</Text>
					<Text className="text-gray-400 text-sm mt-0.5">
						Company Registration Submissions
					</Text>
				</View>
				<View className="flex-row items-center">
					<TouchableOpacity
						onPress={loadCompanies}
						className="w-9 h-9 bg-gray-700 rounded-xl items-center justify-center mr-2"
						style={webRefreshCursor as object}
						accessibilityRole="button"
						accessibilityLabel="Refresh"
					>
						<MaterialCommunityIcons name="refresh" size={18} color="#9CA3AF" />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={handleLogout}
						className="flex-row items-center bg-gray-700 rounded-xl px-4 py-2"
						style={webLogoutCursor as object}
						accessibilityRole="button"
						accessibilityLabel="Logout"
					>
						<MaterialCommunityIcons
							name="logout"
							size={16}
							color="#9CA3AF"
							style={{ marginRight: 6 }}
						/>
						<Text className="text-gray-300 text-sm">Logout</Text>
					</TouchableOpacity>
				</View>
			</View>

			<ScrollView
				className="flex-1"
				contentContainerStyle={{ flexGrow: 1 }}
				showsVerticalScrollIndicator={false}
			>
				<View className={webContainerCls}>
					<View className="px-6 pt-6 pb-12">

						{/* Stats row */}
						<View className="flex-row mb-6" style={{ gap: 10 }}>
							<StatsCard label="Total"    count={companies.length} color="#2563EB" />
							<StatsCard label="Pending"  count={pendingCount}     color="#D97706" />
							<StatsCard label="Approved" count={approvedCount}    color="#059669" />
							<StatsCard label="Rejected" count={rejectedCount}    color="#DC2626" />
						</View>

						{/* Loading state */}
						{loading && (
							<View className="flex-1 items-center justify-center py-24">
								<ActivityIndicator size="large" color="#2563EB" />
								<Text className="text-gray-500 mt-4 text-sm">Loading registrations…</Text>
							</View>
						)}

						{/* Error state */}
						{!loading && fetchError !== '' && (
							<View className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-5 flex-row items-start">
								<MaterialCommunityIcons
									name="alert-circle-outline"
									size={18}
									color="#DC2626"
									style={{ marginRight: 8, marginTop: 1 }}
								/>
								<View className="flex-1">
									<Text className="text-red-700 text-sm font-semibold mb-1">
										Failed to load data
									</Text>
									<Text className="text-red-600 text-sm">{fetchError}</Text>
								</View>
							</View>
						)}

						{/* Empty state */}
						{!loading && fetchError === '' && companies.length === 0 && (
							<View className="items-center justify-center py-24">
								<View className="w-16 h-16 bg-gray-100 rounded-2xl items-center justify-center mb-4">
									<MaterialCommunityIcons name="inbox-outline" size={32} color="#D1D5DB" />
								</View>
								<Text className="text-gray-500 text-base font-medium">No submissions yet</Text>
								<Text className="text-gray-400 text-sm mt-1">
									Company registrations will appear here
								</Text>
							</View>
						)}

						{/* Company cards */}
						{!loading && fetchError === '' && companies.map(
							(company) => (
								<CompanyCard
									key={company._id}
									company={company}
									adminToken={adminToken}
									onPreviewDoc={handlePreviewDoc}
								/>
							)
						)}

					</View>
				</View>
			</ScrollView>

			{/* Document preview modal (web only) */}
			{Platform.OS === 'web' && (
				<Modal
					transparent
					animationType="fade"
					visible={preview.visible}
					onRequestClose={handleClosePreview}
				>
					<View
						style={{
							flex:            1,
							backgroundColor: 'rgba(0,0,0,0.75)',
							alignItems:      'center',
							justifyContent:  'center',
							padding:         24,
						}}
					>
						<View
							style={{
								backgroundColor: '#FFFFFF',
								borderRadius:    16,
								width:           '100%',
								maxWidth:        820,
								height:          '88%',
								overflow:        'hidden',
							}}
						>
							{/* Modal header */}
							<View
								style={{
									flexDirection:    'row',
									alignItems:       'center',
									justifyContent:   'space-between',
									paddingHorizontal: 20,
									paddingVertical:   14,
									borderBottomWidth: 1,
									borderBottomColor: '#E5E7EB',
								}}
							>
								<View className="flex-row items-center flex-1 mr-3">
									<MaterialCommunityIcons
										name="file-document-outline"
										size={18}
										color="#6B7280"
										style={{ marginRight: 8 }}
									/>
									<Text
										style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', flex: 1 }}
										numberOfLines={1}
									>
										{preview.filename}
									</Text>
								</View>
								<TouchableOpacity
									onPress={handleClosePreview}
									style={{ padding: 4, cursor: 'pointer' } as object}
									accessibilityRole="button"
									accessibilityLabel="Close preview"
								>
									<MaterialCommunityIcons name="close" size={22} color="#6B7280" />
								</TouchableOpacity>
							</View>

							{/* Modal body */}
							<View style={{ flex: 1 }}>

								{preview.loading && (
									<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
										<ActivityIndicator size="large" color="#2563EB" />
										<Text style={{ color: '#6B7280', marginTop: 12, fontSize: 14 }}>
											Loading document…
										</Text>
									</View>
								)}

								{!preview.loading && preview.error !== '' && (
									<View
										style={{
											flex:           1,
											alignItems:     'center',
											justifyContent: 'center',
											padding:        24,
										}}
									>
										<MaterialCommunityIcons
											name="alert-circle-outline"
											size={40}
											color="#DC2626"
										/>
										<Text
											style={{
												color:     '#DC2626',
												marginTop: 12,
												fontSize:  14,
												textAlign: 'center',
											}}
										>
											{preview.error}
										</Text>
									</View>
								)}

								{!preview.loading && preview.error === '' && preview.blobUrl !== '' && (
									// iframe is valid on web; @ts-ignore suppresses native-only type narrowing
									// @ts-ignore
									<iframe
										src={preview.blobUrl}
										title={preview.filename}
										style={{ width: '100%', height: '100%', border: 'none' }}
									/>
								)}

							</View>
						</View>
					</View>
				</Modal>
			)}

		</View>
	)
}