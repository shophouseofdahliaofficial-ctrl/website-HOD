-- Product detail banners and digital flipbook (JSONB on products)
ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_banners JSONB NOT NULL DEFAULT '{"images":[],"adaptToFullImageRatio":false,"displayMode":"stacked"}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_flipbook JSONB NOT NULL DEFAULT '{"enabled":false,"sections":[]}'::jsonb;
