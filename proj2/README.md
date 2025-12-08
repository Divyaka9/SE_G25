<p align="center">🍽️ <b>ByteBite — Smart Food Ordering & Food Redistribution System</b></p>

<p align="center">

  <!-- DOI -->
  <a href="https://doi.org/10.5281/zenodo.17547336">
    <img src="https://zenodo.org/badge/DOI/10.5281/zenodo.17547308.svg" />
  </a>

  <!-- Code Coverage -->
  <a href="https://codecov.io/gh/Divyaka9/SE_G25">
    <img src="https://codecov.io/gh/Divyaka9/SE_G25/branch/main/graph/badge.svg" />
  </a>

  <!-- ESLint Style Checker -->
  <a href="https://github.com/shreyas457/SE_G25/actions/workflows/lint.yml">
    <img src="https://github.com/shreyas457/SE_G25/actions/workflows/lint.yml/badge.svg?branch=feat/env-config" />
  </a>

  <!-- ESLint Syntax Checker -->
  <a href="https://github.com/shreyas457/SE_G25/actions/workflows/lint.yml">
    <img src="https://github.com/shreyas457/SE_G25/actions/workflows/lint.yml/badge.svg?branch=feat/env-config" />
  </a>

  <!-- Prettier Formatter -->
  <a href="https://github.com/shreyas457/SE_G25/actions/workflows/format.yml">
    <img src="https://github.com/shreyas457/SE_G25/actions/workflows/format.yml/badge.svg?branch=feat/env-config" />
  </a>

  <!-- License -->
  <a href="#">
    <img src="https://img.shields.io/badge/License-MIT-green" />
  </a>

</p>


<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" width="45"/>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg" width="45"/>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" width="45"/>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" width="45"/>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg" width="45"/>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" width="45"/>
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg" width="45"/>
</p>

---

## 🧩 Overview

**ByteBite** is an intelligent food ordering, redistribution, and donation platform built with a full MERN stack and multiple dashboards for customers, restaurant admins, and shelters.

The system seamlessly integrates:

✔ Customer Ordering System (Food App)  
✔ Veg / Non-Veg Preference Filtering
✔ Restaurant Admin Dashboard  
✔ Driver Dashboard for Order Deliveries 
✔ Shelter Dashboard for Donations  
✔ Real-time Redistribution Queue  
✔ 3D Menu Item Visualization  
✔ Automated CI • Testing • Code Quality Tools  

ByteBite reduces food waste by enabling unused/cancelled meals to be claimed or donated efficiently.

---

## 🍽️ Core Functionalities

### **1️⃣ Customer Ordering (Food App)**  
- User registration and login  
- Browse menu with Veg / Non-Veg preferences and add items to cart  
- Place orders via:  
  - Stripe integration  
  - Cash-on-delivery  
- Track real-time order statuses:  
  `Food Processing → Out for Delivery → Delivered → Redistribute → Claimed → Cancelled`

---

### **2️⃣ Cancellation → Redistribution Queue**
When a user cancels an order:
- It enters **Redistribute** state  
- Other customers receive **real-time notifications**  
- They can **claim** the order  
- Ownership is reassigned to the new claimant  
- Order returns to "Food Processing" under the new owner  

This ensures food does not go to waste.

---

### **3️⃣ Restaurant → Shelter Donation**
Restaurants can donate food to partner shelters:
- Validate order eligibility  
- Assign to a shelter  
- Record donation in `reroutes` collection  
- Shelters receive the donation and update status  
- Donation history is viewable for audits  

---

### **4️⃣ Driver Dashboard (Delivery Workforce)**
The Driver Dashboard enables smooth order delivery management:
- Drivers authenticate with secure login  
- View all assigned deliveries  
- Update delivery stage:
  - **Delivered**  
- Real-time sync with customer order tracking  
- Reduce manual admin workload by automating delivery updates  

---

