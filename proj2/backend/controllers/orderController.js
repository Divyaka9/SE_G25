import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import shelterModel from "../models/shelterModel.js";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
import rerouteModel from "../models/rerouteModel.js";

// config variables
const currency = "usd";
const deliveryCharge = 5;
const frontend_URL = "http://localhost:5173";

// ⭐ discount for claimed orders: 33% off (15 -> 10)
const CLAIM_DISCOUNT_RATE = 1 / 3;

// Status constants & FSM rules
const STATUS = {
  PROCESSING: "Food Preparing",
  LOOKING_FOR_DRIVER: "Looking for driver",
  DRIVER_ASSIGNED: "Driver assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  REDISTRIBUTE: "Redistribute",
  CANCELLED: "Cancelled",
  DONATED: "Donated",
};

const STATUS_VALUES = new Set(Object.values(STATUS));
// Helper to match a status string against the known ones (case/space insensitive)
const normalizeStatus = (value) => (value || "").trim().toLowerCase();

const canonicalizeStatus = (value) => {
  const norm = normalizeStatus(value);
  for (const s of STATUS_VALUES) {
    if (normalizeStatus(s) === norm) return s;
  }
  return null;
};
/**
 * Allowed transitions:
 *
 *  - Food Preparing      -> Looking for driver, Redistribute
 *  - Looking for driver  -> Driver assigned, Redistribute
 *  - Driver assigned     -> Out for delivery, Redistribute
 *  - Out for delivery    -> Delivered, Redistribute
 *  - Redistribute        -> Food Preparing, Cancelled, Donated
 *  - Cancelled           -> Donated
 *  - Delivered, Donated  -> terminal
 */
const ALLOWED_TRANSITIONS = {
  [STATUS.PROCESSING]: new Set([
    STATUS.LOOKING_FOR_DRIVER,
    STATUS.REDISTRIBUTE,
  ]),

  [STATUS.LOOKING_FOR_DRIVER]: new Set([
    STATUS.DRIVER_ASSIGNED,
    STATUS.REDISTRIBUTE,
  ]),

  [STATUS.DRIVER_ASSIGNED]: new Set([
    STATUS.OUT_FOR_DELIVERY,
    STATUS.REDISTRIBUTE,
  ]),

  [STATUS.OUT_FOR_DELIVERY]: new Set([STATUS.DELIVERED, STATUS.REDISTRIBUTE]),

  [STATUS.REDISTRIBUTE]: new Set([
    STATUS.PROCESSING,
    STATUS.CANCELLED,
    STATUS.DONATED,
  ]),

  [STATUS.CANCELLED]: new Set([STATUS.DONATED]),
  [STATUS.DONATED]: new Set(),
  [STATUS.DELIVERED]: new Set(),
};

/**
 * Checks if a status transition is allowed according to the order state machine
 */
const canTransition = (current, next) => {
  if (current === next) return true;
  const allowed = ALLOWED_TRANSITIONS[current];
  return !!allowed && allowed.has(next);
};

/**
 * Try to infer whether an order is veg / non-veg / mixed.
 * This looks at common flags on each item (isVeg / veg / category).
 * If it cannot decide cleanly, it returns "mixed".
 *
 * Returns one of: "veg" | "nonveg" | "mixed"
 */
function getFoodCategoryFromOrder(order) {
  let hasVeg = false;
  let hasNonVeg = false;

  for (const item of order.items || []) {
    if (!item) continue;

    // 1) direct boolean flags commonly used
    let flag = null;
    if (typeof item.isVeg === "boolean") {
      flag = item.isVeg;
    } else if (typeof item.veg === "boolean") {
      flag = item.veg;
    } else if (typeof item.isVegetarian === "boolean") {
      flag = item.isVegetarian;
    }

    // 2) string category like "veg" / "non-veg"
    if (flag === null && typeof item.category === "string") {
      const cat = item.category.toLowerCase();
      if (cat.includes("veg") && !cat.includes("non")) {
        flag = true;
      } else if (cat.includes("non-veg") || cat.includes("non veg")) {
        flag = false;
      }
    }

    if (flag === true) hasVeg = true;
    else if (flag === false) hasNonVeg = true;
  }

  if (hasVeg && !hasNonVeg) return "veg";
  if (hasNonVeg && !hasVeg) return "nonveg";
  return "mixed";
}

