# KERJAKU Interior Studio — Phase 1 MVP

An AI sales operating system for interior workshops: turn client inquiries into signed projects through consultation, AI visual concepts, proposals, and WhatsApp follow-up.

Note: this project is a fresh, empty starter — there is no prior KERJAKU code here to reuse. Everything below is built new, following the KERJAKU brand system you specified (dark navy #050B18, card #0B1628, blue #2563EB, electric blue #38BDF8, orange CTA #F97316).

## What gets built

### Foundation
- Lovable Cloud backend (database, auth, file storage, AI).
- Email/password sign in + sign up at `/auth`, with the whole workspace behind auth.
- Roles: Admin Workshop, Sales, Designer — stored in a dedicated roles table, enforced server-side. First user of a workshop becomes Admin.
- Workshop profile (name, logo, phone, address) editable in Settings and used on proposals.

### Shell & design system
- Dark premium AI workspace: glassmorphism cards, soft gradients, subtle glow, rounded corners, smooth motion.
- Collapsible sidebar (logo + Dashboard, Leads, Consultation, AI Interior, Projects, Proposal, CRM Pipeline, Material Library, Settings). Mobile: bottom-sheet nav, fully responsive.

### Module 1 — Dashboard
Header "Build beautiful spaces faster with AI". Metric cards: Total Leads, AI Concepts Generated, Proposals Sent, Active Projects, Estimated Revenue. Below: horizontal pipeline overview (New Lead → Consultation → AI Concept → Proposal Sent → Negotiation → Deal) with live counts and recent lead cards.

### Module 2 — Consultation / Leads
- Consultation form: client name, phone, email, location; project type (Kitchen Set, Wardrobe, Bedroom, Office, Other); description, budget range, design style, colour preference, special request.
- Uploads: existing room photo, Pinterest reference, optional render — stored in cloud storage.
- Leads list with search/filter; lead detail page showing consultation data, concepts, proposals, and notes.

### Module 3 — AI Interior Visual Concept
Three-panel creative workspace (not a form):
- Left: room photo, reference image, material pick, design style, instruction.
- Center: before/after canvas with comparison slider.
- Right: AI controls, generation history, regenerate/revision.
Generation runs server-side through Lovable AI with a locked system prompt that preserves room geometry, wall/window/door positions, ceiling, and camera perspective, and only improves material realism, lighting, texture, furniture and styling. Every generation stores project, prompt, images, and timestamp. Designer/Admin only; per-day generation cap to control cost.

### Module 4 — Material Library (light version in Phase 1)
Material table (code, name, category, colour, texture, finish) with seeded HPL examples (e.g. TACO 887 J — Milky Ramone, Pattern, Wood Texture), searchable, selectable inside AI Interior and proposal specs. Material codes appear in designer/proposal views only, never in WhatsApp messages.

### Module 5 — Proposal Generator
Split editor: left editing panel, right live preview. Six pages — Cover, Project Concept, Scope of Work, Material Specification, Price Estimation (editable table: No, Description, Qty, Price, Subtotal, Total), Terms & Notes. Workshop name/logo/phone/address pulled from Settings, all fields editable. Outputs: PDF download and a public share link (`/p/<token>`) clients can open without logging in.

### Module 6 — WhatsApp Delivery
Generates the exact Indonesian message format you specified, with client name, file name, and share link filled in; opens WhatsApp via a pre-filled `wa.me` link. Strips AI explanations, material codes, and internal notes. Sending logs an activity on the lead and advances the stage to Proposal Sent.

### Module 7 — CRM Pipeline
Drag-and-drop Kanban: New Lead → Consultation → AI Concept → Proposal Sent → Negotiation → Deal → Production → Completed. Cards show client name, project type, budget, last activity, next follow-up. Lead detail keeps notes, proposal history, and follow-up reminders.

### Projects
Deals converted to projects with stage, value, linked concepts and proposals.

## Deferred to later phases
Phase 2: full HPL intelligence, revision history diffing, client approval link with sign-off. Phase 3: AI sales assistant, automatic follow-up, behaviour analysis, revenue analytics.

## Technical notes
- TanStack Start + React, Tailwind v4 tokens in `src/styles.css` (all KERJAKU colours as semantic tokens; no hardcoded colours in components).
- Data: workshops, profiles, user_roles, leads, consultations, ai_concepts, materials, proposals, proposal_items, activities, projects. RLS on every table scoped to the user's workshop; role checks via a security-definer function.
- Uploads and generated images in cloud storage buckets; proposal share links read through a narrow public policy on a token.
- AI generation and PDF/share-link logic in server functions; image model via Lovable AI (image editing with the source photo as input to preserve architecture).
- PDF rendered client-side from the preview for fidelity, with the same layout as the share link.

## Build order
1. Cloud + auth + roles + design system + app shell
2. Consultation + leads + lead detail
3. CRM pipeline
4. AI Interior workspace + generation
5. Material library
6. Proposal generator + PDF + share link
7. WhatsApp delivery + dashboard metrics
