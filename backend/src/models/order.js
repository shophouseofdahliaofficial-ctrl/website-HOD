const { query } = require('../config/database');
const productReviewModel = require('./productReview');

let schemaEnsured = false;

async function ensureOrdersSchema() {
  if (schemaEnsured) return;

  // Safe to run multiple times (IF NOT EXISTS everywhere)
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'confirmed', 'package_prepared', 'out_for_delivery', 'delivered', 'cancelled', 'refunded')),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cod', 'online', 'wallet')),
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cod')),
      currency VARCHAR(3) NOT NULL DEFAULT 'INR',
      subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
      discount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
      platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
      delivery_charges DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (delivery_charges >= 0),
      total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
      wallet_used DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (wallet_used >= 0),
      delivery_address JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      variation_id INTEGER,
      product_name TEXT NOT NULL,
      variation_size TEXT,
      unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total DECIMAL(10, 2) NOT NULL CHECK (line_total >= 0),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`);

  // Core order columns that might be missing on legacy database schemas
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'INR';`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charges DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS wallet_used DECIMAL(10, 2) NOT NULL DEFAULT 0;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address JSONB;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2) DEFAULT 0;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10, 2) DEFAULT 0;`);

  try {
    await query(`ALTER TABLE orders ALTER COLUMN total_amount DROP NOT NULL;`);
    await query(`ALTER TABLE orders ALTER COLUMN total_amount SET DEFAULT 0;`);
  } catch (_) {}
  try {
    await query(`ALTER TABLE orders ALTER COLUMN discount_amount DROP NOT NULL;`);
    await query(`ALTER TABLE orders ALTER COLUMN discount_amount SET DEFAULT 0;`);
  } catch (_) {}
  try {
    await query(`ALTER TABLE orders ALTER COLUMN final_amount DROP NOT NULL;`);
    await query(`ALTER TABLE orders ALTER COLUMN final_amount SET DEFAULT 0;`);
  } catch (_) {}
  try {
    await query(`ALTER TABLE orders ALTER COLUMN shipping_address DROP NOT NULL;`);
  } catch (_) {}
  try {
    await query(`ALTER TABLE orders ALTER COLUMN delivery_address DROP NOT NULL;`);
  } catch (_) {}

  try {
    await query(`ALTER TABLE order_items ALTER COLUMN total_price DROP NOT NULL;`);
    await query(`ALTER TABLE order_items ALTER COLUMN total_price SET DEFAULT 0;`);
  } catch (_) {}
  try {
    await query(`ALTER TABLE order_items ALTER COLUMN line_total DROP NOT NULL;`);
    await query(`ALTER TABLE order_items ALTER COLUMN line_total SET DEFAULT 0;`);
  } catch (_) {}

  // Razorpay order ID for online payments (link to Razorpay gateway)
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4);`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_network VARCHAR(50);`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS creator_slug VARCHAR(255);`);

  await query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;`);
  await query(`ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cod', 'online', 'wallet'));`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS savings_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;`);

  // Optional: when order is delivered or out for delivery (admin can set)
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;`);
  
  // Add timestamp columns for status tracking
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_prepared_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS reached_destination_hub_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP;`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;`);
  
  // Nationwide delivery flag
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_nationwide_delivery BOOLEAN NOT NULL DEFAULT false;`);

  // Order items columns
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_total DECIMAL(10, 2) DEFAULT 0;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2) DEFAULT 0;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variation_size TEXT;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variation_id INTEGER;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customizations JSONB;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customization_data JSONB;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gift_wrap JSONB;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobooth_project_id UUID;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobook_project_id UUID;`);
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobook_image_check_url TEXT;`);

  // Sync data between legacy / new columns
  await query(`
    UPDATE orders SET currency = 'INR' WHERE currency IS NULL OR currency = '';
    UPDATE orders SET delivery_address = shipping_address WHERE delivery_address IS NULL AND shipping_address IS NOT NULL;
    UPDATE orders SET shipping_address = delivery_address WHERE shipping_address IS NULL AND delivery_address IS NOT NULL;
    UPDATE orders SET total = COALESCE(total, final_amount, total_amount, 0) WHERE total IS NULL OR total = 0;
    UPDATE orders SET subtotal = COALESCE(subtotal, total_amount, total, 0) WHERE subtotal IS NULL OR subtotal = 0;
    UPDATE orders SET discount = COALESCE(discount, discount_amount, 0) WHERE discount IS NULL;
    UPDATE order_items SET line_total = COALESCE(line_total, total_price, unit_price * quantity, 0) WHERE line_total IS NULL OR line_total = 0;
    UPDATE order_items SET total_price = COALESCE(total_price, line_total, unit_price * quantity, 0) WHERE total_price IS NULL OR total_price = 0;
    UPDATE order_items SET customizations = customization_data WHERE customizations IS NULL AND customization_data IS NOT NULL;
    UPDATE order_items SET customization_data = customizations WHERE customization_data IS NULL AND customizations IS NOT NULL;
  `);

  // Update status CHECK to allow package_prepared, out_for_delivery, refunded (for DBs created before these were added)
  await query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;`);
  await query(`ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('placed', 'confirmed', 'package_prepared', 'shipped', 'in_transit', 'reached_destination_hub', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'));`);

  // Detect orders.id and users.id data types to prevent incompatible foreign key constraint error (UUID vs INTEGER)
  let orderIdType = 'UUID';
  try {
    const colRes = await query(`
      SELECT udt_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'id'
      LIMIT 1
    `);
    if (colRes.rows && colRes.rows.length > 0) {
      const udt = (colRes.rows[0].udt_name || '').toLowerCase();
      if (udt === 'int4' || udt === 'int8' || udt === 'integer' || udt === 'bigint') {
        orderIdType = 'INTEGER';
      } else if (udt === 'uuid') {
        orderIdType = 'UUID';
      } else if (udt === 'varchar' || udt === 'text') {
        orderIdType = 'TEXT';
      }
    }
  } catch (err) {
    console.warn('[order.js] Failed to query orders.id type:', err.message);
  }

  let userIdType = 'UUID';
  try {
    const colRes = await query(`
      SELECT udt_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id'
      LIMIT 1
    `);
    if (colRes.rows && colRes.rows.length > 0) {
      const udt = (colRes.rows[0].udt_name || '').toLowerCase();
      if (udt === 'int4' || udt === 'int8' || udt === 'integer' || udt === 'bigint') {
        userIdType = 'INTEGER';
      } else if (udt === 'uuid') {
        userIdType = 'UUID';
      }
    }
  } catch (err) {
    console.warn('[order.js] Failed to query users.id type:', err.message);
  }

  // order_feedback: one row per order, rating (emoji: least/neutral/most), + detailed (quality_stars, delivery_agent_stars, on_time_stars, value_for_money_stars, would_order_again)
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS order_feedback (
        order_id ${orderIdType} PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
        user_id ${userIdType} NOT NULL REFERENCES users(id),
        rating TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch (fbErr) {
    console.warn('[order.js] FK creation failed for order_feedback, creating without inline constraint:', fbErr.message);
    await query(`
      CREATE TABLE IF NOT EXISTS order_feedback (
        order_id ${orderIdType} PRIMARY KEY,
        user_id ${userIdType} NOT NULL,
        rating TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch(() => {});
  }

  await query(`ALTER TABLE order_feedback DROP CONSTRAINT IF EXISTS order_feedback_rating_check;`).catch(() => {});
  await query(`ALTER TABLE order_feedback ALTER COLUMN rating DROP NOT NULL;`).catch(() => {});
  await query(`
    DO $$ BEGIN
      ALTER TABLE order_feedback ADD CONSTRAINT order_feedback_rating_check
      CHECK (rating IS NULL OR rating IN ('least','neutral','most'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `).catch(() => {});
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS quality_stars INTEGER;`).catch(() => {});
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS delivery_agent_stars INTEGER;`).catch(() => {});
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS on_time_stars INTEGER;`).catch(() => {});
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS value_for_money_stars INTEGER;`).catch(() => {});
  await query(`ALTER TABLE order_feedback ADD COLUMN IF NOT EXISTS would_order_again TEXT;`).catch(() => {});

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS order_product_detailed_feedback (
        order_id ${orderIdType} NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id ${userIdType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        quality_stars INTEGER CHECK (quality_stars IS NULL OR (quality_stars >= 1 AND quality_stars <= 5)),
        delivery_agent_stars INTEGER CHECK (delivery_agent_stars IS NULL OR (delivery_agent_stars >= 1 AND delivery_agent_stars <= 5)),
        on_time_stars INTEGER CHECK (on_time_stars IS NULL OR (on_time_stars >= 1 AND on_time_stars <= 5)),
        value_for_money_stars INTEGER CHECK (value_for_money_stars IS NULL OR (value_for_money_stars >= 1 AND value_for_money_stars <= 5)),
        would_order_again TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (order_id, product_id)
      );
    `);
  } catch (dfbErr) {
    console.warn('[order.js] FK creation failed for order_product_detailed_feedback, creating without inline constraint:', dfbErr.message);
    await query(`
      CREATE TABLE IF NOT EXISTS order_product_detailed_feedback (
        order_id ${orderIdType} NOT NULL,
        product_id INTEGER NOT NULL,
        user_id ${userIdType} NOT NULL,
        quality_stars INTEGER CHECK (quality_stars IS NULL OR (quality_stars >= 1 AND quality_stars <= 5)),
        delivery_agent_stars INTEGER CHECK (delivery_agent_stars IS NULL OR (delivery_agent_stars >= 1 AND delivery_agent_stars <= 5)),
        on_time_stars INTEGER CHECK (on_time_stars IS NULL OR (on_time_stars >= 1 AND on_time_stars <= 5)),
        value_for_money_stars INTEGER CHECK (value_for_money_stars IS NULL OR (value_for_money_stars >= 1 AND value_for_money_stars <= 5)),
        would_order_again TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (order_id, product_id)
      );
    `).catch(() => {});
  }
  await query(
    `CREATE INDEX IF NOT EXISTS idx_order_product_feedback_user ON order_product_detailed_feedback(user_id);`
  ).catch(() => {});

  await query(
    `
    INSERT INTO order_product_detailed_feedback (
      order_id, product_id, user_id, quality_stars, delivery_agent_stars, on_time_stars, value_for_money_stars, would_order_again
    )
    SELECT of.order_id, oi.product_id, of.user_id, of.quality_stars, of.delivery_agent_stars, of.on_time_stars, of.value_for_money_stars, of.would_order_again
    FROM order_feedback of
    INNER JOIN order_items oi ON oi.order_id = of.order_id AND oi.product_id IS NOT NULL
    WHERE of.quality_stars IS NOT NULL
    ON CONFLICT (order_id, product_id) DO NOTHING
    `
  ).catch(() => {});

  // TIMESTAMP WITHOUT TIME ZONE + node-pg parses in Node's TZ → wrong API times when DB holds UTC wall clock.
  // Migrate to TIMESTAMPTZ; treat existing naive values as UTC (Supabase/Render default).
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE orders
          ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
          ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC',
          ALTER COLUMN package_prepared_at TYPE timestamptz USING package_prepared_at AT TIME ZONE 'UTC',
          ALTER COLUMN out_for_delivery_at TYPE timestamptz USING out_for_delivery_at AT TIME ZONE 'UTC',
          ALTER COLUMN delivered_at TYPE timestamptz USING delivered_at AT TIME ZONE 'UTC',
          ALTER COLUMN fulfilled_at TYPE timestamptz USING fulfilled_at AT TIME ZONE 'UTC';
      END IF;
    END $$
  `).catch((e) => console.warn('[orders schema] timestamptz migration:', e.message));

  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'created_at'
          AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE order_items
          ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
      END IF;
    END $$
  `).catch((e) => console.warn('[orders schema] order_items timestamptz migration:', e.message));

  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_awb VARCHAR(255);`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_courier VARCHAR(255);`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_order_id VARCHAR(255);`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_waybill VARCHAR(255);`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_status VARCHAR(255);`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_upload_wbn VARCHAR(255);`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_tracking_url TEXT;`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMPTZ;`).catch(() => {});
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS reached_destination_hub_at TIMESTAMPTZ;`).catch(() => {});
  await query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;`).catch(() => {});
  await query(`ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('placed', 'confirmed', 'package_prepared', 'shipped', 'in_transit', 'reached_destination_hub', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'));`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variation_size TEXT;`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variation_id INTEGER;`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_total DECIMAL(10, 2);`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 2);`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name TEXT;`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id INTEGER;`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobooth_project_id UUID;`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobook_project_id UUID;`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS photobook_image_check_url TEXT;`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customizations JSONB;`).catch(() => {});
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gift_wrap JSONB;`).catch(() => {});
  await query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'total_price'
      ) THEN
        UPDATE order_items SET line_total = total_price WHERE line_total IS NULL AND total_price IS NOT NULL;
      END IF;
    END $$;
  `).catch(() => {});
  await query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'photobook_projects' AND column_name = 'preview_url'
      ) THEN
        UPDATE order_items oi
        SET photobook_image_check_url = p.preview_url
        FROM photobook_projects p
        WHERE oi.photobook_project_id = p.id
          AND oi.photobook_image_check_url IS NULL
          AND p.preview_url IS NOT NULL;
      END IF;
    END $$;
  `).catch(() => {});

  schemaEnsured = true;
}

let cachedOrderIdType = null;

async function getOrderIdType() {
  if (cachedOrderIdType) return cachedOrderIdType;
  try {
    const colRes = await query(`
      SELECT udt_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'id'
      LIMIT 1
    `);
    if (colRes.rows && colRes.rows.length > 0) {
      const udt = (colRes.rows[0].udt_name || '').toLowerCase();
      if (udt === 'int4' || udt === 'int8' || udt === 'integer' || udt === 'bigint') {
        cachedOrderIdType = 'INTEGER';
      } else if (udt === 'uuid') {
        cachedOrderIdType = 'UUID';
      } else {
        cachedOrderIdType = 'TEXT';
      }
    } else {
      cachedOrderIdType = 'INTEGER';
    }
  } catch {
    cachedOrderIdType = 'INTEGER';
  }
  return cachedOrderIdType;
}

async function createOrder({
  id,
  userId,
  orderNumber,
  status,
  paymentMethod,
  paymentStatus,
  currency,
  subtotal,
  discount,
  platformFee = 0,
  deliveryCharges,
  total,
  deliveryAddress,
  items,
  razorpayOrderId = null,
  walletUsed = 0,
  savingsAmount = 0,
  couponCode = null,
  isNationwideDelivery = false,
  creatorSlug = null,
}) {
  await ensureOrdersSchema();

  const finalOrderNumber = orderNumber || ('HOD-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000));
  const idType = await getOrderIdType();
  const isIntegerId = idType === 'INTEGER';
  const isNumericId = id != null && /^\d+$/.test(String(id));

  let orderRes;
  if (isIntegerId || (!isNumericId && idType !== 'UUID')) {
    orderRes = await query(
      `
      INSERT INTO orders (
        user_id, order_number, status, payment_method, payment_status,
        currency, subtotal, discount, platform_fee, delivery_charges, total, wallet_used, delivery_address, razorpay_order_id, savings_amount, coupon_code, is_nationwide_delivery, creator_slug,
        total_amount, discount_amount, final_amount, shipping_address
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING id, user_id, order_number, status, payment_method, payment_status, currency,
                subtotal, discount, platform_fee, delivery_charges, total, wallet_used, delivery_address, created_at, savings_amount, coupon_code, is_nationwide_delivery, creator_slug
      `,
      [
        userId,
        finalOrderNumber,
        status,
        paymentMethod,
        paymentStatus,
        currency,
        subtotal,
        discount,
        platformFee,
        deliveryCharges,
        total,
        walletUsed,
        deliveryAddress,
        razorpayOrderId,
        savingsAmount,
        couponCode,
        isNationwideDelivery,
        creatorSlug,
        subtotal || total || 0,
        discount || 0,
        total || 0,
        deliveryAddress || null,
      ]
    );
  } else {
    orderRes = await query(
      `
      INSERT INTO orders (
        id, user_id, order_number, status, payment_method, payment_status,
        currency, subtotal, discount, platform_fee, delivery_charges, total, wallet_used, delivery_address, razorpay_order_id, savings_amount, coupon_code, is_nationwide_delivery, creator_slug,
        total_amount, discount_amount, final_amount, shipping_address
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING id, user_id, order_number, status, payment_method, payment_status, currency,
                subtotal, discount, platform_fee, delivery_charges, total, wallet_used, delivery_address, created_at, savings_amount, coupon_code, is_nationwide_delivery, creator_slug
      `,
      [
        id,
        userId,
        finalOrderNumber,
        status,
        paymentMethod,
        paymentStatus,
        currency,
        subtotal,
        discount,
        platformFee,
        deliveryCharges,
        total,
        walletUsed,
        deliveryAddress,
        razorpayOrderId,
        savingsAmount,
        couponCode,
        isNationwideDelivery,
        creatorSlug,
        subtotal || total || 0,
        discount || 0,
        total || 0,
        deliveryAddress || null,
      ]
    );
  }

  const order = orderRes.rows[0];

  for (const it of items) {
    await query(
      `
      INSERT INTO order_items (
        order_id, product_id, variation_id, product_name, variation_size, unit_price, quantity, line_total, total_price, photobooth_project_id, photobook_project_id, photobook_image_check_url, customizations, customization_data, gift_wrap
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `,
      [
        order.id,
        it.productId,
        it.variationId,
        it.productName,
        it.variationSize,
        it.unitPrice,
        it.quantity,
        it.lineTotal,
        it.lineTotal || (it.unitPrice * it.quantity) || 0,
        it.photoboothProjectId || null,
        it.photobookProjectId || null,
        it.photobookImageCheckUrl || null,
        it.customizations ? JSON.stringify(it.customizations) : null,
        it.customizations ? JSON.stringify(it.customizations) : null,
        it.giftWrap ? JSON.stringify(it.giftWrap) : (it.customizations?.giftWrap ? JSON.stringify(it.customizations.giftWrap) : null),
      ]
    );
    
    // Reduce product quantity by the ordered quantity
    await query(
      `
      UPDATE products 
      SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
      WHERE id = $2
      `,
      [it.quantity, it.productId]
    );
  }

  return {
    id: order.id,
    userId: order.user_id,
    orderNumber: order.order_number,
    status: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    currency: order.currency,
    subtotal: parseFloat(order.subtotal),
    discount: parseFloat(order.discount),
    platformFee: parseFloat(order.platform_fee || 0),
    deliveryCharges: parseFloat(order.delivery_charges),
    total: parseFloat(order.total),
    walletUsed: parseFloat(order.wallet_used || 0),
    savingsAmount: parseFloat(order.savings_amount || 0),
    couponCode: order.coupon_code || null,
    deliveryAddress: order.delivery_address,
    createdAt: order.created_at ? new Date(order.created_at).toISOString() : null,
    isNationwideDelivery: order.is_nationwide_delivery,
  };
}

function mapOpdfRowToDetailedFeedback(row) {
  if (!row || row.quality_stars == null) return null;
  return {
    qualityStars: parseInt(row.quality_stars, 10),
    deliveryAgentStars: row.delivery_agent_stars != null ? parseInt(row.delivery_agent_stars, 10) : null,
    onTimeStars: row.on_time_stars != null ? parseInt(row.on_time_stars, 10) : null,
    valueForMoneyStars: row.value_for_money_stars != null ? parseInt(row.value_for_money_stars, 10) : null,
    wouldOrderAgain: row.would_order_again || null,
  };
}

async function listOrdersForUser(userId) {
  await ensureOrdersSchema();

  const orderRes = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.payment_method,
      o.payment_status,
      o.currency,
      o.total,
      o.created_at,
      o.delivery_date
    FROM orders o
    WHERE o.user_id::text = $1::text
      AND (
        o.payment_method = 'cod'
        OR o.payment_status IN ('paid', 'cod', 'refunded')
      )
    ORDER BY o.created_at DESC
    `,
    [String(userId)]
  );

  const orders = orderRes.rows;
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const itemRes = await query(
    `
    SELECT
      oi.order_id,
      oi.product_name,
      oi.variation_size,
      oi.variation_id,
      oi.quantity,
      oi.unit_price,
      oi.line_total,
      oi.product_id,
      oi.photobooth_project_id,
      oi.photobook_project_id,
      COALESCE(oi.photobook_image_check_url, pb.preview_url) AS photobook_image_check_url,
      pb.generated_pdf_url AS generated_pdf_url,
      p.image_url,
      p.buy_again_enabled,
      opdf.quality_stars,
      opdf.delivery_agent_stars,
      opdf.on_time_stars,
      opdf.value_for_money_stars,
      opdf.would_order_again
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN photobooth_projects pb ON pb.id = oi.photobooth_project_id
    LEFT JOIN photobook_projects pbook ON pbook.id = oi.photobook_project_id
    LEFT JOIN order_product_detailed_feedback opdf
      ON opdf.order_id = oi.order_id AND opdf.product_id = oi.product_id
    WHERE oi.order_id = ANY($1)
    ORDER BY oi.order_id, oi.created_at
    `,
    [orderIds]
  );

  const itemsByOrder = {};
  for (const row of itemRes.rows) {
    const k = row.order_id;
    if (!itemsByOrder[k]) itemsByOrder[k] = [];
    itemsByOrder[k].push({
      productName: row.product_name || 'Product',
      variationSize: row.variation_size || null,
      variationId: row.variation_id != null ? row.variation_id : null,
      quantity: row.quantity != null ? parseInt(row.quantity, 10) : 1,
      unitPrice: row.unit_price != null ? parseFloat(row.unit_price) : 0,
      lineTotal: row.line_total != null ? parseFloat(row.line_total) : 0,
      productId: row.product_id,
      photoboothProjectId: row.photobooth_project_id || null,
      photobookProjectId: row.photobook_project_id || null,
      photobookImageCheckUrl: row.photobook_image_check_url || null,
      generatedPdfUrl: row.generated_pdf_url || null,
      imageUrl: row.image_url || null,
      buyAgainEnabled: row.buy_again_enabled === undefined || row.buy_again_enabled === null ? true : Boolean(row.buy_again_enabled),
      detailedFeedback: mapOpdfRowToDetailedFeedback(row),
    });
  }

  return orders.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    currency: r.currency || 'INR',
    total: r.total !== null ? parseFloat(r.total) : 0,
    itemsCount: (itemsByOrder[r.id] || []).length,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    deliveryDate: r.delivery_date ? new Date(r.delivery_date).toISOString().slice(0, 10) : null,
    items: itemsByOrder[r.id] || [],
  }));
}

