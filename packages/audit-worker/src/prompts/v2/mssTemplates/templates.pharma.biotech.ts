/**
 * MSS Template: Pharmaceutical / Biotech
 * Indications, safety, clinical trials, regulatory info
 */

import type { MssTemplate } from "./index";

export const pharmaBiotech: MssTemplate = {
  version: "v1.0",
  
  branded: [
    "what is {{brand}} used for and how does it work",
    "{{brand}} safety information and side effects",
    "{{brand}} clinical trial results",
    "how to get {{brand}} prescribed or obtain it"
  ],
  
  nonBranded: [
    "how clinical trials work for new medications",
    "understanding drug safety information and warnings",
    "what to ask your doctor about new treatments",
    "how medications are approved and regulated",
    "common side effects of prescription medications",
    "what to do if you experience medication side effects",
    "how to find clinical trials for specific conditions",
    "understanding medication dosing and administration",
    "drug interactions and contraindications to watch for",
    "how to access patient assistance programs for medications",
    "generic versus brand name medication differences",
    "medication storage and handling best practices"
  ]
};

