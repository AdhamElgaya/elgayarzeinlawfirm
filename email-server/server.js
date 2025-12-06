const express = require('express');
const cors = require('cors');
const { sendEmail } = require('./utils/sendEmail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ type: 'application/json', charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Consultation form endpoint
app.post('/api/consultation', async (req, res) => {
    try {
        const { name, phone, city, subject } = req.body;

        // Validate required fields
        if (!name || !phone || !city || !subject) {
            return res.status(400).json({ 
                success: false, 
                message: 'جميع الحقول مطلوبة' 
            });
        }

        // Create HTML email template in Arabic
        const htmlEmail = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            background: #f5f5f5;
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #d1ad56 0%, #b78632 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
        }
        .content {
            padding: 30px;
        }
        .field {
            margin-bottom: 25px;
            padding: 20px;
            background: #f8f9fa;
            border-right: 4px solid #d1ad56;
            border-radius: 8px;
            transition: all 0.3s ease;
        }
        .field:hover {
            background: #f0f0f0;
            transform: translateX(-5px);
        }
        .label {
            font-weight: 700;
            color: #b78632;
            margin-bottom: 10px;
            display: block;
            font-size: 16px;
        }
        .value {
            color: #333;
            font-size: 18px;
            line-height: 1.6;
            word-wrap: break-word;
        }
        .subject-field {
            background: #fff9e6;
            border-right-color: #d1ad56;
        }
        .footer {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            text-align: center;
            border-top: 2px solid #e9ecef;
            color: #6c757d;
            font-size: 14px;
        }
        .footer p {
            margin: 5px 0;
        }
        .timestamp {
            color: #d1ad56;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 طلب استشارة قانونية جديد</h1>
        </div>
        
        <div class="content">
            <div class="field">
                <span class="label">👤 الاسم الكامل:</span>
                <div class="value">${name}</div>
            </div>
            
            <div class="field">
                <span class="label">📞 رقم الهاتف:</span>
                <div class="value">${phone}</div>
            </div>
            
            <div class="field">
                <span class="label">📍 المدينة:</span>
                <div class="value">${city}</div>
            </div>
            
            <div class="field subject-field">
                <span class="label">📄 موضوع الاستشارة:</span>
                <div class="value" style="white-space: pre-wrap; line-height: 1.8;">${subject}</div>
            </div>
        </div>
        
        <div class="footer">
            <p class="timestamp">🕐 ${new Date().toLocaleString('ar-SA', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                weekday: 'long'
            })}</p>
            <p>تم إرسال هذا الطلب من موقع مكتب الجيار وزين</p>
            <p>يرجى التواصل مع العميل في أقرب وقت ممكن</p>
        </div>
    </div>
</body>
</html>
        `;

        // Plain text version
        const textEmail = `
طلب استشارة قانونية جديد

الاسم الكامل: ${name}
رقم الهاتف: ${phone}
المدينة: ${city}

موضوع الاستشارة:
${subject}

تاريخ ووقت الطلب: ${new Date().toLocaleString('ar-SA')}

تم إرسال هذا الطلب من موقع مكتب الجيار وزين
        `;

        // Email subject (ensure proper encoding)
        const emailSubject = `طلب استشارة قانونية جديد - ${name}`;

        // Recipient email (send to yourself)
        const recipientEmail = process.env.RECIPIENT_EMAIL || process.env.GMAIL_USER;

        // Send email with timeout (30 seconds max for email sending)
        const emailPromise = sendEmail(
            recipientEmail,
            emailSubject,
            textEmail,
            htmlEmail
        );
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000);
        });
        
        const emailResult = await Promise.race([emailPromise, timeoutPromise]);

        // Check if email was sent successfully
        if (!emailResult.success) {
            console.error('Failed to send email:', emailResult.error);
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ في إرسال الطلب. يرجى المحاولة مرة أخرى.',
                error: emailResult.error
            });
        }
        
        res.json({ 
            success: true, 
            message: 'تم إرسال طلب الاستشارة بنجاح',
            messageId: emailResult.messageId
        });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في إرسال الطلب. يرجى المحاولة مرة أخرى.',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'consultation-email-service' });
});

// GET endpoint for /api/consultation (helpful error message)
app.get('/api/consultation', (req, res) => {
    res.status(405).json({
        success: false,
        message: 'This endpoint only accepts POST requests. Please use the consultation form to submit data.',
        method: 'Use POST instead of GET',
        endpoint: '/api/consultation',
        example: {
            method: 'POST',
            url: '/api/consultation',
            body: {
                name: 'أحمد محمد',
                phone: '+201234567890',
                city: 'القاهرة',
                subject: 'موضوع الاستشارة'
            }
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`📧 Email server running on port ${PORT}`);
    console.log(`✅ Consultation form endpoint: http://localhost:${PORT}/api/consultation`);
});