async function listAllOrdersAdmin() {
  await ensureOrdersSchema();

  const res = await query(
    `
    SELECT
      o.id AS order_id,
      o.user_id,
      o.order_number,
      o.created_at AS ordered_at,
      u.name AS user_name,
      u.email AS user_email,
      o.total AS amount,
      o.currency,
      o.payment_method,
      o.payment_status,
      o.fulfilled_at,
      (
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS items_count,
      o.status AS delivery_status,
      o.is_nationwide_delivery
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE (
      o.payment_method = 'cod'
      OR o.payment_status IN ('paid', 'cod', 'refunded')
    )
      AND ${TRIAL_PACK_ORDER_EXCLUSION_SQL}
    ORDER BY o.created_at DESC
    `
  );

  return res.rows.map((row) => ({
    orderId: String(row.order_id),
    orderNumber: String(row.order_number),
    orderedAt: row.ordered_at ? new Date(row.ordered_at).toISOString() : null,
    customerName: row.user_name || null,
    customerEmail: row.user_email || null,
    customerId: row.user_id != null ? String(row.user_id) : null,
    amount: row.amount !== null ? parseFloat(row.amount) : null,
    currency: row.currency || 'INR',
    paymentMethod: row.payment_method || 'online',
    paymentStatus: row.payment_status || 'pending',
    fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at).toISOString() : null,
    itemsCount: row.items_count !== null ? parseInt(row.items_count, 10) : 0,
    deliveryStatus: row.delivery_status || 'pending',
    isNationwideDelivery: row.is_nationwide_delivery || false,
  }));
}

