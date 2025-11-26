import mongoose from "mongoose";

const STATUS_VALUES = [
  "Food Processing",
  "Out for delivery",
  "Delivered",
  "Redistribute",
  "Cancelled",
  "Donated",
];

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: { type: Array, required: true },
  amount: { type: Number, required: true },
  address: { type: Object, required: true },

  originalUserId: { type: String },       
  originalUserName: { type: String },     
  claimedBy: { type: String },            
  claimedByName: { type: String },      
  claimedAt: { type: Date },   

  // Updated with enum for stricter validation
  status: {
    type: String,
    enum: STATUS_VALUES,
    default: "Food Processing",
  },

  date: { type: Date, default: Date.now },
  payment: { type: Boolean, default: false },


  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  ratedAt: {
    type: Date,
  },
});

const orderModel =
  mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;
