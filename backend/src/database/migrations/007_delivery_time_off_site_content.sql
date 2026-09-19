-- Customer notice: after cutoff time (IST), confirm before pay (cart / subscription / trial).
INSERT INTO site_content (content_type, title, content, metadata, is_active)
VALUES (
  'delivery_time_off',
  'Delivery timing',
  'In order to maintain the purity and freshness of our dairy products, we will  not be delivering the products now, and it will shifted for tomorrow. This is done to ensure we provide you the best quality of our dairy products',
  '{"enabled": false, "cutoffTime": "22:00"}'::jsonb,
  true
)
ON CONFLICT (content_type) DO NOTHING;
