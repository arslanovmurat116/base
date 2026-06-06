alter table appointments
  add column if not exists outcome_note text,
  add column if not exists revenue_amount numeric(12,2);
