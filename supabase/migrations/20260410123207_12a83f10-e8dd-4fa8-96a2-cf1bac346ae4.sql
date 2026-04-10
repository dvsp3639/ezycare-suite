
-- Step 1: Move ranges from duplicate params to the kept param
WITH duplicates AS (
  SELECT test_id, name, COALESCE(unit, '') as unit,
         (array_agg(id ORDER BY id::text))[1] AS keep_id,
         array_agg(id ORDER BY id::text) AS all_ids
  FROM lab_test_parameters
  GROUP BY test_id, name, COALESCE(unit, '')
  HAVING COUNT(*) > 1
)
UPDATE lab_test_parameter_ranges r
SET parameter_id = d.keep_id
FROM duplicates d
WHERE r.parameter_id = ANY(d.all_ids)
  AND r.parameter_id != d.keep_id;

-- Step 2: Delete duplicate parameter rows
DELETE FROM lab_test_parameters
WHERE id IN (
  WITH duplicates AS (
    SELECT test_id, name, COALESCE(unit, '') as u,
           (array_agg(id ORDER BY id::text))[1] AS keep_id,
           array_agg(id ORDER BY id::text) AS all_ids
    FROM lab_test_parameters
    GROUP BY test_id, name, COALESCE(unit, '')
    HAVING COUNT(*) > 1
  )
  SELECT unnest(all_ids) AS pid FROM duplicates
  EXCEPT
  SELECT keep_id FROM duplicates
);
