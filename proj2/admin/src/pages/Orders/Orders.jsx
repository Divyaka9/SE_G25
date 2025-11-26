import React, { useEffect, useMemo, useState } from "react";
import "./Orders.css";
import { toast } from "react-toastify";
import axios from "axios";
import { assets, url, currency } from "../../assets/assets";

const STATUS_OPTIONS = [
  "Food Processing",
  "Out for delivery",
  "Delivered",
  "Redistribute",
  "Cancelled",
];

// backend donated status string
const DONATED_STATUS = "Donated";

const TERMINAL = new Set(["Delivered", "Cancelled", DONATED_STATUS]);

/**
 * Orders - Admin page for managing all orders
 * Displays orders in tabs (current vs cancelled) with status update functionality
 * Filters out donated orders from current tab
 * @returns {JSX.Element} Orders management interface with tabs and status controls
 */
const Order = () => {
  const [allOrders, setAllOrders] = useState([]); // full dataset
  const [orders, setOrders] = useState([]); // filtered list
  const [activeTab, setActiveTab] = useState("current"); // "current" | "cancelled"

  /**
   * Fetches all orders from the backend API
   * @returns {Promise<void>}
   */
  const fetchAllOrders = async () => {
    try {
      const response = await axios.get(`${url}/api/order/list`);
      if (response.data.success) {
        const data = response.data.data.reverse();
        setAllOrders(data);
      } else {
        toast.error("Failed to fetch orders");
      }
    } catch (err) {
      toast.error("Network error while fetching orders");
    }
  };

  // Counts for tab labels
  const counts = useMemo(() => {
    const cancelled = allOrders.filter((o) => o.status === "Cancelled").length;

    // "Current" should exclude Cancelled and Donated-to-shelter orders
    const current = allOrders.filter(
      (o) => o.status !== "Cancelled" && o.status !== DONATED_STATUS
    ).length;

    return { cancelled, current };
  }, [allOrders]);

  // Filter according to active tab
  useEffect(() => {
    if (activeTab === "cancelled") {
      setOrders(allOrders.filter((o) => o.status === "Cancelled"));
    } else {
      // current tab: hide cancelled + donated orders
      setOrders(
        allOrders.filter(
          (o) => o.status !== "Cancelled" && o.status !== DONATED_STATUS
        )
      );
    }
  }, [activeTab, allOrders]);

  /**
   * Handles order status updates
   * Validates status transitions according to backend rules
   */
  const statusHandler = async (event, orderId) => {
    const nextStatus = event.target.value;
    try {
      const response = await axios.post(`${url}/api/order/status`, {
        orderId,
        status: nextStatus,
      });
      if (response.data.success) {
        await fetchAllOrders();
        toast.success(`Status updated to "${nextStatus}"`);
      } else {
        toast.error(response.data.message || "Failed to update status");
      }
    } catch (err) {
      toast.error("Network error while updating status");
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, []);

  return (
    <div className="order add">
      {/* Header + horizontal tabs */}
      <div className="orders-toolbar">
        <h3>Order Page</h3>
        <div className="orders-tabs">
          <button
            className={`tab-btn ${activeTab === "current" ? "active" : ""}`}
            onClick={() => setActiveTab("current")}
          >
            Current ({counts.current})
          </button>
          <button
            className={`tab-btn ${activeTab === "cancelled" ? "active" : ""}`}
            onClick={() => setActiveTab("cancelled")}
          >
            Cancelled ({counts.cancelled})
          </button>
        </div>
      </div>

      {/* Empty-state */}
      {orders.length === 0 && (
        <div className="empty-hint">
          {activeTab === "cancelled"
            ? "No cancelled orders yet."
            : "No current orders right now."}
        </div>
      )}

      <div className="order-list">
        {orders.map((order) => {
          const addr = order.address || {};

          // Name for original orderer
          const orderedByName =
            order.originalUserName ||
            [addr.firstName, addr.lastName].filter(Boolean).join(" ") ||
            "Unknown";

          // Name for claimer (if any)
          let claimedByLabel = "Not claimed";
          if (order.claimedBy) {
            claimedByLabel =
              order.claimedByName ||
              `User ID: ${order.claimedBy}` ||
              "Claimed user";
          }

          return (
            <div key={order._id} className="order-item">
              <img src={assets.parcel_icon} alt="" />
              <div>
                <p className="order-item-food">
                  {order.items.map((item, idx) =>
                    idx === order.items.length - 1
                      ? `${item.name} x ${item.quantity}`
                      : `${item.name} x ${item.quantity}, `
                  )}
                </p>

                {/* Who ordered & who claimed */}
                <p className="order-item-name">
                  <strong>Ordered by:</strong> {orderedByName}
                </p>
                <p className="order-item-name">
                  <strong>Claimed by:</strong> {claimedByLabel}
                </p>

                <div className="order-item-address">
                  <p>
                    {addr.street
                      ? addr.street + ","
                      : ""}
                  </p>
                  <p>
                    {[addr.city, addr.state, addr.country, addr.zipcode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
                {addr.phone && (
                  <p className="order-item-phone">{addr.phone}</p>
                )}

                {order.status === "Cancelled" && (
                  <div className="shelter-assigned">
                    Status: <b>Cancelled</b>
                  </div>
                )}
              </div>

              <p>Items : {order.items.length}</p>
              <p>
                {currency}
                {order.amount}
              </p>

              <select
                onChange={(e) => statusHandler(e, order._id)}
                value={order.status || "Food Processing"}
                disabled={TERMINAL.has(order.status)} // disable Delivered/Cancelled/Donated
                className={`status-select status--${(
                  order.status || "Food Processing"
                )
                  .split(" ")
                  .join("-")
                  .toLowerCase()}`}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Order;