/**
 * Cancels an order and moves it to Redistribute status
 * Only allows cancellation if order is in "Food Processing" or "Out for delivery" status
 * Queues a notification for redistribution if notification system is available
 */
const cancelOrder = async (req, res) => {
  try {
    const { orderId, userId } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order) return res.json({ success: false, message: "Order not found" });

    if (order.userId !== userId && order.claimedBy !== userId)
      return res.json({ success: false, message: "Unauthorized" });

    const current = order.status || STATUS.PROCESSING;
    const userCancelable = new Set([
      STATUS.PROCESSING, // Food Preparing
      STATUS.LOOKING_FOR_DRIVER, // Admin has posted it, but no driver yet
    ]);
    if (!userCancelable.has(current))
      return res.json({
        success: false,
        message: `Cannot cancel when status is "${current}".`,
      });

    // When user cancels, move to Redistribute
    order.status = STATUS.REDISTRIBUTE;
    await order.save();

    const queueNotification = req.app.get("queueNotification");
    if (typeof queueNotification === "function") {
      const foodCategory = getFoodCategoryFromOrder(order); // "veg" | "nonveg" | "mixed"

      queueNotification({
        orderId,
        orderItems: order.items,
        cancelledByUserId: userId,
        foodCategory,
        message: "Order cancelled by user; available for redistribution",
        addressLat: order.address?.lat,
        addressLng: order.address?.lng,
      });
    }

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("cancelOrder error:", error);
    res.json({ success: false, message: "Error cancelling order" });
  }
};

/**
 * Allows a user to claim a redistributed order.
 * Applies a discount, transfers ownership, and resets status to Food Processing.
 */
const claimOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const claimerId = req.body.userId;

    const order = await orderModel.findById(orderId);
    if (!order) return res.json({ success: false, message: "Order not found" });

    if (order.status !== STATUS.REDISTRIBUTE)
      return res.json({
        success: false,
        message: "Order not available for claim",
      });

    // Ensure originalAmount exists for older orders
    if (typeof order.originalAmount !== "number") {
      order.originalAmount = order.amount;
    }

    // If this is the first time, preserve who originally created it
    if (!order.originalUserId) {
      order.originalUserId = order.userId;
      order.originalUserName =
        order.address?.name ||
        order.address?.fullName ||
        `${order.address?.firstName || ""} ${
          order.address?.lastName || ""
        }`.trim();
    }

    // Look up claimer's name for admin display
    const claimer = await userModel.findById(claimerId).select("name");
    const claimerName =
      claimer?.name ||
      order.address?.name ||
      order.address?.fullName ||
      `${order.address?.firstName || ""} ${
        order.address?.lastName || ""
      }`.trim();

    // ⭐ Apply discount to the order total for the claimer
    const discountedAmount = Math.round(
      order.originalAmount * (1 - CLAIM_DISCOUNT_RATE)
    );

    // Just to be safe, don't go below 1
    order.amount = Math.max(discountedAmount, 1);

    // transfer ownership
    order.userId = claimerId;
    order.claimedBy = claimerId;
    order.claimedByName = claimerName;
    order.claimedAt = new Date();
    order.status = STATUS.PROCESSING;

    await order.save();

    res.json({
      success: true,
      message: "Order claimed successfully at a discounted price.",
      data: order,
    });
  } catch (error) {
    console.error("claimOrder error:", error);
    res.json({ success: false, message: "Error claiming order" });
  }
};

/**
 * Places a new order with Stripe payment
 * Creates order record and clears user's cart
 * Returns Stripe checkout session URL for payment verification
 */
const placeOrder = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;

    const fullName = address?.firstName
      ? `${address.firstName} ${address.lastName || ""}`.trim()
      : address?.name || address?.fullName || "";

    const newOrder = new orderModel({
      userId,
      items,
      amount,
      originalAmount: amount, // ⭐ base price stored here
      address,
      originalUserId: userId,
      originalUserName: fullName,
    });

    await newOrder.save();
    await userModel.findByIdAndUpdate(userId, { cartData: {} });

    res.json({
      success: true,
      session_url: `${frontend_URL}/verify?success=true&orderId=${newOrder._id}`,
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error });
  }
};