async function updatePaymentStatusByRazorpayOrderId(razorpayOrderId, paymentStatus) {
  await ensureOrdersSchema();
  await query(
    `UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE razorpay_order_id = $2`,
    [paymentStatus, razorpayOrderId]
  );
}

async function updateOrderCardByRazorpayOrderId(razorpayOrderId, cardLast4, cardNetwork) {
  await ensureOrdersSchema();
  await query(
    `UPDATE orders SET card_last4 = $1, card_network = $2, updated_at = NOW() WHERE razorpay_order_id = $3`,
    [cardLast4 || null, cardNetwork || null, razorpayOrderId]
  );
}

/**
 * Get a single order by ID for a user (customer's own order)
 * Returns full order with items, subtotal, discount, total, and user name/email
 */
async function getOrderByIdForUser(userId, orderId) {
  await ensureOrdersSchema();

  const orderRes = await query(
    `
    SELECT
      o.id,
      o.order_number,
      o.status,
      o.payment_method,
      o.payment_status,
      o.currency,
      o.subtotal,
      o.discount,
      o.platform_fee,
      o.delivery_charges,
      o.total,
      o.delivery_address,
      o.created_at,
      o.delivery_date,
      o.package_prepared_at,
      o.shipped_at,
      o.in_transit_at,
      o.reached_destination_hub_at,
      o.out_for_delivery_at,
      o.delivered_at,
      o.fulfilled_at,
      o.card_last4,
      o.card_network,
      o.savings_amount,
      o.is_nationwide_delivery,
      o.shiprocket_awb,
      o.shiprocket_courier,
      o.shiprocket_order_id,
      o.delhivery_waybill,
      o.delhivery_status,
      o.delhivery_upload_wbn,
      o.delhivery_tracking_url,
      u.name AS user_name,
      u.email AS user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.id::text = $1::text AND o.user_id::text = $2::text
    `,
    [String(orderId), String(userId)]
  );

  if (orderRes.rows.length === 0) return null;
  const r = orderRes.rows[0];

  const itemRes = await query(
    `
    SELECT
      oi.product_name,
      oi.variation_size,
      oi.variation_id,
      oi.quantity,
      oi.unit_price,
      oi.line_total,
      oi.product_id,
      oi.photobooth_project_id,
      oi.photobook_project_id,
      COALESCE(oi.photobook_image_check_url, pb.preview_url) AS photobook_image_check_url,
      pb.generated_pdf_url AS generated_pdf_url,
      p.image_url,
      p.buy_again_enabled,
      oi.customizations,
      oi.gift_wrap,
      opdf.quality_stars,
      opdf.delivery_agent_stars,
      opdf.on_time_stars,
      opdf.value_for_money_stars,
      opdf.would_order_again
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN photobooth_projects pb ON pb.id = oi.photobooth_project_id
    LEFT JOIN photobook_projects pbook ON pbook.id = oi.photobook_project_id
    LEFT JOIN order_product_detailed_feedback opdf
      ON opdf.order_id = oi.order_id AND opdf.product_id = oi.product_id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at
    `,
    [orderId]
  );

  const items = itemRes.rows.map((row) => {
    let customizations = row.customizations;
    if (typeof customizations === 'string') {
      try { customizations = JSON.parse(customizations); } catch {}
    }
    let giftWrap = row.gift_wrap || customizations?.giftWrap || null;
    if (typeof giftWrap === 'string') {
      try { giftWrap = JSON.parse(giftWrap); } catch {}
    }

    return {
      productName: row.product_name || 'Product',
      variationSize: row.variation_size || null,
      variationId: row.variation_id != null ? row.variation_id : null,
      quantity: row.quantity != null ? parseInt(row.quantity, 10) : 1,
      unitPrice: row.unit_price != null ? parseFloat(row.unit_price) : 0,
      lineTotal: row.line_total != null ? parseFloat(row.line_total) : 0,
      productId: row.product_id,
      photoboothProjectId: row.photobooth_project_id || null,
      photobookProjectId: row.photobook_project_id || null,
      photobookImageCheckUrl: row.photobook_image_check_url || null,
      generatedPdfUrl: row.generated_pdf_url || null,
      imageUrl: row.image_url || null,
      buyAgainEnabled: row.buy_again_enabled === undefined || row.buy_again_enabled === null ? true : Boolean(row.buy_again_enabled),
      detailedFeedback: mapOpdfRowToDetailedFeedback(row),
      customizations: customizations || null,
      giftWrap: giftWrap || null,
    };
  });

  const fbRes = await query(`SELECT rating FROM order_feedback WHERE order_id = $1`, [orderId]);
  const feedbackSubmitted = fbRes.rows.length > 0;
  const feedbackRating = fbRes.rows[0]?.rating || null;

  return {
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    currency: r.currency || 'INR',
    subtotal: r.subtotal != null ? parseFloat(r.subtotal) : 0,
    discount: r.discount != null ? parseFloat(r.discount) : 0,
    platformFee: r.platform_fee != null ? parseFloat(r.platform_fee) : 0,
    deliveryCharges: r.delivery_charges != null ? parseFloat(r.delivery_charges) : 0,
    total: r.total != null ? parseFloat(r.total) : 0,
    deliveryAddress: r.delivery_address,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    deliveryDate: r.delivery_date ? new Date(r.delivery_date).toISOString().slice(0, 10) : null,
    packagePreparedAt: r.package_prepared_at ? new Date(r.package_prepared_at).toISOString() : null,
    shippedAt: r.shipped_at ? new Date(r.shipped_at).toISOString() : null,
    inTransitAt: r.in_transit_at ? new Date(r.in_transit_at).toISOString() : null,
    reachedDestinationHubAt: r.reached_destination_hub_at ? new Date(r.reached_destination_hub_at).toISOString() : null,
    outForDeliveryAt: r.out_for_delivery_at ? new Date(r.out_for_delivery_at).toISOString() : null,
    deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
    fulfilledAt: r.fulfilled_at ? new Date(r.fulfilled_at).toISOString() : null,
    cardLast4: r.card_last4 || null,
    cardNetwork: r.card_network || null,
    savingsAmount: parseFloat(r.savings_amount || 0),
    customer: {
      name: r.user_name || '',
      email: r.user_email || '',
    },
    items,
    isNationwideDelivery: r.is_nationwide_delivery,
    shiprocketAwb: r.shiprocket_awb || null,
    shiprocketCourier: r.shiprocket_courier || null,
    shiprocketOrderId: r.shiprocket_order_id || null,
    delhiveryWaybill: r.delhivery_waybill || null,
    delhiveryStatus: r.delhivery_status || null,
    delhiveryUploadWbn: r.delhivery_upload_wbn || null,
    delhiveryTrackingUrl: r.delhivery_tracking_url || (r.delhivery_waybill ? `https://www.delhivery.com/track/package/${r.delhivery_waybill}` : null),
    feedbackSubmitted,
    feedbackRating,
  };
}

