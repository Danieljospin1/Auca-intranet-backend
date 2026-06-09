require('dotenv').config();
const connectionPromise = require('./database & models/databaseConnection');

async function alterTable() {
    try {
        console.log("Adding ClaimSummary column to posts table...");
        await connectionPromise.query(`ALTER TABLE posts ADD COLUMN ClaimSummary TEXT DEFAULT NULL;`);
        console.log("Column added successfully!");
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists. Skipping.");
        } else {
            console.error("Error adding column:", err);
        }
    } finally {
        process.exit();
    }
}
alterTable();
