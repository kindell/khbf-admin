# KHBF Admin - Deployment Plan

## Översikt

**Mål:** Deploya khbf-admin till `khbf.se/stats/admin` på samma server som WordPress och stats-appen.

**Nuvarande server-struktur:**
```
public_html/
├── [WordPress root files]           # khbf.se
├── stats/                           # khbf.se/stats
│   ├── index.html
│   ├── assets/
│   ├── widget.php                   # API endpoint
│   └── .htaccess
└── stats/admin/                     # khbf.se/stats/admin (NYTT)
    ├── index.html
    ├── assets/
    ├── api/
    │   └── otp-auth.php             # OTP API endpoints
    └── .htaccess
```

## Arkitektur

### Frontend: React + Vite (Behålls)
- Statisk build med `vite build`
- Client-side routing med React Router
- Alla statiska filer exporteras till `dist/`

### Backend: PHP API (Enklaste lösningen för shared hosting)
- OTP authentication endpoints i PHP
- Använder samma Supabase-databas som andra system
- Inga Node.js-processer behöver köras på servern

**Varför PHP istället för Node.js/Express?**
- ✅ Fungerar direkt på shared hosting (webbhotell)
- ✅ Ingen separat process att hantera
- ✅ Apache hanterar allt automatiskt
- ✅ Samma mönster som stats-appen använder (widget.php)
- ❌ Node.js kräver dedikerad server eller port management

## Implementation

### 1. Lokalt: Lägg till PHP API-endpoints

**Skapa:** `public/api/otp-auth.php`
```php
<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/supabase.php';

$action = $_GET['action'] ?? '';

if ($action === 'request-code') {
    handleRequestCode();
} elseif ($action === 'verify-code') {
    handleVerifyCode();
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Invalid action']);
}

function handleRequestCode() {
    // Implementation för att begära OTP-kod
    // Se IMPLEMENTATION_DETAILS.md
}

function handleVerifyCode() {
    // Implementation för att verifiera OTP-kod
    // Se IMPLEMENTATION_DETAILS.md
}
```

**Skapa:** `config/supabase.php`
```php
<?php
// Supabase credentials
define('SUPABASE_URL', getenv('SUPABASE_URL') ?: 'https://rzsoxgagglmitglvmfrk.supabase.co');
define('SUPABASE_KEY', getenv('SUPABASE_SERVICE_ROLE_KEY') ?: 'sb_secret_...');

function supabaseRequest($method, $path, $data = null) {
    $url = SUPABASE_URL . '/rest/v1/' . $path;

    $headers = [
        'apikey: ' . SUPABASE_KEY,
        'Authorization: Bearer ' . SUPABASE_KEY,
        'Content-Type: application/json',
        'Prefer: return=representation'
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'status' => $httpCode,
        'data' => json_decode($response, true)
    ];
}
```

### 2. Frontend: Uppdatera API-anrop

**Ändra i:** `src/SMSLogin.tsx`
```typescript
// Ändra från:
const response = await fetch('http://localhost:3333/api/sms-auth/request-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone_number: normalizedPhone })
});

// Till:
const response = await fetch('/api/otp-auth.php?action=request-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone_number: normalizedPhone })
});
```

Samma för `verify-code` endpoint.

### 3. Vite config: Lägg till base path

**Ändra:** `vite.config.ts`
```typescript
export default defineConfig({
  plugins: [react()],
  base: '/stats/admin/',  // Lägg till denna rad
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
```

### 4. React Router: Lägg till basename

**Ändra:** `src/App.tsx`
```typescript
<BrowserRouter basename="/stats/admin">
  <Routes>
    {/* ... routes ... */}
  </Routes>
</BrowserRouter>
```

### 5. Skapa .htaccess för deployment

**Skapa:** `public/.htaccess`
```apache
RewriteEngine On

# OTP API endpoints
RewriteRule ^api/otp-auth\.php$ api/otp-auth.php [L,QSA]

# Handle React Router - redirect all requests to index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . index.html [L]

# Set proper MIME types
AddType text/javascript .js
AddType text/css .css

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache control
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
```

### 6. Deployment script

**Skapa:** `deploy.sh`
```bash
#!/bin/bash

# Deployment script för khbf-admin till khbf.se/stats/admin

set -e

echo "🚀 Building khbf-admin..."
npm run build

echo "📦 Creating deployment package..."
cd dist
tar -czf ../admin-deploy.tar.gz .
cd ..

echo "📤 Uploading to server..."
scp admin-deploy.tar.gz kullavik@khbf.se:~/

echo "🔧 Deploying on server..."
ssh kullavik@khbf.se << 'ENDSSH'
  cd ~/

  # Create admin directory if it doesn't exist
  mkdir -p public_html/stats/admin

  # Backup existing deployment
  if [ -d "public_html/stats/admin/assets" ]; then
    echo "📦 Backing up existing deployment..."
    tar -czf admin-backup-$(date +%Y%m%d_%H%M%S).tar.gz -C public_html/stats admin
  fi

  # Extract new deployment
  echo "📂 Extracting new files..."
  tar -xzf admin-deploy.tar.gz -C public_html/stats/admin/

  # Set permissions
  chmod -R 755 public_html/stats/admin

  # Cleanup
  rm admin-deploy.tar.gz

  echo "✅ Deployment complete!"
ENDSSH

rm admin-deploy.tar.gz

echo "✅ All done! Visit https://khbf.se/stats/admin"
```

**Gör körbar:**
```bash
chmod +x deploy.sh
```

## Användning

### Development
```bash
npm run dev
# Öppna http://localhost:5173
```

### Build och test lokalt
```bash
npm run build
npm run preview
# Öppna http://localhost:4173/stats/admin
```

### Deploy till production
```bash
./deploy.sh
```

## Säkerhet

### Miljövariabler på servern
Skapa `.htaccess` i projektroten (ovanför public_html) med:
```apache
SetEnv SUPABASE_URL "https://rzsoxgagglmitglvmfrk.supabase.co"
SetEnv SUPABASE_SERVICE_ROLE_KEY "sb_secret_..."
```

### Rate limiting i PHP
Implementera rate limiting för OTP-endpoints:
- Max 1 request per telefonnummer per 60 sekunder
- Max 3 verifieringsförsök per kod

## Troubleshooting

### Problem: 404 på refresh
**Lösning:** Kontrollera att `.htaccess` finns i `public_html/stats/admin/`

### Problem: API-anrop fungerar inte
**Lösning:**
1. Kontrollera att `api/otp-auth.php` finns
2. Kolla server error log: `ssh kullavik@khbf.se "tail -f public_html/error_log"`
3. Verifiera Supabase credentials

### Problem: Assets laddar inte
**Lösning:** Kontrollera att `base: '/stats/admin/'` finns i `vite.config.ts`

## Framtida förbättringar

1. **CI/CD:** Lägg till GitHub Actions för automatisk deployment
2. **Environment configs:** Separata configs för dev/staging/production
3. **Monitoring:** Lägg till error tracking (Sentry)
4. **CDN:** Flytta statiska assets till CDN för bättre prestanda

## Kontakt & Support

För frågor om deployment, kontakta systemadministratören.
