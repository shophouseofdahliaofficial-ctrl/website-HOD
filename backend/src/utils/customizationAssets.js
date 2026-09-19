const { uploadImage } = require('../config/cloudinary');
const { ValidationError } = require('./errors');

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:');

const isHttpUrl = (value) =>
  typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));

/**
 * Upload a data-URL image to Cloudinary.
 * @param {string} dataUrl
 * @param {string} folder
 * @returns {Promise<string>} secure URL
 */
const uploadDataUrlToCloudinary = async (dataUrl, folder) => {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) {
    throw new Error('Invalid image data URL');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) {
    throw new Error('Empty image data');
  }

  const result = await uploadImage(buffer, {
    resource_type: 'image',
    folder,
  });

  return result.url;
};

const resolveCustomizationFolder = (productId) =>
  productId ? `houseofdahlia/products/${productId}/customization` : 'houseofdahlia/customization-assets';

/**
 * Replace base64 imageUrl fields with Cloudinary URLs.
 * Existing http(s) URLs are kept as-is.
 * @param {Array} options
 * @param {string|number|null|undefined} productId
 * @returns {Promise<Array>}
 */
const sanitizeCustomizationOptions = async (options, productId) => {
  if (!Array.isArray(options)) return [];

  const folder = resolveCustomizationFolder(productId);
  const sanitized = [];

  for (const group of options) {
    if (!group || typeof group !== 'object') continue;

    const nextGroup = { ...group };
    if (Array.isArray(group.values)) {
      const nextValues = [];
      for (const value of group.values) {
        if (!value || typeof value !== 'object') continue;
        const nextValue = { ...value };
        if (isDataUrl(nextValue.imageUrl)) {
          nextValue.imageUrl = await uploadDataUrlToCloudinary(nextValue.imageUrl, folder);
        } else if (nextValue.imageUrl && !isHttpUrl(nextValue.imageUrl)) {
          delete nextValue.imageUrl;
        }
        nextValues.push(nextValue);
      }
      nextGroup.values = nextValues;
    }
    sanitized.push(nextGroup);
  }

  return sanitized;
};

/**
 * Replace base64 combination imageUrl fields with Cloudinary URLs.
 * @param {Array} combinations
 * @param {string|number|null|undefined} productId
 * @returns {Promise<Array>}
 */
const sanitizeCustomizationCombinations = async (combinations, productId) => {
  if (!Array.isArray(combinations)) return [];

  const folder = resolveCustomizationFolder(productId);
  const sanitized = [];

  for (const combination of combinations) {
    if (!combination || typeof combination !== 'object') continue;

    const nextCombination = { ...combination };
    if (isDataUrl(nextCombination.imageUrl)) {
      nextCombination.imageUrl = await uploadDataUrlToCloudinary(nextCombination.imageUrl, folder);
    } else if (nextCombination.imageUrl && !isHttpUrl(nextCombination.imageUrl)) {
      delete nextCombination.imageUrl;
    }
    sanitized.push(nextCombination);
  }

  return sanitized;
};

const MAX_CUSTOMIZATION_JSON_CHARS = 512 * 1024;
const MAX_IMAGE_URL_CHARS = 2048;

const collectCustomizationImageUrls = (options = [], combinations = []) => {
  const urls = [];
  for (const group of options) {
    for (const value of group?.values || []) {
      if (value?.imageUrl) urls.push(String(value.imageUrl));
    }
  }
  for (const combination of combinations) {
    if (combination?.imageUrl) urls.push(String(combination.imageUrl));
  }
  return urls;
};

const assertCustomizationPayloadSafe = (options = [], combinations = []) => {
  const payloadSize = JSON.stringify({ options, combinations }).length;
  if (payloadSize > MAX_CUSTOMIZATION_JSON_CHARS) {
    throw new ValidationError(
      `Customization data is too large (${Math.round(payloadSize / 1024)} KB). Upload images to Cloudinary instead of embedding them.`
    );
  }

  for (const imageUrl of collectCustomizationImageUrls(options, combinations)) {
    if (isDataUrl(imageUrl)) {
      throw new ValidationError(
        'Customization images must be uploaded to Cloudinary. Base64 images are not allowed in the database.'
      );
    }
    if (imageUrl.length > MAX_IMAGE_URL_CHARS) {
      throw new ValidationError('Customization image URL is too long. Use a Cloudinary URL instead.');
    }
  }
};

module.exports = {
  isDataUrl,
  isHttpUrl,
  resolveCustomizationFolder,
  uploadDataUrlToCloudinary,
  sanitizeCustomizationOptions,
  sanitizeCustomizationCombinations,
  assertCustomizationPayloadSafe,
};
