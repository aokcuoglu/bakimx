# BakIMX Phase 1: Admin Kataloğu (Admin Catalog)

## Overview

Phase 1 implements the admin-side order management system for BakIMX catalog orders. This includes complete CRUD operations, status tracking, payment management, and stock movement auditing.

## Architecture

### Database Schema

**BakimxOrder** - Order header
- `id`, `workshopId`, `status`, `paymentStatus`, `totalPriceKurus`
- `notes` - Internal admin notes
- `createdAt`, `updatedAt`

**BakimxOrderItem** - Line items
- Links to `BakimxOrder` and `BakimxProduct`
- Stores `quantity`, `unitPriceKurus`, `totalPriceKurus`
- Optional link to `ServiceOrderItem` (1:1 for work order integration)

**BakimxStockMovement** - Audit trail
- Records every stock change (deduction, return, adjustment)
- Links to order and product
- Tracks `type`, `quantity`, `reason`

**BakimxOrderPhoto** - Documentation
- Stores photos for returns/issues
- Links to order and product

**BakimxSyncLog** - Getirbakim integration
- Tracks sync status with getirbakim (Phase 3)
- Records API calls and responses

### State Machine

Orders flow through defined status transitions:

```
pending → confirmed → payment_requested → shipped → delivered
             ↓              ↓
        cancelled      failed_to_sync

delivered → return_requested → return_accepted
```

Payment statuses:
- `unpaid` - No payment received
- `partial` - Partial payment received
- `paid` - Full payment received

### API Endpoints

**Data Queries** (`src/app/admin/orders/data.ts`)
- `getOrders(params)` - List orders with pagination and filtering
- `getOrderById(id)` - Full order details with related data
- `getOrderStats()` - Summary statistics for dashboard

**Server Actions** (`src/app/admin/orders/actions.ts`)
- `createBakimxOrder(data)` - Create new order with items
- `updateBakimxOrder(id, data)` - Update order details
- `updateOrderStatus(id, status)` - Change order status
- `updatePaymentStatus(id, paymentStatus)` - Change payment status
- `addOrderNote(id, content)` - Add internal note
- `recordStockMovement(...)` - Audit stock changes

### Validation

**Zod Schemas** (`src/lib/validations/bakimx-order.ts`)
- `createBakimxOrderSchema` - Validates new order creation
- `updateBakimxOrderSchema` - Partial update validation
- `recordStockMovementSchema` - Stock movement validation

### Utilities

**Order Utilities** (`src/lib/orders/bakimx-order-utils.ts`)
- `getOrderStatusLabel()` - Turkish labels + UI variants
- `getPaymentStatusLabel()` - Turkish payment labels
- `canUpdateOrderStatus()` - Validates state transitions
- `isOrderEditable()` - Check if order can be modified
- `isOrderCancellable()` - Check if order can be cancelled
- `calculateOrderTotalWithTax()` - Calculate totals with VAT
- Status/payment color constants for UI

## UI Components

### Pages

**`/admin/orders`** - Orders dashboard
- Statistics cards (total, pending, confirmed, shipped, unpaid, partial)
- Searchable/filterable orders table
- Quick access to create new order

**`/admin/orders/new`** - Create order
- Workshop selection dropdown
- Dynamic line items (add/remove products)
- Automatic price lookup from catalog
- Real-time total calculation
- Optional notes field

**`/admin/orders/[id]`** - Order detail
- Header with order ID, workshop, total
- Status and payment quick view
- Three tabs:
  - **Items** - Order line items table
  - **Stock** - Stock movement audit trail
  - **Notes** - Internal notes with add capability

### Components

**OrderStatusBadge** - Displays order status with color coding
**PaymentStatusBadge** - Displays payment status
**OrderItemsTable** - Reusable table for displaying line items
**StockMovementsList** - Timeline of stock changes
**OrderNotes** - Notes display with timestamps
**AddNoteDialog** - Modal for adding new notes
**OrderStatusActions** - Status/payment update dropdowns

## Features

### Order Creation
- Select workshop from dropdown
- Add/remove line items dynamically
- Auto-lookup product prices (optional override)
- Real-time total calculation
- Optional internal notes

### Order Management
- View all orders with pagination
- Filter by status, payment status, workshop
- Quick statistics dashboard
- Status transitions with validation
- Payment tracking

