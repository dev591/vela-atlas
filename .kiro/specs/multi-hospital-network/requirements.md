# Requirements Document

## Introduction

The Multi-Hospital Network feature extends the Vela Health platform to support a federated network of independently operated hospitals. A Hospital Manager can register new hospitals on the Vela network by verifying them via Google Maps, assigning specializations, and generating dedicated receptionist credentials. Each registered hospital gets its own receptionist login that scopes all appointment notifications to that hospital. Patients searching for care in the Find Care tab see Vela-registered hospitals highlighted with a gold "✦ ON VELA" badge and can book appointments that instantly notify the correct hospital's receptionist via Socket.IO.

## Glossary

- **Network_Manager**: The Hospital Manager user who administers the Vela hospital network from HospitalManager.tsx.
- **Hospital_Registry**: The Supabase table and backend service that stores registered Vela network hospitals.
- **Google_Maps_Verifier**: The frontend component that calls the Google Places API to verify a hospital name and return canonical details (name, address, place_id, coordinates).
- **Verified_Hospital_Card**: The UI card rendered after a successful Google Maps verification, showing the hospital's real name, address, and a green "Verified" badge.
- **Specialization_Manager**: The UI sub-component within the hospital registration flow that allows adding and removing specialization tags (e.g., Cardiology, Neurology).
- **Credential_Generator**: The backend service that deterministically derives a receptionist email (`reception.<slug>@vela.health`) and generates a random secure password, then stores them hashed in Supabase.
- **Network_Receptionist**: A receptionist user whose account is scoped to a single registered hospital and who receives appointment notifications only for that hospital.
- **Vela_Badge**: The gold "✦ ON VELA" badge rendered on hospital cards in the Find Care tab for hospitals registered in the Hospital_Registry.
- **Appointment_Notifier**: The Socket.IO event pipeline that emits a `new_appointment` event to the room of the target hospital's receptionist when a patient books.
- **Find_Care_Tab**: The existing tab in PatientDashboard.tsx where patients search by symptoms and see nearby hospitals.
- **Booking_Modal**: The existing modal in PatientDashboard.tsx through which a patient selects a date/time and confirms an appointment.

---

## Requirements

### Requirement 1: Hospital Registration Tab

**User Story:** As a Network_Manager, I want a dedicated "Hospitals" tab in the HospitalManager dashboard, so that I can manage the Vela hospital network separately from internal ward operations.

#### Acceptance Criteria

1. THE HospitalManager.tsx SHALL render a "Hospitals" tab alongside the existing Performance, Ward Map, Personnel, AI Trends, and System tabs.
2. WHEN the Network_Manager clicks the "Hospitals" tab, THE HospitalManager.tsx SHALL display the hospital registration panel and the list of already-registered network hospitals.
3. THE Hospital_Registry SHALL persist registered hospital records in a Supabase table named `network_hospitals` with columns: `id`, `name`, `address`, `place_id`, `lat`, `lng`, `specializations`, `receptionist_email`, `receptionist_password_hash`, `created_at`.

---

### Requirement 2: Google Maps Hospital Verification

**User Story:** As a Network_Manager, I want to verify a hospital name against Google Maps before registering it, so that only real, geolocated hospitals are added to the Vela network.

#### Acceptance Criteria

1. THE HospitalManager.tsx SHALL render a text input labeled "Hospital Name" and a button labeled "Verify on Google Maps" within the Hospitals tab.
2. WHEN the Network_Manager clicks "Verify on Google Maps" with a non-empty hospital name, THE Google_Maps_Verifier SHALL query the Google Places Text Search API and return the top matching result's name, formatted address, place_id, and coordinates.
3. WHEN the Google Places API returns a valid result, THE HospitalManager.tsx SHALL render a Verified_Hospital_Card showing the hospital name, address, and a green "✓ Verified" label.
4. IF the Google Places API returns no results or an error, THEN THE HospitalManager.tsx SHALL display an inline error message: "Hospital not found on Google Maps. Please check the name and try again."
5. WHILE a verification request is in progress, THE Google_Maps_Verifier SHALL display a loading indicator and disable the "Verify on Google Maps" button.

---

### Requirement 3: Specialization Assignment

**User Story:** As a Network_Manager, I want to assign medical specializations to a hospital before registering it, so that patients can find the right hospital for their condition.

