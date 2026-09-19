-- Point photobooth polaroid orders at catalog product 2 and retire duplicate product 3.

UPDATE order_items
SET product_id = 2
WHERE product_id = 3;

UPDATE products
SET is_photobooth_product = false,
    is_active = false,
    updated_at = NOW()
WHERE id = 3;
