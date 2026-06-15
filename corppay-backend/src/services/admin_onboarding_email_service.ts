import nodemailer from 'nodemailer'

type OnboardingTransportAuth =
{
	user: string
	pass: string
}

type OnboardingTransportConfig =
{
	host:   string
	port:   number
	secure: boolean
	auth:   OnboardingTransportAuth
}

// Builds the nodemailer transport configuration from environment variables for the onboarding mailer.
function buildOnboardingTransportConfig(): OnboardingTransportConfig
{
	const host   = process.env.SMTP_HOST !== undefined ? process.env.SMTP_HOST : ''
	const port   = process.env.SMTP_PORT !== undefined ? parseInt(process.env.SMTP_PORT, 10) : 587
	const user   = process.env.SMTP_USER !== undefined ? process.env.SMTP_USER : ''
	const pass   = process.env.SMTP_PASS !== undefined ? process.env.SMTP_PASS : ''
	const secure = port === 465
	return { host, port, secure, auth: { user, pass } }
}

// Creates and returns a nodemailer transporter dedicated to the onboarding email service.
function createOnboardingTransporter()
{
	const config = buildOnboardingTransportConfig()
	return nodemailer.createTransport(config)
}

const onboardingTransporter = createOnboardingTransporter()

// Constructs the full onboarding password-setup URL for the given token.
function buildPasswordSetupUrl(token: string): string
{
	const base = process.env.FRONTEND_URL !== undefined ? process.env.FRONTEND_URL : ''
	return `${base}/admin/onboarding/set-password?token=${token}`
}

// Builds the plain-text fallback body for the onboarding approval email.
function buildOnboardingTextBody(setupUrl: string): string
{
	return [
		'Your business registration has been approved on CorpPay.',
		'',
		'Please visit the link below to set your password and complete your account setup.',
		'This link expires in 24 hours.',
		'',
		setupUrl,
		'',
		'If you did not submit a business registration, you can safely ignore this email.',
	].join('\n')
}

// Builds the HTML body for the onboarding approval email.
function buildOnboardingHtmlBody(setupUrl: string): string
{
	return `
		<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
			<div style="background:#2563EB;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
				<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">CorpPay</span>
			</div>
			<h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Your registration has been approved!</h2>
			<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
				Congratulations — your business registration has been reviewed and approved.
				Click the button below to set your account password and complete onboarding.
				This link expires in <strong>24 hours</strong>.
			</p>
			<a href="${setupUrl}"
				style="display:inline-block;background:#059669;color:#fff;text-decoration:none;
					padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
				Set Up My Account
			</a>
			<p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">
				If you did not submit a business registration, you can safely ignore this email.
			</p>
		</div>
	`
}

export type SendOnboardingEmailParams =
{
	toAddress: string
	token:     string
}

// Creates a fully initialized SendOnboardingEmailParams with empty string defaults.
export function createSendOnboardingEmailParams(): SendOnboardingEmailParams
{
	return { toAddress: '', token: '' }
}

// Sends an onboarding approval email containing a secure 24-hour password-setup link.
export async function sendOnboardingEmail(params: SendOnboardingEmailParams): Promise<void>
{
	const from     = process.env.SMTP_FROM !== undefined ? process.env.SMTP_FROM : ''
	const setupUrl = buildPasswordSetupUrl(params.token)
	const textBody = buildOnboardingTextBody(setupUrl)
	const htmlBody = buildOnboardingHtmlBody(setupUrl)

	await onboardingTransporter.sendMail
	({
		from,
		to:      params.toAddress,
		subject: 'CorpPay — Your registration is approved. Set up your account.',
		text:    textBody,
		html:    htmlBody,
	})
}