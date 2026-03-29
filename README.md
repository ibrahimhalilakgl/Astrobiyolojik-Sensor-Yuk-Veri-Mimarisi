# Playwright UI test paketi (~1001 test)

Bu depoda yalnızca **Playwright** senaryoları (`acceptance-test/`) ve bunların çalıştığı **Vite + React arayüzü** (`frontend/`) bulunur.

## Önkoşullar

- Node.js 18+
- `frontend` ve `acceptance-test` klasörleri aynı üst dizinde

## Terminalden çalıştırma

```powershell
cd frontend
npm install

cd ..\acceptance-test
npm install
npx playwright install

npx playwright test
```

Varsayılan **tek worker** (testler sırayla). Eski gibi paralel için:

```powershell
$env:PW_PARALLEL="1"
npx playwright test
```

UI modu:

```powershell
cd acceptance-test
npx playwright test --ui
```

Test sayısını doğrulamak: `npx playwright test --list`

## İsteğe bağlı: backend API testleri

`api-optional.spec.ts` **varsayılan olarak atlanır** (FastAPI yokken `ECONNREFUSED` olmaz).

Backend ayaktayken çalıştırmak için:

```powershell
$env:RUN_BACKEND_API_TESTS="1"
npx playwright test tests/api-optional.spec.ts
```

## Notlar

- Playwright, `playwright.config.ts` içindeki `webServer` ile `frontend` üzerinde `npm run dev` başlatır; **5173** portu boş olmalı (`vite.config.js` içinde `strictPort: true`).
- Eski `backend` klasörü kaldıysa (venv kilidi), süreçleri kapatıp **elle silin**; bu test paketi için gerekli değildir.
