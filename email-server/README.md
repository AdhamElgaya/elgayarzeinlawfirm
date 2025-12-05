# Consultation Form Email Server

This is a Node.js backend server that sends consultation form submissions to your Gmail account using Gmail App Password.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd email-server
npm install
```

### 2. Get Gmail App Password

Follow the instructions in `GMAIL_SETUP.md` to get your Gmail App Password.

### 3. Configure Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-16-character-app-password
RECIPIENT_EMAIL=your-email@gmail.com
PORT=3001
CORS_ORIGIN=https://yourusername.github.io
```

### 4. Run the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The server will run on `http://localhost:3001`

### 5. Update Frontend

In `docs/consultation.html`, update the API_URL:

```javascript
const API_URL = 'http://localhost:3001/api/consultation'; // For local testing
// OR
const API_URL = 'https://your-server.railway.app/api/consultation'; // For production
```

## 📧 How It Works

1. User fills out consultation form on your website
2. Form sends POST request to `/api/consultation` endpoint
3. Server validates the data
4. Server sends formatted HTML email to your Gmail
5. You receive a beautifully formatted email with all the details

## 🎨 Email Format

The email includes:
- ✅ Professional HTML design with gold-black theme
- ✅ All form fields (name, phone, city, subject)
- ✅ Timestamp in Arabic
- ✅ Responsive design
- ✅ Plain text fallback

## 🚀 Deployment Options

### Option 1: Railway (Recommended - Free Tier)

1. Go to https://railway.app/
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js
6. Add environment variables in Railway dashboard
7. Deploy!

**Free Tier:** 500 hours/month

### Option 2: Render

1. Go to https://render.com/
2. Create new "Web Service"
3. Connect GitHub repo
4. Set:
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Add environment variables
6. Deploy!

**Free Tier:** Available

### Option 3: Your Own Server

Deploy to any VPS (DigitalOcean, AWS, etc.):

```bash
# Install PM2 to keep server running
npm install -g pm2

# Start server
pm2 start server.js

# Make it start on boot
pm2 startup
pm2 save
```

## 🔒 Security

- ✅ CORS protection (only your GitHub Pages domain can send requests)
- ✅ Environment variables for sensitive data
- ✅ Input validation
- ✅ Error handling

## 📝 API Endpoint

**POST** `/api/consultation`

**Request Body:**
```json
{
  "name": "أحمد محمد",
  "phone": "+201234567890",
  "city": "القاهرة",
  "subject": "أحتاج استشارة قانونية..."
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "تم إرسال طلب الاستشارة بنجاح",
  "messageId": "email-message-id"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "جميع الحقول مطلوبة"
}
```

## 🧪 Testing

Test the server locally:

```bash
curl -X POST http://localhost:3001/api/consultation \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "+201234567890",
    "city": "Cairo",
    "subject": "Test consultation request"
  }'
```

## 📚 Dependencies

- `express` - Web server framework
- `nodemailer` - Email sending library
- `cors` - CORS middleware
- `dotenv` - Environment variable management

## 💰 Cost

- **Gmail:** Free (up to 500 emails/day)
- **Railway:** Free tier available
- **Render:** Free tier available
- **Total:** $0/month for low-medium traffic

## 🆘 Troubleshooting

**Server won't start?**
- Check if port 3001 is available
- Verify `.env` file exists and has correct values

**Emails not sending?**
- Verify Gmail App Password is correct (no spaces)
- Check 2-Step Verification is enabled
- Check server logs for errors

**CORS errors?**
- Make sure `CORS_ORIGIN` in `.env` matches your GitHub Pages URL exactly

## 📞 Support

Check `GMAIL_SETUP.md` for detailed Gmail setup instructions.

