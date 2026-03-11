import { config } from 'dotenv';
import path from 'path';

// Load environment variables strictly like src/index.tsx
config();

console.log("=== DEXTER RUNTIME DEBUG ===");
console.log("CWD:", process.cwd());
console.log("GOOGLE_API_KEY from process.env:", process.env.GOOGLE_API_KEY || "NOT FOUND");

if (process.env.GOOGLE_API_KEY) {
    const key = process.env.GOOGLE_API_KEY;
    const masked = key.substring(0, 10) + "..." + key.substring(key.length - 4);
    console.log("Masked Key:", masked);
}

// Check for .env file existence manually
import fs from 'fs';
const envPath = path.resolve(process.cwd(), '.env');
console.log(".env path resolved to:", envPath);
console.log(".env exists:", fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const hasKey = content.includes("GOOGLE_API_KEY=");
    console.log("Does .env contain GOOGLE_API_KEY line?:", hasKey);
}
