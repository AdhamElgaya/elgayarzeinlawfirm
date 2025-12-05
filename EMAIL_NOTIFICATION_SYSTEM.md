# Email Notification System - Technical Documentation

> **CONFIDENTIAL** - Internal use only

## Overview

This document describes the email notification system implementation using Node.js and Nodemailer.

## Core Components

### 1. Email Utility Module

**Location:** `server/utils/sendEmail.js`

**Method:**
- Uses `nodemailer` package
- Gmail SMTP service
- Environment-based configuration
- HTML email support

**Configuration:**
- `GMAIL_USER`: Gmail account email
- `GMAIL_PASS`: Gmail app password

**Function Signature:**
```javascript
sendEmail(to, subject, text, html)
```

**Features:**
- Graceful degradation if credentials missing
- HTML email templates
- Error handling

## Notification Triggers

### 1. Booking Creation

**When:** New booking request submitted

**Recipients:**
- Service provider (owner)
- Service requester (client)

**Method:**
- Fetch user data from database
- Generate HTML email template
- Send via `sendEmail()` utility
- Include booking details, dates, and status

### 2. Booking Response

**When:** Service provider accepts/rejects request

**Recipients:**
- Service requester (client)

**Method:**
- Update booking status in database
- Generate response email template
- Send notification only on rejection
- Include rejection reason if provided

### 3. Admin Actions

**When:** Admin approves/rejects service requests

**Recipients:**
- Service provider (owner)

**Method:**
- Update request status
- Send approval/rejection notification
- Include relevant details

### 4. Support Messages

**When:** User sends support chat message

**Recipients:**
- Admin/Support team

**Method:**
- Extract message content
- Generate notification email
- Include user details and message
- Link to admin dashboard

### 5. Scheduled Notifications

**When:** Contract/service expiry approaching

**Recipients:**
- Service provider

**Method:**
- Cron job scheduler
- Check expiry dates
- Calculate days remaining
- Send warning emails
- Include renewal instructions

## Email Template Structure

### HTML Templates

All emails use inline CSS for styling:

**Components:**
- Header section (gradient background)
- Content section (details)
- Action section (buttons/links)
- Footer section (metadata)

**Styling:**
- Responsive design (max-width: 600px)
- Arial font family
- Color-coded status indicators
- Inline styles (no external CSS)

## Implementation Details

### Email Sending Flow

1. **Event Trigger** → Action occurs (booking, response, etc.)
2. **Data Fetch** → Retrieve user information from database
3. **Template Generation** → Build HTML email template
4. **Send Email** → Call `sendEmail()` utility
5. **Error Handling** → Log errors, continue execution

### Error Handling

- Missing credentials: Skip sending, log warning
- Send failures: Log error, don't break main flow
- Invalid recipients: Graceful failure

### Security Considerations

- Environment variables for credentials
- No hardcoded emails
- App passwords (not regular passwords)
- Email validation on recipient addresses

## Configuration

### Required Environment Variables

```env
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
```

### Gmail App Password Setup

1. Enable 2-factor authentication
2. Generate app password in Google Account settings
3. Use app password (not regular password)

## Dependencies

- `nodemailer`: Email sending library
- Node.js environment variables

## Notes

- All emails are sent asynchronously
- Email sending doesn't block main operations
- Templates are generated dynamically
- Supports both plain text and HTML formats

