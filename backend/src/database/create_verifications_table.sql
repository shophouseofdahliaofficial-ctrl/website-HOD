-- ============================================
-- VERIFICATIONS TABLE
-- Stores 6-digit UC codes and Google Drive video links
-- ============================================
CREATE TABLE IF NOT EXISTS verifications (
    id SERIAL PRIMARY KEY,
    uc_code VARCHAR(6) UNIQUE NOT NULL,
    video_url VARCHAR(500) NOT NULL,
    drive_file_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast alphanumeric code lookups
CREATE INDEX IF NOT EXISTS idx_verifications_uc_code ON verifications(uc_code);

-- Link verifications to specific customer orders
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_verifications_order_id ON verifications(order_id);

-- Link verifications to subscription delivery schedules
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS delivery_schedule_id INTEGER REFERENCES delivery_schedules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_verifications_delivery_schedule_id ON verifications(delivery_schedule_id);

-- Apply trigger to automatically update updated_at timestamp
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_verifications_updated_at') THEN
        CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON verifications
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
