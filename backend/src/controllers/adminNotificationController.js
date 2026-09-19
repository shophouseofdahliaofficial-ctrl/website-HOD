const { ValidationError } = require('../utils/errors');
const adminPushService = require('../services/adminPushNotificationService');

const registerPushToken = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not found');
    }

    const { token, platform, appName } = req.body || {};
    if (!token) {
      throw new ValidationError('token is required');
    }

    const saved = await adminPushService.upsertAdminPushToken({
      userId,
      token,
      platform: platform || 'android',
      appName: appName || 'admin-app',
    });

    res.json({
      success: true,
      data: saved,
      message: 'Admin push token registered',
    });
  } catch (error) {
    next(error);
  }
};

const sendTestPush = async (req, res, next) => {
  try {
    const { title, body, data } = req.body || {};
    const firebaseStatus = adminPushService.getFirebaseStatus();
    const result = await adminPushService.sendTestPushToAdmins({ title, body, data });

    res.json({
      success: result.success,
      data: {
        ...result,
        firebaseStatus,
      },
      message: result.success ? 'Test push sent' : 'Test push not delivered',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerPushToken,
  sendTestPush,
};
