# SalePage

แพลตฟอร์มสร้างร้านขายของออนไลน์แบบสำเร็จรูป — **salepage.in.th**

**ดีกว่า เท่กว่า ง่ายกว่า** — รับเงินตรงเข้าบัญชี PromptPay พร้อมระบบตรวจสลิป AI

## Stack

- Next.js 16 (App Router + Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 (`@theme` in `src/app/globals.css`)
- Framer Motion · Lucide React · Sonner · React Hook Form · Zod
- `promptpay-qr` + `qrcode` for Thai QR Payment standard
- API-first — every feature exposed under `/api/v1/*` for web + future React Native app

## Dev

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

If port 3000 is taken: `PORT=3030 pnpm dev`

## Production build

```bash
pnpm build && pnpm start
```

## API v1

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/health` | service + endpoint list |
| POST/GET | `/api/v1/promptpay/qr` | generate Thai QR Payment for a PromptPay ID + optional amount |
| POST | `/api/v1/slip/verify` | verify a bank slip (image or QR payload) — provider-pluggable |
| GET | `/api/v1/shops/:slug` | public shop info |
| GET | `/api/v1/shops/:slug/products` | shop's products |
| GET | `/api/v1/shops/:slug/products/:productSlug` | product detail |

All responses follow `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`.

## Slip verification

Set `SLIP_VERIFY_PROVIDER` to switch:

- `mock` (default) — deterministic fake result, used until production keys land
- `slipok` — requires `SLIPOK_API_KEY` + `SLIPOK_BRANCH_ID`
- `easyslip` — stub, to be wired up

## Domain

- Production: https://salepage.in.th
- DNS: Cloudflare (A `salepage.in.th → 76.76.21.21`, CNAME `www → cname.vercel-dns.com`)
- Host: Vercel (`911korns-projects/salepage`)
