# Database Setup - Milko.in

## Database Schema Documentation

### Overview
PostgreSQL database schema for Milko.in milk delivery subscription platform.

---

## Tables

### 1. **users**
Stores all users (customers and admins).

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - User ID
- `name` (VARCHAR) - User's full name
- `email` (VARCHAR, UNIQUE) - User's email (used for login)
- `password_hash` (VARCHAR) - Bcrypt hashed password
- `role` (VARCHAR) - User role: 'admin' or 'customer'
- `created_at` (TIMESTAMP) - Account creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_users_email` - Fast email lookups (login)
- `idx_users_role` - Role-based queries

---

### 2. **products**
Stores milk products available for subscription.

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Product ID
- `name` (VARCHAR) - Product name (e.g., "Cow Milk", "Buffalo Milk")
- `description` (TEXT) - Product description
- `price_per_litre` (DECIMAL) - Price per litre in INR
- `image_url` (VARCHAR) - Cloudinary CDN URL
- `is_active` (BOOLEAN) - Whether product is available
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_products_is_active` - Fast lookup of active products

---

### 3. **subscriptions**
Stores customer subscriptions for daily milk delivery.

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Subscription ID
- `user_id` (INTEGER, FK → users.id) - Customer who owns subscription
- `product_id` (INTEGER, FK → products.id) - Product being subscribed
- `litres_per_day` (DECIMAL) - Quantity per day
- `duration_months` (INTEGER) - Subscription duration in months
- `delivery_time` (TIME) - Preferred delivery time (e.g., "08:00:00")
- `start_date` (DATE) - Subscription start date
- `end_date` (DATE) - Subscription end date
- `status` (VARCHAR) - Status: 'pending', 'active', 'paused', 'cancelled', 'expired', 'failed'
- `razorpay_subscription_id` (VARCHAR) - Razorpay order/subscription ID
- `razorpay_payment_id` (VARCHAR) - Razorpay payment ID
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Constraints:**
- `end_date >= start_date` - End date must be after start date

**Indexes:**
- `idx_subscriptions_user_id` - User's subscriptions
- `idx_subscriptions_product_id` - Product subscriptions
- `idx_subscriptions_status` - Status filtering
- `idx_subscriptions_dates` - Date range queries
- `idx_subscriptions_razorpay_id` - Webhook processing

---

### 4. **delivery_schedules**
Stores daily delivery schedule entries. Generated automatically when subscription is activated.

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Schedule entry ID
- `subscription_id` (INTEGER, FK → subscriptions.id) - Related subscription
- `delivery_date` (DATE) - Date of delivery
- `status` (VARCHAR) - Status: 'pending', 'delivered', 'skipped', 'cancelled'
- `delivered_at` (TIMESTAMP) - When delivery was marked as delivered
- `notes` (TEXT) - Delivery notes
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Constraints:**
- `UNIQUE(subscription_id, delivery_date)` - One delivery per subscription per date

**Indexes:**
- `idx_delivery_schedules_date` - Date-based queries (admin view)
- `idx_delivery_schedules_subscription` - Subscription deliveries
- `idx_delivery_schedules_status` - Status filtering
- `idx_delivery_schedules_date_status` - Composite index for common queries

---

### 5. **paused_dates**
Stores dates when customer has paused delivery for a subscription.

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Pause entry ID
- `subscription_id` (INTEGER, FK → subscriptions.id) - Related subscription
- `date` (DATE) - Date when delivery is paused
- `reason` (TEXT) - Optional reason for pausing
- `created_at` (TIMESTAMP) - Creation timestamp

**Constraints:**
- `UNIQUE(subscription_id, date)` - One pause entry per subscription per date

**Indexes:**
- `idx_paused_dates_subscription` - Subscription paused dates
- `idx_paused_dates_date` - Date lookups

**Note:** These dates are automatically skipped when generating delivery schedules.

---

