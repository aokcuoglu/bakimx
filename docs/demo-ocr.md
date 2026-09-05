# Anonymous registration OCR demo (#602)

The landing page accepts JPEG, PNG and WebP registration photos up to 8 MB. A
server-side decoder caps input at 25 million pixels, rejects animated images and
invalid/mismatched content, strips metadata, rotates and fits within 1280×1280.
The multipart stream itself is capped at 9 MB, including chunked requests.

Only nonempty vehicle fields returned by the real configured OCR provider reach
the browser. Owner names, identity/tax numbers and raw transcriptions are excluded.
There is no sample-data fallback. The configured provider currently supports 13
public vehicle fields; the prepared sample can display more fields.

Uploads/results are held in application memory for the request, not saved to
storage, OcrLog, vehicles, workshop records or history. The document is transmitted
to the configured external OCR provider for processing; that provider's data
retention terms still apply. Do not describe this as zero third-party retention.

## Limits and concurrency

A signed HttpOnly SameSite=Strict cookie identifies a browser for 400 days. It is
not a hardware identifier: cleared cookies, a different browser or private mode
can create another browser identity. The additional IP limits reduce that bypass,
but do not guarantee one trial per physical computer. Shared office networks share
the IP allowance. IPs are HMAC hashed before they enter the quota table.

Existing PostgreSQL RateLimitCounter rows hold all limits, with no schema change:

- One successful scan per browser for 400 days.
- One successful scan per IP per rolling 24 hours.
- Three validated OCR attempts per IP per rolling 24 hours.
- 50 provider invocations globally per rolling 24 hours by default
  (`DEMO_OCR_DAILY_LIMIT`, integer 1–1000).

A short PostgreSQL advisory transaction lock serializes check-and-reserve across
ECS tasks. Browser/IP entries are reserved before the provider request. Settled
failures and aborted requests refund only those success entries, retaining
attempt/global costs. SDK retries are disabled; the provider request has a
60-second abort/timeout, awaited before refund. No detached Promise.race call runs
after a slot becomes available. A process crash or a refund-store outage retains
the reservation conservatively until its normal expiry; this can consume a trial
without returning a result. An expired or late refund cannot delete a newer
browser reservation. Store failure never falls back to memory or grants access.

## Enabling outside localhost development

Real OCR requires the existing OCR_PROVIDER plus its API key/model configuration,
DATABASE_URL and a SESSION_SECRET of at least 32 characters. In addition set:

- DEMO_OCR_ENABLED=true
- DEMO_OCR_TRUST_PROXY=alb
- DEMO_OCR_ORIGIN=https://your-public-host (one exact HTTPS origin, without credentials, path, query or fragment)
- NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY (real keys)

Before setting the trust flag, verify the external AWS configuration: ECS traffic
must arrive only from the ALB, whose X-Forwarded-For mode must be append. The last
validated XFF IP is used, never the spoofable first value or X-Real-IP. Missing or
malformed IP fails closed. CloudFront or another intermediary would share an IP
quota until the trusted topology is explicitly redesigned. IPv6 variants are
canonicalized. No production config or secret is changed by this implementation.

Outside localhost development the incoming Host must exactly match DEMO_OCR_ORIGIN,
and POST Origin must equal that configured origin. This is explicit because the
standalone Docker server can expose an internal request.url host such as
0.0.0.0:3000. X-Forwarded-Host is never trusted. Turnstile Siteverify must return
success, the configured public hostname and action `demo_ocr`.
Tokens are bounded to 2048 characters; validation times out after 8 seconds. There
is no custom bot bypass. Browser CSP must permit challenges.cloudflare.com for
Turnstile's script/frame if CSP is introduced.

On development requests to localhost/127.0.0.1/::1 only, when both Turnstile keys are
absent, the official always-pass test pair is used. They still call the real
Siteverify endpoint and require either its documented localhost/test response or
its observed example.com response with result_with_testing_key=true metadata and
no action. This exception is restricted to the exact official test-key pair on
local development requests. A partial
key configuration fails closed. Official dummy keys are rejected outside local
development. Explicit DEMO_OCR_ENABLED=false disables even local development.

Sources: [Cloudflare test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/),
[server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[AWS ALB XFF handling](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html).
