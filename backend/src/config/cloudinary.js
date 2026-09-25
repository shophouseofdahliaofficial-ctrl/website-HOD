const cloudinary = require('cloudinary').v2;
require('dotenv').config();

/**
 * Cloudinary Configuration
 * Used for image uploads (product images)
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000, // 60 seconds timeout for uploads
  secure: true,
});

/**
 * Formats a Cloudinary URL to ensure it transforms to WebP and ends with .webp
 * @param {string} secureUrl - Raw Cloudinary secure_url
 * @returns {string} WebP-optimized URL
 */
const formatToWebpUrl = (secureUrl) => {
  if (!secureUrl || typeof secureUrl !== 'string') return secureUrl;
  if (!secureUrl.includes('res.cloudinary.com')) return secureUrl;

  let url = secureUrl;
  // Inject /f_webp,q_auto/ if not already present
  if (url.includes('/upload/') && !url.includes('/f_webp') && !url.includes('/f_auto')) {
    url = url.replace('/upload/', '/upload/f_webp,q_auto/');
  }
  // Convert any image extension to .webp
  url = url.replace(/\.(png|jpg|jpeg|jfif|pjpeg|pjp|avif|bmp|tiff|tif)(\?.*)?$/i, '.webp$2');
  return url;
};

/**
 * Upload image to Cloudinary
 * @param {Buffer|string} file - File buffer or file path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result with URL
 */
const uploadImage = async (file, options = {}) => {
  try {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      const missing = [];
      if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
      if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
      if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
      throw new Error(`Cloudinary credentials are not configured. Missing: ${missing.join(', ')}. Please add these to your .env file.`);
    }

    console.log('[CLOUDINARY] Starting upload...', {
      hasBuffer: Buffer.isBuffer(file),
      bufferSize: Buffer.isBuffer(file) ? file.length : 'N/A',
      folder: options.folder || 'houseofdahlia/products',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
    });

    // Handle both buffer and file path
    if (Buffer.isBuffer(file)) {
      // For large files (>5MB), use upload_stream instead of data URI to avoid timeout
      const fileSizeMB = file.length / (1024 * 1024);
      const useStream = fileSizeMB > 5;
      
      console.log('[CLOUDINARY] File info:', {
        bufferSize: file.length,
        fileSizeMB: fileSizeMB.toFixed(2),
        useStream: useStream,
        folder: options.folder || 'houseofdahlia/products',
      });
      
      try {
        const isImage = (options.resource_type || 'image') === 'image';
        const defaultTransformations = isImage
          ? [{ quality: options.quality || 'auto:good', fetch_format: options.format || 'webp' }]
          : undefined;

        // Remove mimeType from options as it's not a Cloudinary option
        const { mimeType: _, ...uploadOptions } = {
          folder: options.folder || 'houseofdahlia/products',
          resource_type: options.resource_type || 'image',
          format: options.format || (isImage ? 'webp' : undefined),
          transformation: options.transformation || defaultTransformations,
          ...options,
        };
        delete uploadOptions.mimeType; // Ensure it's removed
        
        let result;
        
        // Always use upload_stream for better reliability and timeout handling
        // This works better than data URI for all file sizes
        console.log('[CLOUDINARY] Using upload_stream with WebP conversion & auto-compression...');
        const timeoutDuration = useStream ? 120000 : 90000; // 120s for large, 90s for small
        
        result = await new Promise((resolve, reject) => {
          let timeoutId;
          let isResolved = false;
          
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, uploadResult) => {
              if (isResolved) return; // Prevent multiple calls
              isResolved = true;
              
              if (timeoutId) clearTimeout(timeoutId);
              
              if (error) {
                console.error('[CLOUDINARY] Stream upload error:', {
                  message: error.message,
                  http_code: error.http_code,
                  name: error.name,
                });
                reject(error);
              } else {
                resolve(uploadResult);
              }
            }
          );
          
          // Handle stream errors
          uploadStream.on('error', (streamError) => {
            if (isResolved) return;
            isResolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            console.error('[CLOUDINARY] Stream error:', streamError);
            reject(streamError);
          });
          
          // Add timeout protection
          timeoutId = setTimeout(() => {
            if (isResolved) return;
            isResolved = true;
            uploadStream.destroy();
            reject(new Error(`Upload timeout after ${timeoutDuration / 1000} seconds. The image may be too large or network connection is slow.`));
          }, timeoutDuration);
          
          // Write buffer to stream
          uploadStream.end(file);
        });
        
        const finalUrl = formatToWebpUrl(result.secure_url);
        console.log('[CLOUDINARY] ✅ Upload successful (WebP & Compressed):', {
          url: finalUrl,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        });
        
        clearMediaCache();
        return {
          url: finalUrl,
          publicId: result.public_id,
        };
      } catch (uploadError) {
        console.error('[CLOUDINARY] Upload error:', {
          message: uploadError.message,
          http_code: uploadError.http_code,
          name: uploadError.name,
          error: uploadError,
        });
        
        // Extract meaningful error message
        let errorMessage = 'Unknown Cloudinary error';
        
        // Handle timeout errors specifically
        if (uploadError.http_code === 499 || uploadError.name === 'TimeoutError' || uploadError.message?.includes('timeout')) {
          errorMessage = 'Upload timeout - the image file may be too large or network connection is slow. Please try again or use a smaller image.';
        } else if (uploadError.message) {
          errorMessage = uploadError.message;
        } else if (uploadError.http_code) {
          errorMessage = `Cloudinary upload failed with HTTP ${uploadError.http_code}`;
        } else if (typeof uploadError === 'string') {
          errorMessage = uploadError;
        } else if (uploadError.error && typeof uploadError.error === 'object') {
          // Handle nested error objects
          errorMessage = uploadError.error.message || JSON.stringify(uploadError.error);
        } else {
          errorMessage = JSON.stringify(uploadError);
        }
        
        throw new Error(errorMessage);
      }
    } else {
      // If it's a file path or data URI
      const isImage = (options.resource_type || 'image') === 'image';
      const defaultTransformations = isImage
        ? [{ quality: options.quality || 'auto:good', fetch_format: options.format || 'webp' }]
        : undefined;

      console.log('[CLOUDINARY] Uploading file path/data URI with WebP conversion & auto-compression...');
      const result = await cloudinary.uploader.upload(file, {
        folder: options.folder || 'houseofdahlia/products',
        resource_type: options.resource_type || 'image',
        format: options.format || (isImage ? 'webp' : undefined),
        transformation: options.transformation || defaultTransformations,
        ...options,
      });
      const finalUrl = formatToWebpUrl(result.secure_url);
      console.log('[CLOUDINARY] ✅ Upload successful (WebP & Compressed):', {
        url: finalUrl,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
      });
      clearMediaCache();
      return {
        url: finalUrl,
        publicId: result.public_id,
      };
    }
  } catch (error) {
    console.error('[CLOUDINARY] Upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      http_code: error.http_code,
      error: error,
    });
    
    // Extract meaningful error message
    let errorMessage = 'Unknown Cloudinary error';
    
    // Handle timeout errors specifically
    if (error.http_code === 499 || error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      errorMessage = 'Upload timeout - the image file may be too large or network connection is slow. Please try again or use a smaller image.';
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.http_code) {
      errorMessage = `Cloudinary upload failed with HTTP ${error.http_code}`;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.error && typeof error.error === 'object') {
      // Handle nested error objects (like {"error":{"message":"..."}})
      errorMessage = error.error.message || JSON.stringify(error.error);
    } else {
      // Try to extract useful info from error object
      errorMessage = error.toString() || JSON.stringify(error);
    }
    
    throw new Error(`Failed to upload image to Cloudinary: ${errorMessage}`);
  }
};

