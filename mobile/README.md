# SalePage Mobile (V0.5)

Native iOS + Android companion app for `salepage.in.th` — built with Expo SDK 53 + Expo Router.

> โครงการนี้คือ V0.5 (Native Companion) ตาม [`../ROADMAP.md`](../ROADMAP.md)
> เน้น checkout flow + AI slip verify + tracking ให้ครบก่อนทำ marketplace feed

---

## Stack

- **Runtime**: React Native 0.79 + Expo SDK 53 + React 19
- **Routing**: Expo Router 5 (file-based, mirrors `../src/app/[locale]`)
- **Styling**: NativeWind 4 + Tailwind 3 (palette = `../src/app/globals.css`)
- **State**: TanStack Query (server) + Zustand (cart)
- **Auth**: LINE Login native + JWT (storage via `expo-secure-store`)
- **Payments**: PromptPay QR rendered from `/api/v1/orders` response
- **Slip verify**: `expo-camera` (QR scan / photo) + `expo-image-picker`

---

## Local setup

```bash
cd mobile
pnpm install            # or npm/yarn — pnpm matches the root project
cp .env.example .env.local
```

ใส่ค่าที่จำเป็น (`EXPO_PUBLIC_LINE_LIFF_ID`, `EXPO_PUBLIC_LINE_LOGIN_CHANNEL_ID`)
สำหรับ dev บนเครื่องจริง ตั้ง `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:3000` แล้วเปิด Next.js dev server ก่อน

### Fonts

วาง Kanit font files ที่:

```
mobile/assets/fonts/Kanit-Regular.ttf
mobile/assets/fonts/Kanit-Bold.ttf
```

ดาวน์โหลดจาก https://fonts.google.com/specimen/Kanit (License: SIL OFL 1.1)

### Icons & splash

วางที่:

```
mobile/assets/icon.png      (1024×1024 PNG, รวมพื้นหลัง)
mobile/assets/splash.png    (1284×2778 PNG, transparent หรือ brand bg)
```

จนกว่าจะมีรูปจริง สามารถสร้าง placeholder ผ่าน `npx expo install expo-splash-screen` แล้วใช้ default

---

## Run

```bash
pnpm start              # Expo Dev Tools
pnpm ios                # iOS simulator (ต้องมี Xcode)
pnpm android            # Android emulator (ต้องมี Android Studio)
pnpm web                # Web preview (NativeWind จะ render แต่กล้องจะไม่ทำงาน)
```

หรือใช้ Expo Go บนเครื่องจริง — สแกน QR ที่หน้าจอ

---

## Project layout

```
mobile/
├── app/                    # Expo Router file-based routes
│   ├── _layout.tsx         # Root: Provider (Query, SafeArea, Fonts)
│   ├── index.tsx           # Home (V0.5 = launcher; V1 = feed)
│   ├── signin.tsx
│   ├── s/
│   │   └── [slug]/
│   │       ├── index.tsx       # Shop view
│   │       └── [productSlug].tsx
│   ├── cart.tsx
│   ├── checkout/
│   │   └── [token].tsx     # PromptPay QR + Slip capture/scan
│   ├── o/
│   │   └── [token].tsx     # Order tracking
│   └── +not-found.tsx
├── src/
│   ├── components/ui/      # Button, Screen
│   ├── lib/
│   │   ├── api.ts          # typed fetch -> /api/v1/*
│   │   ├── auth.ts         # JWT in expo-secure-store
│   │   ├── env.ts          # apiBaseUrl etc.
│   │   └── format.ts       # baht / dates / status
│   ├── store/
│   │   └── cart.ts         # Zustand + AsyncStorage
│   └── types/
│       └── api.ts          # mirrors /api/v1 response shapes
├── assets/                 # icons, splash, fonts
├── app.config.ts
├── babel.config.js
├── eas.json
├── global.css
├── metro.config.js
├── nativewind-env.d.ts
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## Backend dependencies (Next.js side)

ฟีเจอร์ในแอปต้องการ endpoint เพิ่มที่จะอิมพลีเมนต์ที่ web project (ดู `../ROADMAP.md` หัวข้อ "API Endpoints to Add"):

- [ ] `POST /api/v1/auth/line-mobile` — exchange LINE id_token → JWT
- [ ] `POST /api/v1/auth/refresh`
- [ ] `POST /api/v1/me/push-token`
- [ ] **`GET /api/v1/orders/:token`** ต้อง include `qr.dataUrl` (ปัจจุบันคืนแค่ตอน POST create)

---

## Deep links

- iOS Universal Link: `https://salepage.in.th/s/<slug>`, `https://salepage.in.th/o/<token>`
  → Apple App Site Association ที่ `https://salepage.in.th/.well-known/apple-app-site-association`
- Android App Link: เดียวกัน → ต้อง add `assetlinks.json` ที่ `/.well-known/assetlinks.json`
- Custom scheme: `salepage://<path>` (สำรองสำหรับ in-LINE, where universal link ไม่ทำงาน)

> ใส่ assetlinks/AASA ใน Next.js `public/.well-known/` เป็น static files

---

## EAS Build

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli init       # creates EAS project; copy projectId to .env
pnpm build:preview:ios      # internal TestFlight
pnpm build:prod             # production for App Store + Play Store
```

ตั้ง secrets ใน EAS:
- `EXPO_PUBLIC_LINE_LIFF_ID`
- `EXPO_PUBLIC_LINE_LOGIN_CHANNEL_ID`

---

## Status (V0.5)

| Feature | Status | Note |
|---|---|---|
| Project scaffold | ✅ | Expo + NativeWind + Expo Router |
| Shop view + product detail | ✅ | reads `/api/v1/shops/:slug` |
| Cart (single shop) | ✅ | persist via AsyncStorage |
| Checkout / create order | ✅ | calls `/api/v1/orders` |
| PromptPay QR display | ⚠️ | TODO: backend ต้องเพิ่ม `qr.dataUrl` ใน `GET /api/v1/orders/:token` |
| Slip QR scan (in-app) | ✅ | expo-camera + barcodeTypes:["qr"] |
| Slip image upload | ✅ | expo-image-picker → multipart |
| Order tracking + polling | ✅ | refetch every 15s |
| LINE Login native | 🚧 | placeholder (uses webview); native SDK pending V0.5 |
| Push notifications | ⏳ | V0.5 last item per ROADMAP |
| Deep links | ⏳ | app.config.ts ตั้งแล้ว ต้องวาง AASA/assetlinks ฝั่ง web |
| App icon + splash | ⏳ | placeholders ต้องส่งไฟล์จริง |

---

## Known issues / TODOs

ดูใน `../ROADMAP.md` ทุก [ ] ใต้ **V0.5**