#### Acceptance Criteria

1. WHEN a Verified_Hospital_Card is displayed, THE Specialization_Manager SHALL render a text input and an "Add" button for entering specialization tags.
2. WHEN the Network_Manager types a specialization name and clicks "Add", THE Specialization_Manager SHALL append the tag to a displayed list of specialization chips below the input.
3. WHEN the Network_Manager clicks the "×" on a specialization chip, THE Specialization_Manager SHALL remove that chip from the list.
4. THE Specialization_Manager SHALL accept a minimum of 1 specialization before the "Register Hospital" button becomes active.

---

### Requirement 4: Receptionist Account Creation

**User Story:** As a Network_Manager, I want to enter a receptionist name and register the hospital in one click, so that credentials are automatically generated and the receptionist can log in immediately.

#### Acceptance Criteria

1. WHEN a Verified_Hospital_Card is displayed, THE HospitalManager.tsx SHALL render a text input labeled "Receptionist Name".
2. WHEN the Network_Manager clicks "Register Hospital" with a verified hospital, at least one specialization, and a receptionist name, THE Credential_Generator SHALL derive the receptionist email as `reception.<hospital_slug>@vela.health` where `<hospital_slug>` is the lowercase, hyphenated first word(s) of the hospital name (max 20 chars, alphanumeric and hyphens only).
3. WHEN the Network_Manager clicks "Register Hospital", THE Credential_Generator SHALL generate a random 10-character password containing uppercase letters, lowercase letters, and digits.
4. WHEN registration succeeds, THE HospitalManager.tsx SHALL display a credential card showing the generated email and plaintext password with a "Copy" button for each field.
5. IF a hospital with the same `place_id` is already registered, THEN THE Hospital_Registry SHALL return an error and THE HospitalManager.tsx SHALL display: "This hospital is already registered on the Vela network."
6. WHEN registration succeeds, THE Hospital_Registry SHALL store the hospital record in `network_hospitals` and create a corresponding user record in the Supabase `auth` or application users table scoped to the `receptionist` role with `hospital_id` set.

---

### Requirement 5: Network Receptionist Login and Scoped View

**User Story:** As a Network_Receptionist, I want to log in with my generated credentials and see only appointments for my hospital, so that I can manage my hospital's patient flow without seeing other hospitals' data.

#### Acceptance Criteria

1. WHEN a Network_Receptionist logs in via the existing Login.tsx receptionist flow using a `reception.*@vela.health` email and the generated password, THE Login.tsx SHALL authenticate against the application users table and set `vela_role = "receptionist"` and `vela_hospital_id = <hospital_id>` in localStorage.
2. WHEN a Network_Receptionist is authenticated, THE Receptionist.tsx SHALL fetch and display only appointments where `hospital_id` matches the receptionist's `vela_hospital_id`.
3. WHILE a Network_Receptionist is logged in, THE Appointment_Notifier SHALL emit `new_appointment` events only to the Socket.IO room identified by `hospital_<hospital_id>`.
4. WHEN a Network_Receptionist's session loads, THE Receptionist.tsx SHALL join the Socket.IO room `hospital_<hospital_id>` and listen for `new_appointment` events.
5. WHEN a `new_appointment` event is received, THE Receptionist.tsx SHALL display a toast notification with the patient name, requested date, and time.

---

### Requirement 6: Vela Badge on Find Care Results

**User Story:** As a Patient, I want to see which nearby hospitals are on the Vela network when I search for care, so that I know I can book appointments directly through Vela.

#### Acceptance Criteria

1. WHEN the Find_Care_Tab renders hospital search results, THE PatientDashboard.tsx SHALL query the Hospital_Registry for all registered `network_hospitals`.
2. FOR EACH hospital card rendered in the Find_Care_Tab, WHEN the hospital's `place_id` matches a record in `network_hospitals`, THE PatientDashboard.tsx SHALL render a gold "✦ ON VELA" badge on that hospital card.
3. THE Vela_Badge SHALL be visually distinct: gold color (`#F59E0B`), star prefix "✦", font-weight bold, and positioned in the top-right corner of the hospital card.
4. WHEN a hospital card has the Vela_Badge, THE PatientDashboard.tsx SHALL render a "Book Appointment" button on that card in addition to the standard card actions.
5. WHEN a hospital card does not have the Vela_Badge, THE PatientDashboard.tsx SHALL NOT render a "Book Appointment" button for that hospital.

