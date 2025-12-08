import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import userRouter from "./routes/userRoute.js";
import foodRouter from "./routes/foodRoute.js";
import "dotenv/config";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import shelterRouter from "./routes/shelterRoute.js";
import shelterPortalRoutes from "./routes/shelterPortalRoutes.js";
import shelterAuthRoute from "./routes/shelterAuthRoute.js";
import { createServer } from "http";
import { Server } from "socket.io";
import rerouteRouter from "./routes/rerouteRoute.js";

import userModel from "./models/userModel.js";

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
].filter(Boolean);

const app = express();
const port = process.env.PORT || 4000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// socketId -> userId
let connectedUsers = new Map();

// notification queue
let notificationQueue = [];
let isProcessingNotification = false;
let currentNotificationIndex = 0;
let eligibleUsers = [];
let currentNotificationTimeout = null;
let claimedOrders = new Set();

// ---------- HELPERS ----------

// veg-only detection
// veg-only detection
function isVegOnlyOrder(orderItems = []) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return true;

  return orderItems.every((item) => {
    if (!item) return true;

    // 1) explicit boolean flag wins if present
    if (typeof item.isVeg === "boolean") {
      return item.isVeg === true;
    }

    // 2) category / type string
    const rawCat = (item.category || item.type || "").toString();
    const cat = rawCat.toLowerCase();
    const catCompact = rawCat.replace(/\s+/g, "").toLowerCase(); // "Non Veg" -> "nonveg"

    // 🚫 clearly non-veg categories
    if (
      cat.includes("non veg") || // "Non Veg"
      cat.includes("non-veg") || // "Non-Veg"
      catCompact === "nonveg" || // "NonVeg"
      catCompact.startsWith("nonveg") || // "NonVeg Starters"
      cat === "nv" // short form
    ) {
      return false;
    }

    // otherwise assume veg by default
    return true;
  });
}

// sweet / dessert detection
// treats anything in categories "Cake" / "Deserts" / "Desserts" as sweets
//   + name-based safety net for things like Gelato, Baklava, Tiramisu, etc.
function orderHasSweets(orderItems = []) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return false;

  return orderItems.some((item) => {
    if (!item) return false;

    const catRaw = (item.category || item.section || item.type || "")
      .toString()
      .toLowerCase();

    const nameRaw = (item.name || "").toString().toLowerCase();

    // Category-based: all items under Cake / Deserts / Desserts tabs
    const categoryIsSweet = [
      "cake",
      "cakes",
      "dessert",
      "desserts",
      "desert",
      "deserts", // handles your tab label typo "Deserts"
      "sweets",
      "sweet",
    ].some((k) => catRaw.includes(k));

    // Name-based: fallback if category is missing / inconsistent
    const nameLooksSweet =
      /cake|dessert|ice cream|ice-cream|gelato|baklava|tiramisu|pastry|pudding|sweet/i.test(
        nameRaw
      );

    return categoryIsSweet || nameLooksSweet;
  });
}

function distanceInKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------- QUEUE PROCESSING ----------

