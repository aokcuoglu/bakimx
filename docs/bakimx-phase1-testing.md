# BakIMX Phase 1 Testing Guide

## Overview

Complete testing guide for Phase 1 (Admin Catalog) implementation covering unit tests, integration tests, and manual QA procedures.

## Unit Tests

### Validation Schemas

**File:** `src/lib/validations/bakimx-order.test.ts`

Tests cover:
- Valid order creation data
- Missing workshopId rejection
- Empty items rejection
- Invalid quantity handling
- Optional price field
- Partial update validation
- Invalid status enum rejection
- Payment status validation

**Run:** `bun test src/lib/validations/bakimx-order.test.ts`

### Order Utilities

**File:** `src/lib/orders/bakimx-order-utils.test.ts`

Tests cover:
- Status label generation
- Payment status labels
- Status transition validation (state machine)
- Order editability checks
- Order cancellation checks
- Tax calculation with custom rates

**Run:** `bun test src/lib/orders/bakimx-order-utils.test.ts`

### Run All Tests

```bash
bun test
```

Expected output: 772+ tests pass

## Integration Testing

### Database Setup

Ensure local database is running:

```bash
docker compose -f docker-compose.local.yml up -d
bun run db:push
bun run db:seed  # Optional: seed demo data
```

### Manual Testing Scenarios

#### 1. Order Creation Flow

**Steps:**
1. Navigate to `/admin/orders/new`
2. Select a workshop from dropdown
3. Add first line item:
   - Select product
   - Enter quantity (1-10)
   - Verify price auto-fills from catalog
   - Optionally override price
4. Add second line item (click "Ürün Ekle")
5. Verify total updates in real-time
6. Add notes (optional)
7. Click "Sipariş Oluştur"

**Expected Result:**
- Order created successfully
- Redirected to order detail page
- Order ID displayed
- All items visible with correct totals
- Status shows "Beklemede" (pending)
- Payment shows "Ödenmemiş" (unpaid)

#### 2. Order List & Filtering

**Steps:**
1. Navigate to `/admin/orders`
2. Verify statistics cards (6 metrics)
3. Verify orders table displays
4. Test status filter dropdown
5. Test payment status filter dropdown
6. Test search by order ID/workshop
7. Click "Temizle" to clear filters

**Expected Result:**
- Statistics update correctly
- Table filters by status
- Table filters by payment status
- Search finds matching orders
- Filters clear properly

#### 3. Order Status Updates

**Steps:**
1. Navigate to order detail page
2. In "Durum & Ödeme" card, change status dropdown
3. Verify toast notification "Başarılı"
4. Verify status badge updates
5. Test invalid transition (should show error)

**Expected Result:**
- Status updates successfully
- Badge reflects new status
- Invalid transitions rejected
- Toast feedback displayed

#### 4. Payment Status Updates

**Steps:**
1. On order detail page
2. Change payment status dropdown
3. Select "Kısmi Ödeme" (partial)
4. Verify badge changes to orange
5. Select "Ödendi" (paid)
6. Verify badge changes to green

**Expected Result:**
- Payment status updates
- Badge color changes appropriately
- Changes persist on page reload

#### 5. Add Notes

**Steps:**
1. On order detail, click "Not Ekle" button
2. Enter note text in modal
3. Click "Kaydet"
4. Verify note appears in Notes tab
5. Add another note
6. Verify multiple notes display

**Expected Result:**
- Notes modal opens
- Note adds successfully
- Notes display in order
- Multiple notes supported

#### 6. Order Items Table

**Steps:**
1. On order detail page, click "Ürünler" tab
2. Verify table displays all items
3. Verify columns: Product Name, SKU, Quantity, Unit Price, Total
4. Verify price formatting (₺)
5. Verify quantity display

**Expected Result:**
- All items display correctly
- Prices formatted as currency
- SKUs displayed
- Quantities shown accurately

#### 7. Stock Movements

**Steps:**
1. On order detail, click "Stok Hareketleri" tab
2. Verify timeline displays (if movements exist)
3. Verify movement types (Düşüm, İade, Ayarlama)
4. Verify timestamps and Turkish dates

