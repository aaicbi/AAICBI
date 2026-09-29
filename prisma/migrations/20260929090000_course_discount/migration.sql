-- Course discounts — a percentage off priceKobo, admin-set per course.
-- Null means no discount.
ALTER TABLE "Course" ADD COLUMN "discountPercent" INTEGER;
