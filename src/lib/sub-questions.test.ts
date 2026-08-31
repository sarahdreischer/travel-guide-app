import { CATEGORIES, type Category } from './destinations'
import { getSubQuestions } from './sub-questions'

// ─── getSubQuestions ──────────────────────────────────────────────────────────

describe('getSubQuestions', () => {
  it('throws for an unknown category', () => {
    expect(() => getSubQuestions('Unknown Category' as Category)).toThrow()
  })

  it('returns the correct sub-questions for Transportation – Driving', () => {
    expect(getSubQuestions('Transportation – Driving')).toEqual([
      'Is driving recommended?',
      'Are roads easy to drive on?',
      'Are there mountain roads that are difficult to drive?',
    ])
  })

  it('returns the correct sub-questions for Transportation - Parking', () => {
    expect(getSubQuestions('Transportation - Parking')).toEqual([
      'Is parking easy?',
      'Is parking widely available?',
      'What are the parking rules?',
    ])
  })

  it('returns the correct sub-questions for Transportation – Public Transport', () => {
    expect(getSubQuestions('Transportation – Public Transport')).toEqual([
      'Is public transport sufficient?',
      'How can I pay for buses?',
      'How can I pay for trains?',
      'How can I pay for trams if available?',
      'How can I pay for metros if available?',
    ])
  })

  it('returns the correct sub-questions for Transportation – Taxis and Ride-Hailing Services', () => {
    expect(getSubQuestions('Transportation – Taxis and Ride-Hailing Services')).toEqual([
      'How much are taxis on average?',
      'Are ride-hailing services available and widely used?',
      'How much are ride-hailing service trips on average?',
    ])
  })

  it('returns the correct sub-questions for Transportation - Airport Transfer', () => {
    expect(getSubQuestions('Transportation - Airport Transfer')).toEqual([
      'How much does airport transport cost on average?',
      'Should I book airport transport in advance?',
    ])
  })

  it('returns the correct sub-questions for Transportation - Car Rental', () => {
    expect(getSubQuestions('Transportation - Car Rental')).toEqual([
      'Are car rentals recommended?',
      'What should I watch out for when renting a car?',
      'How much do car rentals cost on average?',
      'What type of car is recommended for rental?',
      'Which providers are best for car rentals?',
    ])
  })

  it('returns the correct sub-questions for Recommended Areas', () => {
    expect(getSubQuestions('Recommended Areas')).toEqual([
      'Which area should I stay in according to my budget and activity preferences?'
    ])
  })

  it('returns the correct sub-questions for Hotels', () => {
    expect(getSubQuestions('Hotels')).toEqual([
      'What are the top 3 hotels to book according to my budget?',
      'What are average hotel prices?',
      'Are hotels likely to sell out?',
    ])
  })

  it('returns the correct sub-questions for Hostels', () => {
    expect(getSubQuestions('Hostels')).toEqual([
      'What are the top 3 hostels to book according to my budget?',
      'What are average hostel prices?',
      'Are hostels likely to sell out?',
    ])
  })

  it('returns the correct sub-questions for Holiday Rentals', () => {
    expect(getSubQuestions('Holiday Rentals')).toEqual([
      'What are the top 3 holiday rentals according to my budget?',
      'What are average holiday rental prices?',
      'Are holiday rentals likely to sell out?',
    ])
  })

  it('returns the correct sub-questions for Money', () => {
    expect(getSubQuestions('Money')).toEqual([
      'Should I bring cash in advance of the trip?',
      'Are ATMs widely available?',
      'What is the average fee charge for withdrawals from ATMs?',
      'Do most places accept card payment?',
      'Which cards are widely accepted?',
      'Is my current budget realistic?',
      'What is a realistic daily budget?',
    ])
  })

  it('returns the correct sub-questions for WiFi & Mobile Data', () => {
    expect(getSubQuestions('WiFi & Mobile Data')).toEqual([
      'Is Wi-Fi generally reliable?',
      'How reliable is mobile data?',
      'Does the area provide 4G (LTE) and 5G coverage reliable?',
      'Should I buy an eSIM?',
      'Which eSIM provider offers the best prices?',
      'Is the destination suitable for remote work?',
    ])
  })

  it('returns the correct sub-questions for Clothing & Accessories', () => {
    expect(getSubQuestions('Clothing & Accessories')).toEqual([
      'What type of clothes should I pack?',
      'What type of clothes should I pack for my activity preferences?',
      'Do I need insect repellent?',
      'Do I need sunscreen? If yes, what SPF is recommended?',
      'Do I need a rain coat?',
      'Do I need an umbrella?',
      'Do I need a dry bag?',
    ])
  })

  it('returns the correct sub-questions for Health', () => {
    expect(getSubQuestions('Health')).toEqual([
      'Are mosquitos and other insects prevalent?',
      'Do I need insect repellent?',
      'What is the expected UV strength?',
      'Do I need sunscreen and, if yes, what SPF is recommended?',
      'Which vaccinations do I need to have?',
      'Do I need to proof my vaccination status on arrival?',
      'What vaccinations are recommended for me considering my starting location?',
      'What are popular pharmacies?',
    ])
  })

  it('returns the correct sub-questions for Food & Tipping Culture', () => {
    expect(getSubQuestions('Food & Tipping Culture')).toEqual([
      'Which top 3 restaurants should I try?',
      'Where do locals eat?',
      'What local dishes should I try?',
      'Is tipping expected?',
      'Is street food safe?',
      'Which international fast food chains are available?',
      'What are average meal prices?',
    ])
  })

  it('returns the correct sub-questions for Laundry', () => {
    expect(getSubQuestions('Laundry')).toEqual([
      'Are there self-service laundrettes?',
      'How expensive are self-service laundrettes?',
      'Are there service wash laundrettes?',
      'How expensive are service wash laundrettes?',
      'Do laundrettes take cash and/ or card?',
    ])
  })

  it('returns the correct sub-questions for Groceries & Drinking Water', () => {
    expect(getSubQuestions('Groceries & Drinking Water')).toEqual([
      'What supermarkets are recommended?',
      'Is tap water safe to drink?',
    ])
  })

  it('returns the correct sub-questions for Activities', () => {
    expect(getSubQuestions('Activities')).toEqual([
      'Which activities are worth booking in advance according to my activity preferences?',
      'Which activities are tourist traps?',
      'Which additional activities are popular?',
      'What are hidden gems?',
      'Is it advised to swim in nearby beaches?',
    ])
  })

  it('returns the correct sub-questions for Weather', () => {
    expect(getSubQuestions('Weather')).toEqual([
      'What is the weather likely going to look like?',
      'Are rain showers common?',
      'Is it mostly sunny?',
      'How strong will the sun be? What SPF is recommended, if any at all?',
      'Does it rain occasionally?',
      'Is drizzle rain common?',
      'What are the average humidity levels?',
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

  it('returns the correct sub-questions for Local Etiquette', () => {
    expect(getSubQuestions('Local Etiquette')).toEqual([
      'What are common ways to greet people?',
      'What is taboo?',
    ])
  })

  it('returns the correct sub-questions for Alcoholic Drinks', () => {
    expect(getSubQuestions('Alcoholic Drinks')).toEqual([
      'How much are alcoholic drinks on average (at restaurants/ bars/ pubs etc.)?',
      'What are the top 3 bars?',
      'What are the top 3 pubs?',
      'Where can I easily buy alcoholic drinks for private use?',
      'Are alcoholic drinks highly taxed?',
    ])
  })

  it('returns the correct sub-questions for Miscellaneous', () => {
    expect(getSubQuestions('Miscellaneous')).toEqual([
      'What are things I wish I had known?',
    ])
  })

  it('handles all CATEGORIES without throwing', () => {
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