**Expected Result:**
- Stock movements display
- Types color-coded
- Timestamps accurate
- Turkish localization correct

#### 8. Export Functionality

**Steps:**
1. On orders list page
2. Scroll down to export button (if implemented)
3. Click "CSV İndir"
4. Verify CSV file downloads
5. Open CSV in Excel/Sheets
6. Verify Turkish headers and data

**Expected Result:**
- CSV downloads correctly
- Data properly formatted
- All columns present
- Turkish localization maintained

## Mobile Testing

Test all flows at mobile width (375px):

1. **Orders List**
   - Table columns responsive
   - Filters stack vertically
   - Buttons remain accessible

2. **Create Order Form**
   - Form fields stack properly
   - Quantity/price inputs usable
   - Add/remove buttons accessible

3. **Order Detail**
   - Tabs display correctly
   - Status cards stack
   - Export button accessible

## Accessibility Testing

Verify keyboard navigation:

1. Tab through all forms
2. Focus visible on buttons
3. Dropdowns keyboard accessible
4. Modal dialogs keyboard accessible
5. Screen reader compatibility

Use tools:
- Chrome DevTools Lighthouse
- axe DevTools
- WAVE browser extension

## Performance Testing

### Load Testing

```bash
# Measure API response times
time curl http://localhost:3000/api/admin/orders
```

### Bundle Size

```bash
npm run build
# Check output for bundle size warnings
```

## Security Testing

### XSS Prevention

1. Add special characters in notes: `<script>alert('xss')</script>`
2. Verify not executed
3. Verify displayed as text

### CSRF Protection

- Verify Next.js CSRF tokens in forms
- Inspect Network tab for token headers

### SQL Injection

- Test search with SQL: `'; DROP TABLE--`
- Verify no errors/injection

## Browser Compatibility

Test in:
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Edge Cases

### Test These Scenarios

1. **Empty Orders List**
   - No orders in system
   - Verify "Henüz sipariş bulunmamaktadır" message

2. **Very Large Numbers**
   - Order total > 999,999 kurus
   - Verify formatting correct

3. **No Products Available**
   - Create order with empty catalog
   - Verify graceful error

4. **Concurrent Updates**
   - Open order in two tabs
   - Update status in one
   - Verify refresh shows correct status

5. **Network Errors**
   - Disable internet
   - Try to update status
   - Verify error toast shown
   - Verify retry capability

## Test Data Seeding

Use demo seed data:

```bash
bun run db:seed
```

Creates demo workshop and products:
- Workshop: Demo Oto Servis
- Products: Various auto parts with prices

## CI/CD Integration

Tests run automatically on:
- Pull request creation
- Push to dev branch
- Before merge to main

View in GitHub Actions or CI provider dashboard.

## Known Limitations

### Phase 1 Limitations

1. **Getirbakim API** - Currently mocked, returns dummy data
2. **Photo Upload** - Not implemented yet
3. **Authorization** - Not enforced at API level (will be Phase 2)
4. **Audit Logging** - No detailed audit trail (will be Phase 2)

## Regression Testing

Before each release:

1. Run full test suite
2. Manual smoke test (5 minutes):
   - Create order
   - Update status
   - View order
   - List orders
3. Mobile test (2 minutes)
4. Browser compatibility check (3 browsers)

## Reporting Issues

Found a bug? Report with:

1. **Exact Steps to Reproduce**
2. **Expected Result**
3. **Actual Result**
4. **Screenshots/videos** if UI issue
5. **Browser/device** details
6. **Logs** (check browser console)

Example:

> Creating order with Turkish characters in notes: When I add "Müşteri istedi" in notes and save, the character ü is displayed as ?, Expected: Turkish characters should display correctly, Actual: Character appears corrupted

## Performance Benchmarks

Target performance:

- Orders list load: < 500ms
- Order detail load: < 300ms
- Status update: < 200ms
- CSV export: < 1000ms

Monitor with Network tab in DevTools.
