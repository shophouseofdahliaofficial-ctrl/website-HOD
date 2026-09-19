# Backend Project Structure - Milko.in

## STEP 3: Backend Project Structure Complete

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (with pg library)
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Payments**: Razorpay SDK
- **Images**: Cloudinary SDK
- **File Upload**: Multer

---

## Project Structure

```
milko-backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js     # PostgreSQL connection pool
│   │   ├── cloudinary.js   # Cloudinary configuration
│   │   └── razorpay.js     # Razorpay configuration
│   ├── controllers/        # Route controllers (HTTP handlers)
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── subscriptionController.js
│   │   ├── adminController.js
│   │   └── webhookController.js
│   ├── services/           # Business logic layer
│   │   ├── authService.js
│   │   ├── productService.js
│   │   └── subscriptionService.js
│   ├── models/             # Database models (queries)
│   │   ├── user.js
│   │   ├── product.js
│   │   └── subscription.js
│   ├── middleware/         # Express middleware
│   │   ├── auth.js         # JWT authentication
│   │   ├── admin.js        # Admin authorization
│   │   ├── errorHandler.js # Error handling
│   │   └── notFound.js     # 404 handler
│   ├── routes/             # API routes
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── subscriptions.js
│   │   ├── admin.js
│   │   └── webhooks.js
│   ├── utils/              # Utility functions
│   │   ├── jwt.js          # JWT token generation/verification
│   │   └── errors.js        # Custom error classes
│   └── server.js           # Express app entry point
├── .env.example            # Environment variables template
├── package.json
└── README.md
```

---

## Architecture Layers

### 1. **Routes Layer** (`src/routes/`)
- Defines API endpoints
- Applies middleware (auth, admin)
- Delegates to controllers

### 2. **Controllers Layer** (`src/controllers/`)
- Handles HTTP requests/responses
- Validates request data
- Calls services
- Returns JSON responses

### 3. **Services Layer** (`src/services/`)
- Contains business logic
- Orchestrates multiple models
- Handles external API calls (Razorpay, Cloudinary)
- Throws custom errors

### 4. **Models Layer** (`src/models/`)
- Database queries only
- No business logic
- Returns raw data

### 5. **Middleware Layer** (`src/middleware/`)
- Authentication (JWT verification)
- Authorization (admin check)
- Error handling
- 404 handling

---

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/signup` - Register new customer
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout (client-side token removal)
- `GET /api/auth/me` - Get current user (protected)

### Products (`/api/products`)
- `GET /api/products` - Get all active products (public)
- `GET /api/products/:id` - Get product by ID (public)

### Subscriptions (`/api/subscriptions`)
- `GET /api/subscriptions` - Get user's subscriptions (protected)
- `GET /api/subscriptions/:id` - Get subscription details (protected)
- `POST /api/subscriptions` - Create subscription (protected)
- `POST /api/subscriptions/:id/pause` - Pause subscription (protected)
- `POST /api/subscriptions/:id/resume` - Resume subscription (protected)
- `POST /api/subscriptions/:id/cancel` - Cancel subscription (protected)

### Admin (`/api/admin`)
**All routes require admin role**

#### Products
- `GET /api/admin/products` - Get all products
- `POST /api/admin/products` - Create product (with image upload)
- `PUT /api/admin/products/:id` - Update product (with image upload)
- `DELETE /api/admin/products/:id` - Delete product

#### Users
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user by ID

#### Subscriptions
- `GET /api/admin/subscriptions` - Get all subscriptions
- `POST /api/admin/subscriptions/:id/pause` - Pause subscription
- `POST /api/admin/subscriptions/:id/resume` - Resume subscription

#### Deliveries
- `GET /api/admin/deliveries?date=YYYY-MM-DD` - Get delivery schedule
- `PUT /api/admin/deliveries/:id` - Update delivery status

### Webhooks (`/api/webhooks`)
- `POST /api/webhooks/razorpay` - Razorpay webhook handler

---

## Authentication Flow

1. User logs in → `POST /api/auth/login`
2. Backend validates credentials
3. Backend generates JWT token
4. Token returned to frontend
5. Frontend stores token in localStorage
6. Frontend includes token in `Authorization: Bearer <token>` header
7. `authenticate` middleware verifies token on protected routes
8. User object attached to `req.user`

---

## Authorization

### Role-Based Access Control
- **Customer**: Can access own subscriptions, browse products
- **Admin**: Can access all admin routes, manage products, view all users/subscriptions

### Middleware Chain
```javascript
// Customer route
router.get('/subscriptions', authenticate, controller.getMySubscriptions);

