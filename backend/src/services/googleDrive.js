/**
 * Google Drive Upload Service
 * Handles uploading files to Google Drive using a Service Account JSON Key
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

// Path to the service account JSON key
const KEY_PATH = path.join(__dirname, '..', 'config', 'google-service-account-key.json');

let driveInstance = null;

/**
 * Get or initialize Google Drive client instance
 */
function getDriveClient() {
  if (driveInstance) return driveInstance;

  // 1. Try OAuth 2.0 Refresh Token (Highly recommended for personal accounts with quota)
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    console.log('🔑 Loading Google OAuth 2.0 Client credentials...');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      throw new Error('❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when GOOGLE_REFRESH_TOKEN is provided.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
    return driveInstance;
  }

  // 2. Fallback: Try loading Service Account credentials
  let credentials;

  // 2.1. Try loading from Base64 Environment Variable (Highly recommended to avoid copy-paste corruption)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
    try {
      console.log('🔑 Loading Google Service Account credentials from Base64 env variable...');
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      credentials = JSON.parse(decoded);
    } catch (e) {
      throw new Error('❌ GOOGLE_SERVICE_ACCOUNT_BASE64 env variable is not in a valid Base64 JSON format.');
    }
  }
  // 2.2. Try loading from standard Environment Variable (Render Production)
  else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      console.log('🔑 Loading Google Service Account credentials from environment variable...');
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      throw new Error('❌ GOOGLE_SERVICE_ACCOUNT_KEY env variable is not in a valid JSON format.');
    }
  } 
  // 2.3. Fall back to reading local file (Development)
  else if (fs.existsSync(KEY_PATH)) {
    console.log('📂 Loading Google Service Account credentials from local key file...');
    credentials = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  } 
  // 2.4. Throw descriptive error
  else {
    throw new Error(`❌ Google Drive credentials not found. Configure GOOGLE_REFRESH_TOKEN, GOOGLE_SERVICE_ACCOUNT_BASE64/GOOGLE_SERVICE_ACCOUNT_KEY, or place a credential file at: ${KEY_PATH}`);
  }

  // Fix escaped newlines in private key (common issue in env variables/JSON formats)
  const privateKey = credentials.private_key ? credentials.private_key.replace(/\\n/g, '\n') : '';

  // Configure Google Auth Client
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  // Initialize Drive client API (v3)
  driveInstance = google.drive({ version: 'v3', auth });
  return driveInstance;
}

/**
 * Convert a Buffer to a readable stream for drive uploads
 * @param {Buffer} buffer 
 * @returns {Readable}
 */
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

/**
 * Uploads a video file buffer to the configured Google Drive folder
 * @param {Buffer} fileBuffer - The binary video file buffer
 * @param {string} filename - Filename to save as on Drive (e.g. UC_3B8K2F.webm)
 * @param {string} mimeType - The mime type of the video (e.g. video/webm)
 * @returns {Promise<{fileId: string, webViewLink: string}>}
 */
async function uploadVideoToDrive(fileBuffer, filename, mimeType = 'video/webm') {
  try {
    const drive = getDriveClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId || folderId === 'PLACEHOLDER_FOLDER_ID') {
      console.warn('⚠️ GOOGLE_DRIVE_FOLDER_ID is not configured in .env. Video will be uploaded to root drive folder.');
    }

    console.log(`📤 Starting upload to Google Drive: ${filename} (${fileBuffer.length} bytes)...`);

    // Metadata configuration
    const fileMetadata = {
      name: filename,
      parents: folderId && folderId !== 'PLACEHOLDER_FOLDER_ID' ? [folderId] : []
    };

    // Media configuration
    const media = {
      mimeType,
      body: bufferToStream(fileBuffer)
    };

    // 1. Upload the file
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true
    });

    const fileId = file.data.id;
    console.log(`✅ Uploaded successfully to Drive. File ID: ${fileId}`);

    // 2. Set public sharing permissions ("anyone with the link can view")
    console.log(`🔒 Making file public for direct customer streaming...`);
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      supportsAllDrives: true
    });

    console.log(`✅ File is now public!`);

    // 3. Fetch updated links
    const fileDetails = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink, webContentLink',
      supportsAllDrives: true
    });

    return {
      fileId,
      webViewLink: fileDetails.data.webViewLink,
      webContentLink: fileDetails.data.webContentLink
    };
  } catch (error) {
    console.error('❌ Google Drive upload helper error:', error);
    throw error;
  }
}

module.exports = {
  uploadVideoToDrive,
  getDriveClient
};
