# Frontend Project Structure - Milko.in

## STEP 2: Frontend Project Structure Complete

### Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Inline styles (can be migrated to Tailwind/CSS Modules later)
- **HTTP Client**: Axios
- **State Management**: React Context API (AuthContext)

---

## Project Structure

```
milko-frontend/
├── app/                          # Next.js App Router
│   ├── (customer)/              # Customer route group
│   │   ├── layout.tsx           # Customer layout with nav
│   │   ├── products/            # Browse products
│   │   ├── dashboard/           # Customer dashboard
│   │   ├── subscribe/           # Create subscription
│   │   └── subscriptions/       # View subscriptions
│   ├── admin/                   # Admin routes (all prefixed with /admin)
│   │   ├── layout.tsx           # Admin layout with nav
│   │   ├── page.tsx             # Admin dashboard
│   │   ├── products/            # Manage products
│   │   ├── customers/           # View customers
│   │   ├── subscriptions/       # Manage subscriptions
│   │   └── deliveries/          # Delivery schedule
│   ├── auth/                    # Authentication pages
│   │   ├── login/               # Login page
│   │   └── signup/              # Sign up page
│   ├── layout.tsx               # Root layout (wraps all pages)
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
├── components/                   # Reusable components (to be added)
├── contexts/                    # React contexts
│   └── AuthContext.tsx         # Authentication context
├── hooks/                       # Custom React hooks
│   └── useRequireAuth.ts       # Route protection hooks
├── lib/                         # Utilities and services
│   ├── api/                     # API service layer
│   │   ├── client.ts           # Axios instance with interceptors
│   │   ├── auth.ts             # Auth API calls
│   │   ├── products.ts         # Products API calls
│   │   ├── subscriptions.ts   # Subscriptions API calls
│   │   └── index.ts            # Centralized exports
│   └── utils/                   # Helper functions
│       ├── constants.ts        # API endpoints, constants
│       └── storage.ts          # LocalStorage helpers
├── types/                       # TypeScript definitions
│   └── index.ts                # All type definitions
├── middleware.ts                # Next.js middleware (route protection)
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── next.config.js               # Next.js config
└── .env.example                 # Environment variables template
```

---

## Routing Strategy

### Route Groups
Next.js App Router uses **route groups** `(customer)` to organize routes without affecting the URL structure.

### Customer Routes
- `/` - Home page (public)
- `/products` - Browse products (protected)
- `/dashboard` - Customer dashboard (protected)
- `/subscribe` - Create subscription (protected)
- `/subscriptions` - View all subscriptions (protected)

**Protection**: All customer routes use `useRequireAuth()` hook which redirects to `/auth/login` if not authenticated.

### Admin Routes
- `/admin` - Admin dashboard (admin only)
- `/admin/products` - Manage products (admin only)
- `/admin/customers` - View customers (admin only)
- `/admin/subscriptions` - Manage subscriptions (admin only)
- `/admin/deliveries` - Delivery schedule (admin only)

**Protection**: All admin routes use `useRequireAdmin()` hook which:
1. Redirects to `/auth/login` if not authenticated
2. Redirects to `/` if authenticated but not admin

### Auth Routes
- `/auth/login` - Login page (public, redirects if already logged in)
- `/auth/signup` - Sign up page (public, redirects if already logged in)

### Route Protection Flow

```
User visits route
    ↓
Middleware runs (edge runtime)
    ↓
Page component loads
    ↓
Layout component loads
    ↓
useRequireAuth() or useRequireAdmin() hook runs
    ↓
Checks authentication status
    ↓
Redirects if needed OR renders page
```

---

## API Service Layer

### Architecture
- **Centralized Client**: Single Axios instance with interceptors
- **Automatic Token Injection**: JWT token added to all requests
- **Error Handling**: Global error handler for 401 (logout)
- **Type Safety**: All API calls are typed with TypeScript

### API Structure
```typescript
// Example usage
import { productsApi } from '@/lib/api';

// Get all products
const products = await productsApi.getAll();

// Admin API (separate namespace)
import { adminProductsApi } from '@/lib/api';
const allProducts = await adminProductsApi.getAll();
```

### Environment Variables
- `NEXT_PUBLIC_API_BASE_URL` - Backend API base URL
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name (for image display)

---

## Authentication Flow

### Login Process
1. User enters email/password
2. Frontend calls `authApi.login()`
3. Backend validates and returns JWT + user data
4. Frontend stores token in localStorage
5. Frontend stores user data in localStorage
6. AuthContext updates state
7. User redirected to dashboard

### Token Management
- **Storage**: localStorage (can be upgraded to httpOnly cookies)
- **Injection**: Axios interceptor adds token to Authorization header
- **Validation**: On app load, token is validated by calling `/api/auth/me`
- **Expiration**: Handled by backend (401 response triggers logout)

### Role-Based Access
- User object contains `role: 'admin' | 'customer'`
- `useRequireAdmin()` checks `user.role === 'admin'`
- Admin routes are completely separate from customer routes

---

## Layout System

### Root Layout (`app/layout.tsx`)
- Wraps entire application
- Provides AuthProvider context
- Sets global styles and metadata

### Customer Layout (`app/(customer)/layout.tsx`)
- Customer navigation bar
- Shows user name and logout button
- Link to admin panel (if user is admin)
- Protects all customer routes

### Admin Layout (`app/admin/layout.tsx`)
- Dark admin navigation bar
- Admin-specific menu items
- Link back to customer site
- Protects all admin routes

---

## Key Features Implemented

✅ **Route Protection**: Client-side and middleware protection
✅ **Role-Based Access**: Admin vs Customer separation
✅ **API Service Layer**: Centralized, typed API calls
✅ **Authentication Context**: Global auth state management
✅ **Type Safety**: Full TypeScript coverage
✅ **Environment Variables**: Configurable API endpoints
✅ **Error Handling**: Global error handling in API client
✅ **Image Support**: Cloudinary integration ready

---

## Next Steps (To Be Implemented)

1. **Razorpay Integration**: Payment checkout flow
2. **Image Upload**: Admin product image upload
3. **Delivery Schedule View**: Customer view of upcoming deliveries
4. **Pause/Resume Dates**: Customer ability to pause specific dates
5. **Styling**: Migrate to Tailwind CSS or CSS Modules
6. **Loading States**: Better loading indicators
7. **Error Boundaries**: React error boundaries
8. **Form Validation**: Better form validation (react-hook-form)
9. **Toast Notifications**: Success/error notifications
10. **Responsive Design**: Mobile-first responsive design

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Set `NEXT_PUBLIC_API_BASE_URL` to your backend URL
3. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (optional, for images)

---

## Notes

- All pages are Server Components by default (Next.js 14)
- Client-side interactivity uses `'use client'` directive
- API calls are made from client components
- Authentication state is managed client-side (can be enhanced with server-side sessions)
- Middleware is basic - can be enhanced to verify JWT server-side

