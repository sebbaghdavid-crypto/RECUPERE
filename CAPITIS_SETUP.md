# Capitis — configuration RÉCUPÈRE

Do not commit the Capitis secret.

Netlify environment variables:
- CAPITIS_API_KEY = Capitis sandbox key
- CAPITIS_ID_SALT = long random private salt, generated once and kept only in Netlify
- RECUPERE_CASHBACK_OFFERS = JSON array containing Capitis offers, for example:
  [{"id":"capitis-acme","provider":"capitis","merchant":"Example","merchantId":"mch_acme_outfitters","category":"Shopping","cashbackRate":5,"description":"Offre de test","active":true}]

The application uses:
POST /v1/end-users
POST /v1/links

RÉCUPÈRE sends the user's raw email only over the authenticated Capitis API connection when attaching the identifier. Capitis states that the API hashes the value in memory and does not store the raw email. CAPITIS_ID_SALT is used only by RÉCUPÈRE to derive its own opaque external ID.

Sandbox only:
- synthetic/seeded data
- click tokens expire after 30 days
- do not present sandbox inventory or conversions as real cashback

Production:
- Capitis approval is required.