---

### Requirement 7: Patient Appointment Booking with Instant Notification

**User Story:** As a Patient, I want to book an appointment at a Vela-registered hospital and have the receptionist notified instantly, so that my booking is confirmed in real time.

#### Acceptance Criteria

1. WHEN the Patient clicks "Book Appointment" on a Vela-badged hospital card, THE Booking_Modal SHALL open pre-populated with the hospital's name and address from the `network_hospitals` record.
2. WHEN the Patient submits the Booking_Modal with a valid date and time, THE PatientDashboard.tsx SHALL POST to `/api/network/appointments/book` with `patient_id`, `hospital_id`, `date`, and `time`.
3. WHEN the booking API call succeeds, THE Appointment_Notifier SHALL emit a `new_appointment` Socket.IO event to the room `hospital_<hospital_id>` containing `patient_name`, `date`, `time`, and `vela_id`.
4. WHEN the booking API call succeeds, THE PatientDashboard.tsx SHALL display a toast: "Appointment booked at <Hospital Name>. The receptionist has been notified."
5. IF the booking API call fails, THEN THE PatientDashboard.tsx SHALL display a toast: "Booking failed. Please try again."
6. THE `/api/network/appointments/book` endpoint SHALL store the appointment in a `network_appointments` Supabase table with columns: `id`, `hospital_id`, `patient_id`, `patient_name`, `vela_id`, `date`, `time`, `status` (default `pending`), `created_at`.

---

### Requirement 8: Receptionist Appointment Dashboard

**User Story:** As a Network_Receptionist, I want to see all incoming appointments for my hospital in a dedicated view, so that I can manage patient arrivals efficiently.

#### Acceptance Criteria

1. THE Receptionist.tsx SHALL render an "Appointments" tab (already exists) that, for Network_Receptionists, fetches from `/api/network/appointments?hospital_id=<id>` instead of the general appointments endpoint.
2. WHEN the Network_Receptionist views the Appointments tab, THE Receptionist.tsx SHALL display each appointment's patient name, Vela ID, requested date, time, and status.
3. WHEN the Network_Receptionist clicks "Mark Arrived" on an appointment, THE Receptionist.tsx SHALL PATCH `/api/network/appointments/<id>/arrive` and update the appointment status to `arrived`.
4. WHEN an appointment status changes to `arrived`, THE Appointment_Notifier SHALL emit a `queue_updated` Socket.IO event to the room `hospital_<hospital_id>`.

---

### Requirement 9: Credential Display and Sharing

**User Story:** As a Network_Manager, I want the generated credentials to be clearly displayed after registration so I can share them with the receptionist without ambiguity.

#### Acceptance Criteria

1. WHEN hospital registration succeeds, THE HospitalManager.tsx SHALL render a modal or inline card titled "Receptionist Credentials" containing the email, plaintext password, and hospital name.
2. THE credential card SHALL include a "Copy Email" button that copies the email to the clipboard and a "Copy Password" button that copies the password to the clipboard.
3. WHEN either "Copy" button is clicked, THE HospitalManager.tsx SHALL display a brief inline confirmation: "Copied!".
4. THE credential card SHALL include a dismissal button; WHEN clicked, THE HospitalManager.tsx SHALL clear the credential card and reset the registration form.

---

### Requirement 10: Registered Hospitals List

**User Story:** As a Network_Manager, I want to see all hospitals currently registered on the Vela network, so that I can audit the network and avoid duplicate registrations.

#### Acceptance Criteria

1. THE HospitalManager.tsx SHALL fetch and display all records from `network_hospitals` when the Hospitals tab is active.
2. FOR EACH registered hospital, THE HospitalManager.tsx SHALL display the hospital name, address, specializations, receptionist email, and registration date.
3. WHEN the Hospitals tab is first rendered, THE HospitalManager.tsx SHALL show a loading skeleton while the list is being fetched.
4. IF the `network_hospitals` table is empty, THEN THE HospitalManager.tsx SHALL display: "No hospitals registered yet. Use the form above to add the first hospital to the Vela network."
