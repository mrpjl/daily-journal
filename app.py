import os
import sqlite3
import hashlib
import re
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')

# --- MIDDLEWARE & SECURITY (Equivalent to Helmet, CORS, RateLimit) ---
CORS(app, resources={r"/*": {"origins": "*"}})

# Content Security Policy (Helmet equivalent)
csp = {
    'default-src': "'self'",
    'script-src': "'self'",
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", "data:"],
    'font-src': ["'self'", "https:"],
    'connect-src': "'self'",
    'object-src': "'none'"
}
# Note: Talisman upgrades insecure requests by default
Talisman(app, content_security_policy=csp, content_security_policy_nonce_in=['script-src'],force_https=False)

# Rate Limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per 15 minute"],
    storage_uri="memory://"
)

# Logger setup (Winston equivalent)
logging.basicConfig(level=logging.INFO, format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}')
logger = logging.getLogger(__name__)

# --- DATABASE SETUP ---
DATABASE_PATH = os.getenv('DATABASE_PATH', os.path.join(os.path.dirname(__file__), 'data', 'emotions.db'))
os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

def get_db():
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    return db

def init_database():
    with get_db() as db:
        db.execute('''
            CREATE TABLE IF NOT EXISTS emotions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                score INTEGER NOT NULL,
                notes TEXT,
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        db.commit()
    logger.info('Database table "emotions" is ready.')

def run_migrations():
    logger.info('Running database migrations...')
    with get_db() as db:
        db.execute('''
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        migrations_path = os.path.join(os.path.dirname(__file__), 'migrations')
        os.makedirs(migrations_path, exist_ok=True)
        
        applied = {row['name'] for row in db.execute('SELECT name FROM migrations').fetchall()}
        files = sorted([f for f in os.listdir(migrations_path) if f.endswith('.sql')])
        
        for file in files:
            if file not in applied:
                logger.info(f'Applying migration: {file}')
                with open(os.path.join(migrations_path, file), 'r', encoding='utf-8') as f:
                    db.executescript(f.read())
                db.execute('INSERT INTO migrations (name) VALUES (?)', (file,))
                db.commit()
                logger.info(f'Migration applied successfully: {file}')

# --- ENCRYPTION (Exact match to Node.js crypto aes-256-cbc) ---
RAW_ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', '9CC9F047A63371C987B2182278695CC8F9CC9F047A63371C987B2182278695CC8')

# Key derivation matching your logic
if len(RAW_ENCRYPTION_KEY) == 64 and re.match(r'^[0-9a-fA-F]+$', RAW_ENCRYPTION_KEY):
    ENCRYPTION_KEY = bytes.fromhex(RAW_ENCRYPTION_KEY)
else:
    logger.warning('ENCRYPTION_KEY is not 32-byte hex; using SHA-256 derived key.')
    ENCRYPTION_KEY = hashlib.sha256(RAW_ENCRYPTION_KEY.encode('utf-8')).digest()

def encrypt(text):
    if not text: return text
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(ENCRYPTION_KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    
    # Node implicitly pads data; Python needs explicit PKCS7 padding
    padder = padding.PKCS7(algorithms.AES.block_size).padder()
    padded_data = padder.update(text.encode('utf-8')) + padder.finalize()
    
    encrypted = encryptor.update(padded_data) + encryptor.finalize()
    return iv.hex() + ':' + encrypted.hex()

def decrypt(encrypted_text):
    if not encrypted_text: return encrypted_text
    parts = encrypted_text.split(':')
    if len(parts) != 2: return encrypted_text
    
    try:
        iv = bytes.fromhex(parts[0])
        encrypted_data = bytes.fromhex(parts[1])
        
        cipher = Cipher(algorithms.AES(ENCRYPTION_KEY), modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded_data = decryptor.update(encrypted_data) + decryptor.finalize()
        
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        data = unpadder.update(padded_data) + unpadder.finalize()
        
        return data.decode('utf-8')
    except Exception as e:
        logger.warning(f'Failed to decrypt notes; returning stored value. {e}')
        return encrypted_text

# --- ROUTES ---

@app.route('/')
def index():
    return app.send_static_file('emotion-tracker.html')

@app.route('/api/emotions', methods=['GET'])
def get_emotions():
    date = request.args.get('date')
    tags = request.args.get('tags')
    
    query = 'SELECT * FROM emotions'
    params = []
    conditions = []
    
    if date:
        conditions.append('date = ?')
        params.append(date)
    if tags:
        conditions.append('tags LIKE ?')
        params.append(f'%{tags}%')
        
    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)
        
    query += ' ORDER BY date'
    
    with get_db() as db:
        rows = db.execute(query, params).fetchall()
        
    data = {}
    for row in rows:
        r_date = row['date']
        if r_date not in data:
            data[r_date] = []
        data[r_date].append({
            'score': row['score'],
            'notes': decrypt(row['notes']),
            'tags': row['tags']
        })
    return jsonify(data)

@app.route('/api/emotions/heatmap', methods=['GET'])
def get_heatmap():
    with get_db() as db:
        rows = db.execute('SELECT date, score FROM emotions ORDER BY date').fetchall()
    data = {}
    for row in rows:
        r_date = row['date']
        if r_date not in data:
            data[r_date] = []
        data[r_date].append(row['score'])
    return jsonify(data)

@app.route('/api/emotions', methods=['POST'])
def save_emotion():
    data = request.json
    date = data.get('date')
    score = data.get('score')
    notes = data.get('notes', '').strip()
    tags = data.get('tags', '').strip()

    if not date or score is None:
        return jsonify({'error': 'Date and score are required'}), 400
    try:
        score = int(score)
        if not (-5 <= score <= 5):
            raise ValueError
    except ValueError:
        return jsonify({'error': 'Score must be between -5 and 5'}), 400

    encrypted_notes = encrypt(notes)
    
    with get_db() as db:
        existing = db.execute('SELECT id FROM emotions WHERE date = ? AND tags = ?', (date, tags)).fetchone()
        
        if existing:
            db.execute('UPDATE emotions SET score = ?, notes = ? WHERE id = ?', (score, encrypted_notes, existing['id']))
            db.commit()
            return jsonify({'success': True, 'id': existing['id']})
        else:
            cursor = db.execute('INSERT INTO emotions (date, score, notes, tags) VALUES (?, ?, ?, ?)', (date, score, encrypted_notes, tags))
            db.commit()
            return jsonify({'success': True, 'id': cursor.lastrowid})

@app.route('/api/search', methods=['GET'])
def search_notes():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Search query is required'}), 400
    
    lower_query = query.lower()
    results = []
    
    with get_db() as db:
        rows = db.execute('SELECT date, notes FROM emotions ORDER BY date').fetchall()
        
    for row in rows:
        decrypted_notes = decrypt(row['notes'])
        if decrypted_notes and lower_query in decrypted_notes.lower():
            results.append({
                'date': row['date'],
                'notes': decrypted_notes
            })
    return jsonify(results)

@app.route('/api/emotions', methods=['DELETE'])
def delete_emotion():
    date_input = request.json.get('date')
    tag = request.json.get('tag')
    
    if not date_input or not tag:
        return jsonify({'error': 'Date and tag are required'}), 400
        
    # Convert date to YYYY-MM-DD
    utc_date = date_input.split('T')[0]
    
    with get_db() as db:
        cursor = db.execute('DELETE FROM emotions WHERE date = ? AND tags = ?', (utc_date, tag))
        if cursor.rowcount == 0:
            return jsonify({'error': 'No entry found for the specified date and tag.'}), 404
        db.commit()
        
    return jsonify({'success': True})

@app.route('/api/emotions/modify-date', methods=['PATCH'])
def modify_date():
    old_date = request.json.get('oldDate')
    new_date = request.json.get('newDate')
    
    if not old_date or not new_date:
        return jsonify({'error': 'Both oldDate and newDate are required.'}), 400
        
    utc_old_date = old_date.split('T')[0]
    utc_new_date = new_date.split('T')[0]
    
    with get_db() as db:
        cursor = db.execute('UPDATE emotions SET date = ? WHERE date = ?', (utc_new_date, utc_old_date))
        if cursor.rowcount == 0:
            return jsonify({'error': 'No entry found for the specified oldDate.'}), 404
        db.commit()
        
    return jsonify({'success': True})

@app.route('/api/bookmarks', methods=['GET'])
def get_bookmarks():
    bookmarks = []
    with get_db() as db:
        rows = db.execute("SELECT date, notes, tags FROM emotions WHERE tags LIKE '%bookmark%'").fetchall()
        
    for row in rows:
        decrypted_notes = decrypt(row['notes'])
        links = []
        if decrypted_notes:
            for line in decrypted_notes.split('\n'):
                parts = line.split(':', 1)
                title = parts[0].strip() if len(parts) > 0 and parts[0] else 'Untitled'
                url = parts[1].strip() if len(parts) > 1 else ''
                links.append({'title': title, 'url': url})
        
        bookmarks.append({
            'date': row['date'],
            'links': links
        })
    return jsonify(bookmarks)

if __name__ == '__main__':
    init_database()
    run_migrations()
    # Runs on port 3000 to match your current setup
    app.run(host='0.0.0.0', port=3000)
