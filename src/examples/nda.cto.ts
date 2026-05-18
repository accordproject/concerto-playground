export const NDA_EXAMPLE = `namespace org.accordproject.nda@1.0.0

/**
 * Governing law jurisdiction options
 */
enum GoverningLaw {
  o NEW_YORK
  o CALIFORNIA
  o DELAWARE
  o ENGLAND_AND_WALES
}

/**
 * A contracting party
 */
concept Party {
  o String name
  o String email
  o String registeredAddress optional
}

/**
 * Non-Disclosure Agreement data model
 */
concept NDAData {
  o Party disclosingParty
  o Party receivingParty
  o DateTime effectiveDate
  o Integer termMonths
  o GoverningLaw governingLaw
  o String[] permittedPurposes optional
  o Boolean includeNonSolicitation default=false
}
`;

export const LOAN_EXAMPLE = `namespace org.accordproject.loan@1.0.0

/**
 * Fixed-rate loan agreement data model
 */
concept LoanData {
  o String lenderName
  o String borrowerName
  o Double principalAmount
  o Double annualInterestRate
  o Integer termMonths
  o DateTime commencementDate
  o String governingLaw
}
`;

export const SERVICE_EXAMPLE = `namespace org.accordproject.services@1.0.0

enum BillingCycle {
  o HOURLY
  o DAILY
  o MONTHLY
  o FIXED
}

enum PaymentTerms {
  o NET_15
  o NET_30
  o NET_60
  o UPON_RECEIPT
}

concept ServiceProvider {
  o String name
  o String email
  o String taxId optional
}

concept Client {
  o String name
  o String email
  o String billingAddress
}

concept ServiceAgreementData {
  o ServiceProvider provider
  o Client client
  o String serviceDescription
  o BillingCycle billingCycle
  o Double rate
  o PaymentTerms paymentTerms
  o DateTime startDate
  o DateTime endDate optional
  o Boolean includeIPAssignment default=true
}
`;
