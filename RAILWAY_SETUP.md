# 🚀 Railway Setup - Step by Step

## Current Issue: Setting Root Directory

You're in Railway Settings and need to configure the **Root Directory** to point to the `email-server` folder.

## ✅ Solution: Add Root Directory

1. **In Railway Settings, find the "Source Repo" section**
2. **Look for the link that says:**
   ```
   Add Root Directory (used for build and deploy steps. Docs)
   ```
3. **Click on that link**
4. **Enter:** `email-server`
5. **Save/Apply**

This tells Railway to:
- Look for `package.json` in the `email-server` folder
- Run `npm install` in that folder
- Run `node server.js` from that folder

## 📋 Complete Railway Configuration

### Step 1: Root Directory
- **Root Directory:** `email-server`

### Step 2: Environment Variables
Go to **Variables** tab and add:

```
GMAIL_USER = melgayar2020@gmail.com
GMAIL_PASS = rffoyzrxoqmjnbtv
RECIPIENT_EMAIL = melgayar2020@gmail.com
PORT = 3001
CORS_ORIGIN = https://adhamelgaya.github.io/elgayarzeinlawfirm
```

### Step 3: Get Your Server URL
1. Go to **Settings** → **Networking** section
2. Under **Public Networking**, click **"Generate Domain"**
3. Railway will create a URL like: `https://elgayarzeinlawfirm-production.up.railway.app`
4. **Copy this URL** - you'll need it for the consultation form

### Step 4: Test the Server
Once deployed, test it:
```bash
curl https://your-railway-url.up.railway.app/health
```

Should return: `{"status":"ok","service":"consultation-email-service"}`

## 🔧 If "Add Root Directory" Link Doesn't Appear

If you don't see the "Add Root Directory" link:

1. **Go to your service** (not project settings)
2. Click on the service name (e.g., "elgayarzeinlawfirm")
3. Go to **Settings** tab
4. Look for **"Root Directory"** field
5. Enter: `email-server`
6. Save

## ⚠️ Important Notes

- **Branch:** Keep it as "main" (that's correct)
- **Root Directory:** Must be `email-server` (not the root `/`)
- **Start Command:** Railway should auto-detect `node server.js`, but if not, set it manually

## 🎯 After Configuration

1. Railway will automatically redeploy
2. Check the **Deployments** tab to see the build progress
3. Once deployed, get your server URL
4. Update `docs/consultation.html` with the Railway URL
5. Push to GitHub
6. Test the form!

---

**Still having issues?** Check the Railway logs in the **Deployments** tab to see what's happening.