const processNotificationQueue = async () => {
  if (notificationQueue.length > 0 && !isProcessingNotification) {
    isProcessingNotification = true;
    currentNotificationIndex = 0;

    const notification = notificationQueue[0];

    const orderLat = notification.addressLat
      ? parseFloat(notification.addressLat)
      : NaN;
    const orderLng = notification.addressLng
      ? parseFloat(notification.addressLng)
      : NaN;

    const USE_LOCATION = !Number.isNaN(orderLat) && !Number.isNaN(orderLng);

    const RADIUS_KM = 10;

    if (claimedOrders.has(notification.orderId)) {
      console.log(`Order ${notification.orderId} already claimed, skipping`);
      notificationQueue.shift();
      isProcessingNotification = false;
      await processNotificationQueue();
      return;
    }

    // diet side
    let vegOnly;
    if (notification.foodCategory === "veg") {
      vegOnly = true;
    } else if (
      notification.foodCategory === "nonveg" ||
      notification.foodCategory === "mixed"
    ) {
      vegOnly = false;
    } else {
      vegOnly = isVegOnlyOrder(notification.orderItems || []);
    }

    // sugar side
    const hasSweets = orderHasSweets(notification.orderItems || []);

    // treat desserts as veg for diet filter
    if (hasSweets && vegOnly === false) {
      console.log(
        `Dessert detected for order ${notification.orderId}; treating as veg-only for diet filter`
      );
      vegOnly = true;
    }

    console.log(
      `Processing order ${notification.orderId} -> vegOnly=${vegOnly}, hasSweets=${hasSweets}, foodCategory=${notification.foodCategory}`
    );

    const allConnectedUserIds = Array.from(connectedUsers.values()).filter(
      (uid) => uid !== notification.cancelledByUserId
    );

    if (allConnectedUserIds.length === 0) {
      console.log("No connected users to notify.");
      notificationQueue.shift();
      isProcessingNotification = false;
      await processNotificationQueue();
      return;
    }

    const uniqueIds = [...new Set(allConnectedUserIds)];

    const users = await userModel
      .find({ _id: { $in: uniqueIds } })
      .select("_id dietPreference sugarPreference address")
      .lean();

    const allowedUserIds = new Set(
      users
        .filter((u) => {
          const diet = (u.dietPreference || "any").toLowerCase();

          // super-forgiving match: any string containing both "no" and "sweet"
          const sugarRaw = (u.sugarPreference || "any")
            .toString()
            .toLowerCase();
          const sugarIsNoSweets =
            sugarRaw.includes("no") && sugarRaw.includes("sweet");

          // diet rule
          if (!vegOnly && diet === "veg-only") {
            return false;
          }

          // sugar rule
          if (hasSweets && sugarIsNoSweets) {
            return false;
          }

          // ⭐ NEW: distance rule (only if order has coords)
          if (USE_LOCATION) {
            const addr = u.address || {};
            const uLat = addr.lat !== undefined ? parseFloat(addr.lat) : NaN;
            const uLng = addr.lng !== undefined ? parseFloat(addr.lng) : NaN;

            if (Number.isNaN(uLat) || Number.isNaN(uLng)) {
              // no user coords -> skip them for location-based push
              return false;
            }

            const distKm = distanceInKm(orderLat, orderLng, uLat, uLng);
            if (distKm > RADIUS_KM) {
              return false;
            }
          }

          return true;
        })
        .map((u) => u._id.toString())
    );

    eligibleUsers = Array.from(connectedUsers.entries())
      .filter(([socketId, userId]) => allowedUserIds.has(String(userId)))
      .map(([socketId]) => socketId);

    console.log(
      `Eligible sockets (diet + sugar aware): ${eligibleUsers.length}`
    );

    if (eligibleUsers.length === 0) {
      notificationQueue.shift();
      isProcessingNotification = false;
      await processNotificationQueue();
      return;
    }

    showNotificationToNextUser(notification);
  }
};

const showNotificationToNextUser = (notification) => {
  if (claimedOrders.has(notification.orderId)) {
    console.log(`Order ${notification.orderId} was claimed, stopping queue`);
    notificationQueue.shift();
    isProcessingNotification = false;
    processNotificationQueue();
    return;
  }

  if (currentNotificationIndex < eligibleUsers.length) {
    const socketId = eligibleUsers[currentNotificationIndex];

    console.log(
      `Showing notification to user ${
        currentNotificationIndex + 1
      }/${eligibleUsers.length}`
    );

    io.to(socketId).emit("orderCancelled", notification);

    currentNotificationIndex++;

    currentNotificationTimeout = setTimeout(() => {
      showNotificationToNextUser(notification);
    }, 5000);
  } else {
    notificationQueue.shift();
    isProcessingNotification = false;
    processNotificationQueue();
  }
};

const stopNotificationForOrder = (orderId) => {
  claimedOrders.add(orderId);

  if (currentNotificationTimeout) {
    clearTimeout(currentNotificationTimeout);
    currentNotificationTimeout = null;
  }

  if (isProcessingNotification) {
    notificationQueue.shift();
    isProcessingNotification = false;
    processNotificationQueue();
  }
};

const queueNotification = (notification) => {
  notificationQueue.push(notification);
  processNotificationQueue();
};

// expose helpers
app.set("socketio", io);
app.set("queueNotification", queueNotification);
app.set("stopNotificationForOrder", stopNotificationForOrder);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (userId) => {
    if (!userId) return;
    connectedUsers.set(socket.id, userId);
    console.log(`User ${userId} registered with socket ${socket.id}`);
    console.log("Total connected users:", connectedUsers.size);
  });

  socket.on("claimOrder", (data) => {
    const { orderId, userId } = data;
    console.log(`User ${userId} claimed order ${orderId}`);
    stopNotificationForOrder(orderId);
    io.emit("orderClaimed", { orderId, userId });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    connectedUsers.delete(socket.id);
    console.log("Total connected users:", connectedUsers.size);
  });
});

app.use(express.json());
app.use(cors());

connectDB();

app.use("/api/user", userRouter);
app.use("/api/food", foodRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/shelters", shelterRouter);
app.use("/api/reroutes", rerouteRouter);
app.use("/api/shelter", shelterPortalRoutes);
app.use("/api/shelter-auth", shelterAuthRoute);

app.get("/", (req, res) => {
  res.send("API Working");
});

httpServer.listen(port, () =>
  console.log(`Server started on http://localhost:${port}`)
);
