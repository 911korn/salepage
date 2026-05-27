# App Review Notes — TestFlight / App Store Connect submission

> Paste these verbatim into ASC → App Review Information → Notes when
> submitting. Follow CET MANDATORY law: Notes structure (demo account →
> per-issue blocks → bundled bug fixes → IAP IDs → contact).

---

## Demo account credentials

For the reviewer to evaluate the buyer + seller flows without going
through Thailand-specific LINE registration:

```
Email: appreview@salepage.in.th
Password: AppReview!2026

(magic-link login: open the app → "เข้าสู่ระบบด้วยอีเมล" → enter the
email → reviewer receives the OTP link → tap to sign in)

Demo shop the account owns: salepage.in.th/s/demo-shop
```

> If the magic-link inbox is preferable to the reviewer, a Resend
> mail forwarder routes appreview@salepage.in.th → ceo@911.co.th and
> we can paste the OTP code on request.

---

## Happy path (buyer journey)

1. Launch app → Home tab → product feed loads.
2. Tap any product card → product detail with price + ratings +
   shop card → "ซื้อเลย" (Buy now).
3. Cart screen → fill recipient name + phone + Thai postcode → "ยืนยัน
   คำสั่งซื้อ" (Confirm order).
4. Order tracking → first-time-only tutorial modal explains the QR
   workflow → tap "เริ่มชำระเงิน" → PromptPay QR appears.
5. Choose "เลือกจากคลังภาพ" (Pick from gallery) → upload any image →
   demo mode treats it as a valid slip → order flips to "ชำระแล้ว"
   (Paid) automatically.
6. Tap "ดูสถานะออเดอร์" (View order) → tracking screen shows the
   delivery timeline.

---

## TESTING GUIDE — addresses Review Guidelines

Each block: what Apple asks for → what we changed with file paths →
tap-by-tap verify path (no gated feature required) → demo URL.

### Issue #1 — Guideline 5.1.1(v) · Account deletion is in-app

What Apple expects: any app that creates accounts must let the user
delete the account from inside the app, with ease comparable to
sign-in.

What we ship:
- In-app entrypoint: Me tab → scroll to bottom → tap "ลบบัญชี" (red,
  underlined text below "ออกจากระบบ").
- Confirm panel renders inline (no native Alert) with explicit
  warning of consequences + a separate destructive button. Apple's
  ease-of-find requirement is met: it sits at the same level of
  navigation as Sign-out.
- Implementation: `mobile/app/(tabs)/me.tsx` performDeleteAccount()
  calls `POST /api/v1/me/delete-account`. Server route at
  `src/app/api/v1/me/delete-account/route.ts` soft-deletes the User
  (wipes PII, blanks email to `deleted-{id}@deleted.salepage.in.th`,
  severs OAuth accounts/sessions, suspends owned shops).

Verify (no gated feature):
1. Sign in with the demo email above
2. Tap Me tab
3. Scroll past "ออกจากระบบ" → "ลบบัญชี" link
4. Tap → inline confirm with 4 bullet warnings appears
5. Tap "ลบบัญชีถาวร" → app reloads → guest /me view

Demo: https://salepage.in.th/demo/flow1-account-deletion.mp4

### Issue #2 — Guideline 1.2 · Objectionable UGC moderation

What Apple expects: every UGC surface must (a) let viewers report
content (b) let users block other users (c) operator commits to
respond within 24h (d) Terms of Service forbid objectionable
content.

What we ship:
- **Report** button on every UGC surface:
  - Product detail page → "รายงานสินค้านี้" link below description
    (`mobile/app/s/[slug]/[productSlug].tsx`).
  - Shop page → 🚩 icon next to share button
    (`mobile/app/s/[slug]/index.tsx`).
  - (Live comments + Stories + Reviews — rolling out in v0.2; not
    accessible to anonymous buyers in v0.1.0.)
