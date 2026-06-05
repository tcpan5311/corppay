import nodemailer from 'nodemailer'

type ResubmissionTransportAuth =
{
	user: string
	pass: string
}

type ResubmissionTransportConfig =
{
	host:   string
	port:   number
	secure: boolean
	auth:   ResubmissionTransportAuth
}

// Resolves an environment variable as a string, returning the given fallback when absent.
function resolveEnv(name: string, fallback: string): string
{
	const value = process.env[name]
	return typeof value === 'string' ? value : fallback
}

// Builds the nodemailer transport configuration from environment variables for the user resubmission mailer.
function buildResubmissionTransportConfig(): ResubmissionTransportConfig
{
	const host   = resolveEnv('SMTP_HOST', '')
	const port   = parseInt(resolveEnv('SMTP_PORT', '587'), 10)
	const user   = resolveEnv('SMTP_USER', '')
	const pass   = resolveEnv('SMTP_PASS', '')
	const secure = port === 465
	return { host, port, secure, auth: { user, pass } }
}

// Creates and returns a nodemailer transporter dedicated to the user resubmission email service.
function createResubmissionTransporter()
{
	const config = buildResubmissionTransportConfig()
	return nodemailer.createTransport(config)
}

const resubmissionTransporter = createResubmissionTransporter()

// Constructs the full user resubmission URL for the given token.
function buildResubmissionUrl(token: string): string
{
	const base = resolveEnv('FRONTEND_URL', '')
	return `${base}/user-resubmit?token=${token}`
}

// Builds the plain-text fallback body for the user resubmission invitation email.
function buildResubmissionTextBody(resubmitUrl: string): string
{
	return [
		'Your CorpPay application has been reviewed.',
		'',
		'An administrator has enabled your application for resubmission.',
		'Please visit the link below to update your details and resubmit for review.',
		'This link expires in 24 hours.',
		'',
		resubmitUrl,
		'',
		'If you did not submit an application, you can safely ignore this email.',
	].join('\n')
}

// Builds the HTML body for the user resubmission invitation email.
function buildResubmissionHtmlBody(resubmitUrl: string): string
{
	return `
		<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
			<div style="background:#2563EB;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
				<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">CorpPay</span>
			</div>
			<h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Your application is open for resubmission</h2>
			<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
				An administrator has reviewed your previous submission and has enabled your application
				for resubmission. Please click the button below to update your details and resubmit
				for review. This link expires in <strong>24 hours</strong>.
			</p>
			<a href="${resubmitUrl}"
				style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;
					padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
				Update and Resubmit
			</a>
			<p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">
				If you did not submit an application, you can safely ignore this email.
			</p>
		</div>
	`
}

export type SendUserResubmissionEmailParams =
{
	toAddress: string
	token:     string
}

// Creates a fully initialized SendUserResubmissionEmailParams with empty string defaults.
export function createSendUserResubmissionEmailParams(): SendUserResubmissionEmailParams
{
	return { toAddress: '', token: '' }
}

// Sends a resubmission invitation email containing a secure 24-hour resubmission link.
export async function sendUserResubmissionEmail(params: SendUserResubmissionEmailParams): Promise<void>
{
	const from        = resolveEnv('SMTP_FROM', '')
	const resubmitUrl = buildResubmissionUrl(params.token)
	const textBody    = buildResubmissionTextBody(resubmitUrl)
	const htmlBody    = buildResubmissionHtmlBody(resubmitUrl)

	await resubmissionTransporter.sendMail({
		from,
		to:      params.toAddress,
		subject: 'CorpPay — Your application is open for resubmission',
		text:    textBody,
		html:    htmlBody,
	})
}