import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AI_MODEL_RATES, AI_MAX_OUTPUT_TOKENS,
  modelRate, costUsd, coinsForCost, quoteForPrompt, coinsPerUsd,
} from '../lib/canvas-ai-config.ts'

test('only explicitly priced models can be billed', () => {
  assert.ok(modelRate('gpt-6-luna'))
  assert.equal(modelRate('unpriced-latest-model'), undefined)
  assert.equal(new Set(AI_MODEL_RATES.map(x => x.id)).size, AI_MODEL_RATES.length)
})

test('USD rates are per million input and output tokens', () => {
  const luna = modelRate('gpt-6-luna')
  assert.ok(luna)
  assert.equal(costUsd(luna, 1_000_000, 1_000_000), 0.30)
})

test('50% markup, rounded up to one or more whole Vedoy Coins', () => {
  assert.equal(coinsForCost(1, 100), 150)
  assert.equal(coinsForCost(0.01, 100), 2)
  assert.equal(coinsForCost(0.0001, 100), 1)
})

test('quote reservations cover cost of typical usage and output caps', () => {
  for (const model of AI_MODEL_RATES) {
    const text = 'Hvordan kan jeg forbedre denne prosjektplanen?'
    const quote = quoteForPrompt(model, text, 100)
    assert.ok(quote.reservedCoins >= quote.estimatedCoins)
    assert.equal(quote.maximumOutputTokens, AI_MAX_OUTPUT_TOKENS)
    assert.equal(quote.markupPercent, 50)
    assert.ok(quote.maximumInputTokens > Buffer.byteLength(text, 'utf8'))
  }
})

test('Coin exchange rate is disabled until explicitly configured', () => {
  const previous = process.env.VEDOY_COINS_PER_USD
  try {
    delete process.env.VEDOY_COINS_PER_USD
    assert.equal(coinsPerUsd(), null)
    process.env.VEDOY_COINS_PER_USD = 'not-a-number'
    assert.equal(coinsPerUsd(), null)
    process.env.VEDOY_COINS_PER_USD = '100'
    assert.equal(coinsPerUsd(), 100)
  } finally {
    if (previous === undefined) delete process.env.VEDOY_COINS_PER_USD
    else process.env.VEDOY_COINS_PER_USD = previous
  }
})
