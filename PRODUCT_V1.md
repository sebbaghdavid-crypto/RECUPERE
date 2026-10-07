# RÉCUPÈRE — V1

## Objective
Transform the current repository into the foundation of a real service:
client intake, dossier tracking, administration, payment, invoicing, notifications, and auditable status history.

## Important
The current repository contains only a minimal README. The production application currently deployed on Netlify is therefore not present in this GitHub repository.

## V1 domain model

### users
- id
- email
- name
- role: customer | admin
- created_at
- updated_at

### cases
- id
- case_number
- user_id
- category
- company
- reference
- amount
- description
- status
- opportunity_level
- estimated_recovery
- confidence
- created_at
- updated_at

### documents
- id
- case_id
- file_name
- file_url
- mime_type
- created_at

### payments
- id
- case_id
- user_id
- provider
- provider_payment_id
- amount
- currency
- status
- created_at

### invoices
- id
- case_id
- user_id
- provider
- provider_invoice_id
- invoice_number
- amount
- tax_amount
- status
- invoice_url
- issued_at

### case_events
- id
- case_id
- actor_type
- actor_id
- event_type
- payload
- created_at

## Case lifecycle
NEW -> ANALYSIS -> OPPORTUNITY -> PAYMENT_REQUIRED -> PAID -> CLAIM_PREPARED -> SENT -> FOLLOW_UP -> RECOVERED -> CLOSED

Alternative terminal states:
NO_OPPORTUNITY, INCOMPLETE, REFUNDED, CANCELLED

## Payments
PayPal is the planned provider. The integration must use server-side secrets only. Subscription/payment state must be synchronized from verified PayPal webhooks, not from the browser alone.

## Invoicing
Invoice status must be synchronized with PayPal webhook events where PayPal invoicing is used.

## Notifications
- new case -> admin notification
- case received -> customer confirmation
- payment success -> customer + admin notification
- status change -> customer notification
- failed payment -> customer notification
- recovered -> customer notification

## Admin requirements
- dashboard counters
- searchable/filterable cases
- case detail
- document access
- status changes
- payment state
- invoice state
- timeline/history
- manual notes
- export

## Security
- never expose PayPal client secret or access token in frontend
- authenticated admin area
- private document storage
- minimal personal data
- audit trail for important mutations

## Deployment
The Netlify deployment should be connected to this repository only after the application source is actually committed here.