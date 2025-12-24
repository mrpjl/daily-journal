require('dotenv').config(); // Load environment variables
const express = require('express'); // Import Express
const helmet = require('helmet'); // For CSP and security headers
const rateLimit = require('express-rate-limit'); // For rate limiting
const bodyParser = require('body-parser'); // For parsing request bodies
const crypto = require('crypto'); // For encryption and decryption
const winston = require('winston'); // For centralized logging
const { body, validationResult } = require('express-validator'); // For input validation and sanitization
const sqlite3 = require('sqlite3').verbose(); // Import sqlite3
const path = require('path');
const fs = require('fs');
const cors = require('cors'); // Import CORS for cross-origin requests

const app = express(); // Initialize Express application
const PORT = process.env.PORT || 3000;

// Use environment variable for database file path
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'emotions.db');

// Ensure the folder for the database exists
const dataFolderPath = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dataFolderPath)) {
    fs.mkdirSync(dataFolderPath, { recursive: true });
    console.log(`Created folder for the database at ${dataFolderPath}.`);
}

// Initialize SQLite database connection
const db = new sqlite3.Database(DATABASE_PATH, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log(`Connected to the SQLite database at ${DATABASE_PATH}.`);
        initDatabase(); // Ensure the database table is created
        runMigrations(); // Run database migrations
    }
});

// Initialize database table
function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS emotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            score INTEGER NOT NULL,
            notes TEXT,
            tags TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Database table "emotions" is ready.');
        }
    });
}

// Initialize database migrations
function runMigrations() {
    console.log('Running database migrations...');
    db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating migrations table:', err.message);
            return;
        }

        // Load migration files and apply them
        const migrationsPath = path.join(__dirname, 'migrations');
        if (!fs.existsSync(migrationsPath)) {
            fs.mkdirSync(migrationsPath, { recursive: true });
            console.log('Created migrations folder.');
        }

        const appliedMigrations = new Set();
        db.all('SELECT name FROM migrations', [], (err, rows) => {
            if (err) {
                console.error('Error fetching applied migrations:', err.message);
                return;
            }

            rows.forEach(row => appliedMigrations.add(row.name));

            const migrationFiles = fs.readdirSync(migrationsPath).filter(file => file.endsWith('.sql'));
            migrationFiles.sort(); // Ensure migrations are applied in order

            migrationFiles.forEach(file => {
                if (!appliedMigrations.has(file)) {
                    console.log(`Applying migration: ${file}`);
                    const migrationSQL = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
                    db.exec(migrationSQL, (err) => {
                        if (err) {
                            console.error(`Error applying migration ${file}:`, err.message);
                        } else {
                            db.run('INSERT INTO migrations (name) VALUES (?)', [file], (err) => {
                                if (err) {
                                    console.error(`Error recording migration ${file}:`, err.message);
                                } else {
                                    console.log(`Migration applied successfully: ${file}`);
                                }
                            });
                        }
                    });
                }
            });
        });
    });
}

// Middleware
app.use(helmet()); // Add security headers, including CSP
app.use(bodyParser.json({ limit: '1.1kb' })); // Limit payload size to 1.1KB
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origin: '*' })); // Allow all origins

// Serve static files (CSS, JS, etc.)
app.use(express.static(path.join(__dirname)));

// Serve the HTML file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'emotion-tracker.html'), (err) => {
        if (err) {
            console.error('Error serving emotion-tracker.html:', err.message);
            res.status(500).send('Error loading the application.');
        }
    });
});

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.',
});
app.use(limiter);

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

// Add Content Security Policy
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"], // Allow resources from the same origin
            scriptSrc: ["'self'"], // Allow scripts from the same origin
            styleSrc: ["'self'", "'unsafe-inline'"], // Allow styles from the same origin and inline styles
            imgSrc: ["'self'", "data:"], // Allow images from the same origin and data URIs
            fontSrc: ["'self'", "https:"], // Allow fonts from the same origin and HTTPS sources
            connectSrc: ["'self'"], // Allow connections to the same origin
            objectSrc: ["'none'"], // Disallow all object sources
            upgradeInsecureRequests: [], // Upgrade HTTP requests to HTTPS
        }
    })
);

