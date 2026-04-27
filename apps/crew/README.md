# SkyHub Crew

Mobile companion app for crew members. Reads own roster, receives push when schedule changes, works offline.

Separate Expo app from `apps/mobile` (which is the SkyHub ops console).

## Stack

- Expo SDK 54, React Native 0.81, Expo Router 6
- WatermelonDB (SQLite) via `@skyhub/crew-db` for offline roster
- expo-secure-store for tokens (NOT AsyncStorage — PII upgrade)
- expo-local-authentication for biometric unlock
- expo-notifications + Expo Push (FCM/APNs) for real-time schedule changes

## Server endpoints (under `/crew-app/*`)

- `GET /crew-app/auth/operators` — operator picker (public)
- `POST /crew-app/auth/login` — EID + 6-digit PIN → JWT scope=crew
- `POST /crew-app/auth/set-pin` — first-login flow with temp PIN
- `POST /crew-app/auth/refresh` — refresh JWT
- `POST /crew-app/auth/logout` — revoke push token
- `GET  /crew-app/sync/pull` — WatermelonDB sync envelope (changes since `lastPulledAt`)
- `POST /crew-app/sync/push` — message read-receipts (whitelisted writes only)
- `POST /crew-app/push-tokens/register` — register Expo push token
- `DELETE /crew-app/push-tokens` — unregister

## First-time setup checklist

1. `npm install` at repo root.
2. Provision Firebase project, drop `google-services.json` next to `app.json`.
3. Set `EXPO_PUBLIC_API_URL` (e.g. `https://api.skyhub.com`) in `.env` for non-dev.
4. `eas build:configure` (one time per Expo account).

## Build

```
eas build -p android --profile preview      # internal APK
eas build -p android --profile production   # Play AAB
eas build -p ios --profile preview          # TestFlight (when Apple Dev funded)
```

## Dev

```
npm run start          # Expo dev server
npm run android        # build + install on connected device
```

## Issuing temp PINs (Crew Ops side)

Not yet wired — needs an admin endpoint at `server/src/routes/crew.ts` that bcrypts a generated temp PIN onto `CrewMember.crewApp.tempPinHash` and surfaces it once via toast / SMS gateway. Track as Phase 5 follow-up.
