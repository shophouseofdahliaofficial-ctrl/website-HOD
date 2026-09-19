const { Pool } = require('pg');
const dns = require('dns');
const dnsPromises = require('dns').promises;
require('dotenv').config();

// Prefer IPv4 over IPv6 to avoid ENETUNREACH errors
// This makes Node.js try IPv4 first when resolving hostnames
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * PostgreSQL Connection Pool
 * Uses Supabase connection string for database operations
 * Note: For authentication, use Supabase Auth API instead of direct database queries
 */
// Get database URL and fix special characters in password
let databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

// Log which URL is being used (without password)
if (databaseUrl) {
  const urlForLogging = databaseUrl.replace(/:([^:@]+)@/, ':****@'); // Hide password
  console.log('[milko-backend] Database URL:', urlForLogging);
  if (databaseUrl.includes('db.') && databaseUrl.includes('.supabase.co') && !databaseUrl.includes('pooler')) {
    console.warn('[milko-backend] ⚠️  WARNING: Using direct Supabase connection (may have DNS/IPv6 issues)');
    console.warn('[milko-backend] 💡 Use Session Pooler URL instead: pooler.supabase.com:6543');
  } else if (databaseUrl.includes('pooler.supabase.com')) {
    console.log('[milko-backend] ✅ Using Supabase connection pooler (IPv4-compatible)');
  }
}

/**
 * Resolve hostname to IPv4 address to avoid IPv6 connection issues
 * @param {string} url - Database connection URL
 * @returns {Promise<string>} URL with IPv4 address
 */
const resolveToIPv4 = async (url) => {
  try {
    // Parse the connection string - handle both IPv4/IPv6 and hostnames
    // Format: postgresql://user:pass@host:port/database
    // IPv6 format: postgresql://user:pass@[::1]:port/database
    const urlMatch = url.match(/^(postgresql:\/\/)([^:]+):([^@]+)@(?:\[([^\]]+)\]|([^:]+)):(\d+)\/(.+)$/);
    if (!urlMatch) {
      // Try simpler pattern without port/database
      const simpleMatch = url.match(/^(postgresql:\/\/)([^:]+):([^@]+)@(.+)$/);
      if (!simpleMatch) {
        return url; // Return as-is if we can't parse it
      }
      // For simple format, try to extract hostname from the rest
      const [, protocol, username, password, rest] = simpleMatch;
      const parts = rest.split('/');
      const hostPort = parts[0];
      const database = parts.slice(1).join('/');
      
      // Check if hostPort contains IPv6 address
      let hostname = hostPort;
      let port = '5432'; // Default PostgreSQL port
      
      if (hostPort.includes(':')) {
        // Could be IPv6 [::1] or hostname:port
        if (hostPort.startsWith('[') && hostPort.includes(']:')) {
          // IPv6 format: [::1]:5432
          const ipv6Match = hostPort.match(/^\[([^\]]+)\]:(\d+)$/);
          if (ipv6Match) {
            hostname = ipv6Match[1];
            port = ipv6Match[2];
          }
        } else {
          // Regular format: hostname:port
          const lastColon = hostPort.lastIndexOf(':');
          hostname = hostPort.substring(0, lastColon);
          port = hostPort.substring(lastColon + 1);
        }
      }
      
      // If it's an IPv6 address, we need to resolve the hostname (if it's a hostname, not direct IP)
      if (hostname.includes(':') && !hostname.match(/^[0-9a-f:]+$/i)) {
        // It's a hostname that might resolve to IPv6, try to get IPv4
        try {
          const addresses = await dnsPromises.resolve4(hostname);
          if (addresses && addresses.length > 0) {
            const ipv4Address = addresses[0];
            console.log(`[milko-backend] ✅ Resolved ${hostname} to IPv4: ${ipv4Address}`);
            return `${protocol}${username}:${password}@${ipv4Address}:${port}/${database}`;
          }
        } catch (resolveError) {
          console.warn(`[milko-backend] ⚠️  Could not resolve ${hostname} to IPv4:`, resolveError.message);
        }
      } else if (!hostname.includes(':')) {
        // Regular hostname, resolve to IPv4
        try {
          const addresses = await dnsPromises.resolve4(hostname);
          if (addresses && addresses.length > 0) {
            const ipv4Address = addresses[0];
            console.log(`[milko-backend] ✅ Resolved ${hostname} to IPv4: ${ipv4Address}`);
            return `${protocol}${username}:${password}@${ipv4Address}:${port}/${database}`;
          }
        } catch (resolveError) {
          console.warn(`[milko-backend] ⚠️  Could not resolve ${hostname} to IPv4:`, resolveError.message);
        }
      }
      
      return url; // Return original if we can't resolve
    }

    const [, protocol, username, password, ipv6Host, regularHost, port, database] = urlMatch;
    const hostname = ipv6Host || regularHost;
    
    // If it's already an IPv4 address, return as-is
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return url;
    }

    // If it's an IPv6 address directly in the URL, we can't resolve it - need hostname
    if (hostname.includes(':') && hostname.match(/^[0-9a-f:]+$/i)) {
      console.warn('[milko-backend] ⚠️  Direct IPv6 address in connection string - cannot resolve to IPv4 automatically');
      console.warn('[milko-backend] ⚠️  Please use hostname instead of IPv6 address, or configure IPv4 in connection string');
      return url;
    }

    // Resolve hostname to IPv4
    try {
      const addresses = await dnsPromises.resolve4(hostname);
      if (addresses && addresses.length > 0) {
        const ipv4Address = addresses[0];
        console.log(`[milko-backend] ✅ Resolved ${hostname} to IPv4: ${ipv4Address}`);
        return `${protocol}${username}:${password}@${ipv4Address}:${port}/${database}`;
      }
    } catch (resolveError) {
      console.warn(`[milko-backend] ⚠️  Could not resolve ${hostname} to IPv4:`, resolveError.message);
    }
  } catch (error) {
    console.warn('[milko-backend] ⚠️  Error resolving hostname to IPv4:', error.message);
  }
  
  return url; // Return original URL if resolution fails
};

