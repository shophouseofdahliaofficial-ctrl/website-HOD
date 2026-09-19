const bannerModel = require('../models/banner');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { ValidationError, NotFoundError } = require('../utils/errors');

const normalizeLinkTarget = (value) => {
  if (value === undefined || value === null || value === '') return 'same_tab';
  const s = String(value);
  return s === 'new_tab' || s === 'same_tab' ? s : 'same_tab';
};

/**
 * Banner Service
 * Handles banner business logic
 */

/**
 * Get all active banners (for homepage)
 * @returns {Promise<Array>} Array of active banners
 */
const getActiveBanners = async () => {
  return await bannerModel.getActiveBanners();
};

/**
 * Get all banners (for admin)
 * @returns {Promise<Array>} Array of all banners
 */
const getAllBanners = async () => {
  return await bannerModel.getAllBanners();
};

/**
 * Get banner by ID
 * @param {string} bannerId - Banner ID
 * @returns {Promise<Object>} Banner object
 */
const getBannerById = async (bannerId) => {
  const banner = await bannerModel.getBannerById(bannerId);
  if (!banner) {
    throw new NotFoundError('Banner');
  }
  return banner;
};

/**
 * Create new banner (admin only)
 * @param {Object} bannerData - Banner data
 * @param {Object} imageFile - Desktop image file (required)
 * @param {Object} mobileImageFile - Mobile image file (optional)
 * @returns {Promise<Object>} Created banner
 */
