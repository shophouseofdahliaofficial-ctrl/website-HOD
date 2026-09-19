-- Optional migration: convert legacy serviceablePincodes from string[] to {pincode, deliveryTime}[]
-- Run this if you have pincodes stored as ["110001","474001"] and want them as
-- [{"pincode":"110001","deliveryTime":"1h"},{"pincode":"474001","deliveryTime":"1h"}]
-- Default deliveryTime for legacy string entries: '1h'. Objects are left as-is.

UPDATE site_content
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{serviceablePincodes}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(elem) = 'string' THEN
            jsonb_build_object('pincode', elem #>> '{}', 'deliveryTime', '1h')
          ELSE
            elem
        END
      )
      FROM jsonb_array_elements(COALESCE(metadata->'serviceablePincodes', '[]')) AS elem
    ),
    '[]'
  )
)
WHERE content_type = 'pincodes';
