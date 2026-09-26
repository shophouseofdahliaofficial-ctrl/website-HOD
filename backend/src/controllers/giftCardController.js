const giftCardModel = require('../models/giftCard');
const { ValidationError } = require('../utils/errors');

const createGiftCard = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const { amount } = req.body;
    if (!amount) throw new ValidationError('Amount is required');

    const card = await giftCardModel.createGiftCard({ amount, userId });
    res.status(201).json({
      success: true,
      data: card,
      message: 'Gift card created successfully',
    });
  } catch (err) {
    next(err);
  }
};

const redeemGiftCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('Authentication required');
    const { code } = req.body;
    if (!code) throw new ValidationError('Gift card code is required');

    const result = await giftCardModel.redeemGiftCard({ code, userId });
    res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ success: true, data: [] });
    }
    const history = await giftCardModel.getGiftCardHistory(userId);
    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createGiftCard,
  redeemGiftCard,
  getHistory,
};
