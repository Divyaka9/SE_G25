import React, { useContext, useEffect, useState, useRef } from "react";
import "./MyOrders.css";
import axios from "axios";
import { StoreContext } from "../../Context/StoreContext";
import { assets } from "../../assets/assets";
import { useSocket } from "../../Context/SocketContext";
import RateOrderModal from "../../components/RateOrderModal/RateOrderModal";

const MyOrders = () => {
  const [data, setData] = useState([]);
  const { url, token, currency } = useContext(StoreContext);
  const socket = useSocket();
  const orderRefreshHandlerRef = useRef(null);

  const [selectedOrderForRating, setSelectedOrderForRating] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Decode token to get userId (if not available in StoreContext)
  const getUserId = () => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id;
    } catch (error) {
      return null;
    }
  };

  const currentUserId = getUserId();

  const fetchOrders = async () => {
    const response = await axios.post(
      url + "/api/order/userorders",
      {},
      { headers: { token } }
    );
    setData(response.data.data);
  };

  const cancelOrder = async (orderId) => {
    try {
      const response = await axios.post(
        url + "/api/order/cancel_order",
        { orderId },
        { headers: { token } }
      );

      if (response.data.success) {
        fetchOrders();
      } else {
        alert(response.data.message || "Failed to cancel order");
      }
    } catch (error) {
      console.log(error);
      alert("Error cancelling order");
    }
  };

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
  }, [token]);

  // Listen for order cancellations to refresh the list
  useEffect(() => {
    if (socket) {
      orderRefreshHandlerRef.current = () => {
        console.log("📋 MyOrders: Refreshing orders due to cancellation");
        fetchOrders();
      };

      socket.on("orderCancelled", orderRefreshHandlerRef.current);

      return () => {
        if (orderRefreshHandlerRef.current) {
          socket.off("orderCancelled", orderRefreshHandlerRef.current);
        }
      };
    }
  }, [socket]);

  // Calculate progress percentage based on order creation time
  const calculateProgress = (createdAt) => {
    const createdTime = new Date(createdAt).getTime();
    const currentTime = Date.now();
    const twoMinutes = 2 * 60 * 1000;
    const elapsed = currentTime - createdTime;
    const progress = Math.min((elapsed / twoMinutes) * 100, 100);
    return progress;
  };

  // Update progress bars every second (for non-delivered orders)
  const [, forceUpdate] = useState();
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="my-orders">
      <h2>My Orders</h2>
      <div className="container">
        {data.map((order, index) => {
          let progress = calculateProgress(order.date);

          let isCancelled = false;
          if (order.claimedBy?.toString() === currentUserId) {
            isCancelled = false;
          } else if (
            order.userId.toString() === currentUserId &&
            order.status === "Claimed"
          ) {
            isCancelled = true;
          } else if (order.status === "Redistribute") {
            isCancelled = true;
          }

          const isDeliveredStatus = order.status === "Delivered";

          // 👇 if backend says Delivered, force 100% progress
          if (isDeliveredStatus) {
            progress = 100;
          }

          return (
            <div
              key={index}
              className={`my-orders-order ${
                isCancelled ? "cancelled-order" : ""
              }`}
            >
              <img src={assets.parcel_icon} alt="" />
              <p>
                {order.items.map((item, index) => {
                  if (index === order.items.length - 1) {
                    return item.name + " x " + item.quantity;
                  } else {
                    return item.name + " x " + item.quantity + ", ";
                  }
                })}
              </p>
              <p>
                {currency}
                {order.amount}.00
              </p>
              <p>Items: {order.items.length}</p>

              {isCancelled ? (
                <>
                  <div className="progress-container cancelled">
                    <div
                      className="progress-bar cancelled"
                      style={{ width: "100%" }}
                    ></div>
                  </div>
                  <p className="progress-text cancelled">Order Cancelled</p>
                </>
              ) : (
                <>
                  <div className="progress-container">
                    <div
                      className="progress-bar"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="progress-text">
                    {isDeliveredStatus
                      ? "Delivered"
                      : progress >= 60
                      ? "Out for Delivery"
                      : "Preparing Food"}
                  </p>
                </>
              )}

              {/* Rating UI for delivered orders */}
              {!isCancelled && isDeliveredStatus && !order.rating && (
                <button
                  className="rate-order-btn"
                  onClick={() => {
                    setSelectedOrderForRating(order);
                    setShowRatingModal(true);
                  }}
                >
                  Rate order
                </button>
              )}

              {!isCancelled && isDeliveredStatus && order.rating && (
                <div className="order-rating-display">
                  <span className="order-rating-stars">
                    {"★".repeat(order.rating).padEnd(5, "☆")}
                  </span>
                  {order.feedback && (
                    <p className="order-rating-feedback">
                      “{order.feedback}”
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => cancelOrder(order._id)}
                disabled={isDeliveredStatus || isCancelled}
                style={{
                  opacity: isDeliveredStatus || isCancelled ? 0.5 : 1,
                  cursor:
                    isDeliveredStatus || isCancelled
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {isCancelled ? "Cancelled" : "Cancel Order"}
              </button>
            </div>
          );
        })}
      </div>

      {showRatingModal && selectedOrderForRating && (
        <RateOrderModal
          order={selectedOrderForRating}
          onClose={() => {
            setShowRatingModal(false);
            setSelectedOrderForRating(null);
          }}
          onRated={(updatedOrder) => {
            setData((prev) =>
              prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o))
            );
            setShowRatingModal(false);
            setSelectedOrderForRating(null);
          }}
        />
      )}
    </div>
  );
};

export default MyOrders;
