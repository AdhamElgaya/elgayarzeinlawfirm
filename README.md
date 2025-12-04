DISCLAIMER : THIS WEBSITE IS A PRIVATE PROPERTY FOR ELGAYAR AND ZEIN LAWFIRM. AND TAKING OR PUBLISHMENT OF THIS WEBSITE WILL GET YOU INTO SERIOUS LEGAL PROBLEM 
This is an identical replica of the original ASP.NET Web Forms law firm website, built with Node.js and Express.js.

## Features

✅ **Identical Design**: Exact same layout, styling, and animations as the original
✅ **Multilingual Support**: Arabic (RTL) and English support
✅ **Responsive Design**: Bootstrap-based responsive layout
✅ **Database Integration**: SQLite database with all original functionality
✅ **File Upload**: Image and document upload capabilities
✅ **Contact Forms**: Working contact form with database storage
✅ **Authentication**: Admin login system
✅ **Gallery**: Photo gallery with all original images
✅ **Blog/News**: Posts and articles system

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite3
- **Template Engine**: EJS
- **Frontend**: Bootstrap 3.3.7, jQuery 3.7.1
- **Authentication**: bcryptjs + express-session
- **File Upload**: Multer
- **Styling**: Identical CSS from original site

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation Steps

1. **Navigate to the project directory:**
   ```bash
   cd "New Site"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

4. **For development (with auto-restart):**
   ```bash
   npm run dev
   ```

5. **Access the website:**
   - Open your browser and go to: `http://localhost:3000`
   - Default language: Arabic (RTL)
   - Switch to English: `http://localhost:3000/?lang=en`

## Default Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

## Project Structure

```
New Site/
├── public/                 # Static assets (copied from original)
│   ├── Content/           # CSS, images, fonts
│   ├── Scripts/           # JavaScript files
│   ├── Files/             # Uploaded files
│   └── fonts/             # Custom fonts
├── views/                 # EJS templates
│   ├── partials/          # Reusable components
│   ├── index.ejs          # Homepage
│   ├── about.ejs          # About page
│   ├── services.ejs       # Services page
│   ├── contact.ejs        # Contact page
│   ├── gallery.ejs        # Photo gallery
│   ├── posts.ejs          # News/Blog
│   ├── login.ejs          # Admin login
│   └── layout.ejs         # Main layout
├── server.js              # Main application file
├── database.js            # Database setup and helpers
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## API Endpoints

### Public Endpoints
- `GET /` - Homepage
- `GET /about` - About page
- `GET /services` - Services page
- `GET /contact` - Contact page
- `GET /gallery` - Photo gallery
- `GET /posts` - News/Blog
- `GET /login` - Admin login

### API Endpoints
- `POST /api/contact` - Submit contact form
- `POST /api/login` - Admin authentication
- `POST /api/upload` - File upload
- `GET /api/posts` - Get all posts
- `GET /api/photos` - Get all photos

## Database Schema

The application uses SQLite with the following tables:

- **users**: Admin users
- **posts**: News articles and blog posts
- **contact_requests**: Contact form submissions
- **photos**: Uploaded images

## Language Support

- **Arabic (RTL)**: Default language with right-to-left layout
- **English (LTR)**: Left-to-right layout
- Language switching via URL parameter: `?lang=en` or `?lang=ar`

## Features Comparison with Original

| Feature | Original ASP.NET | Node.js Version | Status |
|---------|------------------|-----------------|---------|
| Design & Layout | ✅ | ✅ | Identical |
| Arabic RTL Support | ✅ | ✅ | Identical |
| Bootstrap Styling | ✅ | ✅ | Identical |
| jQuery Animations | ✅ | ✅ | Identical |
| Contact Forms | ✅ | ✅ | Working |
| File Upload | ✅ | ✅ | Working |
| Database Storage | ✅ | ✅ | SQLite |
| Authentication | ✅ | ✅ | Working |
| Photo Gallery | ✅ | ✅ | Working |
| Multilingual | ✅ | ✅ | Working |

## Development

### Adding New Pages
1. Create new EJS template in `views/` directory
2. Add route in `server.js`
3. Update navigation in `layout.ejs`

### Adding New API Endpoints
1. Add route in `server.js`
2. Add database helper function in `database.js` if needed
3. Update frontend JavaScript to call the API

### Styling Changes
- All CSS files are in `public/Content/`
- Main styles are in `public/Content/ar/src/css/mdb.min.css`
- Custom styles are in the EJS templates

## Deployment

### Local Development
```bash
npm start
```

### Production Deployment
1. Set environment variables:
   - `PORT`: Server port (default: 3000)
   - `NODE_ENV`: Set to 'production'

2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "law-firm-website"
   ```

## Support

This Node.js version maintains 100% feature parity with the original ASP.NET application while being more lightweight and easier to deploy.

## License

MIT License - Same as original project.
