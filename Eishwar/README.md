# Apparel Manufacturing Workflow Management System

A comprehensive system for managing end-to-end apparel manufacturing workflows from cutting through payments.

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │    Database     │
│   (React+Vite)  │◄──►│   (FastAPI)     │◄──►│   (SQLite)      │
│                 │    │                 │    │                 │
│ • Master Data   │    │ • REST APIs     │    │ • Master Tables │
│ • Cutting UI    │    │ • WebSocket     │    │ • Transaction   │
│ • QC Dashboard  │    │ • QR/Barcode    │    │   Tables        │
│ • Payments      │    │ • Business      │    │ • Relationships │
│                 │    │   Logic         │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
apparel-manufacturing/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── master.py
│   │   │   ├── cutting.py
│   │   │   ├── stitching.py
│   │   │   └── payment.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── master_data.py
│   │   │   ├── cutting.py
│   │   │   ├── stitching.py
│   │   │   ├── qc.py
│   │   │   └── payments.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── master.py
│   │   │   ├── cutting.py
│   │   │   ├── stitching.py
│   │   │   └── payment.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── cutting_service.py
│   │   │   ├── qr_service.py
│   │   │   └── payment_service.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── barcode_generator.py
│   │       └── qr_generator.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
└── docs/
    └── api_documentation.md
```

## 🚀 Quick Start

### Backend Setup

1. **Create virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the backend:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

## 🔄 Workflow States

| Entity | States |
|--------|--------|
| Delivery Challan (DC) | Open / Partial / Hold / Cleared |
| Bundle | Created / Dispatched / Returned |
| Payment | Pending / Cleared |

## 🌟 Key Features

- **Master Data Management**: Bulk upload and manage categories, styles, colors, sizes
- **Cutting Program**: Ratio-based cutting with barcode generation
- **Stitching Management**: DC creation with QR codes and unit tracking
- **Quality Control**: Scan-based QC with match/mismatch logic
- **Payment Processing**: Auto-calculation with rate tables and status tracking
- **Mobile Responsive**: Optimized for shop-floor tablet and mobile usage

## 🔧 API Endpoints

- **Master Data**: `/api/v1/master/`
- **Cutting**: `/api/v1/cutting/`
- **Stitching**: `/api/v1/stitching/`
- **QC**: `/api/v1/qc/`
- **Payments**: `/api/v1/payments/`

API documentation available at: `http://localhost:8000/docs`

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm run test
```

## 📊 Database Migration

The system uses SQLite for development with easy migration to PostgreSQL/MySQL:

1. Update database URL in `.env`
2. Install appropriate database driver
3. Run migrations: `alembic upgrade head`

## 🔒 Security

- JWT authentication for API access
- Role-based permissions
- Input validation and sanitization
- SQL injection protection via SQLModel

## 📱 Mobile Features

- Touch-friendly interface
- Camera QR/barcode scanning
- Offline capability with sync
- Responsive design for all screen sizes