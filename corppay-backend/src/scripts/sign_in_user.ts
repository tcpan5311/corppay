import axios from 'axios'

async function signIn() 
{
    try 
    {
    const response = await axios.post('http://localhost:5000/auth/login', 
    {
        email: 'tc.pan@corppay.com',
        password: 'Test123456',
        role: 'user'
    })

    console.log('✅ LOGIN SUCCESS')
    console.log('Access Token:', response.data.accessToken)
    console.log('Refresh Token:', response.data.refreshToken)
    console.log('User:', response.data.user)
    } 
    catch (error: any) 
    {
        console.error(error)
    }
}

signIn()