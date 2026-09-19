const emailService = require('../services/emailService');
const { ValidationError } = require('../utils/errors');

/**
 * Handles submission of enterprise inquiries
 */
const submitInquiry = async (req, res, next) => {
  try {
    const { name, email, company, phone, message } = req.body;

    // Simple programmatic validation
    if (!name || !email || !company || !phone || !message) {
      throw new ValidationError('All fields (name, email, company, phone, message) are required.');
    }

    // Verify email format basically
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new ValidationError('Please enter a valid work email.');
    }

    const result = await emailService.sendEnterpriseInquiryEmail({
      name: name.trim(),
      email: email.trim(),
      company: company.trim(),
      phone: phone.trim(),
      message: message.trim(),
    });

    res.json({
      success: true,
      data: result,
      message: 'Your enterprise inquiry has been successfully received.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitInquiry,
};
