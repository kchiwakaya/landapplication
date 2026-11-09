# Ministry of Lands and Rural Development — Model A2 Land Applications Registry

Full-stack web application for capturing, tracking, and adjudicating applications under the **Land Reform and Resettlement Programme (Phase II, Model A2) — Commercial Farm Settlement Scheme (Small, Medium and Large Scale Commercial Farms)** in terms of the *Agricultural Land Settlement Act (Chapter 20:01)*.

---

## Architecture

- **Backend (`backend/`)**: Django 5.1 + Django REST Framework + SimpleJWT + PostgreSQL (`ArrayField`, `GinIndex`, transactional per-province sequence numbers, authenticated attachment streaming).
- **Frontend (`frontend/`)**: React 18 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (Radix primitives) + TanStack Query + React Hook Form + Zod.

---

## Statutory Form Coverage

| Section | Who Completes | Key Fields & Rules |
| :--- | :--- | :--- |
| **A. Particulars of the Applicant** | Capture Officer / Applicant | Title, Surname & Other Names (block letters), Sex, Marital Status, Zimbabwean National ID (`63-1234567A89`), Postal & Residential Address, Business/Residential/Mobile Tel, Occupation, Applicant Category tags (Note 2). |
| **B. Area Preferred** | Capture Officer / Applicant | Preferred Province & District, Farm Scale (`Small-scale`, `Medium-scale`, `Large-scale`, `Peri-urban`), Farming Type (`Crops`, `Livestock`, `Crops & Livestock`, `Other`), 5-Year Cash Flow & Training/Resources statement. |
| **C. Declaration** | Applicant | Statutory declaration under Section 38(a) of Chapter 20:01, declarant name, date, and signature verification. |
| **Attachments** | Capture Officer / CLO | National ID (required), 5-Year Cash Flow Projection (required), Proof of Training/Experience, Proof of Funds/Movable Assets, War Veteran Certificate, Marriage Certificate, Signed Form. |
| **D. Government Officials’ Comments** | Provincial Chief Land Officer | Official assessment comments, date & signature; forwards to Committee or raises a Query. Enforces required attachments before forwarding. |
| **E. Land Identification & Resettlement Committee** | Provincial Committee | Committee meeting date, recommended land holding unit, Natural Region (Schedule I), hectare size, Approve / Reject recommendation. |
| **F. Agricultural Land Settlement Board** | National Board | Recommended / Not Recommended decision, date & signature. |
| **G. Minister of Lands & Rural Development** | Minister’s Office | Final Approved / Not Approved decision, date & signature. |

---

## Quick Start

### 1. PostgreSQL Database

Ensure PostgreSQL is running and create the database:

```sql
CREATE DATABASE land_applications;
```

Copy `backend/.env.example` to `backend/.env` and update your PostgreSQL credentials if needed:

```ini
POSTGRES_DB=land_applications
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

### 2. Backend (Django API)

```powershell
cd landapplication\backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

### 3. Frontend (React + Tailwind + shadcn/ui)

```powershell
cd landapplication\frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Seeded Officer Accounts (`python manage.py seed_demo`)

All demo accounts share the password **`Lands@2026`**:

| Username | Officer Name | Role | Scope | Form Stage |
| :--- | :--- | :--- | :--- | :--- |
| `admin` | Tendai Moyo | Administrator | National | All stages + Officer Admin |
| `capture` | Rutendo Chikwanha | Capture Officer | Mashonaland East | Sections A–C + Attachments |
| `clo` | Farai Mutasa | Chief Land Officer | Mashonaland East | Section D |
| `committee` | Nyasha Gumbo | Resettlement Committee | Mashonaland East | Section E |
| `board` | Tafadzwa Ncube | Land Settlement Board | National | Section F |
| `minister` | Chipo Dube | Minister’s Office | National | Section G |

