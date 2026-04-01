# Implementation Plan: Multi-Hospital Network

## Overview

Implement the multi-hospital network feature in five sequential phases: backend routes + Supabase tables, auth helper, HospitalManager Hospitals tab, PatientDashboard Vela badge + booking, and Receptionist scoped mode. Backend uses Python/FastAPI with Hypothesis for property tests. Frontend uses TypeScript/React with inline styles only (no Tailwind). fast-check is not installed, so frontend PBT sub-tasks are marked optional and should be skipped.

## Tasks

- [x] 1. Backend — Supabase tables and FastAPI routes
  - [x] 1.1 Add `derive_slug` and `generate_password` pure functions to `main.py`
    - Implement `derive_slug(hospital_name: str) -> str` using the regex algorithm from the design
    - Implement `generate_password(length: int = 10) -> str` using `secrets` module
    - Both functions must be module-level so they can be imported by tests
    - _Requirements: 4.2, 4.3_

  - [ ]* 1.2 Write Hypothesis property tests for `derive_slug` and `generate_password`
    - **Property 1: Slug format** — for any `st.text(min_size=0, max_size=200)`, result ≤ 20 chars, only `[a-z0-9-]`, no leading/trailing hyphen
    - **Validates: Requirements 4.2**
    - **Property 2: Password character class coverage** — for any call, result is exactly 10 chars with ≥1 upper, ≥1 lower, ≥1 digit
    - **Validates: Requirements 4.3**
    - **Property 8: Credential email format** — `f"reception.{derive_slug(name)}@vela.health"` matches pattern for any non-empty name that produces a non-empty slug
    - **Validates: Requirements 4.2**
    - Place tests in `medisense/medisense-ai/test_network.py`; run with `pytest medisense/medisense-ai/test_network.py`

  - [x] 1.3 Add `POST /api/network/hospitals/register` route to `fastapi_app`
    - Accept `{ name, address, place_id, lat, lng, specializations, receptionist_name }`
    - Call `derive_slug`, check for existing `receptionist_email` collision (append 4-digit suffix if needed)
    - Call `generate_password`, bcrypt-hash it, insert into `network_hospitals`
    - Return `{ status, email, password, hospital_name, hospital_id }` — password in plaintext only here
    - Return `{ status: "error", code: "DUPLICATE_PLACE_ID" }` with HTTP 409 if `place_id` already exists
    - _Requirements: 4.2, 4.3, 4.5, 4.6, 1.3_

  - [x] 1.4 Add `GET /api/network/hospitals` route
    - Query all rows from `network_hospitals`, exclude `receptionist_password_hash`
    - Return `{ status: "success", hospitals: [...] }`
    - _Requirements: 10.1, 6.1_

  - [x] 1.5 Add `POST /api/network/auth/login` route
    - Accept `{ email, password }`
    - Look up `network_hospitals` by `receptionist_email`; bcrypt-verify password
    - On success return `{ status: "success", hospital_id, hospital_name, receptionist_name }`
    - On failure return `{ status: "error", message: "Invalid credentials" }` (no email-existence leak)
    - _Requirements: 5.1_

  - [x] 1.6 Add `POST /api/network/appointments/book` route
    - Accept `{ hospital_id, patient_id, patient_name, vela_id, date, time }`
    - Insert into `network_appointments` with `status = "pending"`
    - Emit `new_appointment` Socket.IO event to room `hospital_<hospital_id>` with `{ patient_name, date, time, vela_id }`
    - Return `{ status: "success", appointment_id }`
    - _Requirements: 7.2, 7.3, 7.6_

  - [x] 1.7 Add `GET /api/network/appointments` route
    - Accept query param `hospital_id`
    - Return only appointments where `hospital_id` matches
    - Return `{ status: "success", appointments: [...] }`
    - _Requirements: 5.2, 8.1_

  - [x] 1.8 Add `PATCH /api/network/appointments/{id}/arrive` route
    - Update `status` to `"arrived"` for the given appointment id
    - Emit `queue_updated` Socket.IO event to room `hospital_<hospital_id>` with appointment data
    - Return `{ status: "success" }`
    - _Requirements: 8.3, 8.4_

  - [ ]* 1.9 Write pytest integration tests for appointment routes
    - **Property 3: place_id deduplication** — second register with same `place_id` returns 409 with `DUPLICATE_PLACE_ID`
    - **Validates: Requirements 4.5**
    - **Property 5: Appointment booking round-trip** — after POST book, GET appointments returns record with same `patient_id`, `date`, `status = "pending"`
    - **Validates: Requirements 7.2, 7.6, 8.1**
    - **Property 6: Scoped appointment isolation** — appointments booked for hospital A never appear in GET for hospital B
    - **Validates: Requirements 5.2, 8.1**
    - **Property 7: Arrived status transition** — after PATCH arrive, GET returns `status = "arrived"`
    - **Validates: Requirements 8.3**
    - Place in `medisense/medisense-ai/test_network.py`

