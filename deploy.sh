#!/bin/bash

# KHBF Admin Panel - Deployment Script
# Deploys admin panel to khbf.se/stats/admin/
# Usage: ./deploy.sh

set -e

echo "🚀 KHBF Admin Panel - Deployment"
echo "================================"
echo "📍 Target: https://khbf.se/stats/admin/"
echo ""

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -d "src" ]]; then
    echo "❌ Error: Run this script from khbf-admin root directory"
    exit 1
fi

echo "📦 Step 1: Building for production..."
npm run build:deploy

if [[ ! -d "dist" ]]; then
    echo "❌ Build failed - no dist directory created"
    exit 1
fi

echo "📁 Step 2: Adding config directory..."
cd dist

# Copy config directory (public/ files are already copied by Vite)
mkdir -p config
cp ../config/*.php config/ 2>/dev/null || echo "⚠️  No config PHP files found"

cd ..

echo "🔄 Step 3: Syncing to khbf.se..."
rsync -avz --delete \
  --exclude='*.DS_Store' \
  --exclude='node_modules' \
  --exclude='.env' \
  dist/ kullavik@khbf.se:~/public_html/stats/admin/

echo "🔒 Step 4: Setting correct permissions..."
ssh kullavik@khbf.se 'find ~/public_html/stats/admin -type f -exec chmod 644 {} \; && find ~/public_html/stats/admin -type d -exec chmod 755 {} \;'

echo "🔑 Step 5: Ensuring .env file exists..."
ssh kullavik@khbf.se 'test -f ~/public_html/stats/admin/.env || cat > ~/public_html/stats/admin/.env << '\''EOF'\''
VITE_SUPABASE_URL=https://rzsoxgagglmitglvmfrk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6c294Z2FnZ2xtaXRnbHZtZnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNDAzMDMsImV4cCI6MjA2OTkxNjMwM30.npjmuW_oOVnn9x27s1GtRu0knc-IWwxxHzQwZs7f3cc
VITE_SUPABASE_SERVICE_ROLE_KEY=sb_secret_ybRHsx5MjNBuzWHIo_BPUw_AYv3O4VE
EOF
'
ssh kullavik@khbf.se 'chmod 644 ~/public_html/stats/admin/.env'

echo ""
echo "✅ Deployment completed successfully!"
echo "================================"
echo "🌐 Test at: https://khbf.se/stats/admin/"
echo "📱 Admin panel should be live and accessible"
echo ""
