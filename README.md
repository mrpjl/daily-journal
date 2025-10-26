# Emotion Tracker

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open browser: `http://localhost:3000`

---

## Docker Setup

1. Build and run:
   ```bash
   docker-compose up -d
   ```

2. Open browser: `http://localhost:3000`

---

## Database Location

- Local: `./data/emotions.db`
- Docker: Mounted volume at `./data/emotions.db`

The SQLite database persists on your local filesystem in both cases.

# Emotion Tracker Application - SOP User Document

This document provides standard operating procedures (SOP) for maintaining and managing the Emotion Tracker application. Follow these steps to ensure the application remains secure, up-to-date, and functional.

---

## 1. Checking and Updating Vulnerable NPM Packages

### Steps:
1. Run the following command to check for vulnerabilities in the `node_modules`:
   ```bash
   npm audit
   ```
2. Review the vulnerabilities listed in the output.
3. To fix vulnerabilities automatically, run:
   ```bash
   npm audit fix
   ```
4. If some vulnerabilities cannot be fixed automatically, check the details and update the specific packages manually:
   ```bash
   npm install <package-name>@latest
   ```
5. After updating, re-run `npm audit` to ensure no vulnerabilities remain.

---

## 2. Updating the Database for New Columns Without Deleting the Database

### Steps:
1. Open the `server.js` file and locate the `initDatabase` function.
2. Add an `ALTER TABLE` statement to add the new column. For example:
   ```sql
   ALTER TABLE emotions ADD COLUMN new_column_name TEXT;
   ```
3. Ensure the `CREATE TABLE` statement in the `initDatabase` function includes the new column for fresh installations.
4. Restart the server to apply the changes:
   ```bash
   npm start
   ```
5. Verify the database schema using an SQLite client:
   ```bash
   sqlite3 data/emotions.db
   .schema emotions
   ```

## 3. Scanning the Code for Zero Vulnerabilities

