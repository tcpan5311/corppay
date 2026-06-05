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

// Resolves an environment variable as a string, returning the given fallback when absent.
function resolveEnv(name: string, fallback: string): string
{
	const value = process.env[name]
	return typeof value === 'string' ? value : fallback
}

// Builds the nodemailer transport configuration from environment variables for the user onboarding mailer.
function buildOnboardingTransportConfig(): OnboardingTransportConfig
{
	const host   = resolveEnv('SMTP_HOST', '')
	const port   = parseInt(resolveEnv('SMTP_PORT', '587'), 10)
	const user   = resolveEnv('SMTP_USER', '')
	const pass   = resolveEnv('SMTP_PASS', '')
	const secure = port === 465
	return { host, port, secure, auth: { user, pass } }
}

// Creates and returns a nodemailer transporter dedicated to the user onboarding email service.
function createOnboardingTransporter()
{
	const config = buildOnboardingTransportConfig()
	return nodemailer.createTransport(config)
}

const onboardingTransporter = createOnboardingTransporter()

// Constructs the full user onboarding password-setup URL for the given token.
function buildPasswordSetupUrl(token: string): string
{
	const base = resolveEnv('FRONTEND_URL', '')
	return `${base}/user/onboarding/set-user-password?token=${token}`
}

// Builds the plain-text fallback body for the user onboarding approval email.
function buildOnboardingTextBody(setupUrl: string, role: string, department: string): string
{
	return [
		'Your CorpPay application has been approved.',
		'',
		`You have been assigned the role of "${role}" in the "${department}" department.`,
		'',
		'Please visit the link below to set your password and complete your account setup.',
		'This link expires in 24 hours.',
		'',
		setupUrl,
		'',
		'If you did not submit an application, you can safely ignore this email.',
	].join('\n')
}

// Builds the HTML body for the user onboarding approval email.
function buildOnboardingHtmlBody(setupUrl: string, role: string, department: string): string
{
	return `
		<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px;">
			<div style="background:#2563EB;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
				<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px;">CorpPay</span>
			</div>
			<h2 style="color:#1e293b;font-size:18px;margin:0 0 8px;">Your application has been approved!</h2>
			<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">
				Congratulations — your application has been reviewed and approved. You have been assigned
				the role of <strong>${role}</strong> in the <strong>${department}</strong> department.
				Click the button below to set your account password and complete onboarding.
				This link expires in <strong>24 hours</strong>.
			</p>
			<a href="${setupUrl}"
				style="display:inline-block;background:#059669;color:#fff;text-decoration:none;
					padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
				Set Up My Account
			</a>
			<p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">
				If you did not submit an application, you can safely ignore this email.
			</p>
		</div>
	`
}

export type SendUserOnboardingEmailParams =
{
	toAddress:  string
	token:      string
	role:       string
	department: string
}

// Creates a fully initialized SendUserOnboardingEmailParams with empty string defaults.
export function createSendUserOnboardingEmailParams(): SendUserOnboardingEmailParams
{
	return { toAddress: '', token: '', role: '', department: '' }
}

// Sends an approval email containing a secure 24-hour password-setup link and the assigned role and department.
export async function sendUserOnboardingEmail(params: SendUserOnboardingEmailParams): Promise<void>
{
	const from     = resolveEnv('SMTP_FROM', '')
	const setupUrl = buildPasswordSetupUrl(params.token)
	const textBody = buildOnboardingTextBody(setupUrl, params.role, params.department)
	const htmlBody = buildOnboardingHtmlBody(setupUrl, params.role, params.department)

	await onboardingTransporter.sendMail({
		from,
		to:      params.toAddress,
		subject: 'CorpPay — Your application is approved. Set up your account.',
		text:    textBody,
		html:    htmlBody,
	})
}