# Milko Backend

Express.js backend API for Milko.in milk delivery subscription platform.

## Features

- RESTful API with Express.js
- PostgreSQL database
- JWT authentication
- Role-based authorization (admin/customer)
- Razorpay payment integration
- Cloudinary image upload
- Webhook handling for payments

## Tech Stack

- Node.js + Express.js
- PostgreSQL
- JWT for authentication
- Razorpay for payments
- Cloudinary for images

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
   - Database connection string
   - JWT secret
   - Razorpay credentials
   - Cloudinary credentials

4. Set up PostgreSQL database:
```sql
CREATE DATABASE milko;
```

5. Run database schema/migrations:

- If you are using local Postgres, run the schema:

```bash
psql $DATABASE_URL -f src/database/schema.sql
```

- If your DB already exists and you see errors like `column "selling_price" of relation "products" does not exist`, run the migration:

```bash
npm run db:migrate-selling-price
```

If your edit product page fails with errors like `relation "product_images" does not exist`, run:

```bash
npm run db:migrate-product-details
```

If adding a product **variation** fails with `column "price" of relation "product_variations" does not exist`, run:

```bash
npm run db:migrate-variation-price
```

If variation **compare-at** (per-size strikethrough price) fails with `column "compare_at_price" of relation "product_variations" does not exist`, run:

```bash
npm run db:migrate-variation-compare-at
```

If you cannot connect from your machine to Supabase Postgres directly, run the SQL in Supabase SQL Editor instead:

```sql
ALTER TABLE products
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10, 2);

CREATE INDEX IF NOT EXISTS idx_products_selling_price ON products(selling_price);
```

5b. (Optional) Supabase users-table migration:
```bash
npm run db:migrate-supabase
```

6. Run development server:
```bash
npm run dev
```

7. API will be available at `http://localhost:3001`

## Project Structure

```
milko-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── models/          # Database models/queries
│   ├── routes/          # API routes
│   ├── utils/           # Helper functions
│   ├── validators/      # Request validation
│   └── server.js        # Entry point
├── .env.example         # Environment variables template
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Customer signup
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - Get all active products
- `GET /api/products/:id` - Get product by ID

### Subscriptions
- `GET /api/subscriptions` - Get user's subscriptions
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions/:id` - Get subscription details
- `POST /api/subscriptions/:id/pause` - Pause subscription
- `POST /api/subscriptions/:id/resume` - Resume subscription
- `POST /api/subscriptions/:id/cancel` - Cancel subscription

### Admin
- `GET /api/admin/products` - Get all products
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `GET /api/admin/users` - Get all users
- `GET /api/admin/subscriptions` - Get all subscriptions
- `GET /api/admin/deliveries` - Get delivery schedule

### Webhooks
- `POST /api/webhooks/razorpay` - Razorpay webhook handler

## Environment Variables

See `.env.example` for all required environment variables.

## Security

- JWT tokens for authentication
- Password hashing with bcrypt
- CORS configuration
- Helmet for security headers
- Input validation with express-validator
- Webhook signature verification
