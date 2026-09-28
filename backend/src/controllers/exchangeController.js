const exchangeService = require('../services/exchangeService');

const exchangeController = {
  // Customer: Request an exchange
  async requestExchange(req, res, next) {
    try {
      const userId = req.user?.id;
      const exchange = await exchangeService.requestExchange(userId, req.body);
      res.status(201).json({
        success: true,
        data: exchange,
        message: 'Exchange request submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // Customer: Get exchange for an order
  async getExchangeForOrder(req, res, next) {
    try {
      const { orderId } = req.params;
      const userId = req.user?.id;
      const exchange = await exchangeService.getExchangeForOrder(orderId, userId);
      res.json({
        success: true,
        data: exchange || null,
      });
    } catch (error) {
      next(error);
    }
  },

  // Customer: Create online payment order for price difference
  async createPaymentOrder(req, res, next) {
    try {
      const userId = req.user?.id;
      const { exchangeId } = req.body;
      const paymentOrder = await exchangeService.createExchangeOnlinePaymentOrder(userId, exchangeId);
      res.json({
        success: true,
        data: paymentOrder,
      });
    } catch (error) {
      next(error);
    }
  },

  // Customer: Settle or pay difference (wallet or online)
  async settleOrPay(req, res, next) {
    try {
      const userId = req.user?.id;
      const result = await exchangeService.settleOrPayExchange(userId, req.body);
      res.json({
        success: true,
        data: result.exchange,
        walletBalance: result.walletBalance,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Get all exchanges
  async adminGetAllExchanges(req, res, next) {
    try {
      const { status, search, limit, page } = req.query;
      const parsedLimit = parseInt(limit, 10) || 50;
      const parsedPage = parseInt(page, 10) || 1;
      const offset = (parsedPage - 1) * parsedLimit;

      const result = await exchangeService.getAllExchanges({
        status,
        search,
        limit: parsedLimit,
        offset,
      });

      res.json({
        success: true,
        data: {
          exchanges: result.exchanges,
          total: result.total,
          page: parsedPage,
          limit: parsedLimit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Get pending count for sidebar badge
  async adminGetPendingCount(req, res, next) {
    try {
      const count = await exchangeService.getPendingCount();
      res.json({
        success: true,
        data: {
          count,
        },
        count,
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Get exchange by ID
  async adminGetExchangeById(req, res, next) {
    try {
      const { id } = req.params;
      const exchange = await exchangeService.getExchangeById(id);
      res.json({
        success: true,
        data: exchange,
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Approve exchange
  async adminApproveExchange(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await exchangeService.approveExchange(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Exchange approved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Reject exchange
  async adminRejectExchange(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await exchangeService.rejectExchange(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Exchange rejected',
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Mark return package received at warehouse origin
  async adminMarkReturnReceived(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await exchangeService.markReturnReceived(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Return package marked as received at origin warehouse',
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Mark return verified (quality inspection passed)
  async adminMarkReturnVerified(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await exchangeService.markReturnVerified(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Return package verified and quality check passed',
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Manually dispatch forward replacement order (Warehouse -> Customer)
  async adminDispatchReplacement(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await exchangeService.dispatchReplacementOrder(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: `Replacement order successfully dispatched (AWB: ${updated.replacementWaybill})`,
      });
    } catch (error) {
      next(error);
    }
  },

  // Admin: Mark replacement order delivered
  async adminMarkReplacementDelivered(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await exchangeService.markReplacementDelivered(id, req.body);
      res.json({
        success: true,
        data: updated,
        message: 'Replacement order marked as delivered',
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = exchangeController;
