const fetch = require('node-fetch'); // or use built-in fetch if Node >= 18

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

/**
 * In-memory token cache to avoid repeated /auth/login calls.
 * Shiprocket tokens are valid for ~10 days; we refresh every 8 hours to be safe.
 */
let cachedToken = null;
let tokenExpiresAt = 0;
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Get Shiprocket Authentication Token (cached)
 */
async function getToken() {
  // Return cached token if it is still valid
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error('Shiprocket credentials are not configured in .env');
  }

  console.log('[Shiprocket] Authenticating with email:', email);

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    // Don't cache failed attempts
    cachedToken = null;
    tokenExpiresAt = 0;
    throw new Error(`Shiprocket Auth Error: ${data.message || JSON.stringify(data)}`);
  }

  cachedToken = data.token;
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  console.log('[Shiprocket] Token cached successfully, expires in 8 hours');
  return cachedToken;
}

/**
 * Create a Custom Order in Shiprocket
 * @param {Object} orderData - Milko order details
 * @param {Object} customer - Customer details
 * @param {Array} items - Array of order items
 */
async function createShiprocketOrder(orderData, customer, items) {
  try {
    const token = await getToken();
    
    // Calculate total weight and dimensions (Using database values)
    // Shiprocket requires weight in kg and dimensions in cm.
    let totalWeight = 0;
    for (const item of items) {
      const itemWeight = item.weight != null ? parseFloat(item.weight) : 0.1;
      totalWeight += itemWeight * item.quantity;
    }
    totalWeight = Math.max(0.1, Math.round(totalWeight * 1000) / 1000);

    const defaultLength = 20; // 20 cm
    const defaultBreadth = 20; // 20 cm
    const defaultHeight = 20; // 20 cm
 
    // Clean phone number helper
    const cleanPhone = (phone) => {
      let cleaned = String(phone || '').replace(/\D/g, '');
      if (cleaned.length === 12 && cleaned.startsWith('91')) {
        cleaned = cleaned.substring(2);
      }
      if (cleaned.length === 11 && cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      return cleaned;
    };
 
    const formattedPhone = cleanPhone(customer.phone);
 
    const shiprocketPayload = {
      order_id: orderData.orderNumber, // Your unique order number
      order_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Home',
      billing_customer_name: customer.name,
      billing_last_name: '',
      billing_address: customer.street,
      billing_city: customer.city,
      billing_pincode: customer.postalCode,
      billing_state: customer.state,
      billing_country: customer.country || 'India',
      billing_email: customer.email,
      billing_phone: formattedPhone,
      shipping_is_billing: true, // Assuming shipping matches billing
      shipping_customer_name: customer.name,
      shipping_last_name: '',
      shipping_address: customer.street,
      shipping_city: customer.city,
      shipping_pincode: customer.postalCode,
      shipping_state: customer.state,
      shipping_country: customer.country || 'India',
      shipping_email: customer.email,
      shipping_phone: formattedPhone,
      order_items: items.map(item => ({
        name: item.productName,
        sku: (item.variationId || item.productId).toString(), // or variation ID
        units: item.quantity,
        selling_price: item.unitPrice,
        discount: 0,
        tax: 0,
        hsn: ''
      })),
      payment_method: orderData.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
      sub_total: orderData.total,
      length: defaultLength,
      breadth: defaultBreadth,
      height: defaultHeight,
      weight: totalWeight
    };
 
    const response = await fetch(`${BASE_URL}/orders/create/adhoc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(shiprocketPayload)
    });
 
    const data = await response.json();
    if (!response.ok) {
      console.error('[Shiprocket] Order Creation Failed:', data);
      throw new Error(`Shiprocket Order Error: ${data.message || JSON.stringify(data)}`);
    }
 
    console.log('[Shiprocket] Order Created Successfully:', data);
    return data;
  } catch (error) {
    console.error('[Shiprocket] Exception during order creation:', error);
    throw error;
  }
}

/**
 * Query Shiprocket Courier Serviceability to find the cheapest rate
 */
async function getCheapestRate({ pickupPostcode, deliveryPostcode, weight, cod, declaredValue }) {
  try {
    const token = await getToken();
    const url = new URL(`${BASE_URL}/courier/serviceability`);
    url.searchParams.append('pickup_postcode', pickupPostcode);
    url.searchParams.append('delivery_postcode', deliveryPostcode);
    url.searchParams.append('weight', String(Math.max(0.1, Number(weight || 0.1))));
    url.searchParams.append('cod', cod ? '1' : '0');
    url.searchParams.append('declared_value', String(Math.max(0, Number(declaredValue || 0))));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Shiprocket] Serviceability Query Failed:', data);
      return null;
    }

    const courierCompanies = data?.data?.available_courier_companies;
    if (!Array.isArray(courierCompanies) || courierCompanies.length === 0) {
      console.log('[Shiprocket] No serviceable couriers found.');
      return null;
    }

    // Filter to find the cheapest rates
    let cheapest = null;
    for (const courier of courierCompanies) {
      const rate = parseFloat(courier.rate);
      if (Number.isFinite(rate)) {
        if (!cheapest || rate < cheapest.rate) {
          cheapest = {
            courierName: courier.courier_name,
            rate: rate,
            etd: courier.etd || '3-5 Days',
            courierCompanyId: courier.courier_company_id
          };
        }
      }
    }

    console.log('[Shiprocket] Cheapest courier found:', cheapest);
    return cheapest;
  } catch (error) {
    console.error('[Shiprocket] Exception during serviceability query:', error);
    return null;
  }
}

/**
 * Generate and retrieve the invoice PDF URL for a Shiprocket Order
 * @param {string|number} shiprocketOrderId - Shiprocket Order ID
 */
async function getOrderInvoice(shiprocketOrderId) {
  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/orders/print/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ids: [Number(shiprocketOrderId)]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Shiprocket] Print Invoice Failed:', data);
      throw new Error(`Shiprocket Invoice Error: ${data.message || JSON.stringify(data)}`);
    }

    console.log('[Shiprocket] Invoice generated successfully:', data);
    return data;
  } catch (error) {
    console.error('[Shiprocket] Exception during invoice generation:', error);
    throw error;
  }
}

/**
 * Find Shiprocket internal Order ID by our custom order number
 * @param {string} orderNumber - Milko order number
 */
async function findOrderIdByNumber(orderNumber) {
  try {
    const token = await getToken();
    const url = new URL(`${BASE_URL}/orders`);
    url.searchParams.append('filter_by', 'channel_order_id');
    url.searchParams.append('filter', String(orderNumber));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Shiprocket] Find Order ID Failed:', data);
      return null;
    }

    const orders = data?.data;
    if (Array.isArray(orders) && orders.length > 0) {
      const match = orders.find(o => String(o.channel_order_id) === String(orderNumber));
      return match ? match.id : null;
    }
    return null;
  } catch (error) {
    console.error('[Shiprocket] Exception during find Order ID:', error);
    throw error;
  }
}
 
module.exports = {
  getToken,
  createShiprocketOrder,
  getCheapestRate,
  getOrderInvoice,
  findOrderIdByNumber
};
