import nodemailer from 'nodemailer'

type RejectionTransportAuth =
{
	user: string
	pass: string
}

type RejectionTransportConfig =
{
	host:   string
	port:   number
	secure: boolean
	auth:   RejectionTransportAuth
}

// Builds the nodemailer transport configuration from environment variables for the rejection mailer.
function buildRejectionTransportConfig(): RejectionTransportConfig
{
	const host   = process.env.SMTP_HOST !== undefined ? process.env.SMTP_HOST : ''
	const port   = process.env.SMTP_PORT !== undefined ? parseInt(process.env.SMTP_PORT, 10) : 587
	const user   = process.env.SMTP_USER !== undefined ? process.env.SMTP_USER : ''
	const pass   = process.env.SMTP_PASS !== undefined ? process.env.SMTP_PASS : ''
	const secure = port === 465
	return { host, port, secure, auth: { user, pass } }
}

// Creates and returns a nodemailer transporter dedicated to the rejection email service.
function createRejectionTransporter()
{
	const config = buildRejectionTransportConfig()
	return nodemailer.createTransport(config)
}

const rejectionTransporter = createRejectionTransporter()

// Builds the plain-text fallback body for the rejection notification email.
function buildRejectionTextBody(reviewNote: string): string
{
	const noteSection = reviewNote !== ''
		? `Reason provided:\n\n  ${reviewNote}\n`
		: 'No specific reason was provided.\n'

	return [
		'Your business registration on CorpPay has been reviewed and was not approved.',
		'',
		noteSection,
		'If you believe this decision was made in error, please contact our support team.',
		'',
		'If you did not submit a business registration, you can safely ignore this email.',
	].join('\n')
}

// Builds the HTML body for the rejection notification email.
function buildRejectionHtmlBody(reviewNote: string): string
{
	const noteBlock = reviewNote !== ''
		? `
			<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 18px;margin:20px 0;">
				<p style="color:#991B1B;font-size:13px;font-weight:600;margin:0 0 6px;">Reason provided</p>
				<p style="color:#7F1D1D;font-size:14px;margin:0;">${reviewNote}</p>
			</div>
		`
		: `<p style="color:#475569;font-size:14px;margin:12px 0;">No specific reason was provided.</p>`

	return `
		<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
			<div style="background:#2563EB;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
				<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">CorpPay</span>
			</div>
			<h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Your registration was not approved</h2>
			<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 4px;">
				Thank you for submitting your business registration. After review, we were unable to approve your application at this time.
			</p>
			${noteBlock}
			<p style="color:#475569;font-size:14px;line-height:1.6;margin:16px 0 0;">
				If you believe this decision was made in error, please contact our support team.
			</p>
			<p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">
				If you did not submit a business registration, you can safely ignore this email.
			</p>
		</div>
	`
}

export type SendRejectionEmailParams =
{
	toAddress:  string
	reviewNote: string
}

// Creates a fully initialized SendRejectionEmailParams with empty string defaults.
export function createSendRejectionEmailParams(): SendRejectionEmailParams
{
	return { toAddress: '', reviewNote: '' }
}

// Sends a rejection notification email informing the applicant their registration was not approved.
export async function sendRejectionEmail(params: SendRejectionEmailParams): Promise<void>
{
	const from     = process.env.SMTP_FROM !== undefined ? process.env.SMTP_FROM : ''
	const textBody = buildRejectionTextBody(params.reviewNote)
	const htmlBody = buildRejectionHtmlBody(params.reviewNote)

	await rejectionTransporter.sendMail
	({
		from,
		to:      params.toAddress,
		subject: 'CorpPay — Update on your business registration',
		text:    textBody,
		html:    htmlBody,
	})
}