import { Client, Account, Databases, Storage, Avatars } from 'appwrite';

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const avatars = new Avatars(client);
export { client };

export const DB_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID || '';
export const MESSAGES_COL = 'messages';
export const ROOMS_COL = 'rooms';
export const BUCKET_ID = 'chat-media';
