/*
# Rainfall Analysis & Prediction — core schema

1. Purpose
   Stores the historical climate dataset used to train the on-server rain
   prediction model, plus a log of every prediction the dashboard requests.
   Single-tenant app (no sign-in), so data is intentionally shared/public.

2. New Tables
   - `climate_readings`  — daily climate observations (the training set)
   - `rainfall_predictions` — log of predictions made by the dashboard

3. Security
   - RLS enabled on both tables.
   - CRUD granted to anon + authenticated (single-tenant, public data).
   - Policies use USING(true)/WITH CHECK(true) because all rows are intentionally shared.

4. Seed Data
   - 200 deterministic synthetic climate rows so the model has real signal:
     rain tends to occur with high humidity, low pressure, and high cloud cover.
*/

CREATE TABLE IF NOT EXISTS climate_readings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_date    date NOT NULL,
  location        text NOT NULL DEFAULT 'North Fields',
  humidity        numeric NOT NULL CHECK (humidity BETWEEN 0 AND 100),
  temperature_c   numeric NOT NULL,
  pressure_hpa    numeric NOT NULL,
  wind_speed_kmh  numeric NOT NULL,
  cloud_cover_pct numeric NOT NULL CHECK (cloud_cover_pct BETWEEN 0 AND 100),
  rain            boolean NOT NULL,
  rainfall_mm     numeric NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE climate_readings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON climate_readings TO anon, authenticated;

DROP POLICY IF EXISTS "anon_read_climate" ON climate_readings;
CREATE POLICY "anon_read_climate" ON climate_readings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_climate" ON climate_readings;
CREATE POLICY "anon_insert_climate" ON climate_readings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_climate" ON climate_readings;
CREATE POLICY "anon_update_climate" ON climate_readings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_climate" ON climate_readings;
CREATE POLICY "anon_delete_climate" ON climate_readings
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_climate_readings_date ON climate_readings (reading_date);

CREATE TABLE IF NOT EXISTS rainfall_predictions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  humidity               numeric NOT NULL,
  temperature_c          numeric NOT NULL,
  pressure_hpa           numeric NOT NULL,
  wind_speed_kmh         numeric NOT NULL,
  cloud_cover_pct        numeric NOT NULL,
  rain_probability       numeric NOT NULL,
  predicted_intensity_mm numeric NOT NULL,
  advice                 text NOT NULL,
  location_label         text
);

ALTER TABLE rainfall_predictions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON rainfall_predictions TO anon, authenticated;

DROP POLICY IF EXISTS "anon_read_predictions" ON rainfall_predictions;
CREATE POLICY "anon_read_predictions" ON rainfall_predictions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_predictions" ON rainfall_predictions;
CREATE POLICY "anon_insert_predictions" ON rainfall_predictions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_predictions" ON rainfall_predictions;
CREATE POLICY "anon_update_predictions" ON rainfall_predictions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_predictions" ON rainfall_predictions;
CREATE POLICY "anon_delete_predictions" ON rainfall_predictions
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_predictions_created ON rainfall_predictions (created_at DESC);

-- Seed 200 deterministic climate rows with a learnable rain signal.
INSERT INTO climate_readings
  (reading_date, location, humidity, temperature_c, pressure_hpa, wind_speed_kmh, cloud_cover_pct, rain, rainfall_mm)
SELECT
  (DATE '2025-01-01' + (n || ' day')::interval)::date AS reading_date,
  CASE (n % 3) WHEN 0 THEN 'North Fields' WHEN 1 THEN 'River Basin' ELSE 'Highland Plot' END AS location,
  hum,
  temp,
  pres,
  wind,
  cloud,
  (hum > 72 AND pres < 1011 AND cloud > 65) AS rain,
  CASE
    WHEN (hum > 72 AND pres < 1011 AND cloud > 65)
      THEN ROUND(((hum - 70) * 0.8) + (cloud * 0.12) + (wind * 0.05), 1)
    ELSE 0
  END AS rainfall_mm
FROM (
  SELECT
    n,
    ROUND((55 + 35 * SIN(n / 9.0) + 8 * SIN(n / 2.3))::numeric, 1) AS hum,
    ROUND((22 - 7 * COS(n / 11.0) - 4 * SIN(n / 3.1))::numeric, 1) AS temp,
    ROUND((1012 - 9 * SIN(n / 9.0) - 3 * COS(n / 4.0))::numeric, 1) AS pres,
    ROUND((14 + 12 * ABS(SIN(n / 6.0)) + (n % 5))::numeric, 1) AS wind,
    GREATEST(0, LEAST(100, ROUND((40 + 50 * SIN(n / 9.0) + 10 * SIN(n / 2.7))::numeric, 1))) AS cloud
  FROM generate_series(1, 200) AS g(n)
) s;
