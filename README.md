# ATC Exam Management System

Full-stack web app for Assam Talent Council exam administration.

## Tech Stack

- **Frontend**: React 18 + MUI v5 + React Router v6
- **Backend**: Express.js + better-sqlite3
- **Documents**: docx (DOCX generation matching ATC templates)

## Setup

### Backend

```bash
cd backend
npm install
npm run dev       # runs on http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm start         # runs on http://localhost:3000
```

## Default Credentials

| Role     | Username   | Password  |
|----------|------------|-----------|
| Admin    | `admin`    | `admin123`|
| Operator | `operator` | `op123`   |

## Workflow

### Phase 1 — Registration (Admin)
1. Log in as **admin**
2. Click **Register Student** or **Bulk Import** (CSV)
3. CSV format: `roll_no, name, father_name, mother_name, dob, year, subject, exam_date, exam_venue, exam_time`

### Phase 2 — Exam Docs (Admin)
1. Go to **Generate Docs**
2. Download **Admit Cards** (bulk DOCX)
3. Download **Allocation Sheet** (seating layout)

### Phase 3 — Marks Entry (Operator)
1. Log in as **operator**
2. All registered students appear automatically
3. Click **Edit** or double-click any row to enter marks
4. Marks sections:
   - **Practical**: 1st Paper (100), 2nd Paper (100), Fabric (100)
   - **Internal Assessment**: 9 components × 20 marks = 100
   - **Oral & Theory**: Oral (50), Paper I (50), Paper II (50)
5. Division is auto-calculated (First ≥75%, Second ≥55%, Third ≥35%)

### Phase 4 — Result Docs (Admin)
1. Log in as **admin**
2. Go to **Generate Docs**
3. Download **Result Sheet** (full marks table)
4. Download individual **Marksheets** per student

## Document Templates

Based on ATC templates:
- `ATC-ALLOCATION_SHEET.docx` — seating allocation (no marks)
- `ATC-_RESULT_SHEET.docx` — full result with 16-column mark breakdown
- Admit cards — individual student cards
- Marksheets — individual student result

## Deployment (Cloud)

```bash
# Backend: push to Render as a Web Service
# Set PORT env var, SQLite persists on disk (add a disk in Render)

# Frontend: run `npm run build` then deploy /build to Render Static Site
# Or use Netlify/Vercel for the frontend
```
