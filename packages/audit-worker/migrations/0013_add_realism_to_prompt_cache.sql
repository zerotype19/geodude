-- Migration: Add realism score tracking to prompt cache
-- Tracks average realism score of generated queries for quality monitoring

ALTER TABLE llm_prompt_cache ADD COLUMN realism_score_avg REAL DEFAULT 0;

