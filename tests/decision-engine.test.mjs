import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_DECISION, breakEvenCustomers, estimateProfit, priorityAdvice, riceScore } from '../lib/decision-engine.ts'

test('RICE multiplies reach, impact and confidence then divides by build hours', () => {
  assert.equal(riceScore({ ...DEFAULT_DECISION, reach: 100, impact: 2, confidence: 75, build_hours: 50 }), 3)
  assert.equal(riceScore({ ...DEFAULT_DECISION, build_hours: 0 }), 0)
})

test('profit subtracts variable, fixed and estimated monthly labor costs', () => {
  const result = estimateProfit({ ...DEFAULT_DECISION, price_per_customer: 500, variable_cost_per_customer: 100, fixed_monthly_cost: 800, monthly_hours: 5, hourly_cost: 200, build_hours: 20 }, 5)
  assert.equal(result.revenue, 2500)
  assert.equal(result.directCosts, 500)
  assert.equal(result.laborCosts, 1000)
  assert.equal(result.profit, 200)
  assert.equal(result.paybackMonths, 20)
})

test('break-even correctly handles zero or negative contribution', () => {
  assert.equal(breakEvenCustomers({ ...DEFAULT_DECISION, price_per_customer: 500, variable_cost_per_customer: 100, fixed_monthly_cost: 800, monthly_hours: 5, hourly_cost: 200 }), 5)
  assert.equal(breakEvenCustomers({ ...DEFAULT_DECISION, price_per_customer: 100, variable_cost_per_customer: 100 }), null)
})

test('warnings surface unvalidated, unprofitable high-effort ideas', () => {
  const warnings = priorityAdvice({ ...DEFAULT_DECISION, energy: 5, confidence: 10, build_hours: 80, validation_note: '' })
  assert.equal(warnings.length, 5)
})

test('negative input does not produce implausible negative sales', () => {
  assert.equal(estimateProfit({ ...DEFAULT_DECISION, price_per_customer: -10 }, -4).revenue, 0)
})
