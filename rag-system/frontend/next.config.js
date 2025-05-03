/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure allowed development origins
  allowedDevOrigins: [
    'http://localhost:8000',  // Backend URL
    'http://127.0.0.1:8000',  // Backend URL alternative
    'http://localhost:3000',  // Frontend URL
    'http://127.0.0.1:3000',  // Frontend URL alternative
    'http://192.168.8.184:3000',  // LAN IP Frontend
    'http://192.168.8.184:8000',  // LAN IP Backend
  ],
}

module.exports = nextConfig 