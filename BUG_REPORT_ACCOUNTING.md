# Accounting Module Bug Report & Fixes

## ✅ Fixed Bugs

### 1. **Gross Revenue Calculation Mismatch** [FIXED]
**File:** [admin/src/pages/Accounting.js](admin/src/pages/Accounting.js#L201)
**Severity:** HIGH

**Issue:** The `totals` calculation used `row.gmv` (GMV includes delivery fees) instead of `row.grossRevenue` (items only).

**Fix Applied:** Changed line 201 to use only `row.grossRevenue`:
```javascript
acc.grossRevenue += row.grossRevenue;  // was: row.gmv || row.grossRevenue
```

**Impact:** Reports now accurately reflect item-based gross revenue, matching the platform fee calculations.

---

### 2. **Cycle Key Format Mismatch** [FIXED]
**Files:**
- Backend: [backend/server.js](backend/server.js#L1585-L1590)

**Severity:** CRITICAL

**Issue:** Backend was generating cycle keys as `YYYY-MM-DD` while frontend used `YYYY-MM`, causing ledger entries to not match when filtered.

**Fix Applied:** Standardized backend to use `YYYY-MM` format:
```javascript
// Changed from: referenceDate.toISOString().slice(0, 10) → "2026-03-16"  
// To:
const y = referenceDate.getFullYear();
const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
return `${y}-${m}`; // → "2026-03"
```

**Impact:** Backend-settled payouts now correctly appear in admin's monthly cycle view.

---

### 3. **Driver Payout Missing Cycle Restriction** [FIXED]
**File:** [admin/src/pages/Accounting.js](admin/src/pages/Accounting.js#L556)
**Severity:** HIGH

**Issue:** Driver "Mark Paid" button lacked the `selectedCycle === 'ALL'` restriction that stores had.

**Fix Applied:** Added cycle restriction to match store button behavior:
```javascript
disabled={row.pendingPayout <= 0 || selectedCycle === 'ALL'}
```

**Impact:** Admins can no longer record driver payments without specifying a cycle, preventing ambiguous ledger records.

---

### 4. **Item Subtotal Derivation Ambiguity** [DOCUMENTED]
**File:** [backend/server.js](backend/server.js#L1608-1620)
**Severity:** MEDIUM

**Issue:** Discount handling logic was unclear and undocumented.

**Fix Applied:** Added clarifying comment explaining the discount accounting flow:
```javascript
// NOTE: If discountAmount is provided, it should represent a customer discount value.
// When deriving itemsSubtotal from customerTotal, we ADD the discount back because 
// customerTotal has already deducted the discount. Then when calculating merchantNetIncome, 
// we SUBTRACT it again because the merchant bears the cost of customer discounts.
```

**Impact:** Developers now understand the discount accounting semantics, reducing future confusion.

---

## Verification Tests

To verify the fixes work correctly:

1. **Gross Revenue Test**: Check that total "Gross Revenue" = sum of all store "Gross Revenue" (not GMV)
2. **Cycle Key Test**: Record a payout in "2026-03" cycle and verify it appears in that month's ledger
3. **Driver Button Test**: Try clicking "Mark Paid" for driver without selecting a specific cycle - button should be disabled
4. **Auto-settle Test**: Verify orders deliver and auto-generated payout records appear in the correct monthly cycle

