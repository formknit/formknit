import {
  calculated, checkbox, columns, date, email, form, number, page, radio, repeater, select, text,
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

export const examples = { 'Admission form': admission, 'Fee invoice (wizard)': invoice }
