-- Stockali — Phase 0 Core Schema
-- PostgreSQL + PostGIS. Run this after enabling the postgis extension.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- =========================================================
-- USERS & AUTH
-- =========================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer', 'retailer_owner', 'retailer_staff', 'admin')),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_location GEOGRAPHY(POINT, 4326),
    search_radius_m INTEGER NOT NULL DEFAULT 3000,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- =========================================================
-- RETAILERS & STORES
-- =========================================================

CREATE TABLE retailers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    phone TEXT,
    opening_hours JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast "stores near me" queries
CREATE INDEX idx_stores_location ON stores USING GIST (location);

CREATE TABLE store_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
    UNIQUE (store_id, user_id)
);

CREATE TABLE verification_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    document_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- SHARED PRODUCT CATALOGUE
-- =========================================================

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES categories(id)
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand TEXT,
    category_id UUID REFERENCES categories(id),
    barcode TEXT UNIQUE,
    image_url TEXT,
    is_perishable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_label TEXT NOT NULL, -- e.g. "500g", "1L", "Red / Medium"
    barcode TEXT UNIQUE
);

-- =========================================================
-- PER-STORE LISTINGS, INVENTORY & PRICING
-- =========================================================

CREATE TABLE store_product_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    current_price NUMERIC(10, 2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (store_id, product_variant_id)
);

CREATE TABLE inventory_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(10, 2) NOT NULL DEFAULT 0,
    reorder_threshold NUMERIC(10, 2),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id) ON DELETE CASCADE,
    batch_no TEXT,
    quantity NUMERIC(10, 2) NOT NULL,
    expiry_date DATE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id) ON DELETE CASCADE,
    change_qty NUMERIC(10, 2) NOT NULL, -- positive = restock, negative = sale/adjustment
    reason TEXT NOT NULL CHECK (reason IN ('restock', 'sale', 'adjustment', 'expiry_writeoff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- SHOPPING LISTS & PICKUP WORKFLOW
-- =========================================================

CREATE TABLE shopping_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'accepted', 'declined', 'ready', 'collected', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id),
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    substitution_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'substituted', 'unavailable'))
);

-- =========================================================
-- DEMAND SIGNALS, NOTIFICATIONS & ML OUTPUTS
-- =========================================================

CREATE TABLE restock_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notified_at TIMESTAMPTZ
);

-- The core demand-signal table: every search/view/notify-request event,
-- whether or not it resulted in a match. This is what feeds the ML layer.
CREATE TABLE customer_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL, -- nullable: anonymous search allowed
    event_type TEXT NOT NULL CHECK (event_type IN (
        'search', 'product_view', 'store_view', 'out_of_stock_hit',
        'restock_subscribe', 'shopping_list_submit'
    )),
    query_text TEXT,
    product_id UUID REFERENCES products(id),
    store_id UUID REFERENCES stores(id),
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_events_product ON customer_events (product_id, created_at);
CREATE INDEX idx_customer_events_store ON customer_events (store_id, created_at);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'push')),
    title TEXT NOT NULL,
    body TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ML-generated outputs, written by the batch pipeline, read by the retailer dashboard
CREATE TABLE demand_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    predicted_quantity NUMERIC(10, 2) NOT NULL,
    model_version TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE restock_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id) ON DELETE CASCADE,
    recommended_quantity NUMERIC(10, 2) NOT NULL,
    recommended_by DATE,
    confidence NUMERIC(4, 3), -- 0.000 - 1.000
    explanation TEXT,
    retailer_action TEXT CHECK (retailer_action IN ('pending', 'accepted', 'adjusted', 'dismissed')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE discount_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_product_listing_id UUID NOT NULL REFERENCES store_product_listings(id) ON DELETE CASCADE,
    recommended_discount_pct NUMERIC(5, 2) NOT NULL,
    reason TEXT, -- e.g. 'near_expiry', 'slow_mover'
    confidence NUMERIC(4, 3),
    retailer_action TEXT CHECK (retailer_action IN ('pending', 'approved', 'dismissed')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metrics JSONB NOT NULL -- e.g. {"mae": 3.2, "rmse": 5.1, "features": "sales_only"}
);

-- =========================================================
-- AUDIT LOG (admin actions, sensitive changes)
-- =========================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
