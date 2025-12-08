import React, { useContext, useEffect, useState } from "react";
import "./PlaceOrder.css";
import { StoreContext } from "../../Context/StoreContext";
import { assets } from "../../assets/assets";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

const PlaceOrder = () => {
  const [payment, setPayment] = useState("cod");
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    street: "",
    city: "",
    state: "",
    zipcode: "",
    country: "",
    phone: "",
  });

  // ⭐ NEW: geocoded address + suggestions (like LoginPopup)
  const [geoAddress, setGeoAddress] = useState({
    formatted: "",
    lat: "",
    lng: "",
  });
  const [suggestions, setSuggestions] = useState([]);

  const {
    getTotalCartAmount,
    token,
    food_list,
    cartItems,
    url,
    setCartItems,
    currency,
    deliveryCharge,
  } = useContext(StoreContext);

  const navigate = useNavigate();

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  // ⭐ NEW: typed address → Nominatim suggestions
  const handleGeoAddressChange = async (e) => {
    const query = e.target.value;
    setGeoAddress((prev) => ({ ...prev, formatted: query }));

    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&addressdetails=1&limit=5`
      );
      setSuggestions(res.data);
    } catch (err) {
      console.error("Error fetching address suggestions:", err);
    }
  };

  // ⭐ NEW: user clicks a suggestion → we store lat/lng
  const handleSelectSuggestion = (place) => {
    setGeoAddress({
      formatted: place.display_name,
      lat: place.lat,
      lng: place.lon,
    });
    setSuggestions([]);
  };

  const placeOrder = async (e) => {
    e.preventDefault();

    // optional safety: require a selected address with coords
    if (!geoAddress.lat || !geoAddress.lng) {
      toast.error("Please select a valid address from suggestions.");
      return;
    }

    let orderItems = [];
    food_list.map((item) => {
      if (cartItems[item._id] > 0) {
        const { image, model3D, ...itemInfo } = item;
        itemInfo["quantity"] = cartItems[item._id];
        orderItems.push(itemInfo);
      }
    });

    // ⭐ CHANGED: include formatted + lat/lng inside address
    let orderData = {
      address: {
        ...data,
        formatted: geoAddress.formatted,
        lat: geoAddress.lat,
        lng: geoAddress.lng,
      },
      items: orderItems,
      amount: getTotalCartAmount() + deliveryCharge,
    };

    console.log("DEBUG orderData being sent:", orderData);

    if (payment === "stripe") {
      let response = await axios.post(url + "/api/order/place", orderData, {
        headers: { token },
      });
      console.log(response);
      if (response.data.success) {
        const { session_url } = response.data;
        window.location.replace(session_url);
      } else {
        toast.error("Something Went Wrong");
      }
    } else {
      let response = await axios.post(url + "/api/order/placecod", orderData, {
        headers: { token },
      });
      if (response.data.success) {
        navigate("/myorders");
        toast.success(response.data.message);
        setCartItems({});
      } else {
        toast.error("Something Went Wrong");
      }
    }
  };

  useEffect(() => {
    if (!token) {
      toast.error("to place an order sign in first");
      navigate("/cart");
    } else if (getTotalCartAmount() === 0) {
      navigate("/cart");
    }
  }, [token]);

  return (
    <form onSubmit={placeOrder} className="place-order">
      <div className="place-order-left">
        <p className="title">Delivery Information</p>

        <div className="multi-field">
          <input
            type="text"
            name="firstName"
            onChange={onChangeHandler}
            value={data.firstName}
            placeholder="First name"
            required
          />
          <input
            type="text"
            name="lastName"
            onChange={onChangeHandler}
            value={data.lastName}
            placeholder="Last name"
            required
          />
        </div>

        <input
          type="email"
          name="email"
          onChange={onChangeHandler}
          value={data.email}
          placeholder="Email address"
          required
        />

        {/* ⭐ NEW: search address with autocomplete */}
        <div className="address-field">
          <input
            type="text"
            placeholder="Search delivery address"
            value={geoAddress.formatted}
            onChange={handleGeoAddressChange}
            autoComplete="off"
            required
          />
          {suggestions.length > 0 && (
            <ul className="address-suggestions">
              {suggestions.map((s) => (
                <li key={s.place_id} onClick={() => handleSelectSuggestion(s)}>
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* existing street/city/state fields for extra detail (kept) */}
        <input
          type="text"
          name="street"
          onChange={onChangeHandler}
          value={data.street}
          placeholder="Street"
          required
        />
        <div className="multi-field">
          <input
            type="text"
            name="city"
            onChange={onChangeHandler}
            value={data.city}
            placeholder="City"
            required
          />
          <input
            type="text"
            name="state"
            onChange={onChangeHandler}
            value={data.state}
            placeholder="State"
            required
          />
        </div>
        <div className="multi-field">
          <input
            type="text"
            name="zipcode"
            onChange={onChangeHandler}
            value={data.zipcode}
            placeholder="Zip code"
            required
          />
          <input
            type="text"
            name="country"
            onChange={onChangeHandler}
            value={data.country}
            placeholder="Country"
            required
          />
        </div>
        <input
          type="text"
          name="phone"
          onChange={onChangeHandler}
          value={data.phone}
          placeholder="Phone"
          required
        />
      </div>

      <div className="place-order-right">
        <div className="cart-total">
          <h2>Cart Totals</h2>
          <div>
            <div className="cart-total-details">
              <p>Subtotal</p>
              <p>
                {currency}
                {getTotalCartAmount()}
              </p>
            </div>
            <hr />
            <div className="cart-total-details">
              <p>Delivery Fee</p>
              <p>
                {currency}
                {getTotalCartAmount() === 0 ? 0 : deliveryCharge}
              </p>
            </div>
            <hr />
            <div className="cart-total-details">
              <b>Total</b>
              <b>
                {currency}
                {getTotalCartAmount() === 0
                  ? 0
                  : getTotalCartAmount() + deliveryCharge}
              </b>
            </div>
          </div>
        </div>
        <div className="payment">
          <h2>Payment Method</h2>
          <div onClick={() => setPayment("cod")} className="payment-option">
            <img
              src={payment === "cod" ? assets.checked : assets.un_checked}
              alt=""
            />
            <p>COD ( Cash on delivery )</p>
          </div>
          <div onClick={() => setPayment("stripe")} className="payment-option">
            <img
              src={payment === "stripe" ? assets.checked : assets.un_checked}
              alt=""
            />
            <p>Stripe ( Credit / Debit )</p>
          </div>
        </div>
        <button className="place-order-submit" type="submit">
          {payment === "cod" ? "Place Order" : "Proceed To Payment"}
        </button>
      </div>
    </form>
  );
};

export default PlaceOrder;
