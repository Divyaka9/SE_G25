import React, { useContext, useState } from "react";
import "./LoginPopup.css";
import { assets } from "../../assets/assets";
import { StoreContext } from "../../Context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";

const LoginPopup = ({ setShowLogin }) => {
  const { setToken, url, loadCartData } = useContext(StoreContext);
  const [currState, setCurrState] = useState("Sign Up");

  // form data + address + preferences
  const [data, setData] = useState({
    name: "",
    email: "",
    password: "",
    addressFormatted: "",
    addressLat: "",
    addressLng: "",
    dietPreference: "any", // "any" | "veg-only"
    sugarPreference: "any", // "any" | "no-sweets"
  });

  // address suggestions
  const [suggestions, setSuggestions] = useState([]);

  const onChangeHandler = (event) => {
    const { name, value } = event.target;
    setData((prev) => ({ ...prev, [name]: value }));
  };

  // handle address typing (free OpenStreetMap autocomplete)
  const handleAddressChange = async (e) => {
    const query = e.target.value;
    setData((prev) => ({ ...prev, addressFormatted: query }));

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

  // when a user selects a suggestion
  const handleSelectSuggestion = (place) => {
    setData((prev) => ({
      ...prev,
      addressFormatted: place.display_name,
      addressLat: place.lat,
      addressLng: place.lon,
    }));
    setSuggestions([]);
  };

  const onLogin = async (e) => {
    e.preventDefault();

    let new_url = url;
    if (currState === "Login") {
      new_url += "/api/user/login";
    } else {
      new_url += "/api/user/register";
    }

    let payload;

    if (currState === "Login") {
      // Login: only email + password
      payload = {
        email: data.email,
        password: data.password,
      };
    } else {
      // Sign Up: full payload including address + preferences
      payload = {
        name: data.name,
        email: data.email,
        password: data.password,
        address: {
          formatted: data.addressFormatted,
          lat: data.addressLat,
          lng: data.addressLng,
        },
        dietPreference: data.dietPreference,
        sugarPreference: data.sugarPreference,
      };
    }

    try {
      const response = await axios.post(new_url, payload);
      if (response.data.success) {
        setToken(response.data.token);
        localStorage.setItem("token", response.data.token);
        loadCartData({ token: response.data.token });
        setShowLogin(false);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Server error while logging in or signing up.");
    }
  };

  return (
    <div className="login-popup">
      <form onSubmit={onLogin} className="login-popup-container">
        <div className="login-popup-title">
          <h2>{currState}</h2>
          <img
            onClick={() => setShowLogin(false)}
            src={assets.cross_icon}
            alt=""
          />
        </div>

        <div className="login-popup-inputs">
          {currState === "Sign Up" && (
            <>
              {/* Name */}
              <div className="login-field">
                <label className="login-label">Full name</label>
                <input
                  name="name"
                  onChange={onChangeHandler}
                  value={data.name}
                  type="text"
                  placeholder="Your name"
                  required
                />
              </div>

              {/* Address with suggestions */}
              <div className="login-field address-field">
                <label className="login-label">Address</label>
                <input
                  type="text"
                  placeholder="Enter your address"
                  value={data.addressFormatted}
                  onChange={handleAddressChange}
                  required
                  autoComplete="off"
                />
                {suggestions.length > 0 && (
                  <ul className="address-suggestions">
                    {suggestions.map((s) => (
                      <li
                        key={s.place_id}
                        onClick={() => handleSelectSuggestion(s)}
                      >
                        {s.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Preferences row */}
              <div className="login-two-column">
                <div className="login-field">
                  <label className="login-label">Diet preference</label>
                  <select
                    name="dietPreference"
                    value={data.dietPreference}
                    onChange={onChangeHandler}
                  >
                    <option value="any">No diet preference</option>
                    <option value="veg-only">Vegetarian only</option>
                  </select>
                </div>

                <div className="login-field">
                  <label className="login-label">Sugar preference</label>
                  <select
                    name="sugarPreference"
                    value={data.sugarPreference}
                    onChange={onChangeHandler}
                  >
                    <option value="any">Okay with sweets / desserts</option>
                    <option value="no-sweets">
                      Avoid sweets / desserts (sugar-free)
                    </option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div className="login-field">
            <label className="login-label">Email</label>
            <input
              name="email"
              onChange={onChangeHandler}
              value={data.email}
              type="email"
              placeholder="Your email"
              required
            />
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="login-label">Password</label>
            <input
              name="password"
              onChange={onChangeHandler}
              value={data.password}
              type="password"
              placeholder="Password"
              required
            />
          </div>
        </div>

        <button>{currState === "Login" ? "Login" : "Create account"}</button>

        <div className="login-popup-condition">
          <input type="checkbox" required />
          <p>By continuing, I agree to the terms of use & privacy policy.</p>
        </div>

        {currState === "Login" ? (
          <p>
            Create a new account?{" "}
            <span onClick={() => setCurrState("Sign Up")}>Click here</span>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <span onClick={() => setCurrState("Login")}>Login here</span>
          </p>
        )}
      </form>
    </div>
  );
};

export default LoginPopup;
