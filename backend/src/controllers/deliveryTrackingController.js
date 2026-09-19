const { query } = require('../config/database');
const deliveryTrackingModel = require('../models/deliveryTracking');

async function resolveDateParam(inputDate) {
  if (inputDate) return String(inputDate);
  const row = await query(`SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date::text AS ymd`);
  return row.rows[0]?.ymd;
}

const getDeliveries = async (req, res, next) => {
  try {
    await deliveryTrackingModel.ensureDeliveriesTable();
    const date = await resolveDateParam(req.query.date);
    const slot = req.query.slot === 'morning' || req.query.slot === 'evening' ? req.query.slot : undefined;
    const data = await deliveryTrackingModel.getDeliveriesForDate(date, slot);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

const markDelivered = async (req, res, next) => {
  try {
    const { deliveryId, date } = req.body || {};
    if (!deliveryId) {
      return res.status(400).json({
        success: false,
        error: 'deliveryId is required',
      });
    }
    const effectiveDate = await resolveDateParam(date);
    await deliveryTrackingModel.ensureDeliveriesTable();
    await deliveryTrackingModel.markDelivered({
      deliveryId: Number(deliveryId),
      date: effectiveDate,
    });
    res.json({
      success: true,
      data: { deliveryId: Number(deliveryId), date: effectiveDate, status: 'delivered' },
      message: 'Delivery marked as delivered',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeliveries,
  markDelivered,
};

