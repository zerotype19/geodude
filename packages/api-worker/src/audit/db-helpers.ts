/**
 * Database helper functions for v2.1 scoring
 */

import { AuditScoresRow } from "../types/audit";

export async function saveAuditScores(
  db: D1Database, 
  auditId: string, 
  scores: { crawlability: number; structured: number; answerability: number; trust: number; visibility: number; overall: number }
): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_scores 
     (audit_id, crawlability_score, structured_score, answerability_score, trust_score, visibility_score, overall_score)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    auditId,
    scores.crawlability,
    scores.structured,
    scores.answerability,
    scores.trust,
    scores.visibility,
    scores.overall
  ).run();
}

export async function getLatestAuditScores(db: D1Database, auditId: string): Promise<AuditScoresRow | null> {
  const result = await db.prepare(
    `SELECT * FROM audit_scores WHERE audit_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(auditId).first<AuditScoresRow>();
  
  return result || null;
}

export async function getLegacyAuditScores(db: D1Database, auditId: string): Promise<{
  crawlability: number;
  structured: number;
  answerability: number;
  trust: number;
  overall: number;
} | null> {
  const result = await db.prepare(
    `SELECT score_crawlability, score_structured, score_answerability, score_trust, score_overall 
     FROM audits WHERE id = ?`
  ).bind(auditId).first<{
    score_crawlability: number;
    score_structured: number;
    score_answerability: number;
    score_trust: number;
    score_overall: number;
  }>();
  
  if (!result) return null;
  
  return {
    crawlability: result.score_crawlability || 0,
    structured: result.score_structured || 0,
    answerability: result.score_answerability || 0,
    trust: result.score_trust || 0,
    overall: result.score_overall || 0,
  };
}
