// Fills a development database with a demo account, three forms and some submissions:
//   pnpm --filter @formknit/api seed
// The demo sign-in below is for local development only. Never use it on a real deployment.
import {
  calculated, checkbox, date, email, form, lookup, number, page, radio, repeater, select, text, validate, type FormSchema,
} from '@formknit/core'
import { eq } from 'drizzle-orm'
import { hashPassword, newId } from '../src/auth'
import { createDb, forms, submissions, users, type FormSettings } from '../src/db'

export const DEMO_EMAIL = 'demo@formknit.test'
export const DEMO_PASSWORD = 'formknit-demo-password'

const students = form('Student register', [
  text('rollNo').label('Roll number').required().width(4),
  text('fullName').label('Full name').required().width(8),
  select('programme', { bsc: 'BSc Computer Science', bba: 'BBA', ba: 'BA English' }).label('Programme').required().width(6),
  text('phone').label('Phone').width(6),
  number('paid').label('Fees paid so far').min(0),
])

const admission = form(
  'Admission form',
  [
    text('fullName').label('Full name').placeholder('e.g. Sita Sharma').required().minLength(3),
    email('email').label('Email').required().width(6),
    date('dateOfBirth').label('Date of birth').width(6),
    select('country', { NP: 'Nepal', IN: 'India', BT: 'Bhutan' }).label('Country').required().width(6),
    text('district').label('District').visibleWhen('country == "NP"').required().width(6),
    radio('programme', { bsc: 'BSc Computer Science', bba: 'BBA', ba: 'BA English' }).label('Programme').required(),
    checkbox('agree').label('I confirm the details above are correct').required(),
  ],
  { description: 'Apply for the 2027 intake. Fields marked * are required.', submitLabel: 'Submit application' },
)

const invoice = form(
  'Fee invoice',
  [
    page('student', 'Student', [
      text('rollNumber').label('Roll number').description('Try 2027-0142 or 2027-0150').required().width(4),
      lookup('studentName', { source: 'student-register', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'fullName' }).label('Student').required().width(4),
      lookup('paidSoFar', { source: 'student-register', matchField: 'rollNo', matchValue: 'rollNumber', returnField: 'paid', aggregate: 'sum' }).label('Paid so far').width(4),
    ]),
    page('fees', 'Fees', [
      repeater('items', [
        text('name').label('Item').required(),
        number('qty').label('Qty').default(1).min(1),
        number('rate').label('Rate').min(0),
        calculated('amount', 'qty * rate').label('Amount'),
      ])
        .label('Items')
        .minItems(1)
        .set({ compact: true })
        .default([{ name: 'Tuition fee', qty: 1, rate: 9000 }]),
      number('discount').label('Discount %').min(0).max(100).width(4),
      calculated('total', 'ROUND(SUM(items.amount) * (1 - discount / 100), 2)').label('Total').width(4),
      calculated('balance', 'total - paidSoFar').label('Balance after payments').width(4),
    ]),
  ],
  { submitLabel: 'Create invoice' },
)

const db = createDb(process.env.DATABASE_PATH ?? 'formknit.sqlite')
if (db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).get()) {
  console.log('The demo account already exists; nothing to do.')
  process.exit(0)
}

const ownerId = newId()
db.insert(users).values({ id: ownerId, email: DEMO_EMAIL, name: 'Demo User', passwordHash: await hashPassword(DEMO_PASSWORD), createdAt: Date.now() }).run()

function addForm(name: string, slug: string, schema: FormSchema, settings: FormSettings, rows: Record<string, unknown>[]) {
  const id = newId()
  const now = Date.now()
  db.insert(forms).values({ id, ownerId, name, slug, status: 'published', schema, publishedSchema: schema, publishedAt: now, settings, createdAt: now, updatedAt: now }).run()
  rows.forEach((row, i) => {
    const result = validate(schema, row)
    if (!result.valid) throw new Error(`Seed row ${i} for ${name} is invalid: ${JSON.stringify(result.errors)}`)
    db.insert(submissions).values({ id: newId(), formId: id, data: result.data, createdAt: now - (rows.length - i) * 3600000 }).run()
  })
}

addForm('Student register', 'student-register', students, { exposedFields: ['rollNo', 'fullName', 'programme', 'paid'] }, [
  { rollNo: '2027-0142', fullName: 'Sita Sharma', programme: 'bsc', phone: '9800000001', paid: 9000 },
  { rollNo: '2027-0142', fullName: 'Sita Sharma', programme: 'bsc', phone: '9800000001', paid: 3000 },
  { rollNo: '2027-0150', fullName: 'Arjun Thapa', programme: 'bba', phone: '9800000002', paid: 4500 },
])
addForm('Admission form', 'admission', admission, { successMessage: 'Thank you. We have received your application.' }, [
  { fullName: 'Priya Verma', email: 'priya@example.com', dateOfBirth: '2004-06-02', country: 'IN', programme: 'ba', agree: true },
  { fullName: 'Karma Dorji', email: 'karma@example.com', dateOfBirth: '2003-11-19', country: 'BT', programme: 'bsc', agree: true },
  { fullName: 'Anita Gurung', email: 'anita@example.com', dateOfBirth: '2005-01-30', country: 'NP', district: 'Kaski', programme: 'bba', agree: true },
])
addForm('Fee invoice', 'fee-invoice', invoice, {}, [])

console.log(`Seeded. Sign in as ${DEMO_EMAIL} (the password is in apps/api/scripts/seed.ts).`)
