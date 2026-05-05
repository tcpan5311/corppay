const os = require("os")
const fs = require("fs")
const path = require("path")

function getLocalIp() 
{
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) 
    {
        for (const net of interfaces[name]) 
        {
            if (net.family === "IPv4" && !net.internal) 
            {
                return net.address
            }
        }
    }
    return "127.0.0.1"
}

function updateEnvFile(filePath, key, value) 
{
    let env = ""

    if (fs.existsSync(filePath)) 
    {
        env = fs.readFileSync(filePath, "utf-8")
    }

    const newLine = `${key}=${value}`

    if (env.includes(key)) 
    {
        env = env.replace(new RegExp(`${key}=.*`, "g"), newLine)
    } 
    else 
    {
        env += `\n${newLine}\n`
    }

    fs.writeFileSync(filePath, env)
    console.log(`✅ ${key} set in ${filePath}:`, value)
}

const ip = getLocalIp()

// Frontend .env
const frontendEnvPath = path.join(__dirname, "../.env")
updateEnvFile(frontendEnvPath, "EXPO_PUBLIC_API_URL", `http://${ip}:5000`)

// Backend .env
const backendEnvPath = path.join(__dirname, "../corppay-backend/.env")
updateEnvFile(backendEnvPath, "API_BASE_URL", `http://${ip}:5000`)