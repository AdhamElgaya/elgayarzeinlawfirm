#!/bin/bash

# Plesk Deployment Script
# Run this script to prepare your application for Plesk hosting

echo "🚀 Preparing application for Plesk deployment..."

# Create backup
echo "📦 Creating database backup..."
node backup-database.js

# Install production dependencies
echo "📦 Installing production dependencies..."
npm install --production

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️ Creating environment configuration..."
    cp env.example .env
    echo "⚠️  Please update .env file with your production settings!"
fi

# Set proper permissions (if on Linux/Mac)
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🔐 Setting file permissions..."
    chmod 755 server.js
    chmod -R 755 public/
    chmod 666 database.sqlite
    chmod -R 777 public/Files/
fi

# Create deployment package
echo "📦 Creating deployment package..."
tar -czf law-firm-deployment-$(date +%Y%m%d-%H%M%S).tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=*.log \
    --exclude=backups \
    --exclude=.env \
    --exclude=DEPLOYMENT.md \
    --exclude=PLESK_READY.md \
    .

echo "✅ Deployment package created!"
echo ""
echo "📋 Next steps:"
echo "1. Upload the .tar.gz file to your Plesk hosting"
echo "2. Extract the files in your domain's document root"
echo "3. Run 'npm install --production' on the server"
echo "4. Copy your .env file with production settings"
echo "5. Ensure database.sqlite has proper permissions"
echo "6. Configure Node.js application in Plesk panel"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
