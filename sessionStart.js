import path from 'path';
import fs from 'fs/promises';
import pkg from 'whatsapp-web.js';
import { addSession } from './utils/sessions/sessionManager.js';
import { fileURLToPath } from 'url';

const { Client, LocalAuth } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionBasePath = path.join(__dirname, '.wwebjs_auth');

export async function restoreSessions() {
  try {
    const dirs = await fs.readdir(sessionBasePath);

    for (const dir of dirs) {
      if (dir.startsWith('session-')) {
        // Extract userId and deviceId
        const parts = dir.replace('session-', '').split('-');
        if (parts.length < 2) continue;

        const userId = parts[0];
        const deviceId = parts.slice(1).join('-'); // In case deviceId has dashes

        const client = new Client({
          authStrategy: new LocalAuth({ clientId: `${userId}-${deviceId}` }),
        });

        client.on('ready', () => {
          console.log(`✅ Restored session for user: ${userId}, device: ${deviceId}`);
        });

        client.on('auth_failure', (msg) => {
          console.error(`❌ Auth failure for ${userId}-${deviceId}:`, msg);
        });

        client.on('disconnected', (reason) => {
          console.warn(`⚠️ Disconnected: ${userId}-${deviceId}:`, reason);
        });

        client.initialize();
        addSession(userId, deviceId, client);
      }
    }
  } catch (err) {
    console.error('❌ Failed to restore sessions:', err);
  }
}
