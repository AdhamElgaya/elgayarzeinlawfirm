# Gmail App Password Setup Guide

This guide will help you get a Gmail App Password to use with the email server.

## 📋 What You Need

1. **Gmail Account** (the one you want to send emails from)
2. **2-Step Verification enabled** on your Google Account

## 🔑 Step 1: Enable 2-Step Verification

1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** in the left sidebar
3. Under **"How you sign in to Google"**, find **"2-Step Verification"**
4. Click on it and follow the prompts to enable it
   - You'll need to verify your phone number
   - Google will send you a verification code

## 🔐 Step 2: Generate App Password

1. After enabling 2-Step Verification, go back to **Security** page
2. Scroll down to **"App passwords"** (you may need to search for it)
3. Click on **"App passwords"**
4. You may be asked to sign in again
5. Under **"Select app"**, choose **"Mail"**
6. Under **"Select device"**, choose **"Other (Custom name)"**
7. Enter a name like: **"Website Consultation Form"**
8. Click **"Generate"**
9. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)
   - ⚠️ **Important:** You won't be able to see this password again!
   - Remove the spaces when using it (so it becomes: `abcdefghijklmnop`)

## 📝 Step 3: Configure .env File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` file and fill in your details:
   ```env
   GMAIL_USER=your-email@gmail.com
   GMAIL_PASS=abcdefghijklmnop
   RECIPIENT_EMAIL=your-email@gmail.com
   PORT=3001
   CORS_ORIGIN=https://yourusername.github.io
   ```

3. Replace:
   - `your-email@gmail.com` with your actual Gmail address
   - `abcdefghijklmnop` with your 16-character app password (no spaces)
   - `https://yourusername.github.io` with your actual GitHub Pages URL

## ✅ Step 4: Test the Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:3001/health
   ```

4. You should see: `{"status":"ok","service":"consultation-email-service"}`

## 🚀 Step 5: Deploy the Server

You need to deploy this server somewhere. Here are some options:

### Option 1: Railway (Recommended - Easy & Free)
1. Go to https://railway.app/
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables in Railway dashboard:
   - `GMAIL_USER`
   - `GMAIL_PASS`
   - `RECIPIENT_EMAIL`
   - `CORS_ORIGIN`
6. Railway will automatically deploy and give you a URL like: `https://your-app.railway.app`

### Option 2: Render
1. Go to https://render.com/
2. Sign up and create a new "Web Service"
3. Connect your GitHub repo
4. Set build command: `npm install`
5. Set start command: `node server.js`
6. Add environment variables
7. Deploy

### Option 3: Heroku
1. Install Heroku CLI
2. Run: `heroku create your-app-name`
3. Set environment variables: `heroku config:set GMAIL_USER=... GMAIL_PASS=...`
4. Deploy: `git push heroku main`

### Option 4: Your Own Server
- Deploy to any VPS (DigitalOcean, AWS, etc.)
- Use PM2 to keep it running: `pm2 start server.js`

## 🔒 Security Notes

- **Never commit `.env` file to GitHub!** It's already in `.gitignore`
- The app password is different from your regular Gmail password
- You can revoke app passwords anytime from Google Account settings
- The server should only accept requests from your GitHub Pages domain (CORS)

## 🆘 Troubleshooting

**"Invalid login" error?**
- Make sure you're using the App Password, not your regular Gmail password
- Verify 2-Step Verification is enabled
- Check that the password has no spaces

**"Connection timeout" error?**
- Check your internet connection
- Verify Gmail credentials are correct
- Make sure port 3001 is not blocked by firewall

**Emails not received?**
- Check spam folder
- Verify RECIPIENT_EMAIL is correct
- Check server logs for errors

## 💰 Cost

- **Gmail:** Free (up to 500 emails/day)
- **Railway:** Free tier available (500 hours/month)
- **Render:** Free tier available
- **Heroku:** No longer free, but has paid plans

