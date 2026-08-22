import { expect, test } from "bun:test"
import { currentWorkOrderCustomer } from "./current-customer"

test("work orders use the vehicle's current customer without changing intake history", () => {
  const intakeCustomer = { id: "customer-at-intake" }
  const currentCustomer = { id: "current-vehicle-customer" }
  const intake = {
    customer: intakeCustomer,
    vehicle: { customer: currentCustomer },
  }

  expect(currentWorkOrderCustomer(intake)).toBe(currentCustomer)
  expect(intake.customer).toBe(intakeCustomer)
})