### Stock Tracking
- Full audit trail of stock movements
- Track deductions, returns, adjustments
- Reason/comment per movement
- Timestamp every change

### Documentation
- Upload photos for returns/issues
- Link photos to specific products
- Accessible from order detail

### Localization
- All labels in Turkish
- Date formatting with Turkish locale
- Number formatting (currency)

## Testing

All components and utilities have comprehensive tests:

- **Validation tests** - Schema correctness, edge cases
- **Utility tests** - State machine rules, calculations
- **Component tests** - Rendering, interaction

Run with: `bun test`

## Integration Points

### With Existing Systems

**Workshop Integration**
- Orders belong to workshops
- Workshop details displayed in UI
- Workshop selection required for new orders

**Product Integration**
- Line items reference products
- Automatic price lookup from `BakimxProduct`
- SKU display in tables

**Service Order Integration** (Phase 2)
- `ServiceOrderItem.bakimxOrderItemId` links to order line items
- Optional 1:1 relationship (work order can reference parts order)

**Billing Integration** (Phase 2)
- Orders create billing records
- Payment status tracked separately
- Integration with existing payment flow

### Phase 2 Dependencies

- **Atölye Sipariş UI** - Workshop-side order creation
- **Approval workflow** - Admin approve/reject orders
- **Getirbakim sync** - Real stock sync (currently mocked)

### Phase 3 Dependencies

- **Webhook integration** - Getirbakim stock/price updates
- **Real API sync** - Replace mock implementation
- **Auto-reorder** - Automatic low-stock ordering

## Known Limitations

1. **Getirbakim Integration** (Phase 3)
   - Currently mocked implementation
   - Returns dummy data for product search
   - Will be replaced with real API calls

2. **Photo Management** (Phase 4)
   - Photo upload endpoint not yet implemented
   - Photos can be referenced but not uploaded in Phase 1
   - Will be added in return management phase

3. **Notes Storage** (Phase 1)
   - Notes stored as single text field on order
   - Will be split into BakimxOrderNote table in Phase 2
   - No comment threading or user attribution yet

## Development Workflow

### Adding a New Feature

1. **Update schema** if needed (Prisma + migration)
2. **Add validation** in `src/lib/validations/bakimx-order.ts`
3. **Add server action** in `src/app/admin/orders/actions.ts`
4. **Add utility** if needed in `src/lib/orders/bakimx-order-utils.ts`
5. **Create/update component** in `src/app/admin/orders/`
6. **Add tests** (validation, utility, component)
7. **Update relevant pages** to use new component
8. **Test locally** with `bun run dev`

### File Structure

```
src/app/admin/orders/
├── page.tsx                 # Orders dashboard
├── orders-list.tsx          # Table component
├── order-form.tsx           # Create form
├── data.ts                  # Query functions
├── actions.ts               # Server actions
├── order-status-badge.tsx   # Status display
├── order-items-table.tsx    # Items table
├── stock-movements-list.tsx # Stock audit
├── add-note-dialog.tsx      # Note modal
├── order-notes.tsx          # Notes display
├── new/
│   └── page.tsx             # Create page
└── [id]/
    ├── page.tsx             # Detail route
    ├── order-detail.tsx     # Detail view
    └── order-actions.tsx    # Status updates

src/lib/
├── orders/
│   ├── bakimx-order-utils.ts
│   └── bakimx-order-utils.test.ts
└── validations/
    ├── bakimx-order.ts
    └── bakimx-order.test.ts
```

## Performance Considerations

- **Pagination** - Orders list uses limit/offset
- **N+1 Prevention** - All queries include() related data
- **Index Strategy** - `workshopId`, `status`, `paymentStatus` indexed
- **Caching** - Stats calculated on-demand (could be cached in Phase 2)

## Security

- **Authorization** - All endpoints admin-only (enforced at middleware level in Phase 2)
- **Validation** - Server-side validation on all inputs
- **Tenant Isolation** - Orders scoped to workshop (future: verify in queries)
- **CSRF Protection** - Form actions use CSRF tokens (Next.js default)

## Future Enhancements

- [ ] Bulk operations (status update, export)
- [ ] Advanced filtering and search
- [ ] Order templates for repeat customers
- [ ] Email notifications on status changes
- [ ] Integration with accounting system
- [ ] Barcode scanning for order items
- [ ] Mobile app integration
