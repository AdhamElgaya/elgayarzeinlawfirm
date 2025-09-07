const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Posts table
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Contact requests table
    db.run(`
        CREATE TABLE IF NOT EXISTS contact_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            subject TEXT,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Photos table
    db.run(`
        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_name TEXT,
            path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Insert default admin user (password: admin123)
    db.run(`
        INSERT OR IGNORE INTO users (username, password, email) 
        VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@gzlawfirm.net')
    `);

    // Insert sample posts
    db.run(`
        INSERT OR IGNORE INTO posts (title, content, category) VALUES 
        ('تحديثات قانونية جديدة', 'نقدم لكم آخر التحديثات في القوانين والتشريعات الجديدة...', 'news'),
        ('نصائح قانونية مهمة', 'مجموعة من النصائح القانونية المهمة التي تساعدكم...', 'tips'),
        ('قضايا قانونية مهمة', 'نستعرض معكم بعض القضايا القانونية المهمة...', 'cases')
    `);

    console.log('Database initialized successfully');
}

// Database helper functions
const dbHelpers = {
    // User functions
    getUserByUsername: (username) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Contact functions
    createContactRequest: (data) => {
        return new Promise((resolve, reject) => {
            const { name, email, phone, subject, message } = data;
            db.run(
                'INSERT INTO contact_requests (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
                [name, email, phone, subject, message],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    },

    // Post functions
    getAllPosts: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM posts ORDER BY created_at DESC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    getPostById: (id) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM posts WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Photo functions
    createPhoto: (filename, originalName, path) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO photos (filename, original_name, path) VALUES (?, ?, ?)',
                [filename, originalName, path],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    },

    getAllPhotos: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM photos ORDER BY created_at DESC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

// Initialize database on startup
initDatabase();

module.exports = { db, dbHelpers };
