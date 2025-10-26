require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'emotions.db');
const RAW_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ENCRYPTION_KEY = RAW_ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(RAW_ENCRYPTION_KEY)
    ? Buffer.from(RAW_ENCRYPTION_KEY, 'hex')
    : crypto.createHash('sha256').update(RAW_ENCRYPTION_KEY).digest();

const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function isEncrypted(text) {
    return text && text.includes(':') && text.split(':').length === 2;
}

const db = new sqlite3.Database(DATABASE_PATH, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
    
    console.log('Connected to database. Starting encryption...');
    
    db.all('SELECT id, notes FROM emotions', [], (err, rows) => {
        if (err) {
            console.error('Error fetching rows:', err.message);
            db.close();
            return;
        }
        
        let updated = 0;
        let skipped = 0;
        
        rows.forEach((row) => {
            if (!row.notes || isEncrypted(row.notes)) {
                skipped++;
                return;
            }
            
            const encryptedNotes = encrypt(row.notes);
            db.run('UPDATE emotions SET notes = ? WHERE id = ?', [encryptedNotes, row.id], (err) => {
                if (err) {
                    console.error(`Error updating row ${row.id}:`, err.message);
                } else {
                    updated++;
                    console.log(`Encrypted notes for row ${row.id}`);
                }
            });
        });
        
        setTimeout(() => {
            console.log(`\nMigration complete:`);
            console.log(`- Updated: ${updated}`);
            console.log(`- Skipped: ${skipped}`);
            db.close();
        }, 1000);
    });
});