/**
 * Places a new order with Cash on Delivery (COD) payment
 * Creates order record with payment marked as true and clears user's cart
 */
const placeOrderCod = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;

    const fullName = address?.firstName
      ? `${address.firstName} ${address.lastName || ""}`.trim()
      : address?.name || address?.fullName || "";

    const newOrder = new orderModel({
      userId,
      items,
      amount,
      originalAmount: amount, // ⭐ base price stored here
      address,
      payment: true,
      originalUserId: userId,
      originalUserName: fullName,
    });

    await newOrder.save();
    await userModel.findByIdAndUpdate(userId, { cartData: {} });
    res.json({ success: true, message: "Order Placed" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error" });
  }
};

/**
 * Retrieves all orders from the database
 */
const listOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({}).sort({ date: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

/**
 * Retrieves all orders for a specific user
 * Includes both orders created by the user and orders claimed by the user
 */
const userOrders = async (req, res) => {
  try {
    const orders = await orderModel
      .find({
        $or: [{ userId: req.body.userId }, { claimedBy: req.body.userId }],
      })
      .sort({ date: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Error" });
  }
};

/**
 * Updates the status of an order
 */
const updateStatus = async (req, res) => {
  try {
    const { orderId, status: nextRaw } = req.body;

    // Map what admin sent to one of our known status strings
    const next = canonicalizeStatus(nextRaw);

    if (!next) {
      return res.json({
        success: false,
        message: `Invalid status value: "${nextRaw}"`,
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) return res.json({ success: false, message: "Order not found" });

    const current = order.status || STATUS.PROCESSING;

    if (normalizeStatus(current) === normalizeStatus(next)) {
      return res.json({
        success: true,
        message: "Status unchanged",
        data: order,
      });
    }

    if (!canTransition(current, next)) {
      const allowed =
        ALLOWED_TRANSITIONS[current] &&
        Array.from(ALLOWED_TRANSITIONS[current]);
      return res.json({
        success: false,
        message:
          `Illegal transition: "${current}" → "${next}". ` +
          `Allowed: ${allowed && allowed.length ? allowed.join(", ") : "none"}`,
      });
    }

    order.status = next;
    await order.save();
    return res.json({
      success: true,
      message: "Status Updated",
      data: order,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

/**
 * Verifies payment status after Stripe checkout
 */
const verifyOrder = async (req, res) => {
  const { orderId, success } = req.body;
  try {
    if (success === "true") {
      await orderModel.findByIdAndUpdate(orderId, { payment: true });
      res.json({ success: true, message: "Paid" });
    } else {
      await orderModel.findByIdAndDelete(orderId);
      res.json({ success: false, message: "Not Paid" });
    }
  } catch (error) {
    res.json({ success: false, message: "Not Verified" });
  }
};

/**
 * Assigns a cancelled or redistributed order to a shelter
 * Changes order status to "Donated" and creates a reroute record
 */
const assignShelter = async (req, res) => {
  try {
    const { orderId, shelterId } = req.body;

    if (!orderId || !shelterId)
      return res.json({
        success: false,
        message: "orderId and shelterId are required",
      });

    const order = await orderModel.findById(orderId);
    if (!order) return res.json({ success: false, message: "Order not found" });

    const shelter = await shelterModel.findById(shelterId);
    if (!shelter)
      return res.json({ success: false, message: "Shelter not found" });

    const current = order.status || STATUS.PROCESSING;
    if (current !== STATUS.REDISTRIBUTE && current !== STATUS.CANCELLED)
      return res.json({
        success: false,
        message: `Order status is "${current}". Only "Redistribute" or "Cancelled" can be assigned.`,
      });

    if (order.shelter && order.shelter.id)
      return res.json({
        success: true,
        alreadyAssigned: true,
        message: "Order already assigned to a shelter",
        data: order,
      });

    // Move to DONATED state when assigning to shelter
    order.status = STATUS.DONATED;
    order.shelter = {
      id: shelter._id.toString(),
      name: shelter.name,
      contactEmail: shelter.contactEmail,
      contactPhone: shelter.contactPhone,
      address: shelter.address,
    };
    order.donationNotified = false;

    await order.save();

    const shelterAddressLine = shelter.address
      ? [
          shelter.address.street,
          shelter.address.city,
          shelter.address.state,
          shelter.address.zipcode,
          shelter.address.country,
        ]
          .filter(Boolean)
          .join(", ")
      : "";

    await rerouteModel.create({
      orderId: order._id,
      restaurantId: order.restaurantId ?? undefined,
      restaurantName: order.restaurantName ?? undefined,
      shelterId: shelter._id,
      shelterName: shelter.name,
      shelterAddress: shelterAddressLine,
      shelterContactEmail: shelter.contactEmail,
      shelterContactPhone: shelter.contactPhone,
      items: (order.items || []).map((it) => ({
        name: it.name,
        qty: it.quantity ?? it.qty ?? 1,
        price: it.price,
      })),
      total: order.amount ?? order.total,
      status: "pending",
    });

    return res.json({
      success: true,
      message: "Order assigned to shelter and marked as donated",
      data: order,
    });
  } catch (err) {
    console.log("assignShelter error:", err);
    return res.json({ success: false, message: "Error assigning shelter" });
  }
};

/**
 * Allows a user to rate a delivered order and leave optional feedback.
 * Only the owner (or claimer) of the order can rate it, and only when status is Delivered.
 */
const rateOrder = async (req, res) => {
  try {
    const { orderId, rating, feedback } = req.body;
    const userId = req.body.userId; // set by auth middleware

    if (!orderId || rating == null) {
      return res.json({
        success: false,
        message: "orderId and rating are required",
      });
    }

    const numericRating = Number(rating);
    if (
      !Number.isFinite(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.json({
        success: false,
        message: "Rating must be a number between 1 and 5",
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // owner is either original user or claimer
    const ownerId = order.claimedBy || order.userId;
    if (!ownerId || ownerId.toString() !== userId) {
      return res.json({
        success: false,
        message: "You can only rate your own orders",
      });
    }

    if (order.status !== STATUS.DELIVERED) {
      return res.json({
        success: false,
        message: "You can rate an order only after it is delivered",
      });
    }

    order.rating = numericRating;
    order.feedback = (feedback || "").trim() || undefined;
    order.ratedAt = new Date();

    await order.save();

    return res.json({
      success: true,
      message: "Thank you for your feedback",
      data: order,
    });
  } catch (err) {
    console.error("rateOrder error:", err);
    return res.json({
      success: false,
      message: "Error while rating order",
    });
  }
};

const driverAvailableOrders = async (req, res) => {
  try {
    const driverId = req.body.userId; // set by authMiddleware

    // Make sure this user is a driver
    const driver = await userModel.findById(driverId);
    if (!driver || !driver.isDriver) {
      return res.json({
        success: false,
        message: "Only drivers can see available orders",
      });
    }

    // Any order with status "Looking for driver" is considered available.
    // The claim API enforces that only one driver can claim it.
    const orders = await orderModel
      .find({
        status: STATUS.LOOKING_FOR_DRIVER,
      })
      .sort({ date: -1 });

    return res.json({ success: true, data: orders });
  } catch (error) {
    console.error("driverAvailableOrders error:", error);
    return res.json({
      success: false,
      message: "Error fetching orders for driver",
    });
  }
};

// List all orders claimed by the currently logged-in driver
const driverMyOrders = async (req, res) => {
  try {
    const driverId = req.body.userId; // set by authMiddleware

    const orders = await orderModel.find({ driverId }).sort({ date: -1 });

    return res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("driverMyOrders error:", error);
    return res.json({
      success: false,
      message: "Error fetching driver orders",
    });
  }
};

// Driver claims an order to deliver
// Driver claims an order to deliver
const driverClaimOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const driverId = req.body.userId; // from authMiddleware

    // Make sure this user is actually a driver
    const driver = await userModel.findById(driverId);
    if (!driver || !driver.isDriver) {
      return res.json({
        success: false,
        message: "Only drivers can claim orders",
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const current = order.status || STATUS.PROCESSING;

    // Only claimable when admin has set "Looking for driver"
    if (current !== STATUS.LOOKING_FOR_DRIVER) {
      return res.json({
        success: false,
        message: `Order is currently "${current}" and not looking for a driver`,
      });
    }

    // If someone already claimed it, block
    if (order.driverId && order.driverId.toString() !== driverId.toString()) {
      return res.json({
        success: false,
        message: "Order already claimed by another driver",
      });
    }

    // Assign driver and move to Driver assigned
    order.driverId = driverId;
    order.driverName = driver.name;
    order.driverAssignedAt = new Date();
    order.status = STATUS.DRIVER_ASSIGNED;

    await order.save();

    // Notify via Socket.IO (optional, you already had this wiring)
    const io = req.app.get("socketio");
    if (io) {
      io.emit("driver-order-claimed", {
        orderId: order._id.toString(),
        driverId,
        driverName: driver.name,
      });
    }

    return res.json({
      success: true,
      message: "Order claimed successfully",
      data: order,
    });
  } catch (error) {
    console.error("driverClaimOrder error:", error);
    return res.json({
      success: false,
      message: "Error claiming order",
    });
  }
};

// Driver marks an order as delivered
const driverMarkDelivered = async (req, res) => {
  try {
    const { orderId } = req.body;
    const driverId = req.body.userId; // from authMiddleware

    const driver = await userModel.findById(driverId);
    if (!driver || !driver.isDriver) {
      return res.json({
        success: false,
        message: "Only drivers can mark delivery",
      });
    }

    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Ensure this driver is assigned to this order
    if (!order.driverId || order.driverId.toString() !== driverId.toString()) {
      return res.json({
        success: false,
        message: "You are not assigned to this order",
      });
    }

    const current = order.status || STATUS.PROCESSING;

    if (!canTransition(current, STATUS.DELIVERED)) {
      return res.json({
        success: false,
        message: `Cannot mark order as delivered from status "${current}"`,
      });
    }

    order.status = STATUS.DELIVERED;
    order.deliveredAt = new Date();

    await order.save();

    const io = req.app.get("socketio");
    if (io) {
      io.emit("driver-order-delivered", {
        orderId: order._id.toString(),
        driverId,
        driverName: driver.name,
      });
    }

    return res.json({
      success: true,
      message: "Order marked as delivered",
      data: order,
    });
  } catch (error) {
    console.error("driverMarkDelivered error:", error);
    return res.json({
      success: false,
      message: "Error marking order as delivered",
    });
  }
};

// ⬇ ADD THIS in orderController.js (near other handlers)
const userImpact = async (req, res) => {
  try {
    // authMiddleware puts userId into req.body.userId (same as userOrders)
    const userId = req.body.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // 1) orders you cancelled that are in "Redistribute" (waiting to be donated)
    const pendingOrders = await orderModel
      .find({ userId, status: STATUS.REDISTRIBUTE })
      .sort({ date: -1 });

    // 2) orders that reached "Donated"
    const donatedOrders = await orderModel
      .find({ userId, status: STATUS.DONATED })
      .sort({ date: -1 });

    return res.json({
      success: true,

      totalPendingOrders: pendingOrders.length,
      totalDonatedOrders: donatedOrders.length,

      pendingOrders,
      donatedOrders,
    });
  } catch (err) {
    console.error("userImpact error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to compute impact",
    });
  }
};

// ---- Helpers copied from server.js so we can reuse the same rules ----

// Check if an order is veg-only based on item flags / categories
function isVegOnlyOrder(orderItems = []) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return true;

  return orderItems.every((item) => {
    if (!item) return true;

    // 1) explicit boolean flags win if present
    if (typeof item.isVeg === "boolean") {
      return item.isVeg === true;
    }

    const rawCat = (item.category || item.type || "").toString();
    const cat = rawCat.toLowerCase();
    const catCompact = rawCat.replace(/\s+/g, "").toLowerCase(); // "Non Veg" → "nonveg"

    // 🚫 clearly non-veg categories
    if (
      cat.includes("non veg") ||
      cat.includes("non-veg") ||
      catCompact === "nonveg" ||
      catCompact.startsWith("nonveg") || // e.g. "nonveg starters"
      cat === "nv"
    ) {
      return false;
    }

    // otherwise assume veg by default
    return true;
  });
}

// Detect if an order has sweets / desserts
function orderHasSweets(orderItems = []) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return false;

  return orderItems.some((item) => {
    if (!item) return false;

    const catRaw = (item.category || item.section || item.type || "")
      .toString()
      .toLowerCase();

    const nameRaw = (item.name || "").toString().toLowerCase();

    const categoryIsSweet = [
      "cake",
      "cakes",
      "dessert",
      "desserts",
      "desert",
      "deserts",
      "sweets",
      "sweet",
    ].some((k) => catRaw.includes(k));

    const nameLooksSweet =
      /cake|dessert|ice cream|ice-cream|gelato|baklava|tiramisu|pastry|pudding|sweet/i.test(
        nameRaw
      );

    return categoryIsSweet || nameLooksSweet;
  });
}

// Haversine in km
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

/**
 * GET /api/order/user/available
 * Returns: all Redistribute orders this user is eligible to see
 * Uses the SAME diet + sugar + (optional) distance rules as the notification flow.
 */
const getUserAvailableOrders = async (req, res) => {
  try {
    const userId = req.body.userId; // set by authMiddleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Fetch user preferences + location
    const user = await userModel
      .findById(userId)
      .select("dietPreference sugarPreference address")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const diet = (user.dietPreference || "any").toLowerCase();
    const sugarRaw = (user.sugarPreference || "any").toString().toLowerCase();
    const sugarIsNoSweets =
      sugarRaw.includes("no") && sugarRaw.includes("sweet");

    // User location (from their saved address)
    const uAddr = user.address || {};
    const userLat = uAddr.lat !== undefined ? parseFloat(uAddr.lat) : NaN;
    const userLng = uAddr.lng !== undefined ? parseFloat(uAddr.lng) : NaN;

    const USE_LOCATION = !Number.isNaN(userLat) && !Number.isNaN(userLng);

    const RADIUS_KM = 10; // same idea as notifications

    // All Redistribute orders (only these are claimable via claimOrder)
    const rawOrders = await orderModel
      .find({ status: STATUS.REDISTRIBUTE })
      .sort({ date: -1 });

    const eligible = rawOrders.filter((order) => {
      // Don’t show them their own cancelled order in this list
      if (String(order.userId) === String(userId)) {
        return false;
      }

      const items = order.items || [];

      // diet side
      let vegOnly = isVegOnlyOrder(items);
      const hasSweets = orderHasSweets(items);

      // Treat desserts as veg for diet filter (same as server.js)
      if (hasSweets && vegOnly === false) {
        vegOnly = true;
      }

      // diet rule: veg-only users cannot see clearly non-veg orders
      if (!vegOnly && diet === "veg-only") {
        return false;
      }

      // sugar rule: no-sweets users cannot see orders with sweets
      if (hasSweets && sugarIsNoSweets) {
        return false;
      }

      // distance rule: only if BOTH user + order have coords
      if (USE_LOCATION) {
        const addr = order.address || {};
        const oLat = addr.lat !== undefined ? parseFloat(addr.lat) : NaN;
        const oLng = addr.lng !== undefined ? parseFloat(addr.lng) : NaN;

        if (!Number.isNaN(oLat) && !Number.isNaN(oLng)) {
          const distKm = distanceInKm(userLat, userLng, oLat, oLng);
          if (distKm > RADIUS_KM) {
            return false;
          }
        }
      }

      return true;
    });

    return res.json({
      success: true,
      data: eligible,
    });
  } catch (err) {
    console.error("getUserAvailableOrders error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching available orders",
    });
  }
};

// /**
//  * GET /api/order/user/nearby
//  * Query: lat, lng, radiusKm (optional, default 5)
//  * Returns: orders with status in ["Cancelled", "Redistribute"] within radius
//  */
// const getNearbyCancelledOrders = async (req, res) => {
//   try {
//     const { lat, lng, radiusKm = 5 } = req.query;

//     const latitude = parseFloat(lat);
//     const longitude = parseFloat(lng);
//     const radius = parseFloat(radiusKm) || 5;

//     if (
//       Number.isNaN(latitude) ||
//       Number.isNaN(longitude)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "lat and lng query params are required and must be numbers",
//       });
//     }

//     // Fetch all cancelled/redistribute orders
//     const rawOrders = await orderModel.find({
//       status: { $in: ["Cancelled", "Redistribute"] },
//     });

//     console.log("DEBUG nearby: total cancelled/redistribute orders:", rawOrders.length);

// rawOrders.forEach((o) => {
//   const addr = o.address || {};
//   console.log("DEBUG order raw coords:", {
//     id: o._id.toString(),
//     status: o.status,
//     lat: addr.lat,
//     lng: addr.lng,
//     typeLat: typeof addr.lat,
//     typeLng: typeof addr.lng,
//   });
// });

//     const filtered = rawOrders.filter((o) => {
//   const addr = o.address || {};

//   // parse to numbers even if stored as strings
//   const olat = addr.lat !== undefined ? parseFloat(addr.lat) : NaN;
//   const olng = addr.lng !== undefined ? parseFloat(addr.lng) : NaN;

//   if (Number.isNaN(olat) || Number.isNaN(olng)) {
//     // optional debug
//     // console.log("DEBUG skip (no coords):", o._id.toString(), addr);
//     return false;
//   }

//   const distKm = distanceInKm(latitude, longitude, olat, olng);

//   // optional debug
//   // console.log("DEBUG distance:", { id: o._id.toString(), distKm });

//   return distKm <= radius;
// });

//     return res.json({
//       success: true,
//       data: filtered,
//     });
//   } catch (err) {
//     console.error("Error in getNearbyCancelledOrders:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while fetching nearby cancelled orders",
//     });
//   }
// };

// /**
//  * POST /api/order/user/claim
//  * Body: { orderId }
//  * Logic:
//  *  - Only allow if status in ["Cancelled", "Redistribute"]
//  *  - Atomically set status -> "Donated"
//  *  - No schema changes (no new fields)
//  */
// const claimCancelledOrder = async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     const userId = req.user && req.user.id; // or req.user._id depending on your auth

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User not authenticated",
//       });
//     }

//     if (!orderId) {
//       return res.status(400).json({
//         success: false,
//         message: "orderId is required",
//       });
//     }

//     // get user name for claimedByName
//     const user = await userModel.findById(userId).select("name").lean();
//     const userName = user?.name || "Unknown";

//     // Atomic find + update:
//     // - only if status is still Cancelled/Redistribute
//     // - and not already claimed
//     const updated = await orderModel.findOneAndUpdate(
//       {
//         _id: orderId,
//         status: { $in: ["Cancelled", "Redistribute"] },
//         $or: [
//           { claimedBy: { $exists: false } },
//           { claimedBy: null },
//           { claimedBy: "" },
//         ],
//       },
//       {
//         $set: {
//           status: "Donated",
//           claimedBy: userId,
//           claimedByName: userName,
//           claimedAt: new Date(),
//         },
//       },
//       { new: true }
//     );

//     if (!updated) {
//       // Either order not found, not in correct status, or already claimed
//       return res.status(400).json({
//         success: false,
//         message:
//           "Order not available to claim (already claimed/donated or not found)",
//       });
//     }

//     return res.json({
//       success: true,
//       data: updated,
//       message: "Order successfully claimed and marked as Donated",
//     });
//   } catch (err) {
//     console.error("Error in claimCancelledOrder:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while claiming order",
//     });
//   }
// };

export {
  placeOrder,
  listOrders,
  userOrders,
  updateStatus,
  verifyOrder,
  placeOrderCod,
  cancelOrder,
  assignShelter,
  claimOrder,
  rateOrder,
  driverAvailableOrders,
  driverMyOrders,
  driverClaimOrder,
  driverMarkDelivered,
  userImpact,
  getUserAvailableOrders,
  // getNearbyCancelledOrders,
  // claimCancelledOrder,
};
