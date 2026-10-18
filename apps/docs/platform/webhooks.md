# Webhooks

[[toc]]

## Introduction

A webhook sends each new submission, and each change of review status, to an address you
choose, as it happens. Use it to copy submissions into another system, start a workflow, or
post to a chat channel through an automation service.

Webhooks are set per form under **Settings → Webhooks**. A form can have up to 10.

## Adding a webhook

Enter the receiving address and press **Add**. The webhook is given a **secret**, shown next
to it, which the receiver uses to check that requests really come from your Formknit server.

In production, addresses must start with `https://` and point at the public internet.
Addresses on private networks (`localhost`, `10.x`, `192.168.x` and so on) are refused, so a
webhook cannot be used to reach machines behind your firewall. In development, `http://` and
local addresses are allowed for testing.

**Send test** delivers a `webhook.test` event straight away and shows the result. Each
webhook shows its last delivery: when, whether it succeeded, and the response code or error.
A webhook can be paused and resumed.

## Events

| Event | When |
|---|---|
| `submission.created` | A respondent submits the form |
| `submission.status_changed` | Someone changes a submission's status |
| `webhook.test` | You press Send test |

## The request

Each delivery is an HTTP `POST` with a JSON body:

```http
POST /hooks/formknit HTTP/1.1
Content-Type: application/json
User-Agent: Formknit-Webhook
X-Formknit-Event: submission.created
X-Formknit-Signature: sha256=3f5a…
```

```json
{
  "event": "submission.created",
  "sentAt": "2027-03-14T09:26:53.000Z",
  "form": { "id": "6b1f…", "name": "Admission form", "slug": "admission" },
  "submission": {
    "id": "a83c…",
    "formId": "6b1f…",
    "status": "new",
    "data": { "fullName": "Sita Sharma", "email": "sita@example.com", "programme": "bsc" },
    "createdAt": 1805016413000,
    "updatedAt": null
  }
}
```

`data` holds the validated answers, exactly as stored. Times in `submission` are milliseconds
since 1970. For `webhook.test`, `submission` is `null`.

## Verifying the signature

`X-Formknit-Signature` is `sha256=` followed by the HMAC-SHA256 of the **raw request body**,
using the webhook's secret as the key. Compute it yourself and compare in constant time:

::: code-group

```ts [Node.js]
import { createHmac, timingSafeEqual } from 'node:crypto'

export function isFromFormknit(rawBody: string, header: string | undefined, secret: string) {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(header ?? '')
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
```

```python [Python]
import hmac, hashlib

def is_from_formknit(raw_body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(header or "", expected)
```

```php [PHP]
$expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
$valid = hash_equals($expected, $_SERVER['HTTP_X_FORMKNIT_SIGNATURE'] ?? '');
```

:::

Use the body exactly as received, before any JSON parsing; re-serialising it changes the bytes
and the signature will not match. In Express, read it with `express.raw({ type: 'application/json' })`.

## Delivery rules

- The receiver must answer within **5 seconds**. Any `2xx` status counts as success.
- Redirects are not followed.
- Deliveries are sent after the submission is saved, and never delay the respondent.
- A failed delivery is recorded but **not retried**. If you cannot miss events, have the
  receiver fetch anything it missed through the [API](./api), using the submission list.
