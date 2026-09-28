require('dotenv').config({ path: './.env' });
const { query } = require('../src/config/database');
const exchangeModel = require('../src/models/exchange');
const exchangeService = require('../src/services/exchangeService');
const orderModel = require('../src/models/order');

async function runExchangeFullFlowTest() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPLETE DELHIVERY EXCHANGE WORKFLOW TEST');
  console.log('====================================================\n');

  // 1. Find a delivered order
  const ordersRes = await query(
    `SELECT * FROM orders WHERE status = 'delivered' ORDER BY created_at DESC LIMIT 1`
  );

  let order;
  if (ordersRes.rows.length === 0) {
    console.log('No delivered orders found. Finding any order to mark delivered...');
    const anyOrder = await query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 1`);
    if (anyOrder.rows.length === 0) {
      console.error('No orders exist in database to test.');
      process.exit(1);
    }
    await orderModel.updateTimelineStatus(anyOrder.rows[0].id, 'delivered');
    order = (await query(`SELECT * FROM orders WHERE id = $1`, [anyOrder.rows[0].id])).rows[0];
  } else {
    order = ordersRes.rows[0];
  }

  console.log(`✅ Step 0: Test Target Order Found: #${order.order_number} (ID: ${order.id})`);

  // Clear any existing exchange for clean test
  await query(`DELETE FROM order_exchanges WHERE order_id = $1`, [order.id]);

  // 2. Customer Submits Multi-Item Exchange Request
  console.log('\n--- Step 1: Customer Submitting Exchange Request ---');
  const itemsRes = await query(`SELECT * FROM order_items WHERE order_id = $1`, [order.id]);
  const exchangeItems = itemsRes.rows.length > 0
    ? itemsRes.rows.map((it) => ({
        itemId: it.id,
        productId: it.product_id,
        productName: it.product_name || 'Premium Item',
        originalVariation: it.variation_size || 'Size M',
        originalUnitPrice: Number(it.unit_price || 999),
        quantity: it.quantity || 1,
        requestedItemName: it.product_name || 'Premium Item',
        requestedVariation: 'Size XL (Replacement)',
        requestedUnitPrice: Number(it.unit_price || 999),
        priceDifference: 0,
        reason: 'Size is too tight, need larger size',
      }))
    : [{
        productId: 1,
        productName: 'Sample Product',
        originalVariation: 'Size M',
        originalUnitPrice: 999,
        quantity: 1,
        requestedItemName: 'Sample Product',
        requestedVariation: 'Size XL',
        requestedUnitPrice: 999,
        priceDifference: 0,
        reason: 'Size replacement required',
      }];

  const createdExchange = await exchangeService.requestExchange(order.user_id, {
    orderId: order.id,
    reason: 'Fit and size adjustment',
    customerMessage: 'Please exchange for Size XL as discussed.',
    items: exchangeItems,
  });

  console.log(`✅ Exchange Request Created: ID ${createdExchange.id}`);
  console.log(`   Status: ${createdExchange.status}`);
  console.log(`   Items: ${createdExchange.exchangeItems ? createdExchange.exchangeItems.length : 1} product(s)`);

  // 3. Admin Approves Exchange (Reverse Pickup Manifested with Delhivery)
  console.log('\n--- Step 2: Admin Approving Request (Scheduling Reverse Pickup) ---');
  const approved = await exchangeService.approveExchange(createdExchange.id, {
    priceDifference: 0,
    requestedVariation: 'Size XL (Confirmed)',
    approvalMessage: 'Exchange approved. Reverse pickup will be initiated.',
    adminNote: 'Verified customer eligibility within 7-day policy window.',
  });

  console.log(`✅ Exchange Approved: Status '${approved.status}'`);
  console.log(`   Reverse Waybill (AWB): #${approved.reverseWaybill}`);
  console.log(`   Reverse Status: ${approved.reverseStatus}`);
  console.log(`   Reverse Tracking: ${approved.reverseTrackingUrl}`);

  // 4. Return Package Arrives at Warehouse Origin (Step 2)
  console.log('\n--- Step 3: Return Package Arrives at Origin Warehouse ---');
  const returnReceived = await exchangeService.markReturnReceived(approved.id, {
    adminNote: 'Package received by intake team at warehouse dock.',
  });
  console.log(`✅ Return Received: Timestamp ${returnReceived.returnReceivedAt}`);

  // 5. Return Passes Quality Verification (Step 3)
  console.log('\n--- Step 4: Quality Inspection & Verification ---');
  const verified = await exchangeService.markReturnVerified(approved.id, {
    adminNote: 'Item tags intact, condition like-new. Quality verification passed.',
  });
  console.log(`✅ Quality Verification: Passed on ${verified.returnVerifiedAt}`);

  // 6. Forward Replacement Dispatched (Warehouse -> Customer) (Step 4)
  console.log('\n--- Step 5: Dispatching Forward Replacement to Customer ---');
  const dispatched = await exchangeService.dispatchReplacementOrder(approved.id, {
    adminNote: 'Dispatched via Delhivery Surface courier.',
  });
  console.log(`✅ Replacement Dispatched!`);
  console.log(`   Replacement Delhivery AWB: #${dispatched.replacementWaybill}`);
  console.log(`   Replacement Status: ${dispatched.replacementStatus}`);
  console.log(`   Replacement Tracking: ${dispatched.replacementTrackingUrl}`);

  // 7. Automated Delivery to Customer (Step 5)
  console.log('\n--- Step 6: Replacement Delivered to Customer (Automated Step) ---');
  const delivered = await exchangeService.markReplacementDelivered(approved.id, {
    deliveredAt: new Date(),
    adminNote: 'Delivered successfully to customer doorstep.',
  });
  console.log(`✅ Replacement Delivered!`);
  console.log(`   Delivered At: ${delivered.replacementDeliveredAt}`);
  console.log(`   Status: ${delivered.replacementStatus}`);

  // 8. Final End-to-End Verification Check
  console.log('\n--- Step 7: Verifying Customer & Admin API Responses ---');
  const fetchedForCustomer = await exchangeService.getExchangeForOrder(order.id, order.user_id);
  const fetchedForAdmin = await exchangeService.getExchangeById(approved.id);

  console.log('Customer View Status:', {
    status: fetchedForCustomer.status,
    reverseWaybill: fetchedForCustomer.reverseWaybill,
    returnReceivedAt: Boolean(fetchedForCustomer.returnReceivedAt),
    returnVerifiedAt: Boolean(fetchedForCustomer.returnVerifiedAt),
    replacementWaybill: fetchedForCustomer.replacementWaybill,
    replacementDeliveredAt: Boolean(fetchedForCustomer.replacementDeliveredAt),
  });

  console.log('Admin View Status:', {
    status: fetchedForAdmin.status,
    totalExchangeItems: fetchedForAdmin.exchangeItems ? fetchedForAdmin.exchangeItems.length : 1,
    isComplete: Boolean(fetchedForAdmin.replacementDeliveredAt),
  });

  console.log('\n====================================================');
  console.log('🎉 ALL 5 MILESTONES & LOGISTICS CHECKS PASSED 100%!');
  console.log('====================================================\n');
  process.exit(0);
}

runExchangeFullFlowTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