const createBanner = async (bannerData, imageFile, mobileImageFile = null) => {
  // Parse form data - handle checkbox values (can be string "true"/"false" or boolean)
  const title = bannerData.title || null;
  const description = bannerData.description || null;
  const link = bannerData.link || null; // Optional link URL
  const linkTarget = normalizeLinkTarget(bannerData.linkTarget);
  const orderIndex = bannerData.orderIndex ? parseInt(bannerData.orderIndex) : 0;
  const desktopDisplayMode = bannerData.desktopDisplayMode === 'down' ? 'down' : 'swipe';
  const mobileDisplayMode = bannerData.mobileDisplayMode === 'down' ? 'down' : 'swipe';
  
  // Handle images array (can be JSON string or array)
  let images = [];
  if (bannerData.images) {
    images = typeof bannerData.images === 'string' ? JSON.parse(bannerData.images) : bannerData.images;
  }
  if (!Array.isArray(images)) images = [];

  // Handle isActive checkbox - can be string "true"/"false", boolean, or undefined
  let isActive = true; // Default to true
  if (bannerData.isActive !== undefined) {
    if (typeof bannerData.isActive === 'string') {
      isActive = bannerData.isActive === 'true' || bannerData.isActive === 'on';
    } else {
      isActive = Boolean(bannerData.isActive);
    }
  }

  // Handle adaptToFirstImage checkbox
  let adaptToFirstImage = false;
  if (bannerData.adaptToFirstImage !== undefined) {
    if (typeof bannerData.adaptToFirstImage === 'string') {
      adaptToFirstImage = bannerData.adaptToFirstImage === 'true' || bannerData.adaptToFirstImage === 'on';
    } else {
      adaptToFirstImage = Boolean(bannerData.adaptToFirstImage);
    }
  }

  // Validate desktop image file or imageUrl or images is required
  if (!imageFile && !bannerData.imageUrl && images.length === 0) {
    throw new ValidationError('At least one banner image is required');
  }

  // Validate file size (max 20MB)
  const maxFileSize = 20 * 1024 * 1024; // 20MB
  if (imageFile && imageFile.size > maxFileSize) {
    throw new ValidationError(`Desktop image file is too large (${(imageFile.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 20MB. Please compress the image.`);
  }

  if (mobileImageFile && mobileImageFile.size > maxFileSize) {
    throw new ValidationError(`Mobile image file is too large (${(mobileImageFile.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 20MB. Please compress the image.`);
  }

  // STEP 1: Process desktop image (upload to Cloudinary if file buffer provided, or use existing URL)
  let uploadResult;
  if (imageFile) {
    try {
      if (!imageFile.buffer) {
        throw new ValidationError('File buffer is missing. Please ensure the file is properly uploaded.');
      }

      uploadResult = await uploadImage(imageFile.buffer, {
        resource_type: 'image',
        folder: 'houseofdahlia/banners',
        mimeType: imageFile.mimetype,
      });
    } catch (error) {
      console.error('[BANNER] ❌ Desktop image Cloudinary upload failed:', error);
      const errorMessage = error.message || error.toString() || 'Unknown error';
      throw new Error(`Failed to upload desktop image to Cloudinary: ${errorMessage}`);
    }
  } else {
    uploadResult = {
      url: bannerData.imageUrl || images[0]?.imageUrl || '',
      publicId: bannerData.imagePublicId || images[0]?.imagePublicId || null,
    };
  }

  // STEP 2: Process mobile image (optional)
  let mobileUploadResult = null;
  if (mobileImageFile) {
    try {
      if (!mobileImageFile.buffer) {
        throw new ValidationError('Mobile image file buffer is missing.');
      }

      mobileUploadResult = await uploadImage(mobileImageFile.buffer, {
        resource_type: 'image',
        folder: 'houseofdahlia/banners/mobile',
        mimeType: mobileImageFile.mimetype,
      });
    } catch (error) {
      console.error('[BANNER] ❌ Mobile image Cloudinary upload failed:', error);
      if (uploadResult && uploadResult.publicId && imageFile) {
        try {
          await deleteImage(uploadResult.publicId);
        } catch (cleanupError) {
          console.error('[BANNER] ⚠️  Failed to cleanup desktop image:', cleanupError.message);
        }
      }
      
      const errorMessage = error.message || error.toString() || 'Unknown error';
      throw new Error(`Failed to upload mobile image to Cloudinary: ${errorMessage}`);
    }
  } else {
    mobileUploadResult = {
      url: bannerData.mobileImageUrl || images[0]?.mobileImageUrl || null,
      publicId: bannerData.mobileImagePublicId || images[0]?.mobileImagePublicId || null,
    };
  }

  // If images array is empty but uploadResult provided, construct the first image item
  if (images.length === 0 && uploadResult.url) {
    images.push({
      id: 'img_' + Math.random().toString(36).substring(2, 9),
      imageUrl: uploadResult.url,
      imagePublicId: uploadResult.publicId,
      mobileImageUrl: mobileUploadResult?.url || null,
      mobileImagePublicId: mobileUploadResult?.publicId || null,
      title: title || '',
      link: link || '',
      linkTarget,
    });
  }

  // STEP 3: Save banner metadata to database with Cloudinary URLs and images array
  try {
    const banner = await bannerModel.createBanner({
      title,
      description,
      imageUrl: uploadResult.url || images[0]?.imageUrl || '', // Desktop Cloudinary URL
      imagePublicId: uploadResult.publicId || images[0]?.imagePublicId || null, // Desktop Cloudinary public ID
      mobileImageUrl: mobileUploadResult?.url || images[0]?.mobileImageUrl || null, // Mobile Cloudinary URL
      mobileImagePublicId: mobileUploadResult?.publicId || images[0]?.mobileImagePublicId || null, // Mobile Cloudinary public ID
      images,
      desktopDisplayMode,
      mobileDisplayMode,
      link: link || null, // Optional link URL
      linkTarget,
      orderIndex,
      isActive,
      adaptToFirstImage,
    });
    return banner;
  } catch (error) {
    console.error('[BANNER] Database error:', error.message);
    throw new Error(`Failed to save banner to database: ${error.message}`);
  }
};

/**
 * Update banner (admin only)
 * @param {string} bannerId - Banner ID
 * @param {Object} updates - Fields to update
 * @param {Object} imageFile - New desktop image file (optional)
 * @param {Object} mobileImageFile - New mobile image file (optional)
 * @returns {Promise<Object>} Updated banner
 */
