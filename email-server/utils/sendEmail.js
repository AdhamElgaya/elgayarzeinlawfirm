const nodemailer = require('nodemailer');

/**
 * Email utility module for sending emails via Gmail SMTP
 * Uses environment-based configuration with graceful degradation
 */

// Create Gmail transporter (singleton)
let transporter = null;

/**
 * Initialize the email transporter
 * Gracefully degrades if credentials are missing
 */
function initializeTransporter() {
    // Only initialize if not already created
    if (transporter) {
        return transporter;
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_PASS;

    // Graceful degradation if credentials missing
    if (!gmailUser || !gmailPass) {
        console.warn('⚠️  Email credentials not configured. Email sending will be disabled.');
        return null;
    }

    try {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: gmailPass // Gmail app password
            },
            // Ensure UTF-8 encoding for Arabic text
            defaultEncoding: 'UTF-8'
        });

        console.log('✅ Email transporter initialized successfully');
        return transporter;
    } catch (error) {
        console.error('❌ Error initializing email transporter:', error);
        return null;
    }
}

/**
 * Send an email using the configured transporter
 * 
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text version of the email
 * @param {string} html - HTML version of the email
 * @returns {Promise<Object>} - Email sending result
 */
async function sendEmail(to, subject, text, html) {
    // Initialize transporter if not already done
    const emailTransporter = initializeTransporter();

    // Graceful degradation if transporter not available
    if (!emailTransporter) {
        console.warn('⚠️  Email not sent: Transporter not available');
        return {
            success: false,
            error: 'Email service not configured'
        };
    }

    // Validate recipient
    if (!to || !to.includes('@')) {
        console.error('❌ Invalid recipient email:', to);
        return {
            success: false,
            error: 'Invalid recipient email address'
        };
    }

    try {
        const mailOptions = {
            from: {
                name: 'مكتب الجيار وزين',
                address: process.env.GMAIL_USER
            },
            to: to,
            subject: subject, // Nodemailer handles UTF-8 automatically
            text: text || '',
            html: html || text || ''
        };

        const info = await emailTransporter.sendMail(mailOptions);
        
        console.log('✅ Email sent successfully:', info.messageId);
        
        return {
            success: true,
            messageId: info.messageId,
            response: info.response
        };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    sendEmail,
    initializeTransporter
};