- Tapping any report opens a bottom sheet with 7 standard reason
  categories (INAPPROPRIATE / COUNTERFEIT / MISLEADING / HARASSMENT
  / SPAM / ILLEGAL / OTHER) + 1000-char detail field. Server
  endpoint: `POST /api/v1/reports`. Throttled to one report per
  target per 24h server-side.
- Admin queue at `/admin/reports` pages super-admins (ceo@911.co.th
  + cetonlineth@gmail.com) on new entries.
- Terms of Service (https://salepage.in.th/terms) section 3
  explicitly forbids objectionable, abusive, threatening, illegal,
  or counterfeit content, and commits to action within 24 hours.
- 24-hour SLA: incoming reports email ceo@911.co.th + Slack alert
  to the moderation channel.

Verify (no gated feature):
1. Sign in
2. Browse to any shop page (Shops tab → first shop)
3. Tap the 🚩 icon in the shop header → reasons bottom sheet
4. Pick "เนื้อหาไม่เหมาะสม" → "ส่งรายงาน" → success toast

Demo: https://salepage.in.th/demo/flow2-content-report.mp4

### Issue #3 — Guideline 4.8 · Sign in with Apple

What Apple expects: when any third-party login (Google / LINE /
Facebook) is offered, Sign in with Apple must be available with
equivalent prominence on iOS.

What we ship:
- Sign In with Apple button (native AppleAuthentication.SignInButton)
  rendered FIRST in the signin card on iOS, only.
- Implementation: `mobile/app/signin.tsx` lines 159–174 +
  `mobile/src/hooks/use-apple-signin.ts`.
- Server: `POST /api/v1/auth/apple-mobile/route.ts` verifies the
  identityToken via Apple's JWKS, find-or-creates the User.
- Apple Services ID + Sign-In-with-Apple Key + p8 already
  configured on Apple Developer Portal under MR3FF57WDB.

Verify:
1. Launch app
2. Tap "เข้าสู่ระบบ" on Me tab (or any sign-in CTA)
3. Apple SF Symbols sign-in button is FIRST in the list
4. Tap → Apple sheet → choose "Share My Email" → consent → signed in

Demo: https://salepage.in.th/demo/flow3-sign-in-apple.mp4

### Issue #4 — Guideline 5.1.1(c) · Privacy + permission strings

What Apple expects: every Info.plist permission string explains why
(in the user's language), privacy policy URL is reachable.

What we ship:
- All Info.plist usage descriptions Thai-localized:
  - NSCameraUsageDescription: scan PromptPay QR + product photos.
  - NSPhotoLibraryUsageDescription: pick payment slip + product photos.
  - Push notifications: opt-in flow at runtime, in-context (after
    user successfully places first order).
- ITSAppUsesNonExemptEncryption: false (only HTTPS via standard
  TLS, no custom crypto).
- Privacy policy: https://salepage.in.th/privacy (HTTP 200,
  Thai-language, complete).
- Terms of Service: https://salepage.in.th/terms (HTTP 200).
- Contact: https://salepage.in.th/contact + ceo@911.co.th.

---

## In-App Purchases

This build ships **no in-app purchases**. All commerce is between
buyer and seller via Thai PromptPay for physical/digital goods —
per Guideline 3.1.5(a) this is outside the IAP requirement
because:
- Physical goods are paid via PromptPay direct to the seller's bank
- Digital goods are fulfilled directly between the seller and buyer
  (we are a marketplace, not a content store)

If StoreKit-eligible features land in a future build (premium seller
tier, etc.), they will be wired through expo-in-app-purchases and
RevenueCat with IAP IDs documented here.

---

## Contact

- **Primary:** Kittikorn Taweephon (911korn)
- **Email:** ceo@911.co.th
- **Backup email:** cetonlineth@gmail.com
- **Phone:** +66 86 327 3566 (Thailand)
- **Support form:** https://salepage.in.th/contact

Available for live response 08:00–22:00 ICT (UTC+7). Apple Review
correspondence is forwarded to my phone.