// Encryption and decryption setup
const RAW_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '9CC9F047A63371C987B2182278695CC8F9CC9F047A63371C987B2182278695CC8';
const ENCRYPTION_KEY = RAW_ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(RAW_ENCRYPTION_KEY)
    ? Buffer.from(RAW_ENCRYPTION_KEY, 'hex')
    : crypto.createHash('sha256').update(RAW_ENCRYPTION_KEY).digest();

if (!process.env.ENCRYPTION_KEY) {
    console.warn('ENCRYPTION_KEY not set; using derived key from default string.');
} else if (ENCRYPTION_KEY.toString('hex') !== RAW_ENCRYPTION_KEY.toLowerCase()) {
    console.warn('ENCRYPTION_KEY is not 32-byte hex; using SHA-256 derived key.');
    console.log('Encryption key:', ENCRYPTION_KEY.toString('hex'));
}

const IV_LENGTH = 16; // AES block size

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
    if (!encryptedText) return encryptedText;
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText;

    try {
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.warn('Failed to decrypt notes; returning stored value.', error.message);
        return encryptedText;
    }
}

app.get('/api/emotions', (req, res) => {
    const { date, tags } = req.query;

    let sql = 'SELECT * FROM emotions';
    const params = [];

    if (date || tags) {
        sql += ' WHERE';
        if (date) {
            sql += ' date = ?';
            params.push(date);
        }
        if (tags) {
            if (date) sql += ' AND';
            sql += ' tags LIKE ?';
            params.push(`%${tags}%`);
        }
        console.log(`Fetching emotions with filters: ${date ? `date=${date}` : ''} ${tags ? `tags=${tags}` : ''}`);
    } else {
        console.log('Fetching all emotions.');
    }

    sql += ' ORDER BY date';

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error querying database:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }
        console.log(`Fetched ${rows.length} rows from the database.`);
        const data = rows.reduce((acc, row) => {
            if (!acc[row.date]) acc[row.date] = [];
            acc[row.date].push({
                score: row.score,
                notes: decrypt(row.notes),
                tags: row.tags
            });
            return acc;
        }, {});
        res.json(data);
    });
});

