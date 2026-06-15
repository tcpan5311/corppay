import axios from 'axios'

// Signs in the seed user against the local auth endpoint and logs the returned tokens.
async function signIn(): Promise<void>
{
	try
	{
		const response = await axios.post
		(
			'http://localhost:5000/auth/login',
			{
				email: 'tc.pan@corppay.com',
				password: 'Test123456',
				role: 'user',
			},
		)

		console.log('✅ LOGIN SUCCESS')
		console.log('Access Token:', response.data.accessToken)
		console.log('Refresh Token:', response.data.refreshToken)
		console.log('User:', response.data.user)
	}
	catch (error: unknown)
	{
		console.error(error)
	}
}

signIn()
