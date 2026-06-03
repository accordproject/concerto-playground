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

export const VEHICLES_EXAMPLE = `namespace sample.vehicles@1.0.0

// ── Scalars ──────────────────────────────────────────────
// Scalars add validation constraints to primitive types.
scalar VIN extends String regex=/[A-HJ-NPR-Z0-9]{17}/
scalar Year extends Integer range=[1886, ]

// ── Enums ──────────────────────────────────────────────
enum FuelType {
  o PETROL
  o DIESEL
  o ELECTRIC
  o HYBRID
}
enum Condition {
  o NEW
  o USED
  o SALVAGE
}
// ── Concepts (composition) ────────────────────────────────
// Owner is composed into Vehicle rather than inherited
@description("A legal or natural person who holds title to a vehicle")
concept Owner {
  o String firstName
  o String lastName
  o String email optional
}
// ── Inheritance ───────────────────────────────────────────
// Abstract base captures shared fields; Car and Truck add their own.
@description("Base vehicle record")
abstract concept Vehicle {
  @Term("Vehicle Identification Number")
  o VIN vin
  o Year manufactureYear
  o String make
  o String model
  o FuelType fuelType
  o Condition condition default="USED"
  o Integer odometerKm default=0
  o Owner owner                          // ← composition
}
concept Car extends Vehicle {
  o Integer seatCount default=5
  o Boolean hasAirConditioning default=true
}
concept Truck extends Vehicle {
  o Double payloadTonnes
  o Boolean hasRefrigeration default=false
}
`;
