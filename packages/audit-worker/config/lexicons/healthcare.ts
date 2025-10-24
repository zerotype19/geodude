/**
 * Healthcare Provider Lexicon
 * Industry-appropriate terminology and normalization rules
 */

export const HEALTHCARE_LEXICON = {
  compliance: [
    "HIPAA compliant",
    "HIPAA",
    "patient privacy",
    "PHI",
    "protected health information",
    "medical records privacy"
  ],
  
  insurance: [
    "Medicare",
    "Medicaid",
    "in-network",
    "out-of-network",
    "copay",
    "co-payment",
    "deductible",
    "out-of-pocket maximum",
    "HSA",
    "FSA",
    "health savings account"
  ],
  
  services: [
    "primary care",
    "specialist",
    "emergency room",
    "urgent care",
    "telehealth",
    "telemedicine",
    "virtual visit",
    "inpatient",
    "outpatient",
    "procedure",
    "surgery"
  ],
  
  quality_metrics: [
    "patient outcomes",
    "success rate",
    "complication rate",
    "readmission rate",
    "patient satisfaction",
    "wait time",
    "hospital rating",
    "accreditation",
    "board certified"
  ],
  
  access: [
    "appointment availability",
    "accepting new patients",
    "walk-in",
    "same-day appointment",
    "referral required",
    "pre-authorization"
  ],
  
  avoid_phrases: {
    "doctor visit": "appointment",
    "medical center": "hospital",
    "health insurance": "insurance coverage",
    "patient care": "care quality"
  },
  
  lexicon_hint: "Use terms like HIPAA, Medicare, in-network, patient outcomes, telehealth, and board certified. Be specific about insurance and services."
};

