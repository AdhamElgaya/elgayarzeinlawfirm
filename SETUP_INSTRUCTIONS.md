# 📧 Consultation Form Email Setup - Complete Guide

This guide will help you set up email notifications for your consultation form using Gmail directly (no third-party services like EmailJS).

## 📋 What You Need

1. **Gmail Account** (to send/receive emails)
2. **Gmail App Password** (for secure authentication)
3. **A place to host the backend server** (Railway, Render, or your own server)

## 🎯 Overview

**How it works:**
1. User fills form on your GitHub Pages site
2. Form sends data to your backend server
3. Server sends formatted email to your Gmail
4. You receive a beautiful HTML email with all details

## 🔑 Step 1: Get Gmail App Password

**Detailed instructions:** See `email-server/GMAIL_SETUP.md`

**Quick steps:**
1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification**
3. Go to **App passwords**
4. Generate password for "Mail" → "Other (Custom name)"
5. Name it: "Website Consultation Form"
6. **Copy the 16-character password** (remove spaces when using)

## 🖥️ Step 2: Set Up Backend Server

### Option A: Railway (Recommended - Easiest)

1. **Sign up:** https://railway.app/ (use GitHub login)
2. **Create Project:** Click "New Project" → "Deploy from GitHub repo"
3. **Select repo:** Choose your repository
4. **Configure:**
   - Root Directory: `email-server`
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. **Add Environment Variables:**
   - `GMAIL_USER` = your-email@gmail.com
   - `GMAIL_APP_PASSWORD` = your-16-char-password (no spaces)
   - `RECIPIENT_EMAIL` = your-email@gmail.com
   - `CORS_ORIGIN` = https://yourusername.github.io
6. **Deploy:** Railway auto-deploys
7. **Copy URL:** Get your server URL (e.g., `https://your-app.railway.app`)

### Option B: Render

1. **Sign up:** https://render.com/
2. **New Web Service:** Connect GitHub repo
3. **Settings:**
   - Root Directory: `email-server`
   - Build: `npm install`
   - Start: `node server.js`
4. **Environment:** Add same variables as Railway
5. **Deploy**

### Option C: Your Own Server

```bash
cd email-server
npm install
# Create .env file with your credentials
npm start
# Use PM2 to keep it running: pm2 start server.js
```

## 🔧 Step 3: Update Frontend

Edit `docs/consultation.html`:

Find this line (around line 1086):
```javascript
const API_URL = 'YOUR_SERVER_URL/api/consultation';
```

Replace with your actual server URL:
```javascript
const API_URL = 'https://your-app.railway.app/api/consultation';
```

**For local testing:**
```javascript
const API_URL = 'http://localhost:3001/api/consultation';
```

## ✅ Step 4: Test Everything

1. **Test server locally:**
   ```bash
   cd email-server
   npm install
   # Create .env file
   npm start
   ```

2. **Test the endpoint:**
   ```bash
   curl -X POST http://localhost:3001/api/consultation \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","phone":"+201234567890","city":"Cairo","subject":"Test"}'
   ```

3. **Test the form:**
   - Open your website
   - Fill out consultation form
   - Submit
   - Check your email!

## 📧 What the Email Looks Like

You'll receive a beautifully formatted HTML email with:
- ✅ Professional gold-black theme design
- ✅ All form fields clearly displayed
- ✅ Arabic date/time
- ✅ Responsive layout
- ✅ Plain text fallback

## 💰 Cost Breakdown

| Service | Cost | Limits |
|---------|------|--------|
| Gmail | **Free** | 500 emails/day |
| Railway | **Free** | 500 hours/month |
| Render | **Free** | Available |
| **Total** | **$0/month** | For most use cases |

## 🔒 Security Notes

- ✅ App password is stored securely in environment variables
- ✅ CORS protection (only your domain can send requests)
- ✅ Input validation on server
- ✅ Never commit `.env` file to GitHub

## 📁 File Structure

```
email-server/
├── server.js          # Main server file
├── package.json       # Dependencies
├── .env.example       # Environment template
├── .gitignore         # Git ignore file
├── GMAIL_SETUP.md     # Gmail setup guide
└── README.md          # Server documentation

docs/
└── consultation.html   # Frontend form (update API_URL here)
```

## 🆘 Troubleshooting

**"Server URL not configured" error?**
- Make sure you updated `API_URL` in `consultation.html`

**"Invalid login" error?**
- Check Gmail App Password (no spaces)
- Verify 2-Step Verification is enabled

**CORS errors?**
- Make sure `CORS_ORIGIN` matches your GitHub Pages URL exactly
- Check server logs

**Emails not received?**
- Check spam folder
- Verify `RECIPIENT_EMAIL` is correct
- Check server logs for errors

## 📚 Additional Resources

- **Gmail Setup:** `email-server/GMAIL_SETUP.md`
- **Server Docs:** `email-server/README.md`
- **Railway Docs:** https://docs.railway.app/
- **Render Docs:** https://render.com/docs

## ✅ Checklist

- [ ] Gmail App Password generated
- [ ] Backend server deployed (Railway/Render/etc.)
- [ ] Environment variables configured
- [ ] `API_URL` updated in `consultation.html`
- [ ] Tested form submission
- [ ] Received test email

---

**Need help?** Check the troubleshooting section or review the detailed guides in the `email-server/` folder.

