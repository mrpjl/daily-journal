"""Get the schema of the emotions table in the database."""
import sqlite3
import hashlib
import os
from pathlib import Path

from Crypto.Cipher import AES


def _read_raw_key() -> str:
    raw_key = os.getenv("ENCRYPTION_KEY")
    if raw_key:
        return raw_key.strip()

    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("ENCRYPTION_KEY="):
                return line.partition("=")[2].strip()
    return "defaultencryptionkey12345678901234"


def _derive_key(raw_key: str) -> bytes:
    if len(raw_key) == 64 and all(c in "0123456789abcdefABCDEF" for c in raw_key):
        return bytes.fromhex(raw_key)
    return hashlib.sha256(raw_key.encode("utf-8")).digest()


def decrypt_note(value: str, key: bytes) -> str:
    """Decrypts an encrypted note stored in the database."""
    if not value:
        return value
    try:
        iv_hex, cipher_hex = value.split(":", 1)
        iv = bytes.fromhex(iv_hex)
        cipher_bytes = bytes.fromhex(cipher_hex)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        padded_plaintext = cipher.decrypt(cipher_bytes)
        pad_len = padded_plaintext[-1]
        if pad_len < 1 or pad_len > AES.block_size:
            raise ValueError("Invalid padding")
        return padded_plaintext[:-pad_len].decode("utf-8")
    except (ValueError, TypeError, UnicodeDecodeError) as exc:
        return f"<decryption failed: {exc}>"

# Connect to database
conn = sqlite3.connect('./data/emotions.db')
cursor = conn.cursor()

#get list of tables in database
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
for table in tables:
    print(table)

# Get schema of the emotions table
cursor.execute("PRAGMA table_info(emotions)")
schema = cursor.fetchall()
for column in schema:
    print(column)

# select * from emotions to see existing data
cursor.execute("SELECT * FROM emotions")
raw_rows = cursor.fetchall()
encryption_key = _derive_key(_read_raw_key())
for row in raw_rows:
    row = list(row)
    print("Raw note:", row[3])
    # row[3] = decrypt_note(row[3], encryption_key)
    # only print failed decrypted notes
    # if row[3].startswith("<decryption failed:"):
    # print(tuple(row))

IV_LENGTH = 16 # AES block size

# # delete table migrations
# cursor.execute("DROP TABLE IF EXISTS migrations")
# conn.commit()

# # update the tags column to remove the # character from the beginning of each tag value.
# Commit the database to save changes.
# import sqlite3
# # Connect to database
# conn = sqlite3.connect('./data/emotions.db')
# cursor = conn.cursor()

# # # Update tags column
# # cursor.execute("UPDATE emotions SET tags = LTRIM(tags, '#')")
# # conn.commit()

# delete row of date 2025-10-20
# cursor.execute("DELETE FROM emotions WHERE date = '2025-10-01'")
# conn.commit()

# # Close the connection
conn.close()