// API route to fetch only date and score for heatmap
app.get('/api/emotions/heatmap', (req, res) => {
    console.log('Received request to fetch scores for heatmap.');
    db.all('SELECT date, score FROM emotions ORDER BY date', [], (err, rows) => {
        if (err) {
            console.error('Error querying database for heatmap:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }
        console.log(`Fetched ${rows.length} rows for heatmap.`);
        const data = rows.reduce((acc, row) => {
            if (!acc[row.date]) acc[row.date] = [];
            acc[row.date].push(row.score);
            return acc;
        }, {});
        res.json(data);
    });
});

// API route to add or update an emotion entry
app.post('/api/emotions', [
    body('date').isISO8601().withMessage('Invalid date format'),
    body('score').isInt({ min: -5, max: 5 }).withMessage('Score must be between -5 and 5'),
    body('notes').optional().trim().escape(),
    body('tags').optional().trim().escape(),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { date, score, notes, tags } = req.body;
    console.log(`Received data: date=${date}, score=${score}, notes=${notes}, tags=${tags}`);

    if (!date || score === undefined) {
        console.warn('Validation failed: Missing date or score.');
        return res.status(400).json({ error: 'Date and score are required' });
    }

    db.get(
        'SELECT id FROM emotions WHERE date = ? AND tags = ?',
        [date, tags],
        (err, row) => {
            if (err) {
                console.error('Error querying database:', err.message);
                return res.status(500).json({ error: 'Database query error' });
            }

            if (row) {
                console.log(`Updating existing entry with id=${row.id}`);
                const encryptedNotes = encrypt(notes);
                db.run(
                    'UPDATE emotions SET score = ?, notes = ? WHERE id = ?',
                    [score, encryptedNotes, row.id],
                    function (err) {
                        if (err) {
                            console.error('Error updating database:', err.message);
                            return res.status(500).json({ error: 'Database update error' });
                        }
                        console.log(`Entry updated successfully: id=${row.id}`);
                        res.json({ success: true, id: row.id });
                    }
                );
            } else {
                console.log('Inserting new entry');
                const encryptedNotes = encrypt(notes);
                db.run(
                    'INSERT INTO emotions (date, score, notes, tags) VALUES (?, ?, ?, ?)',
                    [date, score, encryptedNotes, tags],
                    function (err) {
                        if (err) {
                            console.error('Error inserting into database:', err.message);
                            return res.status(500).json({ error: 'Database insert error' });
                        }
                        console.log(`Entry inserted successfully: id=${this.lastID}`);
                        res.json({ success: true, id: this.lastID });
                    }
                );
            }
        }
    );
});

// API route to search notes
app.get('/api/search', (req, res) => {
    const query = req.query.q?.trim();
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Searching notes for query: "${query}"`);
    db.all('SELECT date, notes FROM emotions ORDER BY date', [], (err, rows) => {
        if (err) {
            console.error('Error searching notes:', err.message);
            return res.status(500).json({ error: 'Database query error' });
        }

        const lowerQuery = query.toLowerCase();
        const results = rows
            .map(row => ({
                date: row.date,
                notes: decrypt(row.notes)
            }))
            .filter(entry => (entry.notes || '').toLowerCase().includes(lowerQuery));

        console.log(`Found ${results.length} matching notes.`);
        res.json(results);
    });
});

// DELETE /api/emotions: Delete an entry for a specific date and tag
app.delete('/api/emotions', [
    body('date').isISO8601().withMessage('Invalid date format'),
    body('tag').notEmpty().withMessage('Tag is required')
], (req, res) => {
    const { date, tag } = req.body;

    if (!date || !tag) {
        return res.status(400).json({ error: 'Date and tag are required to delete an entry.' });
    }

    console.log(`Deleting entry for date: ${date}, tag: ${tag}`);
    db.serialize(() => {
        db.run('BEGIN TRANSACTION', beginErr => {
            if (beginErr) {
                console.error('Error starting transaction:', beginErr.message);
                return res.status(500).json({ error: 'Failed to start delete transaction.' });
            }

            db.run('DELETE FROM emotions WHERE date = ? AND tags = ?', [date, tag], function (err) {
                if (err) {
                    console.error('Error deleting entry:', err.message);
                    return db.run('ROLLBACK', rollbackErr => {
                        if (rollbackErr) {
                            console.error('Error rolling back transaction:', rollbackErr.message);
                        }
                        res.status(500).json({ error: 'Failed to delete entry.' });
                    });
                }

                if (this.changes === 0) {
                    return db.run('ROLLBACK', rollbackErr => {
                        if (rollbackErr) {
                            console.error('Error rolling back transaction:', rollbackErr.message);
                        }
                        res.status(404).json({ error: 'No entry found for the specified date and tag.' });
                    });
                }

                db.run('COMMIT', commitErr => {
                    if (commitErr) {
                        console.error('Error committing transaction:', commitErr.message);
                        return res.status(500).json({ error: 'Failed to commit delete transaction.' });
                    }

                    console.log(`Entry deleted successfully for date: ${date}, tag: ${tag}`);
                    res.json({ success: true });
                });
            });
        });
    });
});

// PATCH /api/emotions/modify-date: Modify the date of an existing entry
app.patch('/api/emotions/modify-date', (req, res) => {
    const { oldDate, newDate } = req.body;

    if (!oldDate || !newDate) {
        return res.status(400).json({ error: 'Both oldDate and newDate are required to modify an entry.' });
    }

    console.log(`Modifying entry date from ${oldDate} to ${newDate}`);
    const sql = 'UPDATE emotions SET date = ? WHERE date = ?';
    db.run(sql, [newDate, oldDate], function (err) {
        if (err) {
            console.error('Error modifying entry date:', err.message);
            return res.status(500).json({ error: 'Failed to modify entry date.' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'No entry found for the specified oldDate.' });
        }

        console.log(`Entry date modified successfully from ${oldDate} to ${newDate}`);
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
