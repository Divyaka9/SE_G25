import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  listOrders,
  placeOrder,
  updateStatus,
  userOrders,
  verifyOrder,
  placeOrderCod,
  cancelOrder,
  claimOrder,           // existing
  assignShelter,
  rateOrder,
  driverAvailableOrders,
  driverMyOrders,
  driverClaimOrder,
  driverMarkDelivered,
  userImpact,
  getUserAvailableOrders,
  // getNearbyCancelledOrders, // new controller
  // claimCancelledOrder,      // new controller
} from "../controllers/orderController.js";

const orderRouter = express.Router();

orderRouter.get("/list", listOrders);
orderRouter.post("/userorders", authMiddleware, userOrders);
orderRouter.post("/cancel_order", authMiddleware, cancelOrder);
orderRouter.post("/place", authMiddleware, placeOrder);
orderRouter.post("/status", updateStatus);
orderRouter.post("/verify", verifyOrder);
orderRouter.post("/placecod", authMiddleware, placeOrderCod);

// existing claim route (keep if teammates use it)
orderRouter.post("/claim", authMiddleware, claimOrder);

orderRouter.post("/assign-shelter", assignShelter);
orderRouter.get("/impact", authMiddleware, userImpact);
orderRouter.post("/rate", authMiddleware, rateOrder);

orderRouter.get("/driver/available", authMiddleware, driverAvailableOrders);
orderRouter.get("/driver/my", authMiddleware, driverMyOrders);
orderRouter.post("/driver/claim", authMiddleware, driverClaimOrder);
orderRouter.post("/driver/deliver", authMiddleware, driverMarkDelivered);
orderRouter.post(
  "/user/available",
  authMiddleware,
  getUserAvailableOrders
);

// // 🔹 NEW: user sees cancelled/redistribute orders nearby
// orderRouter.get("/user/nearby", authMiddleware, getNearbyCancelledOrders);
// orderRouter.post(
//   "/user/claim",
//   authMiddleware,
//   claimCancelledOrder
// );

// ESM export only
export default orderRouter;
