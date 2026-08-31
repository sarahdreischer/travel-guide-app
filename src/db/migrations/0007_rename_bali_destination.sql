-- Rename the "Bali" destination to "Bali, Indonesia" to match the updated
-- DESTINATIONS list. Keeps the curated destination image mapped to the new key.
UPDATE "destination_images"
SET "destination" = 'Bali, Indonesia'
WHERE "destination" = 'Bali';