- [x] 2. Checkpoint — Backend routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Auth — `networkReceptionistLogin` in `src/utils/auth.ts`
  - [x] 3.1 Add `networkReceptionistLogin(email, password)` function to `auth.ts`
    - POST `{ email, password }` to `${API_URL}/api/network/auth/login`
    - On success: `localStorage.setItem("vela_user", ...)`, `vela_auth = "true"`, `vela_role = "receptionist"`, `vela_hospital_id = hospital_id`
    - On failure: return `false` without touching localStorage
    - Return `Promise<boolean>`
    - _Requirements: 5.1_
  - [x] 3.2 Update `logout` in `auth.ts` to also remove `vela_hospital_id` from localStorage
    - Add `localStorage.removeItem("vela_hospital_id")` to the existing `logout` function
    - _Requirements: 5.1_
  - [x] 3.3 Update `Login.tsx` receptionist login path to call `networkReceptionistLogin` when email matches `reception.*@vela.health` pattern
    - Check email with `/^reception\..+@vela\.health$/.test(email)` before deciding which login function to call
    - If pattern matches, call `networkReceptionistLogin`; otherwise call existing `receptionistLogin`
    - _Requirements: 5.1_

- [x] 4. HospitalManager — Hospitals tab in `src/pages/HospitalManager.tsx`
  - [x] 4.1 Add TypeScript interfaces `NetworkHospital` and `NetworkAppointment` at the top of the file (or a shared types location)
    - Define both interfaces exactly as specified in the design document
    - _Requirements: 1.3_

  - [x] 4.2 Add `hospitals` tab state and tab bar entry to `HospitalManager.tsx`
    - Extend `activeTab` union type to include `'hospitals'`
    - Add a "Hospitals" tab button to the existing tab bar nav using inline styles matching the existing active/inactive pattern (teal `#0F766E` for active, slate for inactive)
    - Add state variables: `hospitalNameInput`, `verifying`, `verifiedHospital`, `verifyError`, `specializations`, `specializationInput`, `receptionistName`, `registering`, `registrationError`, `credentials`, `networkHospitals`, `networkLoading`
    - _Requirements: 1.1, 1.2_

  - [x] 4.3 Implement Google Maps verification sub-panel
    - Render text input "Hospital Name" and "Verify on Google Maps" button inside the Hospitals tab
    - On click: fetch `https://maps.googleapis.com/maps/api/place/textsearch/json?query=<name>&key=<VITE_GOOGLE_MAPS_KEY>` (use `import.meta.env.VITE_GOOGLE_MAPS_KEY`)
    - On success: set `verifiedHospital` with `{ name, address, place_id, lat, lng }` from first result
    - On no results or error: set `verifyError` to the inline error message from the design
    - Show loading spinner and disable button while `verifying === true`
    - Render `VerifiedHospitalCard` (inline component) showing name, address, green "✓ Verified" label when `verifiedHospital` is set
    - All styles must be inline; use gold `#C8B89A` for accents, teal `#0F766E` for verified badge
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.4 Implement specialization chip manager
    - Render text input + "Add" button below `VerifiedHospitalCard`
    - On "Add": append trimmed value to `specializations` array, clear input
    - Render each specialization as a chip with an "×" remove button
    - "Register Hospital" button is disabled unless `verifiedHospital !== null && specializations.length >= 1 && receptionistName.trim() !== ""`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.5 Implement hospital registration submit and credential card
    - On "Register Hospital" click: POST to `/api/network/hospitals/register` with verified hospital data + specializations + receptionistName
    - On success: set `credentials` state and render `CredentialCard` (inline component) showing email, plaintext password, "Copy Email" / "Copy Password" buttons, dismiss button
    - Copy buttons use `navigator.clipboard.writeText` and show brief "Copied!" inline confirmation
    - Dismiss button clears `credentials` and resets the form (clear `verifiedHospital`, `specializations`, `receptionistName`, `hospitalNameInput`)
    - On `DUPLICATE_PLACE_ID` error: set `registrationError` to the message from the design
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 4.6 Implement registered hospitals list
    - Fetch `GET /api/network/hospitals` when `activeTab === 'hospitals'` (in a `useEffect` watching `activeTab`)
    - Render `NetworkHospitalList` (inline component): table/list showing name, address, specializations (comma-joined), receptionist email, formatted `created_at`
    - Show loading skeleton (3 placeholder rows) while `networkLoading === true`
    - Show empty state message from the design when list is empty
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 5. Checkpoint — HospitalManager tab complete, run `npm run build` and fix any TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. PatientDashboard — Vela badge + Book button in Find Care tab
  - [x] 6.1 Add `networkHospitals` and `bookingNetworkHospitalId` state to `PatientDashboard`
    - `networkHospitals: NetworkHospital[]` initialized to `[]`
    - `bookingNetworkHospitalId: string | null` initialized to `null`
    - _Requirements: 6.1_

  - [x] 6.2 Fetch network hospitals when Find Care tab activates
    - In the existing `useEffect` watching `activeTab`, when `activeTab === "find-care"`, fetch `GET /api/network/hospitals` and set `networkHospitals`
    - Build a `registeredPlaceIds = new Set(networkHospitals.map(h => h.place_id))` for O(1) lookup
    - _Requirements: 6.1_

  - [x] 6.3 Render Vela badge and Book button on hospital cards
    - In the hospital card render loop (where `hospitals` array is mapped), check `registeredPlaceIds.has(hospital.place_id)`
    - If true: render gold "✦ ON VELA" badge — inline style: `color: '#C8B89A'`, `fontWeight: 'bold'`, positioned top-right of card
    - If true: render "Book Appointment" button with teal `#0F766E` background
    - If false: render neither badge nor Book button
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 6.4 Wire Book button to booking modal for network hospitals
    - On "Book Appointment" click: find the matching `NetworkHospital` by `place_id`, set `bookingHospital` to it (pre-populated with `name` and `address`), set `bookingNetworkHospitalId` to the hospital's `id`
    - _Requirements: 7.1_

  - [x] 6.5 Fork `bookAppointment` to use network endpoint when `bookingNetworkHospitalId` is set
    - If `bookingNetworkHospitalId !== null`: POST to `/api/network/appointments/book` with `{ patient_id, hospital_id: bookingNetworkHospitalId, patient_name, vela_id, date: bookingDate, time: bookingTime }`
    - On success: toast "Appointment booked at \<Hospital Name\>. The receptionist has been notified." and clear `bookingNetworkHospitalId`
    - On failure: toast "Booking failed. Please try again."
    - If `bookingNetworkHospitalId === null`: use existing `bookAppointment` logic unchanged
    - _Requirements: 7.2, 7.4, 7.5_

