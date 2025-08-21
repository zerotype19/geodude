-- Check current schema of interaction_events table
-- This is safe to run and won't make any changes

SELECT sql FROM sqlite_master WHERE type='table' AND name='interaction_events';

-- Check if class column exists
PRAGMA table_info(interaction_events);

-- Check if sampled column exists
SELECT COUNT(*) as has_sampled_column FROM pragma_table_info('interaction_events') WHERE name='sampled';

-- Check if class column exists
SELECT COUNT(*) as has_class_column FROM pragma_table_info('interaction_events') WHERE name='class';
