import type { DocumentCategory } from '../types/vault';

export interface SampleDocTemplate {
  id: string;
  title: string;
  category: DocumentCategory;
  badge: string;
  subtitle: string;
  rawText: string;
}

export const SAMPLE_DOCUMENTS: SampleDocTemplate[] = [
  {
    id: 'sample-saas-msa',
    title: 'Master Services Agreement & NDA — Apex Meridian',
    category: 'legal',
    badge: 'Legal Contract',
    subtitle: 'Auto-renewal trap, uncapped indemnity & broad IP assignment',
    rawText: `MASTER SERVICES AGREEMENT AND MUTUAL NON-DISCLOSURE AGREEMENT

Effective Date: November 18, 2026
Between: Apex Meridian Holdings LLC ("Client"), located at 742 Evergreen Terrace, Suite 900, Austin, TX 78701, represented by VP of Operations Marcus Vance (marcus.vance@apexmeridian.io, +1-512-555-0194)
And: Priya Sharma Consulting ("Contractor"), Principal Priya Sharma, residing at 418 Indiranagar 100ft Road, Bengaluru 560038 (priya.sharma@sharmadev.co, +91-98450-11223, PAN: ABCPS4921K).

1. SCOPE & FEES
Contractor shall deliver custom analytics software for a fixed fee of $18,500 USD payable Net-90 upon Client's sole subjective acceptance. Wire payments shall be remitted to HDFC Bank Account #50100482917364 (Routing/IFSC: HDFC0001204). Client reserves the unilateral right to withhold final 40% payment for up to 180 days pending internal audit cycles.

2. INTELLECTUAL PROPERTY ASSIGNMENT
Contractor hereby irrevocably assigns to Client all worldwide right, title, and interest in all Deliverables, as well as any pre-existing libraries, developer tools, utilities, prompts, or reusable code frameworks utilized or referenced during the engagement, whether developed before or during the Term, without carve-out or license back to Contractor.

3. TERM & AUTOMATIC RENEWAL
The initial maintenance retainer ($2,400/month) begins automatically upon delivery for 24 months and shall automatically renew for successive 24-month periods unless Contractor provides written cancellation notice via certified postal mail at least 120 days prior to the end of the current term.

4. INDEMNIFICATION & LIABILITY
Contractor agrees to indemnify, defend, and hold harmless Client and its affiliates against any and all third-party claims, indirect, consequential, or punitive damages, with NO CAP on Contractor's aggregate liability. Client's total liability under this Agreement shall not exceed $500 USD.

5. NON-COMPETE & EXCLUSIVITY
For thirty-six (36) months following termination of this Agreement, Contractor shall not directly or indirectly develop software, consult, or provide AI/analytics services for any business operating in North America or Europe.

6. CONFIDENTIALITY
Both parties agree to protect confidential materials, including API staging token sk-live-94a8f2c019e7b3d54109a2b8c7d6e5f4 and internal production database endpoint 10.42.88.19.`,
  },
  {
    id: 'sample-bank-ledger',
    title: 'Q4 Operating Account Statement & Vendor Ledger',
    category: 'financial',
    badge: 'Financial Ledger',
    subtitle: 'Duplicate SaaS billing, hidden wire fees & unusual transfer spike',
    rawText: `COMMERCIAL OPERATING ACCOUNT STATEMENT — Q4 REVIEW
Account Holder: Northstar Robotics Pvt. Ltd. (Authorized Signatory: Rohan Deshmukh)
Contact: rohan.deshmukh@northstarbot.com | Phone: +1-415-555-0148
Account Number: 4829-0019-7731-8840 | Routing Number: 021000021
Registered Office: 1290 Market Street, Floor 6, San Francisco, CA 94103
Tax ID / EIN: 94-3829104 | Card Ending: 4532-8910-4421-9912

Statement Period: October 1, 2026 – November 20, 2026
Opening Balance: $84,210.00 | Closing Balance: $52,485.40

TRANSACTION LOG:
- 2026-10-03 | CloudScale Hosting Pro Plan | -$1,240.00 | Recurring Card
- 2026-10-05 | CloudScale Hosting Pro Plan (DUPLICATE AUTH) | -$1,240.00 | Recurring Card
- 2026-10-08 | Wire Transfer to Elena Rostova (Contractor) | -$6,500.00 | Ref: INV-882
- 2026-10-08 | Outgoing International Wire Fee (Undisclosed Tier) | -$185.00 | Bank Fee
- 2026-10-14 | DataPulse Analytics Annual Auto-Renew | -$9,600.00 | No prior renewal notice
- 2026-10-21 | Payroll Disbursement (4 employees) | -$14,200.00 | ACH Batch
- 2026-11-02 | CloudScale Hosting Pro Plan | -$1,240.00 | Recurring Card
- 2026-11-03 | CloudScale Hosting Pro Plan (DUPLICATE AUTH) | -$1,240.00 | Recurring Card
- 2026-11-09 | Unrecognized Charge: VORTEX DATA SYNDICATE LTD | -$3,890.00 | Wire / Unapproved
- 2026-11-12 | Foreign Exchange Markup Fee (4.8% spread) | -$312.60 | Hidden FX Fee
- 2026-11-15 | Stripe Payout Settlement | +$12,450.00 | Revenue Deposit
- 2026-11-19 | Enterprise Telemetry License (Legacy Unused Seat x12) | -$4,477.00 | Annual Auto-Debit

NOTES: CFO audit flagged rising SaaS burn and unverified wire activity to VORTEX DATA SYNDICATE LTD. Reconcile before board meeting on Nov 28.`,
  },
  {
    id: 'sample-medical-bill',
    title: 'Itemized Hospital Statement & Insurance EOB',
    category: 'medical',
    badge: 'Medical Bill',
    subtitle: 'Upcoded ER level, duplicate lab panel & balance-billing check',
    rawText: `ITEMIZED PATIENT STATEMENT & EXPLANATION OF BENEFITS
Facility: St. Jude Metropolitan Medical Center, 880 Harbor View Blvd, Seattle, WA 98104
Patient Name: Daniel Alvarez | DOB: 04/19/1988 | SSN: 419-82-7741
Patient Email: d.alvarez88@fastmail.com | Phone: +1-206-555-0177
Insurance Carrier: Pacific Shield PPO | Policy ID: PSH-992817402 | Group: 77412

Date of Service: November 4, 2026 (Outpatient Urgent Visit — Mild Ankle Sprain, X-Ray & Wrap)
Attending Physician: Dr. Evelyn Brooks, MD

ITEMIZED CHARGES:
1. CPT 99285 — Emergency Dept Visit Level 5 (Life-Threatening/High Complexity) | Billed: $3,450.00
   *Note: Clinical chart records Grade 1 ankle sprain, 22-minute total visit, normal vitals, discharged with OTC ibuprofen.*
2. CPT 73610 — Radiologic Exam, Ankle (3 views) | Billed: $680.00 | Allowed: $195.00
3. CPT 80053 — Comprehensive Metabolic Panel (Lab) | Billed: $420.00
4. CPT 80053 — Comprehensive Metabolic Panel (Duplicate Same Timestamp) | Billed: $420.00
5. Facility Supply Fee — Elastic Compression Bandage (ACE Wrap) | Billed: $290.00
6. Out-of-Network Radiologist Interpretation Fee (Dr. K. Patel, Harbor Imaging) | Billed: $890.00
   *Note: Patient visited an IN-NETWORK hospital facility without consenting to out-of-network radiology.*

TOTAL BILLED: $6,150.00
INSURANCE ADJUSTMENT & PAYMENT: -$1,640.00
PATIENT BALANCE DUE IN 15 DAYS (COLLECTIONS WARNING): $4,510.00`,
  },
];
