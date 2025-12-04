const fs = require('fs');
const path = require('path');
const { db } = require('./database');

/**
 * Database backup utility for Plesk deployment
 * Run this script before deployment to create a backup
 */

function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    const backupFile = path.join(backupDir, `database-backup-${timestamp}.sqlite`);
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Copy database file
    const sourceDb = path.join(__dirname, 'database.sqlite');
    if (fs.existsSync(sourceDb)) {
        fs.copyFileSync(sourceDb, backupFile);
        console.log(`Database backup created: ${backupFile}`);
        
        // Also create a timestamped copy for deployment
        const deploymentBackup = path.join(__dirname, 'database-backup-for-deployment.sqlite');
        fs.copyFileSync(sourceDb, deploymentBackup);
        console.log(`Deployment backup created: ${deploymentBackup}`);
        
        return true;
    } else {
        console.error('Source database file not found!');
        return false;
    }
}

function exportData() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFile = path.join(__dirname, `data-export-${timestamp}.json`);
    
    const exportData = {
        timestamp: new Date().toISOString(),
        tables: {}
    };
    
    // Export users
    db.all('SELECT * FROM users', (err, users) => {
        if (!err) exportData.tables.users = users;
        
        // Export posts
        db.all('SELECT * FROM posts', (err, posts) => {
            if (!err) exportData.tables.posts = posts;
            
            // Export contact requests
            db.all('SELECT * FROM contact_requests', (err, contacts) => {
                if (!err) exportData.tables.contact_requests = contacts;
                
                // Export photos
                db.all('SELECT * FROM photos', (err, photos) => {
                    if (!err) exportData.tables.photos = photos;
                    
                    // Write export file
                    fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
                    console.log(`Data export created: ${exportFile}`);
                    
                    // Close database connection
                    db.close();
                });
            });
        });
    });
}

// Main execution
if (require.main === module) {
    console.log('Creating database backup...');
    const backupSuccess = createBackup();
    
    if (backupSuccess) {
        console.log('Exporting data...');
        exportData();
    }
}

module.exports = { createBackup, exportData };
