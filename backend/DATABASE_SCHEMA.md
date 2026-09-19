# Database Schema - Milko.in

## STEP 4: Database Schema Design Complete

### Overview
Complete PostgreSQL database schema for the Milko.in milk delivery subscription platform.

---

## Schema Summary

### Tables Created

1. **users** - User accounts (customers and admins)
2. **products** - Milk products (Cow Milk, Buffalo Milk, etc.)
3. **subscriptions** - Customer subscriptions
4. **delivery_schedules** - Daily delivery schedule entries
5. **paused_dates** - Dates when delivery is paused
6. **payments** - Payment records

---

## Entity Relationship Diagram

```
┌─────────────┐
│    users    │
│─────────────│
│ id (PK)     │
│ name        │
│ email       │◄──────┐
│ password    │       │
│ role        │       │
└─────────────┘       │
                       │
┌─────────────┐        │
│  products   │        │
│─────────────│        │
│ id (PK)     │        │
│ name        │        │
│ price       │        │
│ image_url   │        │
└─────────────┘        │
       │                │
       │                │
       ▼                │
┌─────────────┐        │
│subscriptions│────────┘
│─────────────│
│ id (PK)     │
│ user_id (FK)│
│ product_id  │
│ litres/day  │
│ status      │
│ dates       │
└─────────────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────────┐  ┌─────────────┐
│  delivery_  │  │  paused_    │
│  schedules  │  │  dates      │
│─────────────│  │─────────────│
│ id (PK)     │  │ id (PK)     │
│ sub_id (FK) │  │ sub_id (FK) │
│ date        │  │ date        │
│ status      │  │ reason      │
└─────────────┘  └─────────────┘
       │
       │
       ▼
┌─────────────┐
│  payments   │
│─────────────│
│ id (PK)     │
│ sub_id (FK) │
│ amount      │
│ status      │
└─────────────┘
```

---

## Key Features

### 1. **User Management**
- Separate roles: `admin` and `customer`
- Email-based authentication
- Bcrypt password hashing

### 2. **Product Management**
- Active/inactive status (soft delete)
- Price per litre
- Cloudinary image URLs

### 3. **Subscription System**
- Daily delivery subscriptions
- Configurable quantity (litres per day)
- Duration-based (1, 3, 6, 12 months)
- Delivery time preference
- Status tracking: pending → active → (paused/cancelled/expired)

### 4. **Delivery Scheduling**
- Automatic generation when subscription activates
- Daily entries from start_date to end_date
- Automatic skipping of paused dates
- Status tracking: pending → delivered/skipped/cancelled

### 5. **Pause Functionality**
- Customers can pause specific dates
- Dates stored in `paused_dates` table
- Automatically excluded from delivery schedule generation

### 6. **Payment Tracking**
- Razorpay integration
- Payment history per subscription
- Status tracking: pending → captured/failed/refunded

---

## Database Relationships

### Foreign Keys
- `subscriptions.user_id` → `users.id` (CASCADE)
- `subscriptions.product_id` → `products.id` (RESTRICT)
- `delivery_schedules.subscription_id` → `subscriptions.id` (CASCADE)
- `paused_dates.subscription_id` → `subscriptions.id` (CASCADE)
- `payments.subscription_id` → `subscriptions.id` (CASCADE)

### Constraints
- Email uniqueness in users table
- One delivery per subscription per date (UNIQUE constraint)
- One pause entry per subscription per date (UNIQUE constraint)
- Date validation: end_date >= start_date
- Status enums enforced via CHECK constraints

---

## Indexes for Performance

### Users
- Email index (login queries)
- Role index (admin queries)

### Products
- Active products index (customer product listing)

### Subscriptions
- User ID index (user's subscriptions)
- Product ID index (product subscriptions)
- Status index (filtering)
- Date range index (date queries)
- Razorpay ID index (webhook processing)

### Delivery Schedules
- Date index (admin delivery view)
- Subscription index (subscription deliveries)
- Status index (filtering)
- Composite date+status index (common queries)

### Payments
- Subscription index (subscription payments)
- Razorpay ID index (webhook lookups)
- Status index (filtering)

---

## Automatic Features

### Triggers
- `update_updated_at_column()` - Automatically updates `updated_at` timestamp on row updates
- Applied to: users, products, subscriptions, delivery_schedules, payments

---

## Setup Instructions

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

### 3. Generate Admin Password Hash
```bash
node src/database/generate_admin_hash.js YourSecurePassword
```

### 4. Update Seed File
Edit `src/database/seed.sql` with the generated hash.

### 5. Seed Initial Data (Optional)
```bash
psql $DATABASE_URL -f src/database/seed.sql
```

### Or Use Setup Scripts
```bash
# Linux/Mac
chmod +x src/database/setup.sh
./src/database/setup.sh

# Windows PowerShell
.\src/database/setup.ps1
```

---

## Data Flow Examples

### Subscription Creation
1. Customer creates subscription → `subscriptions` (status: 'pending')
2. Payment successful → Webhook updates status to 'active'
3. Delivery schedules generated → `delivery_schedules` entries created
4. Paused dates checked → Dates in `paused_dates` skipped

### Daily Delivery Management
1. Admin queries deliveries for date → `SELECT * FROM delivery_schedules WHERE delivery_date = '2024-01-15'`
2. Admin marks delivered → `UPDATE delivery_schedules SET status = 'delivered' WHERE id = ?`
3. Customer pauses date → `INSERT INTO paused_dates (subscription_id, date) VALUES (?, ?)`

---

## File Structure

```
milko-backend/src/database/
├── schema.sql              # Complete database schema
├── seed.sql                # Initial data (admin user + products)
├── generate_admin_hash.js  # Utility to generate password hash
├── setup.sh                # Setup script (Linux/Mac)
├── setup.ps1               # Setup script (Windows)
├── README.md               # Detailed documentation
└── migrations/
    └── 001_initial_schema.sql  # Migration file
```

---

## Notes

- All IDs use SERIAL (auto-incrementing integers)
- Timestamps use PostgreSQL's `CURRENT_TIMESTAMP`
- Soft deletes: Products use `is_active = false`
- Delivery schedules are generated in bulk transactions
- Paused dates are checked during schedule generation
- All foreign keys have appropriate CASCADE/RESTRICT rules

---

## Next Steps

1. **Run the schema** to create the database
2. **Seed initial data** (admin user + sample products)
3. **Test the backend** with the database
4. **Proceed to STEP 5** for API contracts documentation

