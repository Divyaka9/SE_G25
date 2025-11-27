import React, { useContext } from "react";
import "./Cart.css";
import { StoreContext } from "../../Context/StoreContext";
import { useNavigate } from "react-router-dom";

const Cart = () => {
  const {
    cartItems,
    food_list,
    addToCart,        // ⭐ make sure this exists in StoreContext
    removeFromCart,
    getTotalCartAmount,
    url,
    currency,
    deliveryCharge,
  } = useContext(StoreContext);
  const navigate = useNavigate();

  const subtotal = getTotalCartAmount();
  const isCartEmpty = subtotal === 0;
  const deliveryFee = isCartEmpty ? 0 : deliveryCharge;
  const grandTotal = isCartEmpty ? 0 : subtotal + deliveryFee;

  const handleCheckout = () => {
    if (!isCartEmpty) {
      navigate("/order");
    }
  };

  const cartItemsWithData = food_list.filter(
    (item) => cartItems[item._id] > 0
  );

  return (
    <div className="cart">
      {/* Empty state */}
      {cartItemsWithData.length === 0 && (
        <div className="cart-empty">
          <h2>Your cart is empty</h2>
          <p>Add something tasty to get started.</p>
          <button
            className="cart-empty-cta"
            onClick={() => navigate("/menu")}
          >
            Browse menu
          </button>
        </div>
      )}

      {/* Items table / list */}
      {cartItemsWithData.length > 0 && (
        <div className="cart-items">
          <div className="cart-items-title">
            <p>Items</p> <p>Title</p> <p>Price</p> <p>Quantity</p> <p>Total</p>{" "}
            <p>Remove</p>
          </div>
          <br />
          <hr />

          {cartItemsWithData.map((item, index) => (
            <div key={item._id || index}>
              <div className="cart-items-title cart-items-item">
                <img src={url + "/images/" + item.image} alt={item.name} />
                <p>{item.name}</p>
                <p>
                  {currency}
                  {item.price}
                </p>

                {/* ⭐ Quantity stepper */}
                <div className="cart-qty-controls">
                  <button
                    type="button"
                    className="cart-qty-btn"
                    onClick={() => removeFromCart(item._id)}
                  >
                    −
                  </button>
                  <span className="cart-qty-value">
                    {cartItems[item._id]}
                  </span>
                  <button
                    type="button"
                    className="cart-qty-btn"
                    onClick={() => addToCart(item._id)}
                  >
                    +
                  </button>
                </div>

                <p>
                  {currency}
                  {item.price * cartItems[item._id]}
                </p>

                <button
                  type="button"
                  className="cart-items-remove-icon"
                  onClick={() => removeFromCart(item._id)}
                >
                  Remove
                </button>
              </div>
              <hr />
            </div>
          ))}
        </div>
      )}

      {/* Summary + promo code */}
      <div className="cart-bottom">
        <div className="cart-total">
          <h2>Cart Totals</h2>
          <div>
            <div className="cart-total-details">
              <p>Subtotal</p>
              <p>
                {currency}
                {subtotal}
              </p>
            </div>
            <hr />
            <div className="cart-total-details">
              <p>Delivery Fee</p>
              <p>
                {currency}
                {deliveryFee}
              </p>
            </div>
            <hr />
            <div className="cart-total-details">
              <b>Total</b>
              <b>
                {currency}
                {grandTotal}
              </b>
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={isCartEmpty}
            className={`cart-checkout-btn ${
              isCartEmpty ? "cart-checkout-btn-disabled" : ""
            }`}
          >
            {isCartEmpty ? "ADD ITEMS TO CHECKOUT" : "PROCEED TO CHECKOUT"}
          </button>
        </div>

        <div className="cart-promocode">
          <div>
            <p>If you have a promo code, Enter it here</p>
            <div className="cart-promocode-input">
              <input type="text" placeholder="promo code" />
              <button>Submit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