// Fix URL encoding issues - if password contains @, it needs to be encoded
const encodeDbUrlPassword = (url) => {
  if (!url || !url.includes('://') || !url.includes('@')) return url;
  // If the password is already percent-encoded, don't risk double-encoding.
  if (url.includes('%')) return url;

  try {
    const protocolEnd = url.indexOf('://') + 3;
    const lastAt = url.lastIndexOf('@');
    if (lastAt <= protocolEnd) return url;

    const userInfo = url.slice(protocolEnd, lastAt); // username:password (password may contain '@' / ':')
    const hostAndDb = url.slice(lastAt + 1);

    const firstColon = userInfo.indexOf(':');
    if (firstColon === -1) return url;

    const username = userInfo.slice(0, firstColon);
    const password = userInfo.slice(firstColon + 1);

    // Only encode when needed (common problematic characters in URIs)
    if (!/[ @:/?#]/.test(password)) return url;

      const encodedPassword = encodeURIComponent(password);
    return `${url.slice(0, protocolEnd)}${username}:${encodedPassword}@${hostAndDb}`;
  } catch (e) {
    return url;
  }
};

databaseUrl = encodeDbUrlPassword(databaseUrl);

if (!databaseUrl) {
  // eslint-disable-next-line no-console
  console.warn(
    '[milko-backend] SUPABASE_DB_URL or DATABASE_URL is not set. Database-backed endpoints will fail until you configure it.'
  );
} else {
  // Check if using Supabase direct connection (might have IPv6 issues on Render)
  if (databaseUrl.includes('supabase.co') && !databaseUrl.includes('pooler.supabase.com')) {
    console.warn('[milko-backend] ⚠️  Using Supabase direct connection (may have IPv6 issues on Render)');
    console.warn('[milko-backend] 💡 For better compatibility, use Supabase connection pooler:');
    console.warn('[milko-backend]    Go to Supabase Dashboard → Settings → Database → Connection Pooling');
    console.warn('[milko-backend]    Use the "Transaction" or "Session" mode connection string');
  }
}

// Parse connection string to handle special characters in password
let poolConfig = {
  connectionString: databaseUrl,
  // Supabase requires SSL connections
  ssl: databaseUrl?.includes('supabase') ? { rejectUnauthorized: false } : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  max: 10, // Reduced pool size to avoid connection issues
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 20000, // Increased to 20 seconds for slow connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Naive TIMESTAMP columns are interpreted consistently; timestamptz + API ISO(Z) then display IST on clients
  options: '-c TimeZone=UTC',
};

// Note: query_timeout is not a valid pg Pool option, it's handled in our query wrapper
const pool = new Pool(poolConfig);

// Try to resolve to IPv4 if we get IPv6 connection errors
// This will be used as a fallback if IPv6 connections fail
let ipv4ResolvedUrl = null;
if (databaseUrl) {
  // Resolve hostname to IPv4 in the background (non-blocking)
  resolveToIPv4(databaseUrl)
    .then((resolved) => {
      if (resolved !== databaseUrl) {
        ipv4ResolvedUrl = resolved;
        console.log('[milko-backend] ✅ IPv4 address resolved and cached for fallback');
      }
    })
    .catch(() => {
      // Silently fail - we'll use original URL
    });
}

/**
 * Test database connection on startup
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection test successful');
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.error('   This may cause database queries to timeout.');
    
    // Check for DNS resolution errors
    if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
      console.error('   ⚠️  DNS resolution error detected!');
      console.error('   💡 The database hostname cannot be resolved.');
      console.error('   💡 Solution: Use Supabase connection pooler URL instead of direct connection');
      console.error('   1. Go to Supabase Dashboard → Settings → Database');
      console.error('   2. Find "Connection Pooling" section');
      console.error('   3. Copy the "Session" mode connection string (URI format)');
      console.error('   4. Update SUPABASE_DB_URL in your environment variables');
      console.error('   5. The pooler URL should contain "pooler.supabase.com" (not "db.xxxxx.supabase.co")');
      console.error('   6. Port should be 6543 (not 5432)');
    } else if (error.message?.includes('ENETUNREACH') || error.message?.includes(':')) {
      console.error('   ⚠️  IPv6 connection error detected!');
      console.error('   💡 Solution: Use Supabase connection pooler (IPv4-compatible)');
      console.error('   1. Go to Supabase Dashboard → Settings → Database');
      console.error('   2. Find "Connection Pooling" section');
      console.error('   3. Copy the "Transaction" or "Session" mode connection string');
      console.error('   4. Update SUPABASE_DB_URL in your environment variables');
      console.error('   5. The pooler URL should contain "pooler.supabase.com"');
    } else {
      console.error('   Please check your SUPABASE_DB_URL or DATABASE_URL environment variable.');
    }
  }
};

// Test connection on startup (non-blocking)
if (databaseUrl) {
  testConnection().catch(() => {
    // Error already logged
  });
}

pool.on('connect', () => {
  console.log('✅ Database client connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  // Don't exit on error - let the app continue and handle errors gracefully
});

// Store for IPv4 fallback pool
let ipv4Pool = null;

/**
 * Execute a query with timeout protection and IPv6 fallback
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  const QUERY_TIMEOUT = Number.parseInt(process.env.DB_QUERY_TIMEOUT_MS || '', 10) || 20000; // default 20s
  
  try {
    // Wrap query in timeout promise
    const queryPromise = pool.query(text, params);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout after ${QUERY_TIMEOUT}ms: ${text.substring(0, 100)}...`));
      }, QUERY_TIMEOUT);
    });

    const res = await Promise.race([queryPromise, timeoutPromise]);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    const message =
      error?.message ||
      (Array.isArray(error?.errors) && error.errors[0]?.message) ||
      String(error);
    
    // Check if it's an IPv6 connection error (ENETUNREACH with IPv6 address)
    const isIPv6Error = message.includes('ENETUNREACH') && 
                       (message.includes(':') || message.match(/[0-9a-f]{4}:[0-9a-f]{4}/i));
    
    if (isIPv6Error && ipv4ResolvedUrl && !ipv4Pool) {
      // Try to use IPv4 fallback
      console.warn('[milko-backend] ⚠️  IPv6 connection failed, attempting IPv4 fallback...');
      try {
        // Create IPv4 pool
        ipv4Pool = new Pool({
          connectionString: ipv4ResolvedUrl,
          ssl: ipv4ResolvedUrl?.includes('supabase') ? { rejectUnauthorized: false } : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 20000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
          options: '-c TimeZone=UTC',
        });
        
        // Retry query with IPv4 pool
        const retryPromise = ipv4Pool.query(text, params);
        const retryTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Query timeout after ${QUERY_TIMEOUT}ms: ${text.substring(0, 100)}...`));
          }, QUERY_TIMEOUT);
        });
        
        const res = await Promise.race([retryPromise, retryTimeoutPromise]);
        console.log('[milko-backend] ✅ Query succeeded using IPv4 fallback');
        const retryDuration = Date.now() - start;
        console.log('Executed query (IPv4 fallback)', { text: text.substring(0, 100), duration: retryDuration, rows: res.rowCount });
        return res;
      } catch (retryError) {
        console.error('[milko-backend] ❌ IPv4 fallback also failed:', retryError.message);
        // Fall through to original error
      }
    }
    
    console.error('Query error', { text: text.substring(0, 100), duration, error: message });
    
    // If it's a timeout error, provide a more user-friendly message
    if (message.includes('timeout')) {
      const timeoutError = new Error('Database query timed out. Please try again.');
      timeoutError.name = 'QueryTimeoutError';
      throw timeoutError;
    }
    
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Client>} PostgreSQL client
 */
const getClient = async () => {
  // Use IPv4 pool if available (fallback for IPv6 issues)
  const activePool = ipv4Pool || pool;
  
  try {
    const client = await activePool.connect();
    const query = client.query;
    const release = client.release;
    
    // Set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout(() => {
      console.error('A client has been checked out for more than 5 seconds!');
      console.error(`The last executed query on this client was: ${client.lastQuery}`);
    }, 5000);
    
    // Monkey patch the query method to log the query before execution
    client.query = (...args) => {
      client.lastQuery = args;
      return query.apply(client, args);
    };
    
    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release.apply(client);
    };
    
    return client;
  } catch (error) {
    // If IPv6 pool fails and we haven't tried IPv4 yet, try IPv4
    if (!ipv4Pool && ipv4ResolvedUrl && (error.message?.includes('ENETUNREACH') || error.message?.includes(':'))) {
      console.warn('[milko-backend] ⚠️  Primary pool connection failed, trying IPv4 fallback...');
      ipv4Pool = new Pool({
        connectionString: ipv4ResolvedUrl,
        ssl: ipv4ResolvedUrl?.includes('supabase') ? { rejectUnauthorized: false } : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 20000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        options: '-c TimeZone=UTC',
      });
      return getClient(); // Retry with IPv4 pool
    }
    throw error;
  }
};

module.exports = {
  query,
  getClient,
  pool,
};