### **4️⃣ 3D Menu Visualization**
Optional 3D models per dish using:  
- **Three.js**  
- **@react-three/fiber**  
- **@react-three/drei**  

Enhances the customer's browsing experience.

---

## ⚙️ Development Tools & Automation

### 🧪 Testing
- **Jest** — backend unit & integration tests  
- **Vitest** — frontend & dashboard testing  
- Automated coverage exporting  

### 🔍 Style & Syntax
- **ESLint**  
- **Prettier**  
- `.prettierignore`, `.eslintrc` per app  

### 🚀 Continuous Integration (GitHub Actions)
Runs automatically on each push:
- Lint  
- Tests  
- Build artifacts for:
  - Food App  
  - Admin Dashboard  
  - Shelter Dashboard  

---

## 🏗 Repository Structure

```
proj2/
│
├── backend/                # Express.js API
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   ├── test/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
├── food-app/               # Customer-facing React app
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── styles/
│   │   └── utils/
│   ├── vite.config.js
│   └── package.json
│
├── admin-dashboard/        # Restaurant admin app
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── styles/
│   │   └── utils/
│   ├── vite.config.js
│   └── package.json
│
├── shelter-dashboard/      # Shelter donation management app
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── styles.css
│   ├── vite.config.js
│   └── package.json
│
├── scripts/
│   └── generate-docs.js
│
├── tests/
├── API.md
├── GETTING_STARTED.md
├── ENV_TEMPLATE.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── CHANGLOG.md
├── LICENSE
├── README.md
└── package.json
```

---

## 🎥 Demo 

[![Watch the demo](https://img.youtube.com/vi/1IyLCHuaQmE/hqdefault.jpg)](https://youtu.be/1IyLCHuaQmE)

---

## 👥 Contributors

We separate previous contributors from new contributors.

### 🧓 Previous Contributors (Original ByteBite Team)

| Name | Unity ID |
|------|--------|
| Smruthi Bangalore Thandava Murthy | sbangal6 |
| Vineeta Vishwas Bhujle | vbhujle |
| Swasti Sadanand | ssadana |
| Shreyas Raviprasad | sravipr |

---

### 🆕 New Contributors (Our Team)

| Name | Unity ID |
|------|--------|
| Soham Sarang Deshpande | sdeshpa5 |
| Divya Kannan | dkannan2 |
| Tejas Pavular Ramesh | tpavula |
| Mahek Kantharia | mrkantha |

---

## 🛠 Work Completed by Our Team

1. **Driver Dashboard** - Built a Driver Dashboard that lets drivers view “Ready for Pickup” orders, manage accepted and out-for-delivery orders, and seamlessly mark deliveries as completed.
2. **Shelter Dashboard** - Built a Shelter Dashboard that allows shelters to accept or decline donation requests and view their donation history, including all past fulfilled orders.
3. **Preference Filters** -  Lets customers tag preferences (Veg / No Sugar) so notifications stay meaningful and targeted.
4. **Enhanced UI experienced** - Implemented dynamic menu-item filtering and optimizing dashboard layout and responsiveness.

---

## 🚧 Future Enhancements

- Real-time driver tracking  
- Unified login system (SSO across dashboards)  
- AI-based redistribution recommendations  
- Admin analytics dashboard  
- Mobile PWA support  
- Automated donation batching  

---

## 📦 Running Production Builds

### 1️⃣ Start Backend
```bash
cd backend
npm install
npm run server
```

### 2️⃣ Start Food App Build
```bash
cd frontend
npm install
npm run dev
```

### 3️⃣ Start Admin Dashboard Build
```bash
cd admin
npm install
npm run dev
```

### 4️⃣ Start Shelter Dashboard Build
```bash
cd shelter-dashboard
npm install
npm run dev
```

---

## 📜 License

This project is licensed under the MIT License.

---

## 💬 Feedback

We welcome feature requests, bug reports, and contributions.

---

<p align="center"><i>🥡 "Reduce waste. Redistribute smartly. Feed communities — one byte at a time."</i></p>
