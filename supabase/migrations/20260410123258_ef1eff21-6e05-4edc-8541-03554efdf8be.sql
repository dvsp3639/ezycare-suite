
-- Merge params with same test_id+name where one has empty unit and another has a real unit
WITH dups AS (
  SELECT test_id, name,
         (array_agg(id ORDER BY (CASE WHEN unit IS NOT NULL AND unit != '' THEN 0 ELSE 1 END), id::text))[1] AS keep_id,
         array_agg(id) AS all_ids
  FROM lab_test_parameters
  GROUP BY test_id, name
  HAVING COUNT(*) > 1
)
UPDATE lab_test_parameter_ranges r
SET parameter_id = d.keep_id
FROM dups d
WHERE r.parameter_id = ANY(d.all_ids)
  AND r.parameter_id != d.keep_id;

DELETE FROM lab_test_parameters
WHERE id IN (
  WITH dups AS (
    SELECT test_id, name,
           (array_agg(id ORDER BY (CASE WHEN unit IS NOT NULL AND unit != '' THEN 0 ELSE 1 END), id::text))[1] AS keep_id,
           array_agg(id) AS all_ids
    FROM lab_test_parameters
    GROUP BY test_id, name
    HAVING COUNT(*) > 1
  )
  SELECT unnest(all_ids) FROM dups
  EXCEPT
  SELECT keep_id FROM dups
);
