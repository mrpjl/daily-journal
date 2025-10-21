const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({ origin: '*' })); // Allow all origins
app.use(express.json());

// Ensure the data directory exists
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'emotions.db');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Serve static files
app.use(express.static(__dirname));

// Serve the HTML file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'emotion-tracker.html'));
});

// Open SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Database connected at:', DB_PATH);
        initDatabase();
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
            console.error('Error creating table:', err);
        } else {
            console.log('Database table ready');
        }
    });
}

// API Routes

// Get all emotions
app.get('/api/emotions', (req, res) => {
    db.all('SELECT * FROM emotions ORDER BY date', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const data = rows.reduce((acc, row) => {
            if (!acc[row.date]) acc[row.date] = [];
            acc[row.date].push({
                score: row.score,
                notes: row.notes,
                tags: row.tags
            });
            return acc;
        }, {});
        res.json(data);
    });
});

// Add or update emotion entry
app.post('/api/emotions', (req, res) => {
    const { date, score, notes, tags } = req.body;

    if (!date || score === undefined) {
        return res.status(400).json({ error: 'Date and score are required' });
    }

    db.get(
        'SELECT id FROM emotions WHERE date = ? AND tags = ?',
        [date, tags],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (row) {
                // Update existing entry
                db.run(
                    'UPDATE emotions SET score = ?, notes = ? WHERE id = ?',
                    [score, notes, row.id],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({ success: true, id: row.id });
                    }
                );
            } else {
                // Insert new entry
                db.run(
                    'INSERT INTO emotions (date, score, notes, tags) VALUES (?, ?, ?, ?)',
                    [date, score, notes, tags],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        res.json({ success: true, id: this.lastID });
                    }
                );
            }
        }
    );
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
