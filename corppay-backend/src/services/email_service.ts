import nodemailer from 'nodemailer'

type TransportAuth =
{
	user: string
	pass: string
}

type TransportConfig =
{
	host:   string
	port:   number
	secure: boolean
	auth:   TransportAuth
}

// Builds the nodemailer transport configuration from environment variables.
function buildTransportConfig(): TransportConfig
{
	const host   = process.env.SMTP_HOST !== undefined ? process.env.SMTP_HOST : ''
	const port   = process.env.SMTP_PORT !== undefined ? parseInt(process.env.SMTP_PORT, 10) : 587
	const user   = process.env.SMTP_USER !== undefined ? process.env.SMTP_USER : ''
	const pass   = process.env.SMTP_PASS !== undefined ? process.env.SMTP_PASS : ''
	const secure = port === 465
	return { host, port, secure, auth: { user, pass } }
}

// Creates and returns a singleton nodemailer transporter configured from environment variables.
function createTransporter()
{
	const config = buildTransportConfig()
	return nodemailer.createTransport(config)
}

const transporter = createTransporter()

// Constructs the full verification URL for the given token.
function buildVerificationUrl(token: string): string
{
	const base = process.env.API_BASE_URL !== undefined ? process.env.API_BASE_URL : ''
	return `${base}/companies/verify-email?token=${token}`
}

// Builds the plain-text fallback body for the verification email.
function buildTextBody(verifyUrl: string): string
{
	return [
		'Thank you for registering with CorpPay.',
		'',
		'Please verify your email address by visiting the link below.',
		'This link expires in 15 minutes.',
		'',
		verifyUrl,
		'',
		'If you did not submit this registration, you can safely ignore this email.',
	].join('\n')
}

// Builds the HTML body for the verification email.
function buildHtmlBody(verifyUrl: string): string
{
	return `
		<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
			<div style="background:#2563EB;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
				<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">CorpPay</span>
			</div>
			<h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Verify your email address</h2>
			<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
				Thank you for submitting a business registration. Click the button below to confirm your
				email address and complete your registration. This link expires in <strong>15 minutes</strong>.
			</p>
			<a href="${verifyUrl}"
				style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;
					padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
				Verify Email
			</a>
			<p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">
				If you did not submit this registration, you can safely ignore this email.
			</p>
		</div>
	`
}

type SendVerificationEmailParams =
{
	toAddress: string
	token:     string
}

// Creates a fully initialized SendVerificationEmailParams with empty string defaults.
export function createSendVerificationEmailParams(): SendVerificationEmailParams
{
	return { toAddress: '', token: '' }
}

// Sends a verification email containing a secure expiring link to the provided address.
export async function sendVerificationEmail(params: SendVerificationEmailParams): Promise<void>
{
	const from      = process.env.SMTP_FROM !== undefined ? process.env.SMTP_FROM : ''
	const verifyUrl = buildVerificationUrl(params.token)
	const textBody  = buildTextBody(verifyUrl)
	const htmlBody  = buildHtmlBody(verifyUrl)

	await transporter.sendMail({
		from,
		to:      params.toAddress,
		subject: 'CorpPay — Verify your email to complete registration',
		text:    textBody,
		html:    htmlBody,
	})
}