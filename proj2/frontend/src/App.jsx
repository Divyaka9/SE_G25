import React, { useState } from "react";
import Home from "./pages/Home/Home";
import Footer from "./components/Footer/Footer";
import Navbar from "./components/Navbar/Navbar";
import { Route, Routes } from "react-router-dom";
import Cart from "./pages/Cart/Cart";
import LoginPopup from "./components/LoginPopup/LoginPopup";
import PlaceOrder from "./pages/PlaceOrder/PlaceOrder";
import MyOrders from "./pages/MyOrders/MyOrders";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Verify from "./pages/Verify/Verify";
import NotificationListener from "./components/NotificationListener/NotificationListener";
import { Toaster } from "react-hot-toast";
import DriverRegister from "./pages/DriverRegister.jsx";
import DriverLogin from "./pages/DriverLogin.jsx";
import DriverOrders from "./pages/DriverOrders.jsx";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./pages/Profile/Profile"; // ⭐ NEW
import Impact from "./pages/Impact/Impact";

const App = () => {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <NotificationListener />
      <Toaster position="top-right" />
      <ToastContainer />
      {showLogin ? <LoginPopup setShowLogin={setShowLogin} /> : <></>}
      <div className="app">
        <Navbar setShowLogin={setShowLogin} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/order" element={<PlaceOrder />} />
          <Route path="/myorders" element={<MyOrders />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/driver/register" element={<DriverRegister />} />
          <Route path="/driver/login" element={<DriverLogin />} />
          <Route
            path="/impact"
            element={
              <ProtectedRoute>
                {" "}
                <Impact />{" "}
              </ProtectedRoute>
            }
          />

          <Route
            path="/driver/orders"
            element={
              <ProtectedRoute>
                <DriverOrders />
              </ProtectedRoute>
            }
          />
          {/* ⭐ New profile route (protected) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
      <Footer />
    </>
  );
};

export default App;
