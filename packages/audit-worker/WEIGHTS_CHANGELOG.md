# Classifier V2 - Weights Tuning Changelog

Track all weight adjustments with rationale and impact.

## Format

```
Date: YYYY-MM-DD
Domain(s): example.com, example2.com
Issue: Brief description
Change: Specific parameter adjustments
Expected Impact: What should improve
Actual Impact: Observed after deployment (update after 48h)
Telemetry: Link to relevant charts/queries
```

---

## Baseline (2025-10-18)

**Initial Weights**

Site Type Clusters:
- `commerce`: weightPerHit=2, clusterBonus=2
- `media`: weightPerHit=1, clusterBonus=2
- `software`: weightPerHit=1.5, clusterBonus=2
- `support`: weightPerHit=1, clusterBonus=1
- `ir`: weightPerHit=1.5, clusterBonus=2

Industry Boosts:
- `finance`: weightPerHit=2, clusterBonus=2
- `insurance`: weightPerHit=2, clusterBonus=2
- `travel`: weightPerHit=1.5, clusterBonus=2
- `automotive`: weightPerHit=2, clusterBonus=2
- `retail_sportswear`: weightPerHit=1.25, clusterBonus=1.5
- `retail_music`: weightPerHit=1.5, clusterBonus=2

Schema Boosts:
- Product/Offer → ecommerce +2
- NewsArticle/Article → media +2
- FAQPage/HowTo → support +1.5
- SoftwareApplication → software +2
- FinancialService/BankOrCreditUnion → finance +3
- InsuranceAgency/Insurance → insurance +3
- AutoDealer/Vehicle → automotive +3
- TouristTrip/LodgingBusiness → travel +2

---

## Example Entry (Template)

**Date**: 2025-10-19  
**Domain(s)**: stripe.com, paypal.com  
**Issue**: Finance sites misclassified as software due to `/api` and `docs` signals  
**Change**: Increased `FinancialService` schema boost from +3 to +4  
**Expected Impact**: Finance sites with strong API/docs presence should still classify as `financial` if schema present  
**Actual Impact**: TBD (check after 48h)  
**Telemetry**: `/admin/health` confidence histogram  

---

## Tuning Guidelines

### When to Tune

1. **High Confidence Mismatch** (v2 confidence ≥0.75, but disagrees with legacy)
   - If v2 has JSON-LD support → increase schema boost by +1
   - If v2 lacks JSON-LD but has nav signals → increase cluster weightPerHit by +0.5

2. **Low Confidence Correct** (v2 confidence <0.6, but classification correct)
   - Increase clusterBonus for the winning cluster by +0.5
   - OR increase weightPerHit for strong tokens by +0.25

3. **Persistent Misclassification** (v2 wrong for 3+ consecutive audits of same domain)
   - Lower misleading cluster clusterBonus by −0.5
   - AND increase correct cluster weightPerHit by +0.5

### Caps & Safety

- Never exceed `weightPerHit: 3` for any token
- Never exceed `clusterBonus: 4` for any cluster
- Never exceed `schemaBoost: 5` for any type
- Test changes on 10+ diverse domains before production
- Revert if agreement rate drops >5% in 24h

### Testing Protocol

1. Run edge case test suite (`npm test -- edgeCases.spec.ts`)
2. Spot-check 20 benchmark domains in `/admin/classifier-compare`
3. Deploy to staging (10% traffic) for 6h
4. Monitor health dashboard for alerts
5. Full rollout if no regressions

---

## Log Entries Below

(Add new entries here as tuning occurs)

