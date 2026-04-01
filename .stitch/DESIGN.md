# Design System Specification: Editorial Precision in Medical AI

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Clinical Curator."** 

We are rejecting the "friendly tech" aesthetic of rounded pills and neon gradients. Instead, we are building a high-fidelity workspace that marries the dense, authoritative utility of a **Bloomberg Terminal** with the serene, human-centric clarity of **Apple Health**. This is a tool for high-stakes decision-making. 

The system breaks from generic layouts through **Intentional Asymmetry**. We prioritize a "sidebar-heavy" architecture and editorial-style typography scales that make data feel like a published medical journal rather than a chaotic dashboard. A constant **0.025 opacity noise grain** overlay provides a tactile, "fine-paper" quality to the digital interface, grounding the AI’s precision in a physical, trustworthy texture.

---

## 2. Colors & Surface Philosophy
The palette is rooted in functional psychology, tailored to three distinct user personas.

### The Persona Themes
*   **DOCTOR (Dark Authority):** High contrast, monochrome dominance with `#C8B89A` (Gold) accents. This is the "Suited" aesthetic—formal, serious, and expert.
*   **RECEPTIONIST (Efficiency):** Deep greens (`#065F46`) and fresh backgrounds (`#F7FFF7`) to reduce eye strain during high-volume data entry.
*   **PATIENT (Reassurance):** Soft teals (`#0F766E`) and calming washes (`#F0FDFA`) to lower cortisol and project calm.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for structural sectioning. Information architecture must be defined through **Background Color Shifts**. 
*   **Surface Hierarchy:** Use the `surface-container` tiers to nest content. A `surface-container-lowest` card should sit atop a `surface-container-low` section. 
*   **Glass & Gradient:** For floating modals or "Atlas Orb" interactions, use **Glassmorphism** (semi-transparent `surface` colors with a 12px-20px backdrop-blur). Main CTAs should utilize a subtle linear gradient from `primary` to `primary-container` to add "soul" and depth.

---

## 3. Typography: The Editorial Voice
We use typography to bridge the gap between human emotion and machine precision.

*   **Display & Headlines (Instrument Serif):** This is our "Editorial" voice. It is used for patient names, diagnoses, and high-level insights. It conveys heritage and wisdom.
*   **UI & Labels (Geist Sans):** Our "Functional" voice. Used for navigation, form labels, and button text. It is neutral, modern, and invisible.
*   **Data & Numbers (Geist Mono):** Our "Technical" voice. All vitals, timestamps, and laboratory values must use Geist Mono. The fixed character width ensures that columns of numbers remain perfectly aligned for quick scanning—essential for clinical accuracy.

---

## 4. Elevation, Depth & Texture
We achieve hierarchy through **Tonal Layering**, not structural scaffolding.

*   **The Layering Principle:** Stack `surface-container-lowest` (white/brightest) on `surface-container-high` (light grey/beige) to create a natural lift. 
*   **Ambient Shadows:** Shadows are rare. When used (e.g., a floating diagnostic card), they must be "Ambient": `blur: 40px`, `spread: -5px`, `opacity: 6%`, using a tint of the `on-surface` color.
*   **The Ghost Border:** If a boundary is required for accessibility, use a `1px` border with `outline-variant` at **15% opacity**. High-contrast borders are forbidden.
*   **The Signature Cursor:** A custom `5px` solid dot cursor with a `28px` lagging ring (ghost-gold) provides a sense of high-precision "instrumentation" as the user navigates data.

---

## 5. Components & UI Elements

### Buttons
*   **Primary:** Sharp 8px radius. Background: `primary` (Doctor: Black, Patient: Teal). Text: `on-primary`. No icons unless they represent a specific file action.
*   **Secondary:** Ghost-style. `1px` Ghost Border (15% opacity).
*   **Tertiary:** Text-only, `label-md` Geist Sans, all-caps with 0.05em letter spacing.

### Input Fields
*   **Architecture:** Minimalist. No enclosing boxes. Use a `1px` bottom border in `outline-variant`. 
*   **States:** On focus, the bottom border transitions to the theme's `accent` color. Error states use `error` text with no background "pink" wash.

### Cards & Lists
*   **The No-Divider Rule:** Forbid horizontal lines between list items. Use **Vertical White Space** (`spacing-4` to `spacing-6`) and subtle `surface-container` shifts to separate records.
*   **The Atlas Orb:** A 60px floating action circle with warm gold accents and a subtle `0.025` grain overlay. This houses the AI "Command" center.

### Data Visualization
*   **Bloomberg Density:** Charts should be compact. Use `Geist Mono` for all axes. Avoid rounded ends on bar charts; use square caps to maintain the "Clinical" look.

---

## 6. Do’s and Don’ts

### Do
*   **DO** use Instrument Serif for large, "emotional" data points (e.g., "Patient Status: Stable").
*   **DO** use Geist Mono for any value that a doctor might need to compare vertically (Blood Pressure, Heart Rate).
*   **DO** use `surface-container-highest` for the Sidebar background to create a "command" anchor on the left.
*   **DO** maintain the 8-12px radius. It is soft enough to be modern but sharp enough to be professional.

### Don't
*   **DON’T** use pill-shaped buttons. They feel too "consumer-grade" for a medical platform.
*   **DON’T** use purple gradients or neon glows. This is a medical tool, not a social app.
*   **DON’T** use standard drop shadows. If a card doesn't look "lifted" enough, increase the background contrast between the card and the surface.
*   **DON’T** use icons for everything. Rely on high-quality typography and clear labels.