// In-memory cache for Cloudinary listing (TTL: 2 minutes)
const mediaCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

const clearMediaCache = () => {
  mediaCache.clear();
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    clearMediaCache();
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete image');
  }
};

/**
 * List media resources from Cloudinary
 * @param {Object} options - Filtering and pagination options
 * @returns {Promise<Object>} Object containing resources array and next_cursor
 */
const listMediaResources = async (options = {}) => {
  const { maxResults = 40, nextCursor, folder, prefix, search, forceRefresh } = options;
  const cacheKey = JSON.stringify({ maxResults, nextCursor, folder, prefix, search: search?.trim() || '' });

  if (!forceRefresh && mediaCache.has(cacheKey)) {
    const cached = mediaCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    } else {
      mediaCache.delete(cacheKey);
    }
  }

  try {
    let queryExpression = 'resource_type:image';
    if (folder && folder !== 'all') {
      queryExpression += ` AND folder:${folder}*`;
    }
    if (search && search.trim()) {
      queryExpression += ` AND (public_id:*${search.trim()}* OR filename:*${search.trim()}*)`;
    }

    let resultData;

    try {
      let searchBuilder = cloudinary.search
        .expression(queryExpression)
        .sort_by('created_at', 'desc')
        .max_results(Math.min(Number(maxResults) || 40, 100));

      if (nextCursor) {
        searchBuilder = searchBuilder.next_cursor(nextCursor);
      }

      const result = await searchBuilder.execute();
      resultData = {
        resources: (result.resources || []).map((r) => ({
          publicId: r.public_id,
          url: formatToWebpUrl(r.secure_url || r.url),
          format: 'webp',
          width: r.width,
          height: r.height,
          bytes: r.bytes,
          folder: r.folder || (r.public_id.includes('/') ? r.public_id.substring(0, r.public_id.lastIndexOf('/')) : ''),
          filename: (r.filename || r.public_id.split('/').pop()).replace(/\.[^/.]+$/, '') + '.webp',
          createdAt: r.created_at,
        })),
        nextCursor: result.next_cursor || null,
        totalCount: result.total_count || 0,
      };
    } catch (searchErr) {
      console.warn('[CLOUDINARY] Search API fallback to api.resources:', searchErr.message);
      const apiOptions = {
        resource_type: 'image',
        type: 'upload',
        max_results: Math.min(Number(maxResults) || 40, 100),
      };
      if (nextCursor) apiOptions.next_cursor = nextCursor;
      if (prefix) apiOptions.prefix = prefix;
      else if (folder && folder !== 'all') apiOptions.prefix = folder;

      const result = await cloudinary.api.resources(apiOptions);
      resultData = {
        resources: (result.resources || []).map((r) => ({
          publicId: r.public_id,
          url: formatToWebpUrl(r.secure_url || r.url),
          format: 'webp',
          width: r.width,
          height: r.height,
          bytes: r.bytes,
          folder: r.folder || (r.public_id.includes('/') ? r.public_id.substring(0, r.public_id.lastIndexOf('/')) : ''),
          filename: (r.public_id.split('/').pop()).replace(/\.[^/.]+$/, '') + '.webp',
          createdAt: r.created_at,
        })),
        nextCursor: result.next_cursor || null,
        totalCount: result.resources?.length || 0,
      };
    }

    // Cache valid response
    mediaCache.set(cacheKey, {
      timestamp: Date.now(),
      data: resultData,
    });

    return resultData;
  } catch (error) {
    console.error('[CLOUDINARY] Failed to list resources:', error);
    throw new Error(`Failed to list Cloudinary media: ${error.message}`);
  }
};

module.exports = {
  uploadImage,
  deleteImage,
  listMediaResources,
  clearMediaCache,
  cloudinary,
};

