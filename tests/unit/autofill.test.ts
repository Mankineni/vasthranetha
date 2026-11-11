import { emptyForm } from '@/lib/catalogue/form'
import { applySuggestion, parseSuggestion } from '@/lib/autofill/suggestion'
import { autofillRequest, isAutofillEnabled, MAX_INPUT_CHARS, suggestFields } from '@/lib/autofill/autofill'

const FABRICS = ['Soft silk', 'Cotton', 'Banarasi']

describe('parseSuggestion', () => {
  test('keeps known fields with the right types, uses the stored fabric spelling, drops the rest', () => {
    expect(
      parseSuggestion(
        { name: 'Soft Silk Saree', fabric: 'soft silk', length: '6.3 m', blousePiece: true, dealerPrice: 1850, price: 2500, extra: 'x' },
        FABRICS,
      ),
    ).toEqual({ name: 'Soft Silk Saree', fabric: 'Soft silk', length: '6.3 m', blousePiece: true, dealerPrice: 1850 })
  })

  test('understands the string forms the structured output uses', () => {
    expect(
      parseSuggestion({ name: '', fabric: '', length: '', blousePiece: 'included', description: 'Light and soft.', dealerPrice: '1,850' }, FABRICS),
    ).toEqual({ blousePiece: true, description: 'Light and soft.', dealerPrice: 1850 })
    expect(parseSuggestion({ blousePiece: 'not included' }, FABRICS)).toEqual({ blousePiece: false })
    expect(parseSuggestion({ blousePiece: 'unknown' }, FABRICS)).toEqual({})
  })

  test('drops an unknown fabric and values of the wrong type', () => {
    expect(parseSuggestion({ fabric: 'Organza', name: 42, length: ['6m'], dealerPrice: 'call me', description: null }, FABRICS)).toEqual({})
    expect(parseSuggestion('not an object', FABRICS)).toEqual({})
    expect(parseSuggestion(null, FABRICS)).toEqual({})
  })

  test('trims text and caps its length; drops zero or negative prices', () => {
    const s = parseSuggestion({ name: `  ${'x'.repeat(300)}  `, dealerPrice: 0 }, FABRICS)
    expect(s.name).toHaveLength(120)
    expect(s.dealerPrice).toBeUndefined()
  })
})

describe('applySuggestion', () => {
  const fabrics = [
    { id: 1, name: 'Soft silk' },
    { id: 2, name: 'Cotton' },
  ]

  test('fills only empty fields and never the selling price', () => {
    const current = { ...emptyForm(1), name: 'My own name', price: '', description: '' }
    const next = applySuggestion(current, { name: 'Suggested', description: 'Soft silk with zari.', dealerPrice: 1850, fabric: 'Soft silk', length: '6.3 m', blousePiece: true }, fabrics)
    expect(next).toMatchObject({
      name: 'My own name',
      price: '',
      description: 'Soft silk with zari.',
      dealerPrice: '1850',
      fabricId: '1',
      length: '6.3 m',
      blousePiece: 'yes',
    })
  })

  test('keeps a chosen fabric, typed dealer price and blouse choice', () => {
    const current = { ...emptyForm(1), fabricId: '2', dealerPrice: '1700', blousePiece: 'no' as const }
    const next = applySuggestion(current, { fabric: 'Soft silk', dealerPrice: 1850, blousePiece: true }, fabrics)
    expect(next).toMatchObject({ fabricId: '2', dealerPrice: '1700', blousePiece: 'no' })
  })
})

describe('suggestFields', () => {
  test('passes the text (capped) and fabric names to the client and returns the parsed suggestion', async () => {
    let seen = ''
    const r = await suggestFields('a'.repeat(5000), FABRICS, async (text) => {
      seen = text
      return { name: 'Cotton Saree', fabric: 'COTTON' }
    })
    expect(seen).toHaveLength(MAX_INPUT_CHARS)
    expect(r).toEqual({ ok: true, suggestion: { name: 'Cotton Saree', fabric: 'Cotton' } })
  })

  test('a client that throws gives ok: false', async () => {
    expect(await suggestFields('text', FABRICS, async () => Promise.reject(new Error('boom')))).toEqual({ ok: false })
  })

  test('a client slower than the timeout gives ok: false', async () => {
    const slow = () => new Promise((resolve) => setTimeout(() => resolve({ name: 'late' }), 200))
    expect(await suggestFields('text', FABRICS, slow, 20)).toEqual({ ok: false })
  })

  test('empty text gives ok: false without calling the client', async () => {
    let called = false
    const r = await suggestFields('   ', FABRICS, async () => {
      called = true
      return {}
    })
    expect(r).toEqual({ ok: false })
    expect(called).toBe(false)
  })
})

describe('autofillRequest', () => {
  test('asks for structured output at low effort with refusal fallback, no forced tool call', () => {
    const req = autofillRequest('Soft silk saree 6.3m with blouse, rate 1850', FABRICS, 'claude-opus-5-5')
    expect(req.model).toBe('claude-opus-5-5')
    expect(req.betas).toEqual(['server-side-fallback-2026-07-01'])
    expect(req.fallbacks).toBe('default')
    expect(req.output_config?.effort).toBe('low')
    expect(req.output_config?.format).toBeTruthy()
    expect(req).not.toHaveProperty('tool_choice')
    expect(req).not.toHaveProperty('temperature')
    expect(JSON.stringify(req.messages)).toContain('rate 1850')
    expect(JSON.stringify(req.output_config?.format)).toContain('Banarasi')
  })
})

describe('isAutofillEnabled', () => {
  const saved = { key: process.env.ANTHROPIC_API_KEY, fake: process.env.AUTOFILL_FAKE }
  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = saved.key
    process.env.AUTOFILL_FAKE = saved.fake
    if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY
    if (saved.fake === undefined) delete process.env.AUTOFILL_FAKE
  })

  test('off without a key, on with a key or the test switch', () => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.AUTOFILL_FAKE
    expect(isAutofillEnabled()).toBe(false)
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(isAutofillEnabled()).toBe(true)
    delete process.env.ANTHROPIC_API_KEY
    process.env.AUTOFILL_FAKE = '1'
    expect(isAutofillEnabled()).toBe(true)
  })
})
