import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { StoreContext } from "../../Context/StoreContext";
import toast from "react-hot-toast";

const ClaimOrder = () => {
  const { url, token, currency } = useContext(StoreContext);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState("");

  const authHeader = token ? { headers: { token } } : {};

  useEffect(() => {
    if (!token) {
      setError("Please login to view available orders.");
      return;
    }

    fetchAvailableOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchAvailableOrders = async () => {
    if (!token) return;

    try {
      setLoadingOrders(true);

      const res = await axios.post(
        `${url}/api/order/user/available`,
        {},         // <-- body is empty, userId comes from token
        authHeader
      );

      if (res.data.success) {
        setOrders(res.data.data || []);
        setError("");
      } else {
        setError(res.data.message || "Failed to fetch available orders.");
      }
    } catch (err) {
      console.error("Error fetching available orders", err);
      setError("Something went wrong while fetching available orders.");
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleClaim = async (orderId) => {
    if (!token) {
      toast.error("Please login first");
      return;
    }

    try {
      const res = await axios.post(
        `${url}/api/order/claim`,
        { orderId },
        authHeader
      );

      if (res.data.success) {
        toast.success("Order claimed at discounted price!");
        setOrders((prev) => prev.filter((o) => o._id !== orderId));
      } else {
        toast.error(res.data.message || "Could not claim this order");
      }
    } catch (err) {
      console.error("Error claiming order", err);
      toast.error("Something went wrong while claiming the order");
    }
  };

  const renderOrderList = () => {
    if (error) return <p style={{ color: "red" }}>{error}</p>;
    if (loadingOrders) return <p>Loading available orders…</p>;
    if (orders.length === 0)
      return <p>No available orders right now.</p>;

    return (
      <ul className="driver-order-list">
        {orders.map((o) => (
          <li key={o._id} className="driver-order-card">
            <div>
              <div className="driver-order-header">
                <div>
                  <div className="driver-order-id">
                    <strong>Order:</strong> {o._id}
                  </div>
                  {typeof o.amount === "number" && (
                    <div className="driver-order-meta">
                      <span>
                        <strong>Total:</strong> {currency}
                        {o.amount}
                      </span>
                    </div>
                  )}
                </div>

                <span className="driver-status-pill">{o.status}</span>
              </div>

              <div className="driver-order-meta">
                {o.address && (
                  <span>
                    <strong>Address:</strong>{" "}
                    {o.address.formatted ||
                      o.address.line1 ||
                      o.address.fullName ||
                      o.address.name}
                  </span>
                )}
              </div>

              {Array.isArray(o.items) && o.items.length > 0 && (
                <div>
                  <strong style={{ fontSize: "0.85rem" }}>Items:</strong>
                  <ul className="driver-order-items">
                    {o.items.map((item, idx) => (
                      <li key={idx}>
                        {item.name} × {item.quantity || item.qty || 1}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="driver-order-actions">
              <button
                className="claim-order-btn"
                onClick={() => handleClaim(o._id)}
              >
                Claim this order
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="driver-page">
      <h2>Available Redistribution Orders</h2>
      {renderOrderList()}
    </div>
  );
};

export default ClaimOrder;
