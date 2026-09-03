# Visamile Partner API

Authenticate with header:

```
X-API-Key: vm_<your-key>
```

Create keys from **Partner → Profile → API keys**.

## Endpoints

### POST /api/v1/cases

Create a single case (lands in `PENDING_PAYMENT`).

```json
{
  "countryId": "...",
  "visaTypeId": "...",
  "travelerType": "ADULT",
  "applicationGrouping": "INDIVIDUAL",
  "applicantFirstName": "Jane",
  "applicantLastName": "Doe",
  "applicantPassportNo": "P1234567"
}
```

### POST /api/v1/cases/bulk

```json
{
  "countryId": "...",
  "visaTypeId": "...",
  "travelerType": "CHILD",
  "applicants": [
    { "applicantFirstName": "A", "applicantLastName": "B", "applicantPassportNo": "P111" }
  ]
}
```

Country/visa IDs are available from `GET /api/pricing` (session auth) or your admin catalog.