const updateBanner = async (bannerId, updates, imageFile = null, mobileImageFile = null) => {
  const banner = await bannerModel.getBannerById(bannerId);
  if (!banner) {
    throw new NotFoundError('Banner');
  }

  // Handle desktop image upload if new image provided
  if (imageFile) {
    if (banner.imagePublicId) {
      try {
        await deleteImage(banner.imagePublicId);
      } catch (error) {
        console.error('Failed to delete old desktop banner image:', error);
      }
    }

    const uploadResult = await uploadImage(imageFile.buffer, {
      resource_type: 'image',
      folder: 'houseofdahlia/banners',
    });

    updates.imageUrl = uploadResult.url;
    updates.imagePublicId = uploadResult.publicId;
  }

  // Handle mobile image upload if new image provided
  if (mobileImageFile) {
    if (banner.mobileImagePublicId) {
      try {
        await deleteImage(banner.mobileImagePublicId);
      } catch (error) {
        console.error('Failed to delete old mobile banner image:', error);
      }
    }

    const mobileUploadResult = await uploadImage(mobileImageFile.buffer, {
      resource_type: 'image',
      folder: 'houseofdahlia/banners/mobile',
    });

    updates.mobileImageUrl = mobileUploadResult.url;
    updates.mobileImagePublicId = mobileUploadResult.publicId;
  }

  // Handle images array if passed
  if (updates.images) {
    let parsedImages = typeof updates.images === 'string' ? JSON.parse(updates.images) : updates.images;
    if (Array.isArray(parsedImages)) {
      updates.images = parsedImages;
      if (parsedImages.length > 0 && !imageFile) {
        updates.imageUrl = parsedImages[0].imageUrl || updates.imageUrl || banner.imageUrl;
        updates.imagePublicId = parsedImages[0].imagePublicId || updates.imagePublicId || banner.imagePublicId;
        updates.mobileImageUrl = parsedImages[0].mobileImageUrl || updates.mobileImageUrl || banner.mobileImageUrl;
        updates.mobileImagePublicId = parsedImages[0].mobileImagePublicId || updates.mobileImagePublicId || banner.mobileImagePublicId;
      }
    }
  }

  // Handle display modes
  if (updates.desktopDisplayMode) {
    updates.desktopDisplayMode = updates.desktopDisplayMode === 'down' ? 'down' : 'swipe';
  }
  if (updates.mobileDisplayMode) {
    updates.mobileDisplayMode = updates.mobileDisplayMode === 'down' ? 'down' : 'swipe';
  }

  // Handle orderIndex conversion
  if (updates.orderIndex !== undefined) {
    updates.orderIndex = parseInt(updates.orderIndex);
  }

  // Handle link - convert empty string to null
  if (updates.link !== undefined) {
    updates.link = updates.link || null;
  }

  if (updates.linkTarget !== undefined) {
    updates.linkTarget = normalizeLinkTarget(updates.linkTarget);
  }

  // Handle adaptToFirstImage checkbox
  if (updates.adaptToFirstImage !== undefined) {
    if (typeof updates.adaptToFirstImage === 'string') {
      updates.adaptToFirstImage = updates.adaptToFirstImage === 'true' || updates.adaptToFirstImage === 'on';
    } else {
      updates.adaptToFirstImage = Boolean(updates.adaptToFirstImage);
    }
  }

  return await bannerModel.updateBanner(bannerId, updates);
};

/**
 * Delete banner (admin only)
 * @param {string} bannerId - Banner ID
 * @returns {Promise<Object>} Deleted banner
 */
const deleteBanner = async (bannerId) => {
  const banner = await bannerModel.getBannerById(bannerId);
  if (!banner) {
    throw new NotFoundError('Banner');
  }

  // Delete desktop image from Cloudinary
  if (banner.imagePublicId) {
    try {
      await deleteImage(banner.imagePublicId);
    } catch (error) {
      console.error('Failed to delete desktop banner image from Cloudinary:', error);
      // Continue even if deletion fails
    }
  }

  // Delete mobile image from Cloudinary
  if (banner.mobileImagePublicId) {
    try {
      await deleteImage(banner.mobileImagePublicId);
    } catch (error) {
      console.error('Failed to delete mobile banner image from Cloudinary:', error);
      // Continue even if deletion fails
    }
  }

  // Delete from database
  return await bannerModel.deleteBanner(bannerId);
};

module.exports = {
  getActiveBanners,
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};



