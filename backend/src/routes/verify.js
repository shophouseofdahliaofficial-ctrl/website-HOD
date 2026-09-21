const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/verify/:code
 * Lookup endpoint for checking product verification code (UC)
 * Requires user authentication
 */
router.get('/:code', authenticate, async (req, res, next) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const userId = req.user.id;
    const userRole = req.user.role;

    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Verification code must be exactly 6 alphanumeric characters.'
      });
    }

    console.log(`🔍 Authenticity check requested for UC code: ${code} by user ${userId} (${userRole})`);

    // 1. Check if the UC code exists at all in the database
    const existResult = await query(
      'SELECT id FROM verifications WHERE uc_code = $1 LIMIT 1',
      [code]
    );

    if (existResult.rows.length === 0) {
      console.warn(`❌ Authentic check failed for code: ${code} (Not found)`);
      return res.status(404).json({
        success: false,
        error: 'Verification code not found. The Code was never registered at Milko.'
      });
    }

    // 2. If user is admin, allow them to view it directly
    let result;
    if (userRole === 'admin') {
      result = await query(
        'SELECT uc_code, video_url, drive_file_id, created_at FROM verifications WHERE uc_code = $1 LIMIT 1',
        [code]
      );
    } else {
      // If customer, verify that they are the owner of the linked order or subscription
      result = await query(
        `SELECT v.uc_code, v.video_url, v.drive_file_id, v.created_at 
         FROM verifications v
         LEFT JOIN orders o ON v.order_id = o.id
         LEFT JOIN delivery_schedules ds ON v.delivery_schedule_id = ds.id
         LEFT JOIN subscriptions s ON ds.subscription_id = s.id
         WHERE v.uc_code = $1 
           AND (o.user_id::text = $2::text OR s.user_id::text = $2::text)
         LIMIT 1`,
        [code, String(userId)]
      );
    }

    if (result.rows.length === 0) {
      console.warn(`🔒 Security block: User ${userId} is not authorized to view code: ${code}`);
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view the verification clip for this product. Only the customer who purchased this product can view its genuineness clip.',
        isUnauthorized: true
      });
    }

    const verification = result.rows[0];
    console.log(`✅ Authentic check successful for code: ${code}`);

    res.json({
      success: true,
      data: {
        ucCode: verification.uc_code,
        videoUrl: verification.video_url,
        driveFileId: verification.drive_file_id,
        createdAt: verification.created_at,
        status: 'Active & Original',
        qualitySeal: 'Grade A+ Premium',
        source: '100% Genuine Direct-from-Farm'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
