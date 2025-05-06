import path from 'path';
import fs from 'fs/promises';
import pkg from 'whatsapp-web.js';
import { addSession } from './utils/sessions/sessionManager.js';

const { Client, LocalAuth }  = pkg
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const sessionBasePath = path.join(__dirname, '.wwebjs_auth'); // or your correct path
const sessions = new Map(); // or your session manager

export async function restoreSessions() {
  try {
    const dirs = await fs.readdir(sessionBasePath);
    for (const dir of dirs) {
      if (dir.startsWith('session-')) {
        const userId = dir.replace('session-', '');
        const client = new Client({
          authStrategy: new LocalAuth({ clientId: userId }),
        });

        client.on('ready', () => {
          console.log(`✅ Restored WhatsApp session for user ${userId}`);
        });

        client.on('auth_failure', msg => {
          console.error(`❌ Auth failure for ${userId}:`, msg);
        });

        client.on('disconnected', reason => {
          console.warn(`⚠️ Disconnected for ${userId}:`, reason);
        });

        client.initialize();
        addSession(userId, client); // your session map function
      }
    }
  } catch (err) {
    console.error('Failed to restore sessions:', err);
  }
}