- [x] 7. Checkpoint — PatientDashboard complete, run `npm run build` and fix any TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Receptionist — Scoped appointments mode in `src/pages/Receptionist.tsx`
  - [x] 8.1 Read `vela_hospital_id` from localStorage at component mount
    - Add `const hospitalId = localStorage.getItem("vela_hospital_id")` near the top of the component (outside state, as a stable ref or derived constant)
    - _Requirements: 5.2, 8.1_

  - [x] 8.2 Fork `fetchAppointments` to use scoped endpoint when `hospitalId` is set
    - If `hospitalId`: fetch `GET /api/network/appointments?hospital_id=<hospitalId>` and set `appointments` from `data.appointments`
    - If not: keep existing `GET /api/appointments/today` call unchanged
    - _Requirements: 5.2, 8.1, 8.2_

  - [x] 8.3 Fork `handleMarkArrived` to use network endpoint when `hospitalId` is set
    - If `hospitalId`: call `PATCH /api/network/appointments/<aptId>/arrive`
    - If not: keep existing `POST /api/appointments/<aptId>/arrive` call unchanged
    - On success: call `fetchAppointments()` to refresh the list
    - _Requirements: 8.3_

  - [x] 8.4 Join Socket.IO room and listen for `new_appointment` when `hospitalId` is set
    - In the existing socket `useEffect`, if `hospitalId` is set: emit `socket.emit("join_room", { room: \`hospital_${hospitalId}\` })` after socket connects
    - Listen for `new_appointment` event: show toast with `patient_name`, `date`, `time` from event data
    - Clean up listener on unmount
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 8.5 Add `join_room` Socket.IO event handler to `main.py`
    - Add `@sio.event async def join_room(sid, data)` that calls `await sio.enter_room(sid, data["room"])`
    - _Requirements: 5.3, 5.4_

- [x] 9. Final checkpoint — run `npm run build` with zero TypeScript errors
  - Ensure all tests pass, ask the user if questions arise.
