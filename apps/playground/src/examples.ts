import {
  address, calculated, checkbox, columns, content, date, dateRange, divider, email, field, form, lookup, number, page, panel,
  radio, rating, repeater, richText, select, signature, slider, text, textarea, url, type LookupQuery,
} from '@formknit/core'

export const admission = form(
  'Admission form',
  [
    text('fullName').label('Full name').placeholder('e.g. Sita Sharma').required().minLength(3),
    email('email').label('Email').placeholder('name@example.com').description('We send your confirmation here.').required(),
    columns(
      [date('dateOfBirth').label('Date of birth').max('2012-12-31')],
      [select('country', { NP: 'Nepal', IN: 'India', BT: 'Bhutan' }).label('Country').placeholder('Select a country').required()],
    ),
    text('district').label('District').visibleWhen('country == "NP"').required(),
    radio('programme', { bsc: 'BSc Computer Science', bba: 'BBA', ba: 'BA English' }).label('Programme').required(),
    checkbox('agree').label('I confirm the details above are correct').required(),
  ],
  { description: 'Apply for the 2027 intake. Fields marked * are required.', submitLabel: 'Submit application' },
)

export const invoice = form(
  'Fee invoice',
  [
    page('student', 'Student', [
      text('rollNumber').label('Roll number').placeholder('2027-0142').required().pattern(/\d{4}-\d{4}/, 'Use the format 2027-0142'),
      text('fullName').label('Full name').required(),
    ]),
    page('fees', 'Fees', [
      repeater('items', [
        text('name').label('Item').required(),
        number('qty').label('Qty').default(1).min(1),
        number('rate').label('Rate').min(0),
        calculated('amount', 'qty * rate').label('Amount'),
      ])
        .label('Items')
        .set({ compact: true })
        .description('Add each fee that applies. The total updates as you type.')
        .minItems(1)
        .default([{ name: 'Tuition fee', qty: 1, rate: 9000 }, { name: 'Lab fee', qty: 2, rate: 1500 }]),
      columns(
        [number('discount').label('Discount %').min(0).max(100)],
        [calculated('total', 'ROUND(SUM(items.amount) * (1 - discount / 100), 2)').label('Total (calculated)')],
      ),
    ]).description('What the student owes this term.'),
    page('scholarship', 'Scholarship', [
      text('scholarshipId').label('Scholarship ID').required(),
    ]).visibleWhen('discount >= 50'),
    page('confirm', 'Confirm', [checkbox('agree').label('The amounts above are correct').required()]),
  ],
  { submitLabel: 'Create invoice' },
)

export const showcase = form(
  'Everything',
  [
    content('Layout', { heading: true }),
    text('firstName').label('First name').width(6).required(),
    text('lastName').label('Last name').width(6).required(),
    text('city').label('City').width(4),
    text('province').label('Province').width(4),
    text('postcode').label('Postcode').width(4),
    divider(),
    content('Data from elsewhere', { heading: true }),
    text('rollNumber').label('Roll number').description('Try 2027-0142 or 2027-0150').width(4),
    lookup('studentName', { source: 'students', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'fullName' }).label('Student (looked up)').width(4),
    lookup('paid', { source: 'payments', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'amount', aggregate: 'sum' }).label('Paid so far (looked up)').width(4),
    divider(),
    content('More field types', { heading: true }),
    url('website').label('Website').placeholder('https://').width(6),
    field('file', 'cv', { label: 'CV', accept: '.pdf', validate: { maxSizeMb: 1 }, description: 'PDF, up to 1 MB', width: 6 }),
    rating('satisfaction').label('How satisfied are you?').width(6),
    slider('confidence').label('Confidence').min(0).max(10).width(6),
    dateRange('stay').label('Dates of stay').width(6),
    signature('sign').label('Signature').width(6),
    address('home').label('Home address'),
    richText('about').label('About you').placeholder('Write a few lines…').description('Formatted text, stored as cleaned HTML.').maxLength(500),
    panel('Feedback', [
      radio('recommend', { yes: 'Yes', maybe: 'Maybe', no: 'No' }).label('Would you recommend us?').className('fx-stack-choices').width(4),
      textarea('comments').label('Comments').width(8),
    ]),
  ],
  { description: 'Widths, lookups and the newer field types. Resize the window to see the fields stack.' },
)

const STUDENTS: Record<string, { fullName: string; payments: number[] }> = {
  '2027-0142': { fullName: 'Sita Sharma', payments: [9000, 3000] },
  '2027-0150': { fullName: 'Arjun Thapa', payments: [4500] },
}

/** Stands in for your API: answers lookups from a small in-memory table after a short delay. */
export async function fakeLookup(query: LookupQuery): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  const student = STUDENTS[String(query.where.rollNo)]
  if (!student) return null
  if (query.source === 'payments') return student.payments.reduce((a, b) => a + b, 0)
  return student.fullName
}

export const examples = { 'Admission form': admission, 'Fee invoice (wizard)': invoice, Everything: showcase }
