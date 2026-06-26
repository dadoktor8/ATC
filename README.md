# ATC Exam Management System

> **Proprietary software. All rights reserved.**
> This repository is private and intended solely for authorised personnel of the Art Training Centre. Redistribution, modification, or use outside the organisation is strictly prohibited.

---

## Overview

The ATC Exam Management System is an internal full-stack web application that manages the complete lifecycle of Art Training Centre examinations — from student registration through marks entry to the generation of official PDF documents stamped on ATC form templates.

The system is role-based: administrators handle registrations, document generation, and system configuration, while operators handle marks entry for their assigned students.

---

## Features

### Student Management
- Register individual students or bulk-import via CSV
- Full student record: name, roll number, father's name, year, subject, centre, session
- Centre-based filtering across all views

### Examination Phases

| Phase | Actor | Action |
|-------|-------|--------|
| Registration | Admin | Register students individually or via CSV bulk import |
| Admit Cards | Admin | Generate official admit card PDFs (one per student) with image overlay |
| Allocation Sheet | Admin | Generate seating allocation sheet PDF per batch |
| Marks Entry | Operator | Enter practical, IA, oral, and theory marks per student |
| Result Sheet | Admin | Generate result sheet PDF per batch with full marks breakdown |
| Mark Sheets | Admin | Generate individual mark sheet PDFs (only for students with marks entered) |
| Certificates | Admin | Generate diploma/visharad/ratna certificate PDFs per student |

### PDF Generation
All official documents are generated as pixel-accurate PDFs by overlaying data on top of scanned ATC form images:

- **Admit Card** — per-student, preview before download, batch download
- **Allocation Sheet** — per-batch, multiple rows per page, paginated
- **Result Sheet** — per-batch, same layout as allocation sheet with marks columns
- **Mark Sheet** — per-student (like admit card), requires marks to be entered; warns admin if any student is missing marks
- **Certificates** — Senior Diploma Final, Junior Diploma, Ankan Visharad, Junior Diploma Final, Ankan Ratna

### Position Editor
A standalone browser-based calibration tool (`cert-position-editor(2).html`) that lets you visually drag field pins onto a scanned form image and export coordinates. Supports:
- Allocation Sheet & Result Sheet (column-only x positioning; row y is computed automatically)
- Admit Card & Certificates (full x/y per field)
- Mark Sheet (full x/y per field, including individual marks row positioning)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, MUI v5, React Router v6 |
| Backend | Node.js, Express.js |
| Database | SQLite via `better-sqlite3` |
| PDF Engine | PDFKit |
| DOCX Engine | `docx` library |
| Auth | JWT (role-based: `admin` / `operator`) |

---

## Project Structure

```
atc-exam-system/
├── backend/
│   ├── cert-templates/          # Coord JSON files for all document types
│   │   ├── allocation_sheet_coords.json
│   │   ├── result_sheet_coords.json
│   │   ├── mark_sheet_coords.json
│   │   ├── admit_card_coords.json
│   │   └── images/              # Template images (not in repo — upload via UI)
│   ├── db/
│   │   └── schema.js            # SQLite schema (auto-creates on first run)
│   ├── generators/              # PDF and DOCX generators
│   │   ├── allocationSheetPdf.js
│   │   ├── markSheetPdf.js
│   │   ├── admitCard.js
│   │   └── certificate.js
│   ├── routes/                  # Express route handlers
│   ├── middleware/
│   │   └── auth.js              # JWT verification middleware
│   └── server.js
├── frontend/
│   └── src/
│       ├── pages/               # AdminLayout, BatchesPage, AdmitCardPage, MarkSheetPage, …
│       ├── components/          # GeneratePanel, MarksForm, BulkImport, …
│       └── utils/
│           └── api.js           # All axios API calls
├── cert-position-editor(2).html # Field calibration tool (open in browser directly)
└── .gitignore
```

---

## Setup & Running

### Prerequisites
- Node.js 18+
- npm

### Backend

```bash
cd backend
npm install
cp .env.example .env        # set JWT_SECRET and PORT
npm run dev                 # http://localhost:4000
```

The SQLite database (`atc.db`) is created automatically on first run.

### Frontend

```bash
cd frontend
npm install
npm start                   # http://localhost:3000
```

---

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Operator | `operator` | `op123` |

> Change these immediately after first login in a production environment.

---

## Document Template Setup

Form background images are **not stored in the repository** (they are large binaries). After cloning or deploying:

1. Log in as admin
2. Go to **Settings → Generate Documents**
3. Select the document type from the dropdown
4. Upload the corresponding scanned form image (PNG or JPEG)

| Document | Expected filename (auto-detected) |
|----------|-----------------------------------|
| Admit Card | `admit_card.jpg` / `.png` |
| Allocation Sheet | `allocation_sheet.jpg` / `.png` |
| Result Sheet | `result_sheet.jpg` / `.png` |
| Mark Sheet | `mark_sheet.jpg` / `.png` |
| Senior Diploma Final | `senior_diploma_final.jpg` |
| Junior Diploma | `junior_diploma.jpg` |
| Ankan Visharad | `ankan_visharad.jpg` |
| Junior Diploma Final | `junior_diploma_final.jpg` |
| Ankan Ratna | `ankan_ratna.jpg` |

---

## Calibrating Field Positions

If field positions drift after a form redesign:

1. Open `cert-position-editor(2).html` in any browser (no server needed)
2. Select the document type
3. Upload the form template image
4. Drag each labelled pin to the correct position on the form
5. Click **Export JSON**
6. Replace the corresponding file in `backend/cert-templates/`

---

## Marks System

Marks are entered by operators per student:

| Section | Components | Max |
|---------|-----------|-----|
| Practical | 1st Paper, 2nd Paper, Fabric Design | 100 each |
| Internal Assessment | 9 IA components | 20 each |
| Oral | Oral Examination | 50 |
| Theory | Paper I, Paper II | 50 each |

Division is auto-calculated:

| Division | Aggregate |
|----------|-----------|
| First | ≥ 75% |
| Second | ≥ 55% |
| Third | ≥ 35% |
| Absent | Marked AB |

---

## Bulk Student Import (CSV)

```csv
roll_no,name,father_name,mother_name,dob,year,subject,exam_date,exam_venue,exam_time
```

Download the sample CSV from the Bulk Import dialog for the correct column order.

---

## Deployment

### Backend (e.g. Render Web Service)
```bash
# Set environment variables:
#   PORT=4000
#   JWT_SECRET=<strong-random-string>
# Attach a persistent disk mounted at /data
# Set DB_PATH=/data/atc.db in .env
npm start
```

### Frontend (e.g. Render Static Site / Netlify / Vercel)
```bash
cd frontend
npm run build
# Deploy the /build folder
# Set REACT_APP_API_URL to your backend URL
```

---

## License

**Copyright © Art Training Centre. All Rights Reserved.**

This software and its source code are the exclusive property of the Art Training Centre. No part of this codebase may be copied, distributed, sublicensed, or used in any form without the express written permission of the organisation.
