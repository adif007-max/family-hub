-- ============================================================
-- Migration 005 — seed Adi's vehicle
-- ============================================================

insert into vehicles (
  family_id,
  make,
  model,
  year,
  license_plate,
  test_expiry_date,
  insurance_renewal_date,
  insurance_policy_number,
  notes
)
select
  'fink',
  'סקודה',
  'קודיאק',
  2019,
  '60221502',
  date '2026-07-05',
  date '2026-07-31',
  '7793188425',
  'צבע: לבן. קילומטראז 79,000. הוחלפו 4 צמיגים ב-27/2/2026. סוכן ביטוח: יהודה לייבוביץ, חברה: הכשרה.'
where not exists (
  select 1 from vehicles
  where family_id = 'fink' and license_plate = '60221502'
);
