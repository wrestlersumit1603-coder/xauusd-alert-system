import { getDb } from './database.js';
const db = getDb();
console.log('Migration complete');
db.close();
