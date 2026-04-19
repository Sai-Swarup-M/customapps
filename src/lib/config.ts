import fs from 'fs'
import path from 'path'

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return {}

  return fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .reduce<Record<string, string>>((acc, line) => {
      const [key, ...rest] = line.split('=')
      acc[key.trim()] = rest.join('=').trim()
      return acc
    }, {})
}

// File values win over process.env — prevents empty shell vars from overriding .env.local
const fileEnv = loadEnv()
const env: Record<string, string> = { ...process.env as Record<string, string> }
for (const [k, v] of Object.entries(fileEnv)) {
  if (v) env[k] = v
}

export const config = {
  anthropicApiKey:      env.ANTHROPIC_API_KEY ?? '',
  supabaseUrl:          env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey:      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  supabaseServiceKey:   env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  uploadApiKey:         env.UPLOAD_API_KEY ?? '',
  cronSecret:           env.CRON_SECRET ?? '',
  vapidPublicKey:       env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey:      env.VAPID_PRIVATE_KEY ?? '',
}
