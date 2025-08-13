-- Billing tables for SaaS subscription management
-- Plans, subscriptions, and daily usage tracking

CREATE TABLE plan (
  id TEXT PRIMARY KEY,        -- plan_starter, plan_pro
  name TEXT NOT NULL,
  monthly_clicks_limit INTEGER,
  monthly_captures_limit INTEGER
);

CREATE TABLE subscription (
  id TEXT PRIMARY KEY,        -- sub_<stripe_id>
  org_id TEXT NOT NULL REFERENCES organization(id),
  plan_id TEXT NOT NULL REFERENCES plan(id),
  status TEXT NOT NULL,       -- active|past_due|canceled|trialing
  current_period_start INTEGER,
  current_period_end INTEGER
);

CREATE TABLE usage_daily (
  org_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  day INTEGER NOT NULL,       -- epoch days
  clicks INTEGER NOT NULL DEFAULT 0,
  captures INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, project_id, day)
);
