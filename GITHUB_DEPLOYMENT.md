# 🚀 Deploy to GitHub Pages - Complete Guide

This guide will help you deploy your website to GitHub Pages and connect it to the email server.

## 📋 Overview

Since GitHub Pages only hosts **static files** (HTML, CSS, JS), you need to:
1. ✅ Deploy the **email server** separately (Railway/Render)
2. ✅ Update the consultation form to use the deployed server URL
3. ✅ Push everything to GitHub

## 🎯 Step-by-Step Guide

### Step 1: Deploy Email Server to Railway (5 minutes)

1. **Go to Railway:**
   - Visit https://railway.app/
   - Click "Start a New Project"
   - Sign in with **GitHub** (same account as your website repo)

2. **Deploy from GitHub:**
   - Click **"New Project"** → **"Deploy from GitHub repo"**
   - Select your repository
   - Railway will detect it's a Node.js project

3. **Configure the Service:**
   - Railway might auto-detect `email-server` folder
   - If not, go to **Settings** → **Root Directory** → Set to: `email-server`
   - **Start Command** should be: `node server.js`

4. **Add Environment Variables:**
   - Go to your service → **Variables** tab
   - Click **"New Variable"** and add these one by one:
   
   ```
   GMAIL_USER = melgayar2020@gmail.com
   GMAIL_PASS = rffoyzrxoqmj nbtv
   RECIPIENT_EMAIL = melgayar2020@gmail.com
   PORT = 3001
   CORS_ORIGIN = https://YOUR-USERNAME.github.io
   ```
   
   ⚠️ **Important:** Replace `YOUR-USERNAME` with your actual GitHub username!

5. **Get Your Server URL:**
   - Railway will automatically deploy
   - Go to **Settings** → **Domains**
   - Copy the URL (looks like: `https://your-app-name.up.railway.app`)
   - Or use the default Railway domain

### Step 2: Update Consultation Form

1. **Edit `docs/consultation.html`:**
   - Find line ~1086: `const API_URL = 'http://localhost:3001/api/consultation';`
   - Replace with your Railway URL:
     ```javascript
     const API_URL = 'https://your-app-name.up.railway.app/api/consultation';
     ```

2. **Save and commit:**
   ```bash
   git add docs/consultation.html
   git commit -m "Update consultation form for production"
   git push
   ```

### Step 3: Enable GitHub Pages

1. **Go to your GitHub repository**
2. **Settings** → **Pages**
3. **Source:** Select `main` branch
4. **Folder:** Select `/docs`
5. **Save**

Your site will be live at: `https://YOUR-USERNAME.github.io/REPO-NAME/`

### Step 4: Test Everything

1. **Test the server:**
   ```bash
   curl https://your-app-name.up.railway.app/health
   ```
   Should return: `{"status":"ok","service":"consultation-email-service"}`

2. **Test the form:**
   - Visit your GitHub Pages site
   - Go to consultation page
   - Fill out and submit the form
   - Check your email at `melgayar2020@gmail.com`

## 🔧 Alternative: Render (If Railway doesn't work)

1. **Go to Render:** https://render.com/
2. **Sign in with GitHub**
3. **New** → **Web Service**
4. **Connect your repository**
5. **Configure:**
   - **Name:** `consultation-email-server`
   - **Root Directory:** `email-server`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** `Node`
6. **Add Environment Variables** (same as Railway)
7. **Deploy**
8. **Get URL** and update `consultation.html`

## 🔒 Security Checklist

- [ ] `.env` file is in `.gitignore` (already done)
- [ ] Environment variables are set in Railway/Render dashboard
- [ ] `CORS_ORIGIN` matches your GitHub Pages URL exactly
- [ ] Gmail App Password has no spaces

## 🆘 Troubleshooting

**"Cannot connect to server" error?**
- Check Railway/Render logs
- Verify server is running (check health endpoint)
- Make sure `API_URL` in `consultation.html` is correct

**CORS errors?**
- Verify `CORS_ORIGIN` in Railway matches your GitHub Pages URL exactly
- No trailing slash: `https://username.github.io` (not `https://username.github.io/`)

**Emails not sending?**
- Check Railway/Render logs for errors
- Verify Gmail App Password is correct
- Check spam folder

**Form not working on GitHub Pages?**
- Make sure you pushed the updated `consultation.html`
- Check browser console for errors (F12)
- Verify the `API_URL` is correct

## 📝 Quick Checklist

- [ ] Deployed email server to Railway/Render
- [ ] Added all environment variables
- [ ] Got server URL from Railway/Render
- [ ] Updated `API_URL` in `docs/consultation.html`
- [ ] Committed and pushed to GitHub
- [ ] Enabled GitHub Pages (Settings → Pages)
- [ ] Tested the form on GitHub Pages
- [ ] Received test email

## 💰 Cost

- **GitHub Pages:** Free ✅
- **Railway:** Free tier (500 hours/month) ✅
- **Render:** Free tier available ✅
- **Total:** $0/month 🎉

---

**Need help?** Check the logs in Railway/Render dashboard for detailed error messages.

