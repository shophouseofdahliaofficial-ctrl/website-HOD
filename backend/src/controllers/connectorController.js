const { query } = require('../config/database');
const { google } = require('googleapis');

const SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  photos: 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
};

/**
 * Build a Google OAuth2 client using env credentials.
 */
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables.');
  }

  // redirect_uri = 'postmessage' is required for popup-based code exchange
  return new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
}

/**
 * POST /api/connectors/google/exchange
 * Body: { code: string, scope: 'drive' | 'photos' }
 *
 * Exchanges an authorization code for tokens and stores the refresh token.
 */
exports.exchangeCode = async (req, res, next) => {
  try {
    const { code, scope } = req.body;
    const userId = req.user.id;

    if (!code || !scope) {
      return res.status(400).json({ success: false, error: 'code and scope are required.' });
    }

    if (!SCOPES[scope]) {
      return res.status(400).json({ success: false, error: 'scope must be "drive" or "photos".' });
    }

    const oauth2Client = getOAuth2Client();

    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // Google only returns refresh_token on the FIRST consent.
      // If user re-authorises without revoking, Google may omit it.
      // Check if we already have one stored.
      const existing = await query(
        'SELECT id FROM google_connectors WHERE user_id = $1 AND scope = $2',
        [userId, scope],
      );

      if (existing.rows.length > 0) {
        // We already have a refresh token; just update connected_at
        await query(
          'UPDATE google_connectors SET connected_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND scope = $2',
          [userId, scope],
        );
        return res.json({
          success: true,
          data: { connected: true, scope },
        });
      }

      return res.status(400).json({
        success: false,
        error:
          'Google did not return a refresh token. Please revoke access at https://myaccount.google.com/permissions and try again.',
      });
    }

    // Upsert refresh token
    await query(
      `INSERT INTO google_connectors (user_id, scope, refresh_token, connected_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id, scope) DO UPDATE
         SET refresh_token = EXCLUDED.refresh_token,
             connected_at = NOW(),
             updated_at = NOW()`,
      [userId, scope, tokens.refresh_token],
    );

    res.json({
      success: true,
      data: { connected: true, scope },
    });
  } catch (error) {
    console.error('[Connectors] Exchange code error:', error.message);
    next(error);
  }
};

/**
 * GET /api/connectors/google/token?scope=drive|photos
 *
 * Returns a fresh access token using the stored refresh token.
 */
exports.getAccessToken = async (req, res, next) => {
  try {
    const { scope } = req.query;
    const userId = req.user.id;

    if (!scope || !SCOPES[scope]) {
      return res.status(400).json({ success: false, error: 'scope query param must be "drive" or "photos".' });
    }

    const result = await query(
      'SELECT refresh_token FROM google_connectors WHERE user_id = $1 AND scope = $2',
      [userId, scope],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not connected. Please connect first.' });
    }

    const refreshToken = result.rows[0].refresh_token;
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Get a fresh access token
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      return res.status(500).json({ success: false, error: 'Failed to refresh access token.' });
    }

    res.json({
      success: true,
      data: {
        access_token: credentials.access_token,
        expires_in: credentials.expiry_date
          ? Math.max(0, Math.floor((credentials.expiry_date - Date.now()) / 1000))
          : 3600,
      },
    });
  } catch (error) {
    console.error('[Connectors] Get access token error:', error.message);

    // If the refresh token is revoked / invalid, remove the connector
    if (
      error.message?.includes('invalid_grant') ||
      error.message?.includes('Token has been expired or revoked')
    ) {
      const { scope } = req.query;
      const userId = req.user.id;
      await query('DELETE FROM google_connectors WHERE user_id = $1 AND scope = $2', [userId, scope]);
      return res.status(401).json({
        success: false,
        error: 'Google authorization has been revoked. Please reconnect.',
      });
    }

    next(error);
  }
};

/**
 * DELETE /api/connectors/google/disconnect?scope=drive|photos
 *
 * Removes the stored refresh token (disconnects).
 */
exports.disconnect = async (req, res, next) => {
  try {
    const { scope } = req.query;
    const userId = req.user.id;

    if (!scope || !SCOPES[scope]) {
      return res.status(400).json({ success: false, error: 'scope query param must be "drive" or "photos".' });
    }

    // Optionally revoke the token at Google
    const result = await query(
      'SELECT refresh_token FROM google_connectors WHERE user_id = $1 AND scope = $2',
      [userId, scope],
    );

    if (result.rows.length > 0) {
      const refreshToken = result.rows[0].refresh_token;
      try {
        const oauth2Client = getOAuth2Client();
        await oauth2Client.revokeToken(refreshToken);
      } catch (revokeErr) {
        // Non-fatal: token may already be invalid
        console.warn('[Connectors] Token revocation failed (non-fatal):', revokeErr.message);
      }
    }

    await query('DELETE FROM google_connectors WHERE user_id = $1 AND scope = $2', [userId, scope]);

    res.json({ success: true, data: { disconnected: true, scope } });
  } catch (error) {
    console.error('[Connectors] Disconnect error:', error.message);
    next(error);
  }
};

