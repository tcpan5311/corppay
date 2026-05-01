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

const ip = getLocalIp()
const envPath = path.join(__dirname, "../.env")

let env = ""
if (fs.existsSync(envPath)) 
{
    env = fs.readFileSync(envPath, "utf-8")
}

const newLine = `EXPO_PUBLIC_API_URL=http://${ip}:5000`

if (env.includes("EXPO_PUBLIC_API_URL")) 
{
    env = env.replace(/EXPO_PUBLIC_API_URL=.*/g, newLine)
} 
else 
{
    env += `\n${newLine}\n`
}

fs.writeFileSync(envPath, env)

console.log("✅ API URL set to:", newLine)