### 6. **payments**
Stores payment records linked to subscriptions.

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Payment ID
- `subscription_id` (INTEGER, FK → subscriptions.id) - Related subscription
- `razorpay_payment_id` (VARCHAR, UNIQUE) - Razorpay payment ID
- `razorpay_order_id` (VARCHAR) - Razorpay order ID
- `amount` (DECIMAL) - Payment amount in INR
- `currency` (VARCHAR) - Currency code (default: 'INR')
- `status` (VARCHAR) - Status: 'pending', 'captured', 'failed', 'refunded'
- `payment_method` (VARCHAR) - Payment method used
- `paid_at` (TIMESTAMP) - Payment completion timestamp
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_payments_subscription` - Subscription payments
- `idx_payments_razorpay_id` - Webhook lookups
- `idx_payments_status` - Status filtering

---

## Relationships

```
users (1) ──→ (N) subscriptions
products (1) ──→ (N) subscriptions
subscriptions (1) ──→ (N) delivery_schedules
subscriptions (1) ──→ (N) paused_dates
subscriptions (1) ──→ (N) payments
```

### Foreign Key Constraints:
- `subscriptions.user_id` → `users.id` (CASCADE on delete)
- `subscriptions.product_id` → `products.id` (RESTRICT on delete)
- `delivery_schedules.subscription_id` → `subscriptions.id` (CASCADE on delete)
- `paused_dates.subscription_id` → `subscriptions.id` (CASCADE on delete)
- `payments.subscription_id` → `subscriptions.id` (CASCADE on delete)

---

## Database Setup

### 1. Create Database
```sql
CREATE DATABASE milko;
```

### 2. Run Schema
```bash
# Using psql
psql -U postgres -d milko -f src/database/schema.sql

# Or using connection string
psql $DATABASE_URL -f src/database/schema.sql
```

### 3. Seed Initial Data (Optional)
```bash
psql $DATABASE_URL -f src/database/seed.sql
```

**Important:** Before running seed.sql, generate a proper password hash:
```bash
node src/database/generate_admin_hash.js YourSecurePassword
```
Then update the hash in `seed.sql`.

---

## Migration Strategy

### Initial Setup
1. Create database: `CREATE DATABASE milko;`
2. Run schema: `psql -d milko -f src/database/schema.sql`
3. Seed data: `psql -d milko -f src/database/seed.sql` (optional)

### Future Migrations
- Store migration files in `src/database/migrations/`
- Number them sequentially: `001_initial_schema.sql`, `002_add_column.sql`, etc.
- Track applied migrations in a `migrations` table (to be implemented)

---

## Indexes Summary

### Performance Optimizations
- **Email lookups**: Fast login queries
- **Status filtering**: Quick filtering by subscription/delivery status
- **Date queries**: Efficient date range queries for deliveries
- **Foreign keys**: Indexed for join performance
- **Composite indexes**: Optimized for common query patterns

---

## Data Flow Examples

### Subscription Creation Flow
1. Customer creates subscription → `subscriptions` table (status: 'pending')
2. Payment successful → Webhook updates `subscriptions` (status: 'active')
3. Delivery schedules generated → `delivery_schedules` table entries created
4. Paused dates skipped automatically during generation

### Delivery Management Flow
1. Admin views deliveries for date → Query `delivery_schedules` by date
2. Admin marks delivery complete → Update `delivery_schedules.status` to 'delivered'
3. Customer pauses date → Insert into `paused_dates` table
4. Next schedule generation → Skips dates in `paused_dates`

---

## Notes

- All timestamps use `CURRENT_TIMESTAMP` for consistency
- `updated_at` is automatically updated via trigger
- Soft deletes: Products use `is_active = false` instead of deletion
- Subscription status transitions: pending → active → (paused/cancelled/expired)
- Delivery schedules are generated in bulk when subscription activates
- Paused dates are checked during schedule generation to skip them