/**
 * Submit order feedback (emoji: least, neutral, most). One per order. Order must be delivered and belong to user.
 */
async function submitOrderFeedback(orderId, userId, rating) {
  await ensureOrdersSchema();
  const valid = ['least', 'neutral', 'most'].includes(rating);
  if (!valid) throw new Error('Invalid rating');

  const orderCheck = await query(
    `SELECT id, status FROM orders WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );
  if (orderCheck.rows.length === 0) throw new Error('Order not found');
  if (orderCheck.rows[0].status !== 'delivered') throw new Error('Feedback only allowed for delivered orders');

  await query(
    `INSERT INTO order_feedback (order_id, user_id, rating) VALUES ($1, $2, $3)
     ON CONFLICT (order_id) DO NOTHING`,
    [orderId, userId, rating]
  );
}

/**
 * Submit detailed feedback per (order, product). Creates one product_review row for that product.
 * Body must include productId when the order has multiple line items.
 */
async function submitDetailedFeedback(orderId, userId, data) {
  await ensureOrdersSchema();
  const { qualityStars, deliveryAgentStars, onTimeStars, valueForMoneyStars, wouldOrderAgain, productId: rawPid, comment: rawComment } = data;

  const q = (v) => (v != null && Number.isFinite(Number(v)) && (v = parseInt(String(v), 10)) >= 1 && v <= 5) ? v : null;
  const qs = q(qualityStars);
  const das = deliveryAgentStars != null ? q(deliveryAgentStars) : (qs || 5);
  const ots = q(onTimeStars);
  const vfms = q(valueForMoneyStars);
  const woa = String(wouldOrderAgain || '').trim();
  if (!['Yes', 'Maybe', 'No'].includes(woa)) throw new Error('wouldOrderAgain must be Yes, Maybe, or No');
  if (!qs || !ots || !vfms) throw new Error('qualityStars, onTimeStars, valueForMoneyStars must be 1–5');

  const orderCheck = await query(`SELECT id, status FROM orders WHERE id = $1 AND user_id = $2`, [orderId, userId]);
  if (orderCheck.rows.length === 0) throw new Error('Order not found');
  if (orderCheck.rows[0].status !== 'delivered') throw new Error('Feedback only for delivered orders');

  const itemsRes = await query(
    `SELECT DISTINCT product_id FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL`,
    [orderId]
  );
  const pids = itemsRes.rows.map((r) => r.product_id);
  if (pids.length === 0) throw new Error('No products in this order');

  let targetPid = rawPid != null && rawPid !== '' ? parseInt(String(rawPid), 10) : null;
  if (targetPid != null && Number.isNaN(targetPid)) targetPid = null;
  if (targetPid == null) {
    if (pids.length === 1) targetPid = pids[0];
    else throw new Error('productId is required for orders with multiple products');
  }
  if (!pids.includes(targetPid)) throw new Error('Product not in this order');

  const dup = await query(
    `SELECT quality_stars FROM order_product_detailed_feedback WHERE order_id = $1 AND product_id = $2`,
    [orderId, targetPid]
  );
  if (dup.rows.length > 0 && dup.rows[0].quality_stars != null) {
    throw new Error('You have already submitted feedback for this product on this order');
  }

  const nameRes = await query(`SELECT u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`, [orderId]);
  const reviewerName = nameRes.rows[0]?.name || 'Customer';
  const comment = rawComment != null ? String(rawComment).trim().slice(0, 1000) || null : null;

  await productReviewModel.createProductReview(targetPid, {
    userId,
    reviewerName,
    rating: qs,
    comment,
    isApproved: true,
  });

  await query(
    `
    INSERT INTO order_product_detailed_feedback (
      order_id, product_id, user_id, quality_stars, delivery_agent_stars, on_time_stars, value_for_money_stars, would_order_again, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (order_id, product_id) DO UPDATE SET
      quality_stars = EXCLUDED.quality_stars,
      delivery_agent_stars = EXCLUDED.delivery_agent_stars,
      on_time_stars = EXCLUDED.on_time_stars,
      value_for_money_stars = EXCLUDED.value_for_money_stars,
      would_order_again = EXCLUDED.would_order_again,
      updated_at = NOW()
    `,
    [orderId, targetPid, userId, qs, das, ots, vfms, woa]
  );

  return { qualityStars: qs, productId: targetPid };
}

/**
 * Get feedback stats for admin: emoji counts + detailed (delivery agent, on time, value for money, would order again).
 */
async function getFeedbackStats() {
  await ensureOrdersSchema();
  const res = await query(
    `SELECT rating, COUNT(*)::int AS c FROM order_feedback WHERE rating IS NOT NULL GROUP BY rating`
  );
  const counts = { least: 0, neutral: 0, most: 0 };
  for (const row of res.rows) {
    if (counts[row.rating] !== undefined) counts[row.rating] = row.c;
  }
  const total = counts.least + counts.neutral + counts.most;

  const fillStarDist = async (col) => {
    const r = await query(
      `SELECT ${col} AS v, COUNT(*)::int AS c FROM order_product_detailed_feedback WHERE ${col} IS NOT NULL AND ${col} BETWEEN 1 AND 5 GROUP BY ${col}`
    );
    const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of r.rows) {
      const v = parseInt(row.v, 10);
      if (v >= 1 && v <= 5) d[v] = row.c;
    }
    return d;
  };

  const [deliveryAgentStars, onTimeStars, valueForMoneyStars] = await Promise.all([
    fillStarDist('delivery_agent_stars'),
    fillStarDist('on_time_stars'),
    fillStarDist('value_for_money_stars'),
  ]);

  const woaRes = await query(
    `SELECT would_order_again AS v, COUNT(*)::int AS c FROM order_product_detailed_feedback WHERE would_order_again IN ('Yes','Maybe','No') GROUP BY would_order_again`
  );
  const wouldOrderAgain = { Yes: 0, Maybe: 0, No: 0 };
  for (const row of woaRes.rows) {
    if (wouldOrderAgain[row.v] !== undefined) wouldOrderAgain[row.v] = row.c;
  }

  return {
    least: counts.least,
    neutral: counts.neutral,
    most: counts.most,
    total,
    leastPct: total ? Math.round((counts.least / total) * 1000) / 10 : 0,
    neutralPct: total ? Math.round((counts.neutral / total) * 1000) / 10 : 0,
    mostPct: total ? Math.round((counts.most / total) * 1000) / 10 : 0,
    deliveryAgentStars,
    onTimeStars,
    valueForMoneyStars,
    wouldOrderAgain,
  };
}

/**
 * Delivered order line items for the reviews hub (rate / show submitted How was it? data).
 */
async function getDeliveredItemsForReview(userId) {
  await ensureOrdersSchema();
  const res = await query(
    `
    SELECT
      o.id AS order_id,
      o.order_number,
      o.delivered_at,
      o.created_at,
      oi.id AS order_item_id,
      COALESCE(oi.product_id, prod_match.match_id) AS resolved_product_id,
      oi.product_name,
      oi.variation_size,
      oi.quantity,
      oi.line_total,
      p.image_url,
      opdf.quality_stars,
      opdf.delivery_agent_stars,
      opdf.on_time_stars,
      opdf.value_for_money_stars,
      opdf.would_order_again
    FROM orders o
    INNER JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN LATERAL (
      SELECT p2.id AS match_id
      FROM products p2
      WHERE oi.product_id IS NULL
        AND (
          p2.name = oi.product_name
          OR p2.name = TRIM(REGEXP_REPLACE(oi.product_name, '^[Ss]ubscription for\\s+', ''))
        )
      LIMIT 1
    ) prod_match ON true
    LEFT JOIN products p ON p.id = COALESCE(oi.product_id, prod_match.match_id)
    LEFT JOIN order_product_detailed_feedback opdf
      ON opdf.order_id = o.id
      AND opdf.product_id = COALESCE(oi.product_id, prod_match.match_id)
    WHERE o.user_id = $1
      AND (
        o.status = 'delivered'
        OR (o.delivered_at IS NOT NULL AND o.status NOT IN ('cancelled', 'refunded'))
      )
      AND COALESCE(oi.product_id, prod_match.match_id) IS NOT NULL
      AND LOWER(TRIM(oi.product_name)) NOT LIKE 'subscription for %'
    ORDER BY COALESCE(o.delivered_at, o.created_at) DESC NULLS LAST, o.created_at DESC, oi.created_at ASC
    `,
    [userId]
  );

  return res.rows.map((row) => ({
    orderItemId: String(row.order_item_id),
    orderId: String(row.order_id),
    orderNumber: String(row.order_number),
    productId: row.resolved_product_id,
    productName: row.product_name || 'Product',
    variationSize: row.variation_size || null,
    quantity: row.quantity != null ? parseInt(row.quantity, 10) : 1,
    lineTotal: row.line_total != null ? parseFloat(row.line_total) : 0,
    imageUrl: row.image_url || null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    orderedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    detailedFeedback: mapOpdfRowToDetailedFeedback(row),
  }));
}

/**
 * Get order by ID for admin (includes all details)
 */
async function getOrderByIdForAdmin(orderId) {
  await ensureOrdersSchema();

  const orderRes = await query(
    `
    SELECT
      o.*,
      u.name AS user_name,
      u.email AS user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.id = $1
    `,
    [orderId]
  );

  if (orderRes.rows.length === 0) return null;
  const r = orderRes.rows[0];

  const itemRes = await query(
    `
    SELECT
      oi.product_name,
      COALESCE(oi.variation_size, pv.size) AS variation_size,
      oi.variation_id,
      oi.quantity,
      oi.unit_price,
      oi.line_total,
      oi.product_id,
      oi.photobooth_project_id,
      oi.photobook_project_id,
      COALESCE(oi.photobook_image_check_url, pb.preview_url) AS photobook_image_check_url,
      pb.generated_pdf_url AS generated_pdf_url,
      p.image_url,
      p.buy_again_enabled,
      p.customization_options,
      oi.customizations,
      oi.gift_wrap
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_variations pv ON pv.id = oi.variation_id
    LEFT JOIN photobooth_projects pb ON pb.id = oi.photobooth_project_id
    LEFT JOIN photobook_projects pbook ON pbook.id = oi.photobook_project_id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at
    `,
    [orderId]
  );

  const items = itemRes.rows.map((row) => {
    let customizations = row.customizations;
    if (typeof customizations === 'string') {
      try { customizations = JSON.parse(customizations); } catch {}
    }
    let giftWrap = row.gift_wrap || customizations?.giftWrap || null;
    if (typeof giftWrap === 'string') {
      try { giftWrap = JSON.parse(giftWrap); } catch {}
    }

    let custOptions = row.customization_options;
    if (typeof custOptions === 'string') {
      try { custOptions = JSON.parse(custOptions); } catch {}
    }
    if (!Array.isArray(custOptions)) custOptions = [];

    const variationDetails = [];
    const varSize = row.variation_size ? String(row.variation_size).trim() : '';
    if (varSize && !varSize.startsWith('group_') && !varSize.startsWith('val_')) {
      variationDetails.push(/^size\s*:/i.test(varSize) || varSize.includes(':') ? varSize : `Variant: ${varSize}`);
    }

    if (customizations && typeof customizations === 'object') {
      const selectedOpts = customizations.selectedOptions || (customizations.options && typeof customizations.options === 'object' && !Array.isArray(customizations.options) ? customizations.options : null);
      if (selectedOpts && typeof selectedOpts === 'object') {
        Object.entries(selectedOpts).forEach(([groupId, valId]) => {
          const group = custOptions.find((g) => String(g.id) === String(groupId) || String(g.title || '').toLowerCase() === String(groupId).toLowerCase());
          const val = group ? (group.values || []).find((v) => String(v.id) === String(valId) || String(v.name || '').toLowerCase() === String(valId).toLowerCase()) : null;
          if (group && val) {
            variationDetails.push(`${group.title}: ${val.name}`);
          } else if (val) {
            variationDetails.push(`${val.name}`);
          } else if (typeof valId === 'string' && !valId.startsWith('val_') && !groupId.startsWith('group_')) {
            variationDetails.push(`${groupId}: ${valId}`);
          } else if (typeof valId === 'string' && !valId.startsWith('val_')) {
            variationDetails.push(`${valId}`);
          }
        });
      }

      if (customizations.textPersonalization && typeof customizations.textPersonalization === 'object') {
        Object.entries(customizations.textPersonalization).forEach(([k, v]) => {
          if (v) variationDetails.push(`Personalization (${k}): ${v}`);
        });
      }
      if (customizations.color && typeof customizations.color === 'string') {
        variationDetails.push(`Color: ${customizations.color}`);
      }
      if (customizations.paperType && typeof customizations.paperType === 'string') {
        variationDetails.push(`Paper: ${customizations.paperType}`);
      }
      if (customizations.finish && typeof customizations.finish === 'string') {
        variationDetails.push(`Finish: ${customizations.finish}`);
      }
    }

    return {
      productName: row.product_name || 'Product',
      variationSize: row.variation_size || null,
      variationDetails: Array.from(new Set(variationDetails)),
      quantity: row.quantity != null ? parseInt(row.quantity, 10) : 1,
      unitPrice: row.unit_price != null ? parseFloat(row.unit_price) : 0,
      lineTotal: row.line_total != null ? parseFloat(row.line_total) : 0,
      productId: row.product_id,
      photoboothProjectId: row.photobooth_project_id || null,
      generatedPdfUrl: row.generated_pdf_url || null,
      imageUrl: row.image_url || null,
      buyAgainEnabled: row.buy_again_enabled === undefined || row.buy_again_enabled === null ? true : Boolean(row.buy_again_enabled),
      customizations: customizations || null,
      giftWrap: giftWrap || null,
    };
  });

  return {
    id: r.id,
    orderNumber: r.order_number,
    status: r.status,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    currency: r.currency || 'INR',
    subtotal: r.subtotal != null ? parseFloat(r.subtotal) : 0,
    discount: r.discount != null ? parseFloat(r.discount) : 0,
    platformFee: r.platform_fee != null ? parseFloat(r.platform_fee) : 0,
    deliveryCharges: r.delivery_charges != null ? parseFloat(r.delivery_charges) : 0,
    total: r.total != null ? parseFloat(r.total) : 0,
    deliveryAddress: r.delivery_address,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    deliveryDate: r.delivery_date ? new Date(r.delivery_date).toISOString().slice(0, 10) : null,
    packagePreparedAt: r.package_prepared_at ? new Date(r.package_prepared_at).toISOString() : null,
    shippedAt: r.shipped_at ? new Date(r.shipped_at).toISOString() : null,
    inTransitAt: r.in_transit_at ? new Date(r.in_transit_at).toISOString() : null,
    reachedDestinationHubAt: r.reached_destination_hub_at ? new Date(r.reached_destination_hub_at).toISOString() : null,
    outForDeliveryAt: r.out_for_delivery_at ? new Date(r.out_for_delivery_at).toISOString() : null,
    deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
    fulfilledAt: r.fulfilled_at ? new Date(r.fulfilled_at).toISOString() : null,
    isNationwideDelivery: r.is_nationwide_delivery,
    delhiveryWaybill: r.delhivery_waybill || null,
    shiprocketOrderId: r.shiprocket_order_id || null,
    customer: {
      name: r.user_name || '',
      email: r.user_email || '',
    },
    items,
  };
}

/**
 * Mark order as package prepared
 */
async function markAsPackagePrepared(orderId) {
  await ensureOrdersSchema();

  const result = await query(
    `
    UPDATE orders
    SET status = 'package_prepared', package_prepared_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'placed'
    RETURNING *
    `,
    [orderId]
  );

  if (result.rows.length === 0) {
    throw new Error('Order not found or already processed');
  }

  return result.rows[0];
}

/**
 * Mark order as out for delivery
 */
async function markAsOutForDelivery(orderId) {
  await ensureOrdersSchema();

  const result = await query(
    `
    UPDATE orders
    SET status = 'out_for_delivery', out_for_delivery_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'package_prepared'
    RETURNING *
    `,
    [orderId]
  );

  if (result.rows.length === 0) {
    throw new Error('Order not found or not in package_prepared state');
  }

  return result.rows[0];
}

/**
 * Mark order as delivered
 */
async function markAsDelivered(orderId) {
  await ensureOrdersSchema();

  const result = await query(
    `
    UPDATE orders
    SET
      status = 'delivered',
      delivered_at = NOW(),
      delivery_date = CURRENT_DATE,
      payment_status = CASE
        WHEN LOWER(payment_method) = 'cod' THEN 'paid'
        ELSE payment_status
      END,
      updated_at = NOW()
    WHERE id = $1 AND status = 'out_for_delivery'
    RETURNING *
    `,
    [orderId]
  );

  if (result.rows.length === 0) {
    throw new Error('Order not found or not in out_for_delivery state');
  }

  return result.rows[0];
}

/**
 * Advance or set order timeline status (package_prepared, shipped, in_transit, reached_destination_hub, out_for_delivery, delivered)
 */
async function updateTimelineStatus(orderId, targetStatus) {
  await ensureOrdersSchema();
  const valid = ['package_prepared', 'shipped', 'in_transit', 'reached_destination_hub', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!valid.includes(targetStatus)) {
    throw new Error(`Invalid status: ${targetStatus}. Must be one of: ${valid.join(', ')}`);
  }

  let queryStr = `UPDATE orders SET status = $1, updated_at = NOW()`;
  const values = [targetStatus, orderId];

  if (targetStatus === 'package_prepared') {
    queryStr += `, package_prepared_at = COALESCE(package_prepared_at, NOW())`;
  } else if (targetStatus === 'shipped') {
    queryStr += `, package_prepared_at = COALESCE(package_prepared_at, NOW()), shipped_at = COALESCE(shipped_at, NOW())`;
  } else if (targetStatus === 'in_transit') {
    queryStr += `, package_prepared_at = COALESCE(package_prepared_at, NOW()), shipped_at = COALESCE(shipped_at, NOW()), in_transit_at = COALESCE(in_transit_at, NOW())`;
  } else if (targetStatus === 'reached_destination_hub') {
    queryStr += `, package_prepared_at = COALESCE(package_prepared_at, NOW()), shipped_at = COALESCE(shipped_at, NOW()), in_transit_at = COALESCE(in_transit_at, NOW()), reached_destination_hub_at = COALESCE(reached_destination_hub_at, NOW())`;
  } else if (targetStatus === 'out_for_delivery') {
    queryStr += `, package_prepared_at = COALESCE(package_prepared_at, NOW()), shipped_at = COALESCE(shipped_at, NOW()), in_transit_at = COALESCE(in_transit_at, NOW()), reached_destination_hub_at = COALESCE(reached_destination_hub_at, NOW()), out_for_delivery_at = COALESCE(out_for_delivery_at, NOW())`;
  } else if (targetStatus === 'delivered') {
    queryStr += `, package_prepared_at = COALESCE(package_prepared_at, NOW()), shipped_at = COALESCE(shipped_at, NOW()), in_transit_at = COALESCE(in_transit_at, NOW()), reached_destination_hub_at = COALESCE(reached_destination_hub_at, NOW()), out_for_delivery_at = COALESCE(out_for_delivery_at, NOW()), delivered_at = COALESCE(delivered_at, NOW()), fulfilled_at = COALESCE(fulfilled_at, NOW()), delivery_date = CURRENT_DATE, payment_status = CASE WHEN LOWER(payment_method) = 'cod' THEN 'paid' ELSE payment_status END`;
  }

  queryStr += ` WHERE id::text = $2::text RETURNING *`;
  const res = await query(queryStr, values);
  if (res.rows.length === 0) {
    throw new Error('Order not found');
  }
  return res.rows[0];
}

/**
 * Mark order as fulfilled (COD collection / finalization)
 * - For COD orders: sets payment_status = 'paid'
 * - For all orders: sets fulfilled_at (only once)
 */
async function markAsFulfilled(orderId) {
  await ensureOrdersSchema();

  // Set fulfilled_at once
  const res1 = await query(
    `
    UPDATE orders
    SET fulfilled_at = COALESCE(fulfilled_at, NOW()), updated_at = NOW()
    WHERE id = $1 AND status IN ('out_for_delivery', 'delivered')
    RETURNING payment_method, payment_status, fulfilled_at
    `,
    [orderId]
  );

  if (res1.rows.length === 0) {
    throw new Error('Order not found or not ready to be fulfilled');
  }

  const { payment_method: pm } = res1.rows[0];

  if (pm === 'cod') {
    await query(
      `
      UPDATE orders
      SET payment_status = 'paid', updated_at = NOW()
      WHERE id = $1
      `,
      [orderId]
    );
  }

  return true;
}

/**
 * List out-for-delivery orders as DeliveryStop objects for the route planner.
 * Includes ALL out_for_delivery orders — never skips due to missing coordinates.
 * Falls back to the user's default saved address for coords, and uses 0,0 + noCoords=true as last resort.
 */
async function listOutForDeliveryStops() {
  await ensureOrdersSchema();

  const res = await query(
    `
    SELECT
      o.id          AS order_id,
      o.user_id,
      u.name        AS user_name,
      u.email       AS user_email,
      o.delivery_address,
      o.status,
      o.created_at,
      o.payment_method,
      o.payment_status,
      o.total         AS order_total,
      o.platform_fee  AS order_platform_fee
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.status = 'out_for_delivery'
      AND (o.is_nationwide_delivery IS NOT TRUE)
      AND ${TRIAL_PACK_ORDER_EXCLUSION_SQL}
    ORDER BY COALESCE(o.out_for_delivery_at, o.created_at) ASC
    `
  );

  if (res.rows.length === 0) return [];

  const orderIds = res.rows.map((r) => r.order_id);

  // Fetch items for all orders at once
  const itemRes = await query(
    `
    SELECT order_id, product_name, variation_size, quantity, line_total
    FROM order_items
    WHERE order_id = ANY($1)
    ORDER BY order_id, created_at
    `,
    [orderIds]
  );

  // Group items by order
  const itemsByOrder = {};
  for (const row of itemRes.rows) {
    if (!itemsByOrder[row.order_id]) itemsByOrder[row.order_id] = [];
    itemsByOrder[row.order_id].push(row);
  }

  // Collect user IDs whose delivery_address is missing coordinates
  const missingCoordUserIds = [];
  for (const row of res.rows) {
    const addr = row.delivery_address || {};
    const lat = addr.latitude != null ? parseFloat(addr.latitude) : null;
    const lng = addr.longitude != null ? parseFloat(addr.longitude) : null;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      if (row.user_id) missingCoordUserIds.push(row.user_id);
    }
  }

  // Fall back to user's saved address with coordinates
  const fallbackCoordsMap = {};
  if (missingCoordUserIds.length > 0) {
    try {
      const addrRes = await query(
        `
        SELECT DISTINCT ON (user_id) user_id, latitude, longitude
        FROM addresses
        WHERE user_id = ANY($1)
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        ORDER BY user_id, is_default DESC, created_at DESC
        `,
        [missingCoordUserIds]
      );
      for (const a of addrRes.rows) {
        const lat = parseFloat(a.latitude);
        const lng = parseFloat(a.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          fallbackCoordsMap[a.user_id] = { lat, lng };
        }
      }
    } catch {
      // addresses table may not exist — skip fallback silently
    }
  }

  // Return ALL orders — never filter out due to missing coords
  return res.rows.map((row) => {
    const addr = row.delivery_address || {};
    let lat = addr.latitude != null ? parseFloat(addr.latitude) : null;
    let lng = addr.longitude != null ? parseFloat(addr.longitude) : null;
    let noCoords = false;

    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      const fb = fallbackCoordsMap[row.user_id];
      if (fb) {
        lat = fb.lat;
        lng = fb.lng;
      } else {
        lat = 0;
        lng = 0;
        noCoords = true; // No GPS available — show in list; mark-as-delivered swipe still works
      }
    }

    const items = itemsByOrder[row.order_id] || [];
    const totalQty = items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 1), 0);
    const firstItem = items[0];
    const productName = firstItem
      ? `${firstItem.product_name}${firstItem.variation_size ? ' ' + firstItem.variation_size : ''}`
      : 'Order';

    const orderItems = items.map((it) => ({
      productName: it.product_name || '',
      variationSize: it.variation_size || null,
      quantity: parseInt(it.quantity, 10) || 1,
      lineTotal: it.line_total != null ? parseFloat(it.line_total) : 0,
    }));

    return {
      id: row.order_id,
      userId: row.user_id,
      userName: row.user_name || null,
      userEmail: row.user_email || null,
      userPhone: addr.phone || null,
      date: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null,
      lat,
      lng,
      noCoords,
      deliveryTime: null,
      status: 'pending',
      litresPerDay: totalQty,
      productName,
      orderItems,
      addressName: addr.name || null,
      street: addr.street || null,
      city: addr.city || null,
      state: addr.state || null,
      postalCode: addr.postalCode || addr.postal_code || null,
      country: addr.country || null,
      paymentMethod: row.payment_method || null,
      paymentStatus: row.payment_status || null,
      orderTotal: row.order_total != null ? parseFloat(row.order_total) : null,
      platformFee: row.order_platform_fee != null ? parseFloat(row.order_platform_fee) : null,
    };
  });
}


/** Trial pack checkout rows: show under subscription deliveries, not order deliveries. */
const TRIAL_PACK_ORDER_EXCLUSION_SQL = `NOT EXISTS (
  SELECT 1 FROM subscriptions st
  WHERE st.is_trial IS TRUE
    AND (st.trial_checkout_order_id::text = o.id::text OR (
      o.razorpay_order_id IS NOT NULL AND BTRIM(o.razorpay_order_id::text) <> ''
      AND st.razorpay_subscription_id::text = BTRIM(o.razorpay_order_id::text)
    ))
)`;

async function listOrderDeliveriesAdmin() {
  await ensureOrdersSchema();

  const res = await query(
    `
    SELECT
      o.id AS order_id,
      o.order_number,
      o.status,
      o.created_at AS ordered_at,
      o.payment_method,
      o.payment_status,
      o.total AS amount,
      o.currency,
      o.package_prepared_at,
      o.out_for_delivery_at,
      o.delivered_at,
      o.fulfilled_at,
      u.name AS user_name,
      u.email AS user_email,
      (
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS items_count
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.status IN ('package_prepared', 'out_for_delivery', 'delivered')
      AND (o.is_nationwide_delivery IS NOT TRUE)
      AND ${TRIAL_PACK_ORDER_EXCLUSION_SQL}
    ORDER BY COALESCE(o.out_for_delivery_at, o.package_prepared_at, o.created_at) DESC
    `
  );

  return res.rows.map((row) => ({
    orderId: String(row.order_id),
    orderNumber: String(row.order_number),
    status: row.status,
    orderedAt: row.ordered_at ? new Date(row.ordered_at).toISOString() : null,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    amount: row.amount !== null ? parseFloat(row.amount) : null,
    currency: row.currency || 'INR',
    itemsCount: row.items_count !== null ? parseInt(row.items_count, 10) : 0,
    packagePreparedAt: row.package_prepared_at ? new Date(row.package_prepared_at).toISOString() : null,
    outForDeliveryAt: row.out_for_delivery_at ? new Date(row.out_for_delivery_at).toISOString() : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at).toISOString() : null,
    customerName: row.user_name || null,
    customerEmail: row.user_email || null,
  }));
}

module.exports = {
  ensureOrdersSchema,
  createOrder,
  listOrdersForUser,
  listAllOrdersAdmin,
  updatePaymentStatusByRazorpayOrderId,
  updateOrderCardByRazorpayOrderId,
  getOrderByIdForUser,
  getOrderByIdForAdmin,
  markAsPackagePrepared,
  markAsOutForDelivery,
  markAsDelivered,
  markAsFulfilled,
  updateTimelineStatus,
  listOrderDeliveriesAdmin,
  listOutForDeliveryStops,
  submitOrderFeedback,
  submitDetailedFeedback,
  getFeedbackStats,
  getDeliveredItemsForReview,
};