### Steps:
1. Use `npm audit` to scan for vulnerabilities in dependencies.
2. Use a static code analysis tool like [SonarQube](https://www.sonarqube.org/) or [ESLint](https://eslint.org/) to scan the codebase:
   ```bash
   npx eslint .
   ```
3. Address any issues flagged by the tools.

---

## 4. Managing the Code Securely

### Best Practices:
- **Version Control**: Use Git for version control. Commit changes frequently and write meaningful commit messages.
- **Branching**: Use feature branches for new features and bug fixes. Merge changes into the `main` branch only after review.
- **Secrets Management**: Do not hardcode sensitive information (e.g., API keys, database credentials). Use environment variables instead.
- **Access Control**: Restrict access to the repository and ensure only authorized users can make changes.

---

## 5. Dockerized Deployment Steps

### Steps:
1. Create a `Dockerfile` in the project root:
   ```dockerfile
   # Use Node.js base image
   FROM node:16

   # Set working directory
   WORKDIR /app

   # Copy package files and install dependencies
   COPY package*.json ./
   RUN npm install

   # Copy the application code
   COPY . .

   # Expose the application port
   EXPOSE 3000

   # Start the application
   CMD ["npm", "start"]
   ```
2. Build the Docker image:
   ```bash
   docker build -t emotion-tracker .
   ```
3. Run the Docker container:
   ```bash
   docker run -d -p 3000:3000 --name emotion-tracker emotion-tracker
   ```
4. Verify the application is running:
   ```bash
   docker ps
   ```

---

## 6. Regular Maintenance Tasks

### Steps:
1. **Backup the Database**:
   - Periodically back up the SQLite database:
     ```bash
     cp data/emotions.db backups/emotions-$(date +%F).db
     ```
2. **Update Dependencies**:
   - Regularly update dependencies to their latest versions:
     ```bash
     npm outdated
     npm update
     ```
3. **Monitor Logs**:
   - Check application logs for errors or unusual activity:
     ```bash
     docker logs emotion-tracker
     ```

---

## 7. Additional Notes

- **Testing**: Always test changes in a staging environment before deploying to production.
- **Documentation**: Keep this document updated with any new procedures or changes to the application.

---

By following these steps, you can ensure the Emotion Tracker application remains secure, reliable, and easy to maintain.


---

## Database Migrations

The application uses a simple migration system to manage database schema changes. Migrations are stored as `.sql` files in the `migrations` folder and are applied automatically when the server starts.

### Steps to Add a New Migration

1. **Create a New Migration File**:
   - Navigate to the `migrations` folder:
     ```bash
     cd migrations
     ```
   - Create a new `.sql` file with a sequential name (e.g., `002_add_example_column.sql`):
     ```bash
     touch 002_add_example_column.sql
     ```

2. **Write the SQL Migration**:
   - Open the file and add the SQL commands for the migration. For example:
     ```sql
     ALTER TABLE emotions ADD COLUMN example_column TEXT DEFAULT 'example';
     ```

3. **Restart the Server**:
   - Restart the server to apply the migration:
     ```bash
     npm start
     ```

4. **Verify the Migration**:
   - Check the database schema to ensure the migration was applied:
     ```bash
     sqlite3 data/emotions.db
     .schema emotions
     ```
### Notes
- Migrations are applied in the order of their filenames (e.g., `001_`, `002_`, etc.).
- Each migration is applied only once and is tracked in the `migrations` table.
- If a migration fails, check the server logs for error details.
---

# Emotion Tracker Application

## Features

### 1. Heatmap for Daily Emotions
- Displays a heatmap where each cell represents a day and its corresponding emotion score.
- Emotion scores range from -5 (Very Angry) to 5 (Ecstatic), with distinct colors for each score.

### 2. Add Notes for Each Day
- Users can add notes for each day along with the emotion score.
- Notes are stored in the database and can be updated at any time.

### 3. View Notes and Emotion Details for a Selected Date
- Clicking on a specific date in the heatmap displays the following details in a section below the heatmap:
  - **Selected Date**: The date clicked on.
  - **Emotion of the Day**: The emotion state corresponding to the score (e.g., "Happy", "Sad").
  - **Notes**: The notes added for that day, formatted with support for Markdown-like syntax:
    - `**bold**` → **bold**
    - `*italic*` → *italic*
    - Newlines (`\n`) are rendered as line breaks.

### Example
If you click on a date (e.g., `Oct 20, 2025`), the section will display:
```
Notes for Selected Date
Selected Date: Oct 20, 2025
Emotion of the day: Happy
Notes:
This is a **test** note.
- Line 1
- Line 2
```

---

## How to Use

1. **Add an Entry**:
   - Use the form at the top of the page to select a date, enter an emotion score, and add notes.
   - Click the "Add Entry" button to save the data.

2. **View Notes and Emotion Details**:
   - Click on any date in the heatmap to view its details in the "Notes for Selected Date" section below the heatmap.

3. **Markdown Support**:
   - Use `**bold**` for bold text and `*italic*` for italic text in the notes.
   - Use newlines (`\n`) to separate lines in the notes.

---

## Maintenance and Deployment

Refer to the [SOP User Document](#sop-user-document) for instructions on maintaining and deploying the application.

---

## API Documentation

The Emotion Tracker application provides the following RESTful APIs for managing emotions and notes.

### 1. Get All Emotion Entries

**Endpoint**:  
`GET /api/emotions`

**Description**:  
Fetches all emotion entries from the database.

**Response**:
```json
{
    "2025-01-01": {
        "score": 2,
        "notes": "Feeling great!"
    },
    "2025-01-02": {
        "score": -3,
        "notes": "Had a tough day."
    }
}
```

---

### 2. Add or Update an Emotion Entry

**Endpoint**:  
`POST /api/emotions`

**Description**:  
Adds a new emotion entry or updates an existing one for a specific date.

**Request Body**:
```json
{
    "date": "2025-01-01",
    "score": 2,
    "notes": "Feeling great!"
}
```

**Response**:
```json
{
    "success": true,
    "date": "2025-01-01",
    "score": 2,
    "notes": "Feeling great!"
}
```

**Validation Rules**:
- `date`: Required, must be in `YYYY-MM-DD` format.
- `score`: Required, must be an integer between `-5` and `5`.
- `notes`: Optional, a string containing notes for the day.

---

## Testing the APIs

You can test the APIs using tools like [Postman](https://www.postman.com/) or `curl`.

### 1. Testing the `GET /api/emotions` Endpoint

**Using Postman**:
1. Open Postman and create a new request.
2. Set the method to `GET` and the URL to `http://localhost:3000/api/emotions`.
3. Click "Send" to fetch all emotion entries.

**Using `curl`**:
```bash
curl -X GET http://localhost:3000/api/emotions
```

---

### 2. Testing the `
- Command to generate hex code.
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))
```

Migration for Existing Plaintext Data
If you have existing plaintext notes in the database, they will be re-encrypted when updated. To force re-encryption of all existing data:
```bash
node encrypt_existing_notes.js
```
Summary
✅ Encryption is already implemented
✅ Generate and store a secure 32-byte hex key
✅ Update .env with the new key
✅ Restart the server
✅ Run migration script if you have existing plaintext data

Keep your encryption key safe! Without it, encrypted data cannot be recovered.POST /api/emotions` Endpoint

**Using Postman**:
1. Open Postman and create a new request.
2. Set the method to `POST` and the URL to `http://localhost:3000/api/emotions`.
3. Go to the "Body" tab, select "raw", and set the type to "JSON".
4. Enter the following JSON in the body:
   ```json
   {
       "date": "2025-01-01",
       "score": 2,
       "notes": "Feeling great!"
   }
   ```
5. Click "Send" to add or update the emotion entry.

**Using `curl`**:
```bash
curl -X POST http://localhost:3000/api/emotions \
-H "Content-Type: application/json" \
-d '{
    "date": "2025-01-01",
    "score": 2,
    "notes": "Feeling great!"
}'
```

---

## Error Handling

The APIs return appropriate error messages for invalid requests. Examples:

1. **Missing Required Fields**:
   ```json
   {
       "error": "Date and score are required"
   }
   ```

2. **Invalid Score**:
   ```json
   {
       "error": "Score must be between -5 and 5"
   }
   ```

---

## Notes

- Ensure the server is running before testing the APIs:
  ```bash
  npm start
  ```
- Use the `sqlite3` CLI or any SQLite client to verify the database contents:
  ```bash
  sqlite3 data/emotions.db
  SELECT * FROM emotions;
  ```

This section provides a comprehensive guide to the available APIs and how to test them effectively.
