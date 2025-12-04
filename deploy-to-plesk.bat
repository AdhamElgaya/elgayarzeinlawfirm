@echo off
echo 🚀 Preparing application for Plesk deployment...

echo 📦 Creating database backup...
node backup-database.js

echo 📦 Installing production dependencies...
npm install --production

echo ⚙️ Creating environment configuration...
if not exist .env (
    copy env.example .env
    echo ⚠️  Please update .env file with your production settings!
)

echo 📦 Creating deployment package...
set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=%timestamp: =0%
powershell -command "Compress-Archive -Path 'server.js','package.json','package-lock.json','database.js','database.sqlite','views','public','web.config','.htaccess','env.example','backup-database.js' -DestinationPath 'law-firm-deployment-%timestamp%.zip' -Force"

echo ✅ Deployment package created!
echo.
echo 📋 Next steps:
echo 1. Upload the .zip file to your Plesk hosting
echo 2. Extract the files in your domain's document root
echo 3. Run 'npm install --production' on the server
echo 4. Copy your .env file with production settings
echo 5. Ensure database.sqlite has proper permissions
echo 6. Configure Node.js application in Plesk panel
echo.
echo 📖 See DEPLOYMENT.md for detailed instructions
pause
