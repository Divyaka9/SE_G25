import React, { useContext, useState } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link, useNavigate } from "react-router-dom";
import { StoreContext } from "../../Context/StoreContext";
import { ThemeContext } from "../../Context/ThemeContext";

const Navbar = ({ setShowLogin }) => {
  const [menu, setMenu] = useState("home");
  const { getTotalCartAmount, token, setToken, searchTerm, setSearchTerm } =
    useContext(StoreContext);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    navigate("/");
  };

  // 🔍 update search text in global context
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // 🔍 on submit: go to home & scroll to food list
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate("/"); // make sure we're on home

    setTimeout(() => {
      const el = document.getElementById("food-display");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };

  return (
    <div className={`navbar ${theme}`}>
      {/* Logo */}
      <Link
        to="/"
        onClick={() => {
          setMenu("home");
        }}
      >
        <img className="logo" src={assets.logo} alt="ByteBite Logo" />
      </Link>

      {/* Navigation Menu */}
      <ul className="navbar-menu">
        <Link
          to="/"
          onClick={() => setMenu("home")}
          className={menu === "home" ? "active" : ""}
        >
          Home
        </Link>
        <a
          href="#explore-menu"
          onClick={() => setMenu("menu")}
          className={menu === "menu" ? "active" : ""}
        >
          Menu
        </a>
        <a
          href="#app-download"
          onClick={() => setMenu("mob-app")}
          className={menu === "mob-app" ? "active" : ""}
        >
          Mobile App
        </a>
        <a
          href="#footer"
          onClick={() => setMenu("contact")}
          className={menu === "contact" ? "active" : ""}
        >
          Contact Us
        </a>
      </ul>

      {/* Right Section */}
      <div className="navbar-right">
        {/* 🔍 Search bar */}
        <form className="navbar-search" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Search dishes or cuisines..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button type="submit" className="navbar-search-btn">
            <img src={assets.search_icon} alt="Search" />
          </button>
        </form>

        {/* Cart */}
        <Link to="/cart" className="navbar-search-icon">
          <img src={assets.basket_icon} alt="Cart" />
          <div className={getTotalCartAmount() > 0 ? "dot" : ""}></div>
        </Link>

        {/* Theme Toggle Button */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle Theme"
        >
          <div className={`toggle-track ${theme}`}>
            <div
              className={`toggle-thumb ${theme === "dark" ? "on" : ""}`}
            ></div>
          </div>
          <span className="toggle-text">
            {theme === "dark" ? "Dark" : "Light"}
          </span>
        </button>

        {/* Login / Profile */}
        {!token ? (
          <button onClick={() => setShowLogin(true)}>Sign In</button>
        ) : (
          <div className="navbar-profile">
            <img src={assets.profile_icon} alt="Profile" />
            <ul className="navbar-profile-dropdown">
              {/* Profile */}
              <li onClick={() => navigate("/profile")}>
                <img src={assets.profile_icon} alt="Profile" />
                <p>Profile</p>
              </li>
              <hr />
              {/* Orders */}
              <li onClick={() => navigate("/myorders")}>
                <img src={assets.bag_icon} alt="Orders" /> <p>Orders</p>
              </li>
              <hr />
              <li onClick={() => navigate("/impact")}>
                <img
                  src={assets.impact_icon || assets.profile_icon}
                  alt="Impact"
                />
                <p>My Impact</p>
              </li>
              <hr />
              {/* Logout */}
              <li onClick={logout}>
                <img src={assets.logout_icon} alt="Logout" /> <p>Logout</p>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
