const { query } = require('../src/config/database');

async function deliverOrder(orderNumber) {
  try {
    const cleanNum = String(orderNumber).replace('#', '').trim();
    console.log(`Delivering order #${cleanNum}...`);

    const now = new Date();
    const deliveredAt = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    const outForDeliveryAt = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const reachedHubAt = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const inTransitAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const shippedAt = new Date(now.getTime() - 36 * 60 * 60 * 1000);
    const preparedAt = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const res = await query(
      `
      UPDATE orders
      SET 
        status = 'delivered',
        package_prepared_at = COALESCE(package_prepared_at, $2),
        shipped_at = COALESCE(shipped_at, $3),
        in_transit_at = COALESCE(in_transit_at, $4),
        reached_destination_hub_at = COALESCE(reached_destination_hub_at, $5),
        out_for_delivery_at = COALESCE(out_for_delivery_at, $6),
        delivered_at = $7,
        payment_status = CASE WHEN LOWER(payment_method) = 'cod' THEN 'paid' ELSE payment_status END,
        updated_at = NOW()
      WHERE order_number ILIKE $1
      RETURNING id, order_number, status, payment_status, delivered_at;
      `,
      [cleanNum, preparedAt, shippedAt, inTransitAt, reachedHubAt, outForDeliveryAt, deliveredAt]
    );

    if (res.rows.length === 0) {
      console.error(`❌ Order #${cleanNum} not found in database.`);
      process.exit(1);
    }

    console.log('✅ Order delivered successfully:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error delivering order:', err);
    process.exit(1);
  }
}

const targetOrder = process.argv[2] || '25337D89';
deliverOrder(targetOrder);
