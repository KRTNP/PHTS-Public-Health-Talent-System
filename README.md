# PHTS - Public Health Talent System

**ระบบบริหารจัดการเงินเพิ่มสำหรับตำแหน่งที่มีเหตุพิเศษ (พ.ต.ส.)**

An enterprise-grade compensation management platform designed specifically for Thai public healthcare facilities. PHTS automates the complex calculation of "Special Position Allowances" (P.T.S.), streamlining the workflow from individual requests to monthly payroll execution while ensuring strict compliance with Civil Service Commission regulations.

## System Overview

Transitioning from error-prone manual spreadsheets to a centralized digital solution, PHTS integrates directly with existing HRMS databases. It features a robust calculation engine capable of handling intricate leave deductions, license validations, and retroactive payment adjustments across fiscal years.

**Key Capabilities:**
* **Precision Payroll Engine:** Implements "Daily Accumulation" logic to calculate allowances with 100% accuracy, automatically deducting payments when leave quotas are exceeded (e.g., Sick Leave > 60 days, Personal Leave > 45 days).
* **Smart Retroactive System:** Automatically detects late approvals and calculates "Retroactive Payments" (ตกเบิก), handling cross-month logic and debt recovery without human intervention.
* **5-Stage Approval Workflow:** A rigorous state-machine driven workflow (Head Dept $\to$ Officer $\to$ HR $\to$ Finance $\to$ Director) ensures every baht is auditable.
* **Secure Digital Signature:** Replaces paper trails with secure Electronic Signatures, timestamped and logged for full auditability.
* **Role-Based Access Control (RBAC):** Tailored dashboards for 8 distinct user roles, ensuring data security and privacy.

## Technical Architecture

The system utilizes a Decoupled Architecture to separate complex business logic from the user interface:

1.  **Frontend (Next.js):** A responsive interface built with App Router and Material UI v5, focusing on a professional "Medical Clean" aesthetic.
2.  **Backend (Express/Node.js):** A stateless RESTful API powered by TypeScript. It handles the core calculation service and manages the approval state machine.
3.  **Data Layer (MySQL):** Stores transactional data (`pts_system`) while syncing read-only personnel and leave data from the legacy HRMS (`hrms_databases`).

## Technology Stack

**Frontend & Interface**
![Next.js](https://img.shields.io/badge/-Next.js-000000?style=flat&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![MUI](https://img.shields.io/badge/-MUI_v5-007FFF?style=flat&logo=mui&logoColor=white)
![SweetAlert2](https://img.shields.io/badge/-SweetAlert2-EF2D5E?style=flat&logo=sweetalert2&logoColor=white)

**Backend & Infrastructure**
![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/-Express-000000?style=flat&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/-MySQL-4479A1?style=flat&logo=mysql&logoColor=white)
![Passport.js](https://img.shields.io/badge/-Passport.js-34E27A?style=flat&logo=passport&logoColor=white)
![Docker](https://img.shields.io/badge/-Docker-2496ED?style=flat&logo=docker&logoColor=white)

## Getting Started

### Prerequisites
* Node.js (v18+ LTS)
* MySQL (v8.0+)
* Connection to HRMS Database (Read-Replica recommended)

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/yourusername/phts-public-health-talent-system.git](https://github.com/yourusername/phts-public-health-talent-system.git)
    cd phts-public-health-talent-system
    ```

2.  **Setup Backend Service**
    Navigate to the `backend` directory:
    ```bash
    cd backend
    npm install
    ```
    Create `.env` file and configure database connections (both PHTS and HRMS):
    ```env
    DB_HOST=localhost
    DB_USER=root
    DB_PASS=password
    DB_NAME_PHTS=phts_system
    DB_NAME_HRMS=hrms_databases
    JWT_SECRET=your_secret_key
    ```
    Run migrations and start the server:
    ```bash
    npm run migrate
    npm run dev
    ```

3.  **Setup Frontend Application**
    Navigate to the `frontend` directory:
    ```bash
    cd ../frontend
    npm install
    npm run dev
    ```

4.  **Access the Application**
    Open `http://localhost:3000`. Default admin credentials (for dev): `admin` / `password`.

## Core Modules

The system is composed of several specialized modules handling specific business domains:

* **Request Management:** Handles new enrollments (`NEW`), info updates (`UPDATE_INFO`), and rate changes (`CHANGE_RATE`). Supports file attachments (PDF/JPG) for evidence.
* **Payroll Calculator:** The heart of PHTS. It processes "Eligible Days" by cross-referencing valid license dates with the leave history to compute the exact payout.
* **Report Generator:** Uses `exceljs` to produce the "Monthly Detail Report" and "Payment Summary Sheet" formatted strictly for financial department processing.

## License

This project is proprietary software developed for internal use within Public Health facilities.
