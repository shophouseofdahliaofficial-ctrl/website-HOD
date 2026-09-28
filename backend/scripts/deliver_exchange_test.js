require('dotenv').config({ path: './.env' });
const exchangeModel = require('../src/models/exchange');

async function deliverExchange(orderNumberOrId) {
  if (!orderNumberOrId) {
    console.error('Usage: node scripts/deliver_exchange_test.js <orderNumber_or_exchangeId>');
    process.exit(1);
  }

  const clean = String(orderNumberOrId).replace(/^#+/, '').trim();
  const all = await exchangeModel.getAllExchanges({ search: clean });
  if (!all.exchanges || all.exchanges.length === 0) {
    console.error(`No exchange found matching "${orderNumberOrId}"`);
    process.exit(1);
  }

  const exchange = all.exchanges[0];
  console.log(`Found exchange for #${exchange.orderNumber} (ID: ${exchange.id})`);

  const updated = await exchangeModel.markReplacementDelivered(exchange.id, {
    deliveredAt: new Date(),
    adminNote: 'Marked delivered via test delivery automation script',
  });

  console.log(`✅ Replacement for Order #${updated.orderNumber} is now marked DELIVERED!`);
  console.log(`Replacement Delivered At: ${updated.replacementDeliveredAt}`);
  process.exit(0);
}

const target = process.argv[2] || '25337D89';
deliverExchange(target).catch((err) => {
  console.error(err);
  process.exit(1);
});
