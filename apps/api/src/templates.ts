import {
  address, calculated, checkbox, checkboxGroup, date, email, form, number, page, phone, radio, rating, repeater, select, text,
  textarea, type FormSchema,
} from '@formknit/core'

export interface Template {
  id: string
  name: string
  description: string
  schema: FormSchema
}

/** Ready-made forms to start from. */
export const TEMPLATES: Template[] = [
  {
    id: 'contact',
    name: 'Contact form',
    description: 'Name, email and a message.',
    schema: form('Contact us', [
      text('name').label('Name').required().width(6),
      email('email').label('Email').required().width(6),
      textarea('message').label('Message').required().minLength(10),
    ]),
  },
  {
    id: 'admission',
    name: 'Admission form',
    description: 'Personal details and programme choice, in two steps.',
    schema: form('Admission form', [
      page('personal', 'Personal', [
        text('fullName').label('Full name').required(),
        email('email').label('Email').required().width(6),
        phone('phone').label('Phone').width(6),
        date('dateOfBirth').label('Date of birth').width(6),
        select('country', { NP: 'Nepal', IN: 'India', other: 'Other' }).label('Country').required().width(6),
        address('address').label('Address'),
      ]),
      page('programme', 'Programme', [
        radio('programme', { bsc: 'BSc Computer Science', bba: 'BBA', ba: 'BA English' }).label('Programme').required(),
        textarea('statement').label('Why do you want to join?'),
        checkbox('agree').label('I confirm the details above are correct').required(),
      ]),
    ]),
  },
  {
    id: 'event',
    name: 'Event registration',
    description: 'Attendees, sessions and dietary needs.',
    schema: form('Event registration', [
      text('name').label('Your name').required().width(6),
      email('email').label('Email').required().width(6),
      number('tickets').label('Number of tickets').min(1).max(10).default(1).width(6),
      calculated('cost', 'tickets * 500').label('Cost (NPR)').width(6),
      checkboxGroup('sessions', { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }).label('Sessions').minItems(1),
      text('dietary').label('Dietary needs'),
    ]),
  },
  {
    id: 'feedback',
    name: 'Feedback survey',
    description: 'Ratings and comments.',
    schema: form('Feedback', [
      rating('overall').label('Overall, how satisfied are you?').required(),
      radio('recommend', { yes: 'Yes', maybe: 'Maybe', no: 'No' }).label('Would you recommend us?'),
      textarea('good').label('What went well?'),
      textarea('better').label('What could be better?'),
    ]),
  },
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Line items with calculated totals.',
    schema: form('Invoice', [
      text('customer').label('Customer').required(),
      repeater('items', [
        text('name').label('Item').required(),
        number('qty').label('Qty').default(1).min(1),
        number('rate').label('Rate').min(0),
        calculated('amount', 'qty * rate').label('Amount'),
      ])
        .label('Items')
        .minItems(1)
        .set({ compact: true }),
      number('discount').label('Discount %').min(0).max(100).width(6),
      calculated('total', 'ROUND(SUM(items.amount) * (1 - discount / 100), 2)').label('Total').width(6),
    ]),
  },
]