// Admin route
router.get('/admin/products', authenticate, requireAdmin, controller.getAllProducts);
```

---

## Database Models

### User Model
- `createUser()` - Create new user
- `findByEmail()` - Find user by email
- `findById()` - Find user by ID
- `getAllUsers()` - Get all users (admin)
- `verifyPassword()` - Verify password hash
- `updateUser()` - Update user

### Product Model
- `createProduct()` - Create product
- `getActiveProducts()` - Get active products (customer)
- `getAllProducts()` - Get all products (admin)
- `getProductById()` - Get product by ID
- `updateProduct()` - Update product
- `deleteProduct()` - Soft delete product

### Subscription Model
- `createSubscription()` - Create subscription
- `getSubscriptionsByUserId()` - Get user's subscriptions
- `getAllSubscriptions()` - Get all subscriptions (admin)
- `getSubscriptionById()` - Get subscription by ID
- `updateSubscriptionStatus()` - Update status
- `generateDeliverySchedules()` - Generate daily delivery entries

---

## Payment Integration (Razorpay)

### Flow
1. Customer creates subscription → Backend creates Razorpay order
2. Backend returns Razorpay order details to frontend
3. Frontend redirects to Razorpay checkout
4. Customer completes payment
5. Razorpay sends webhook to `/api/webhooks/razorpay`
6. Webhook handler verifies signature
7. Webhook handler activates subscription
8. Delivery schedules generated automatically

### Webhook Events Handled
- `payment.captured` - Payment successful, activate subscription
- `payment.failed` - Payment failed, log for review
- `subscription.activated` - Subscription activated
- `subscription.cancelled` - Subscription cancelled

---

## Image Upload (Cloudinary)

### Flow
1. Admin uploads image via `POST /api/admin/products` (multipart/form-data)
2. Multer middleware processes file
3. Product service uploads to Cloudinary
4. Cloudinary returns CDN URL
5. URL stored in database
6. Frontend displays image via Cloudinary CDN

### Configuration
- Images stored in `milko/products/` folder on Cloudinary
- 5MB file size limit
- Only image files allowed

---

## Error Handling

### Custom Error Classes
- `ValidationError` (400) - Invalid input
- `AuthenticationError` (401) - Authentication failed
- `AuthorizationError` (403) - Access denied
- `NotFoundError` (404) - Resource not found
- `AppError` (500) - Generic server error

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "stack": "..." // Only in development
}
```

---

## Security Features

1. **JWT Authentication**: Secure token-based auth
2. **Password Hashing**: bcrypt with salt rounds
3. **CORS**: Configured for frontend domains
4. **Helmet**: Security headers
5. **Input Validation**: Basic validation in controllers
6. **Webhook Signature Verification**: Razorpay webhook security
7. **SQL Injection Prevention**: Parameterized queries (pg library)

---

## Environment Variables

See `.env.example` for all required variables:
- `PORT` - Server port
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `RAZORPAY_KEY_ID` - Razorpay key ID
- `RAZORPAY_KEY_SECRET` - Razorpay key secret
- `RAZORPAY_WEBHOOK_SECRET` - Webhook signature secret
- `CLOUDINARY_*` - Cloudinary credentials
- `FRONTEND_URL` - Frontend URL for CORS

---

## Development

### Start Development Server
```bash
npm run dev  # Uses nodemon for auto-reload
```

### Start Production Server
```bash
npm start
```

### Database Setup
1. Create PostgreSQL database
2. Run migrations (to be created in STEP 4)
3. Update `DATABASE_URL` in `.env`

---

## Next Steps

1. **Database Schema**: Create migration files (STEP 4)
2. **Request Validation**: Add express-validator for better validation
3. **Rate Limiting**: Add rate limiting middleware
4. **Logging**: Add structured logging (Winston)
5. **Testing**: Add unit and integration tests
6. **API Documentation**: Add Swagger/OpenAPI docs

---

## Notes

- All database queries use parameterized queries to prevent SQL injection
- JWT tokens expire after 7 days (configurable)
- Subscriptions are soft-deleted (status changed, not deleted from DB)
- Delivery schedules are generated automatically when subscription is activated
- Webhook handler always returns 200 to prevent Razorpay retries