/**
 * GET /api/connectors/google/status
 *
 * Returns which scopes are connected for the current user.
 */
exports.getStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT scope, connected_at FROM google_connectors WHERE user_id = $1',
      [userId],
    );

    const connected = {};
    for (const row of result.rows) {
      connected[row.scope] = { connected: true, connectedAt: row.connected_at };
    }

    res.json({
      success: true,
      data: {
        drive: connected.drive || { connected: false },
        photos: connected.photos || { connected: false },
      },
    });
  } catch (error) {
    console.error('[Connectors] Status error:', error.message);
    next(error);
  }
};

/**
 * Helper to get a fresh access token for a specific user and scope.
 */
async function getFreshAccessTokenForUser(userId, scope) {
  const scopeValue = SCOPES[scope];
  if (!scopeValue) {
    throw new Error(`Invalid scope name: ${scope}`);
  }

  const result = await query(
    'SELECT refresh_token FROM google_connectors WHERE user_id = $1 AND scope = $2',
    [userId, scope],
  );

  if (result.rows.length === 0) {
    throw new Error('Not connected. Please connect first.');
  }

  const refreshToken = result.rows[0].refresh_token;
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token.');
  }

  return credentials.access_token;
}

/**
 * POST /api/connectors/google/photos/session
 *
 * Creates a Google Photos Picker session and returns the pickerUri and sessionId.
 */
exports.createPhotosSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const accessToken = await getFreshAccessTokenForUser(userId, 'photos');

    // Create session via REST API
    const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create Google Photos Picker session: ${errorText}`);
    }

    const data = await response.json();
    // data contains: { id, pickerUri, mediaItemsSet, pollingConfig: { pollInterval, timeoutIn } }

    res.json({
      success: true,
      data: {
        sessionId: data.id,
        pickerUri: data.pickerUri,
      },
    });
  } catch (error) {
    console.error('[Connectors] Create Photos session error:', error.message);
    next(error);
  }
};

/**
 * GET /api/connectors/google/photos/session/:sessionId
 *
 * Polls the session status. If mediaItemsSet is true, retrieves the media items.
 */
exports.pollPhotosSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required.' });
    }

    const accessToken = await getFreshAccessTokenForUser(userId, 'photos');

    // Get session status
    const sessionResponse = await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      if (sessionResponse.status === 401 || sessionResponse.status === 403) {
        return res.status(sessionResponse.status).json({ success: false, error: 'Google authorization has been revoked or expired.' });
      }
      throw new Error(`Failed to get Google Photos Picker session: ${errorText}`);
    }

    const sessionData = await sessionResponse.json();

    if (sessionData.mediaItemsSet) {
      // Fetch selected media items
      const itemsResponse = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!itemsResponse.ok) {
        const errorText = await itemsResponse.text();
        throw new Error(`Failed to list Google Photos Picker media items: ${errorText}`);
      }

      const itemsData = await itemsResponse.json();
      // itemsData is: { mediaItems: [ { id, mediaFile: { filename, baseUrl, mimeType } } ], nextPageToken }

      // Optionally delete the session since it's fully complete
      try {
        await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
      } catch (deleteErr) {
        console.warn('[Connectors] Failed to delete session (non-fatal):', deleteErr.message);
      }

      return res.json({
        success: true,
        data: {
          mediaItemsSet: true,
          mediaItems: itemsData.mediaItems || [],
        },
      });
    }

    // Still selecting
    res.json({
      success: true,
      data: {
        mediaItemsSet: false,
      },
    });
  } catch (error) {
    console.error('[Connectors] Poll Photos session error:', error.message);
    next(error);
  }
};

/**
 * GET /api/connectors/google/photos/proxy
 * Query: { url: string }
 *
 * Proxies Google Photos user content (lh3.googleusercontent.com) URLs to bypass browser CORS restrictions.
 */
exports.proxyPhoto = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'url is required.' });
    }

    const { URL } = require('url');
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Verify the URL is from googleusercontent.com
    if (hostname !== 'lh3.googleusercontent.com' && !hostname.endsWith('.googleusercontent.com')) {
      return res.status(403).json({ success: false, error: 'Forbidden: Invalid domain.' });
    }

    // Get fresh Google OAuth access token for this user
    const userId = req.user.id;
    const googleAccessToken = await getFreshAccessTokenForUser(userId, 'photos');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch photo from Google: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Convert arrayBuffer to Buffer and send
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('[Connectors] Proxy photo error:', error.message);
    next(error);
  }
};

