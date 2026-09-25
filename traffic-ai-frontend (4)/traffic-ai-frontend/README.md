# SignalSync — AI Traffic Management Platform (React JSX)

A modern, responsive React + TypeScript + Vite web application for intelligent urban traffic management and real-time signal control.

---

## 🚀 Quick Start in VS Code

### 1. Open the project in VS Code
Open your terminal or command prompt and run:
```bash
code "C:\Users\HP\.gemini\antigravity\scratch\signalsync-react"
```
*(Or open `C:\Users\HP\.gemini\antigravity\scratch\traffic-ai-frontend`)*

### 2. Start the development server
Inside the VS Code terminal (`Ctrl + \``):
```bash
npm run dev
```
Then open your browser at the displayed local URL (typically **`http://localhost:5173/`**).

---

## 🚦 Key Architecture & Traffic Engineering Features

### 1. Real-World Indian 4-Stage Split Phasing (Situation 1)
- **100% Zero-Conflict Traversal**:
  - **Stage 1 (South Arm Green)**: S→N (Through), S→E (Right Turn), S→W (Left Turn) move simultaneously. North, East, and West are held on strict RED.
  - **Stage 2 (North Arm Green)**: N→S (Through), N→W (Right Turn), N→E (Left Turn) move simultaneously. South, East, and West are held on strict RED.
  - **Stage 3 (East Arm Green)**: E→W (Through), E→N (Right Turn), E→S (Left Turn) move simultaneously. North, South, and West are held on strict RED.
  - **Stage 4 (West Arm Green)**: W→E (Through), W→S (Right Turn), W→N (Left Turn) move simultaneously. North, South, and East are held on strict RED.
- **Safety Clearances**: 3.0s Yellow clearance interval + 1.5s All-Red clearance gap between every phase transition.
- **Exact Single Signal Head**: Exactly one arm's signal head is green/yellow at any moment; all other 3 arms remain strictly illuminated on RED.

### 2. Stop Line Accuracy & Zero Overshoot
- **Stop line coordinates**: North (248px), South (248px), East (448px), West (448px).
- Vehicles strictly halt 9–14px *before* the white stop line, keeping pedestrian zebra crossings completely unobstructed.
- Stopped cars never launch during Yellow clearance.

### 3. Dedicated Simulation Lab & Views
- **Junction Simulation Lab** (`/app/junction`): Dedicated medium canvas (480px height), live 12-movement conflict status matrix table, approach sensor telemetry, and traffic arrival rate demand sliders.
- **Corridor Operations Command Center** (`/app/dashboard`): 4-junction monitored matrix (Gandhipuram Central J1, Lakeview Cross J2, Avinashi Junction J3, Mill Road Gate J4), SVG progression map, KPIs, queue bars, and 15-min congestion forecast.
- **Landing Page**: Clean hero with live simulation canvas, throughput counters, problem statement, and "Sign in" CTA (redundant demo buttons removed).
- **Login Page**: Clean credentials login (`ops@signalsync.city` / `demo1234`) with ambient animated canvas.
- **Settings Page**: User Details profile form only (Full Name, Work Email, Role, Department, Employee ID, Phone, Save button).

---

## 📦 Tech Stack
- **Framework**: React 19 (JSX / TSX)
- **Build Tool**: Vite 8
- **Language**: TypeScript
- **Styling**: SignalSync Custom CSS Design System + Inter Font
- **Icons**: Handcrafted lightweight SVG vectors
- **Charts**: Native SVG Area Charts with zero overhead
