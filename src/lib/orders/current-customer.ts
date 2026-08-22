/**
 * A work order's intake customer is the historical party recorded at intake.
 * The customer shown on operational work-order surfaces, however, follows the
 * vehicle's current owner. Keeping that choice here prevents callers from
 * "fixing" stale displays by rewriting the historical intake association.
 */
export function currentWorkOrderCustomer<Customer>(intake: {
  vehicle: { customer: Customer }
}): Customer {
  return intake.vehicle.customer
}
