# 📚 Shelf Swap – Second-Hand Textbook Exchange

> **DBMS Project**: A peer-to-peer university textbook exchange platform engineered with **Node.js**, **Express**, **MongoDB (Mongoose)**, and **React (Vite)**. Features specialized database indexing, text search weighting, atomic state transitions, and concurrency control.

---

## 🌟 Key Features

- **Course & Semester Cataloging**: Filter and browse listings by normalized course code (e.g., `CS201`, `MA101`) and academic term.
- **Full-Text Relevance Search**: MongoDB `$text` search with weighted fields across book title, course code, author, and description.
- **Request & Exchange State Machine**: Multi-stage reservation workflow (`pending` → `accepted` / `rejected` / `cancelled` → `exchanged`).
- **Atomic Concurrency Control**: Prevents double-booking via atomic status guards (`findOneAndUpdate`) when multiple users request the same book.
- **Privacy by Design**: Student contact information (email) remains masked until a book owner officially accepts an exchange request.

---

## 🗄️ Database Architecture & Design

### Entity Relationship & Schemas

```
┌─────────────────────────┐          1:N          ┌─────────────────────────┐
│          User           │ ───────────────────── │          Book           │
├─────────────────────────┤                       ├─────────────────────────┤
│ _id: ObjectId           │                       │ _id: ObjectId           │
│ name: String            │                       │ title: String (max 150) │
│ email: String (unique)  │                       │ author: String          │
│ passwordHash: String    │                       │ courseCode: String      │
│ createdAt / updatedAt   │                       │ semester: String        │
└─────────────────────────┘                       │ condition: enum         │
             │                                    │ price: Number           │
             │ 1:N                                │ status: enum            │
             ▼                                    │ owner: Ref(User)        │
┌─────────────────────────┐                       │ reservedFor: Ref(User)  │
│         Request         │                       └─────────────────────────┘
├─────────────────────────┤                                    ▲
│ _id: ObjectId           │                                    │ 1:N
│ book: Ref(Book)         │ ───────────────────────────────────┘
│ owner: Ref(User)        │
│ requester: Ref(User)    │
│ message: String         │
│ status: enum            │
└─────────────────────────┘
```

### 🚀 Indexing Strategy & Optimizations

| Target Collection | Index Definition | Type & Purpose |
| :--- | :--- | :--- |
| **`books`** | `{ title: 'text', courseCode: 'text', author: 'text', description: 'text' }`<br>Weights: `title: 10, courseCode: 6, author: 3, description: 1` | **Weighted Full-Text Index (`book_text`)**: Powers natural keyword search sorted by relevance score (`$meta: 'textScore'`). |
| **`books`** | `{ courseCode: 1, semester: 1, status: 1 }` | **Compound Index**: Optimizes anchored prefix regex queries (e.g. `^CS`) combined with semester and status filters. |
| **`books`** | `{ status: 1, createdAt: -1 }`<br>`{ owner: 1, createdAt: -1 }` | **Sorting & Filtering Indexes**: Enables fast paginated listing and dashboard queries without in-memory sort. |
| **`requests`** | `{ book: 1, requester: 1 }`<br>`partialFilterExpression: { status: 'pending' }` | **Partial Unique Index**: Guarantees at most **one active/pending request per student per book**, while preserving historical cancelled/rejected records. |
| **`requests`** | `{ owner: 1, status: 1, createdAt: -1 }`<br>`{ requester: 1, createdAt: -1 }` | **Lookup Indexes**: Fast incoming & outgoing request resolution for user dashboards. |

---

## 🔄 Concurrency & Atomic State Machine

The transaction flow prevents race conditions (two students accepting or reserving the same book simultaneously) without heavyweight distributed locks:

```
[Available] ──(Student requests)──> [Pending Request]
     │                                      │
     │ (Owner accepts request)              │ (Owner rejects or
     ▼                                      │  Student cancels)
[Reserved] <────────────────────────────────┘
     │
     │ (Owner confirms hand-off)
     ▼
[Exchanged]
```

1. **Atomic Guard on Accept**:
   ```javascript
   // Atomic status check prevents two concurrent accepts from winning:
   const book = await Book.findOneAndUpdate(
     { _id: r.book, owner: req.userId, status: 'available' },
     { status: 'reserved', reservedFor: r.requester }
   );
   if (!book) return res.status(409).json({ error: 'This book has already been reserved.' });
   ```
2. **Auto-Rejection**: Once an owner accepts one request, competing pending requests for that book are atomically marked `rejected`.
3. **Rollback on Cancel**: If a requester withdraws an already accepted request, the book status reverts to `available`.

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Register a new user | No |
| `POST` | `/api/auth/login` | Login and obtain JWT token | No |

### Book Catalog
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/books` | Search & filter books (`?q=&course=&semester=&page=`) | No |
| `GET` | `/api/books/facets` | Unique courses and semesters for dropdowns | No |
| `GET` | `/api/books/mine` | List books posted by current user | Yes |
| `POST` | `/api/books` | Create a new book listing | Yes |
| `DELETE` | `/api/books/:id` | Remove a book listing | Yes |
| `POST` | `/api/books/:id/complete`| Mark exchange complete (`reserved` → `exchanged`) | Yes |

### Requests & Exchanges
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/books/:id/requests`| Request a book | Yes |
| `GET` | `/api/requests/incoming` | View incoming requests for owned books | Yes |
| `GET` | `/api/requests/outgoing` | View requests sent by the logged-in user | Yes |
| `POST` | `/api/requests/:id/accept` | Accept a pending request (reserves book) | Yes |
| `POST` | `/api/requests/:id/reject` | Reject a pending request | Yes |
| `POST` | `/api/requests/:id/cancel` | Cancel/withdraw a request | Yes |

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens), bcryptjs
- **Frontend**: React 18, Vite, Vanilla CSS
- **Orchestration**: Concurrently (runs API & client simultaneously)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas cluster)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/sanskrutee99/DBMS-Project.git
cd DBMS-Project
npm install && npm run install:all
```

### 2. Environment Setup
Configure your environment in `server/.env` (see `server/.env.example`):
```env
MONGO_URI=mongodb://127.0.0.1:27017/book_exchange
JWT_SECRET=your_super_secret_jwt_key
PORT=5000
```
*(If using MongoDB Atlas, make sure your IP is whitelisted in Network Access and replace `MONGO_URI` with your connection string).*

### 3. (Optional) Seed Demo Data
Populate demo books and users:
```bash
npm --prefix server run seed
```

**Demo Accounts:**
- `asha@uni.edu` (Password: `password`)
- `ravi@uni.edu` (Password: `password`)

### 4. Run the Application
Start both the API server and Vite client concurrently:
```bash
npm run dev
```

- **Client App**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:5000](http://localhost:5000)

---

## 🔍 Database Verification & Query Profiling

You can inspect and verify the MongoDB indexes in `mongosh`:

```javascript
use book_exchange

// List all created indexes on the books collection
db.books.getIndexes()

// Verify that course queries use an index scan (IXSCAN)
db.books.find({ courseCode: /^CS2/ }).explain("executionStats")

// Verify text search scoring
db.books.find({ $text: { $search: "algorithms" } }, { score: { $meta: "textScore" } })
```

---

## 📄 License
This project is open-source and created as part of the Database Management Systems (DBMS) curriculum.
