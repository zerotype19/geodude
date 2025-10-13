-- Phase 5: AI Visibility Intelligence Platform Tables
-- Migration: 0016_phase5_visibility_tables.sql

-- Visibility scores table - daily aggregated scores per domain/assistant
CREATE TABLE ai_visibility_scores (
  id TEXT PRIMARY KEY,
  day DATE NOT NULL,
  assistant TEXT NOT NULL,
  domain TEXT NOT NULL,
  score_0_100 REAL NOT NULL,
  citations_count INTEGER DEFAULT 0,
  unique_domains_count INTEGER DEFAULT 0,
  recency_score REAL DEFAULT 0,
  drift_pct REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(day, assistant, domain)
);

-- Weekly rankings table - share of voice rankings per assistant
CREATE TABLE ai_visibility_rankings (
  id TEXT PRIMARY KEY,
  week_start DATE NOT NULL,
  assistant TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_rank INTEGER NOT NULL,
  mentions_count INTEGER DEFAULT 0,
  share_pct REAL DEFAULT 0,
  previous_rank INTEGER,
  rank_change INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start, assistant, domain)
);

-- GEO Index table - page-level AI findability scores
CREATE TABLE ai_geo_index (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  assistants_seen INTEGER DEFAULT 0,
  backlinks_ai INTEGER DEFAULT 0,
  recency_score REAL DEFAULT 0,
  geo_index_score REAL NOT NULL,
  citations_count INTEGER DEFAULT 0,
  content_quality_score REAL DEFAULT 0,
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(url, measured_at)
);

-- Alerts table - monitoring and notification system
CREATE TABLE ai_alerts (
  id TEXT PRIMARY KEY,
  day DATE NOT NULL,
  type TEXT NOT NULL, -- 'drift', 'error', 'threshold', 'trend'
  message TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  domain TEXT,
  assistant TEXT,
  resolved BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance indices for efficient querying
CREATE INDEX idx_visibility_scores_day_assistant ON ai_visibility_scores(day, assistant);
CREATE INDEX idx_visibility_scores_domain ON ai_visibility_scores(domain);
CREATE INDEX idx_visibility_scores_score ON ai_visibility_scores(score_0_100 DESC);

CREATE INDEX idx_rankings_week_assistant ON ai_visibility_rankings(week_start, assistant);
CREATE INDEX idx_rankings_domain_rank ON ai_visibility_rankings(domain_rank);
CREATE INDEX idx_rankings_share_pct ON ai_visibility_rankings(share_pct DESC);

CREATE INDEX idx_geo_index_domain ON ai_geo_index(domain);
CREATE INDEX idx_geo_index_score ON ai_geo_index(geo_index_score DESC);
CREATE INDEX idx_geo_index_measured ON ai_geo_index(measured_at DESC);

CREATE INDEX idx_alerts_day_type ON ai_alerts(day, type);
CREATE INDEX idx_alerts_severity ON ai_alerts(severity);
CREATE INDEX idx_alerts_resolved ON ai_alerts(resolved);
