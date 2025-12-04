# Plesk Deployment Guide

## Pre-Deployment Checklist

1. **Database Backup**: Export your current database
2. **File Uploads**: Ensure all uploaded files are included
3. **Environment Variables**: Configure production settings
4. **Dependencies**: Install production dependencies

## Deployment Steps

### 1. Upload Files
- Upload all project files to your Plesk hosting directory
- Ensure `node_modules` is excluded (will be installed on server)

### 2. Install Dependencies
```bash
npm install --production
```

### 3. Database Setup
- Copy your `database.sqlite` file to the server
- Ensure proper permissions (read/write access)

### 4. Environment Configuration
- Copy `.env.example` to `.env`
- Update environment variables for production:
  - Change `SESSION_SECRET` to a secure random string
  - Update `PORT` if needed (Plesk usually handles this)
  - Set `NODE_ENV=production`

### 5. Plesk Configuration
- Enable Node.js in Plesk
- Set the application root to your project directory
- Set the startup file to `server.js`
- Configure the application URL

### 6. File Permissions
Ensure the following directories have write permissions:
- `public/Files/` (for file uploads)
- Database file location

### 7. SSL Configuration
- Enable SSL certificate in Plesk
- Update session configuration for HTTPS if needed

## Post-Deployment

### 1. Test the Application
- Visit your domain to ensure the site loads
- Test all major functionality:
  - Contact forms
  - File uploads
  - Admin login
  - Gallery display

### 2. Database Migration
If you have existing data:
- Export from development database
- Import to production database
- Update file paths if necessary

### 3. Performance Optimization
- Enable gzip compression in Plesk
- Configure caching headers
- Optimize images

## Troubleshooting

### Common Issues
1. **Module not found**: Run `npm install` on the server
2. **Permission denied**: Check file permissions for uploads and database
3. **Port issues**: Plesk handles port configuration automatically
4. **Database errors**: Ensure SQLite file has proper permissions

### Logs
Check Plesk error logs for debugging:
- Application logs
- Error logs
- Access logs

## Security Considerations

1. **Change default passwords**: Update admin credentials
2. **Session secret**: Use a strong, unique session secret
3. **File uploads**: Validate file types and sizes
4. **HTTPS**: Enable SSL certificate
5. **Environment variables**: Never commit `.env` file

## Backup Strategy

1. **Database**: Regular SQLite backups
2. **Uploaded files**: Backup `public/Files/` directory
3. **Code**: Use Git for version control
4. **Configuration**: Document environment settings

## Maintenance

1. **Regular updates**: Keep dependencies updated
2. **Monitoring**: Set up application monitoring
3. **Backups**: Automated daily backups
4. **Logs**: Regular log review and cleanup
