const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { dbHelpers } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Load environment variables
require('dotenv').config();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'law-firm-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production' ? true : false, 
        maxAge: 720 * 60 * 1000 // 720 minutes like original
    }
}));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/Files/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Language data (matching original ASP.NET structure)
const languages = {
    ar: {
        title: "مكتب الجيار وزين",
        hero: "مكتب الجيار وزين",
        subtitle: "أحد أكبر وأحسن مكاتب المحاماه فى مصر",
        cta: "تواصل معنا",
        services: "خدماتنا القانونية",
        servicesDesc: "نقدم مجموعة واسعة من الخدمات القانونية المتخصصة"
    },
    en: {
        title: "Law Firm",
        hero: "We provide the best legal services",
        subtitle: "A law firm specialized in providing comprehensive legal solutions",
        cta: "Contact Us",
        services: "Our Legal Services",
        servicesDesc: "We offer a wide range of specialized legal services"
    }
};

// Routes
app.get('/', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('index', { 
        l: l, 
        lang: lang,
        img1: '/Content/img/p1.jpg',
        img2: '/Content/img/p2.jpg',
        img3: '/Content/img/p3.jpg',
        img4: '/Content/img/p4.jpg',
        img5: '/Content/img/p5.jpg',
        img6: '/Content/img/p6.jpg',
        img7: '/Content/img/p7.jpg',
        img8: '/Content/img/p8.jpg',
        img9: '/Content/img/p9.jpg'
    });
});

app.get('/about', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('about', { l: l, lang: lang });
});

app.get('/services', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('services', { l: l, lang: lang });
});

app.get('/gallery', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('gallery', { l: l, lang: lang });
});

app.get('/contact', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('contact', { l: l, lang: lang });
});

app.get('/posts', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('posts', { l: l, lang: lang });
});

app.get('/partners', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('partners', { l: l, lang: lang });
});

app.get('/team', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('team', { l: l, lang: lang });
});

app.get('/consultation', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('consultation', { l: l, lang: lang });
});

app.get('/login', (req, res) => {
    const lang = req.query.lang || 'ar';
    const l = languages[lang];
    res.render('login', { l: l, lang: lang });
});

// API Routes
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        await dbHelpers.createContactRequest({ name, email, phone, subject, message });
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ success: false, message: 'Error sending message' });
    }
});

app.post('/api/consultation', async (req, res) => {
    try {
        const { name, phone, city, subject } = req.body;
        await dbHelpers.createContactRequest({ 
            name, 
            email: '', 
            phone, 
            subject: 'استشارة قانونية', 
            message: `الاسم: ${name}\nرقم الهاتف: ${phone}\nالمدينة: ${city}\nموضوع الاستشارة: ${subject}` 
        });
        res.json({ success: true, message: 'Consultation request sent successfully' });
    } catch (error) {
        console.error('Consultation form error:', error);
        res.status(500).json({ success: false, message: 'Error sending consultation request' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await dbHelpers.getUserByUsername(username);
        
        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.userId = user.id;
            req.session.username = user.username;
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login error' });
    }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { filename, originalname, path: filePath } = req.file;
        await dbHelpers.createPhoto(filename, originalname, filePath);
        
        res.json({ 
            success: true, 
            filename: filename,
            path: '/Files/' + filename 
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Upload error' });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const posts = await dbHelpers.getAllPosts();
        res.json({ success: true, posts });
    } catch (error) {
        console.error('Posts error:', error);
        res.status(500).json({ success: false, message: 'Error fetching posts' });
    }
});

app.get('/api/photos', async (req, res) => {
    try {
        const photos = await dbHelpers.getAllPhotos();
        res.json({ success: true, photos });
    } catch (error) {
        console.error('Photos error:', error);
        res.status(500).json({ success: false, message: 'Error fetching photos' });
    }
});

// Language switching
app.get('/lang', (req, res) => {
    const lang = req.query.lang || 'ar';
    res.redirect(req.get('Referer') || '/?lang=' + lang);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} or http://YOUR-IP-ADDRESS:${PORT}`);
    console.log('Law firm website is ready!');
});
