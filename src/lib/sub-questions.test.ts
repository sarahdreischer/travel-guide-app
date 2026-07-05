import { CATEGORIES, type Category } from './destinations'
import { getSubQuestions } from './sub-questions'

// ─── getSubQuestions ──────────────────────────────────────────────────────────

describe('getSubQuestions', () => {
  it('throws for an unknown category', () => {
    expect(() => getSubQuestions('Unknown Category' as Category)).toThrow()
  })

  it('returns the correct sub-questions for Transportation – Self Driving', () => {
    expect(getSubQuestions('Transportation – Self Driving')).toEqual([
      'Is driving recommended?',
      'Are roads in good condition?',
      'Is rental car recommended?',
      'Are mountain roads difficult?',
      'Is parking easy?',
      'Is parking widely available?',
      'What are the parking rules?',
    ])
  })

  it('returns the correct sub-questions for Transportation – Public Transport', () => {
    expect(getSubQuestions('Transportation – Public Transport')).toEqual([
      'Is public transport sufficient?',
    ])
  })

  it('returns the correct sub-questions for Transportation – Serviced', () => {
    expect(getSubQuestions('Transportation – Serviced')).toEqual([
      'Should I book airport transport in advance?',
      'Are taxis/Uber readily available?',
    ])
  })

  it('returns the correct sub-questions for Accommodation', () => {
    expect(getSubQuestions('Accommodation')).toEqual([
      'Which area should I stay in?',
      'Hotel, hostel or Airbnb?',
      'Private room or shared dorm?',
      'Is it social?',
      'Is accommodation likely to sell out?',
    ])
  })

  it('returns the correct sub-questions for Budget & Money', () => {
    expect(getSubQuestions('Budget & Money')).toEqual([
      'Do I need to bring cash?',
      'Do most places take card or cash?',
      'Which cards are widely accepted?',
      'How expensive is the destination?',
      'What is a realistic daily budget?',
    ])
  })

  it('returns the correct sub-questions for Connectivity', () => {
    expect(getSubQuestions('Connectivity')).toEqual([
      'Should I buy an eSIM?',
      'Which eSIM provider is best?',
      'How reliable is mobile data?',
      'Is Wi-Fi generally reliable?',
      'Is the destination suitable for remote work?',
    ])
  })

  it('returns the correct sub-questions for Packing', () => {
    expect(getSubQuestions('Packing')).toEqual([
      'Should I pack shorts/tops/t-shirts?',
      'Should I pack long trousers/shirts?',
      'Do I need hiking shoes?',
      'Do I need insect repellent?',
      'Do I need sunscreen?',
      'What SPF is recommended?',
      'Do I need a rain coat?',
      'Do I need an umbrella?',
      'Do I need a dry bag?',
    ])
  })

  it('returns the correct sub-questions for Food', () => {
    expect(getSubQuestions('Food')).toEqual([
      'Is tipping expected?',
      'Where do locals eat?',
      'What local dishes should I try?',
      'Is street food safe?',
      'What are average meal prices?',
    ])
  })

  it('returns the correct sub-questions for Laundry', () => {
    expect(getSubQuestions('Laundry')).toEqual([
      'Are there self-service laundrettes?',
      'How expensive are self-service laundrettes?',
      'Are there service wash laundrettes?',
      'How expensive are service wash laundrettes?',
      'Do laundrettes take cash and/or card?',
    ])
  })

  it('returns the correct sub-questions for Daily Logistics', () => {
    expect(getSubQuestions('Daily Logistics')).toEqual([
      'What supermarkets are recommended?',
      'Can I drink tap water?',
      'What are popular pharmacies?',
      'Are ATMs widely available?',
      'Is sunscreen expensive?',
    ])
  })

  it('returns the correct sub-questions for Activities', () => {
    expect(getSubQuestions('Activities')).toEqual([
      'Which activities are worth booking?',
      'Which activities are tourist traps?',
      'Should I book ahead?',
      'What are hidden gems?',
      'Is it advised to swim in nearby beaches?',
    ])
  })

  it('returns the correct sub-questions for Weather', () => {
    expect(getSubQuestions('Weather')).toEqual([
      'Are rain showers common?',
      'Is it mostly sunny?',
      'Does it rain occasionally?',
      'Is drizzle rain common?',
      'Are there specific times to avoid going outside?',
    ])
  })

  it('returns the correct sub-questions for Safety', () => {
    expect(getSubQuestions('Safety')).toEqual([
      'Is it safe for solo travellers?',
      'Are there scams to watch out for?',
      'Which areas should I avoid?',
      'Is phone theft common?',
      'Is it safe at night?',
      'Is it safe for women to walk around alone?',
    ])
  })

  it('returns an empty array for Local Etiquette (TBD)', () => {
    expect(getSubQuestions('Local Etiquette')).toEqual([])
  })

  it('does NOT throw for Local Etiquette', () => {
    expect(() => getSubQuestions('Local Etiquette')).not.toThrow()
  })

  it('returns the correct sub-questions for Miscellaneous', () => {
    expect(getSubQuestions('Miscellaneous')).toEqual([
      'What are things I wish I had known?',
    ])
  })

  it('handles all 15 CATEGORIES without throwing', () => {
    for (const category of CATEGORIES) {
      expect(() => getSubQuestions(category)).not.toThrow()
    }
  })

  it('returns an array for every known category', () => {
    for (const category of CATEGORIES) {
      expect(Array.isArray(getSubQuestions(category))).toBe(true)
    }
  })
})
