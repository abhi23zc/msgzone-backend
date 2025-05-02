import whatsapp from 'whatsapp-web.js';
import { User } from '../../models/user.Schema.js';
import { UserAuthStrategy } from '../UserAuthStrategy.js';
import { addSession } from './sessionManager.js';

const { Client, RemoteAuth } = whatsapp;

async function restoreAllSessions() {
  const users = await User.find({ waSession: { $exists: true, $ne: null } });

  for (const user of users) {
    const store = new UserAuthStrategy(user._id.toString());

    const client = new Client({
      authStrategy: new RemoteAuth({
        clientId: user._id.toString(),
        store: store,
        backupSyncIntervalMs: 300000
      })
    });

    client.on('ready', () => {
      console.log(`✅ Restored WhatsApp session for user: ${user.email}`);
    });

    client.on('auth_failure', () => {
      console.log(`❌ Failed to restore session for user: ${user.email}`);
    });

    client.initialize();
    addSession(user._id.toString(), client);
  }
}

export { restoreAllSessions };
