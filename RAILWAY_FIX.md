# 🔧 Fix Railway Deployment Error

## Problem
Railway is trying to run the root `server.js` (which uses sqlite3) instead of the email server.

**Error:** `Error: /app/node_modules/sqlite3/build/Release/node_sqlite3.node: invalid ELF header`

## ✅ Solution: Set Root Directory in Railway

### Step 1: Go to Railway Settings

1. In Railway, go to your **service** (not project)
2. Click on the service name: **"elgayarzeinlawfirm"**
3. Go to **Settings** tab

### Step 2: Set Root Directory

1. Find **"Source"** section
2. Look for **"Root Directory"** field
3. Enter: `email-server`
4. **Save**

### Step 3: Verify Start Command

1. In the same Settings tab
2. Find **"Deploy"** section
3. **Start Command** should be: `node server.js`
4. If it's different, change it to: `node server.js`

### Step 4: Redeploy

1. Railway should automatically redeploy after saving
2. If not, go to **Deployments** tab
3. Click **"Redeploy"**

## 🔍 Alternative: Create New Service

If the Root Directory setting doesn't work:

1. **Delete the current service** (or disconnect it)
2. **Create a new service:**
   - Click **"New"** → **"GitHub Repo"**
   - Select your repository
3. **Configure immediately:**
   - **Root Directory:** `email-server`
   - **Start Command:** `node server.js`
4. **Add Environment Variables** (see below)

## 📋 Environment Variables

Go to **Variables** tab and add:

```
GMAIL_USER=melgayar2020@gmail.com
GMAIL_PASS=rffoyzrxoqmjnbtv
RECIPIENT_EMAIL=melgayar2020@gmail.com
PORT=3001
CORS_ORIGIN=https://adhamelgaya.github.io/elgayarzeinlawfirm
```

## ✅ Verify It's Working

After redeploy, check the logs. You should see:
```
✅ Email transporter initialized successfully
📧 Email server running on port 3001
✅ Consultation form endpoint: http://localhost:3001/api/consultation
```

**NOT** the sqlite3 error!

## 🧪 Test the Server

Once deployed, test it:
```bash
curl https://your-railway-url.up.railway.app/health
```

Should return: `{"status":"ok","service":"consultation-email-service"}`

---

**The key is:** Railway must use `email-server` as the Root Directory, not the repository root!

