// seed.js
// Run with:  node seed.js

import mongoose from "mongoose";
import dotenv from "dotenv";

import Food from "./models/foodModel.js";
import Shelter from "./models/shelterModel.js";

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/food-del";

// ------------------ FOOD ITEMS ------------------
const foodItems = [
  {
    name: "Margherita Pizza",
    description: "Classic pizza with tomato sauce, mozzarella, and basil.",
    price: 12.99,
    category: "Main Course",
    isVeg: true,
    stock: 20,
    imageUrl:
      "https://images.pexels.com/photos/4109084/pexels-photo-4109084.jpeg",
  },
  {
    name: "Veggie Burger",
    description: "Grilled veggie patty with lettuce, tomato, and cheese.",
    price: 9.5,
    category: "Main Course",
    isVeg: true,
    stock: 15,
    imageUrl:
      "https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg",
  },
  {
    name: "Grilled Chicken Bowl",
    description: "Grilled chicken with rice, veggies, and house sauce.",
    price: 13.75,
    category: "Main Course",
    isVeg: false,
    stock: 18,
    imageUrl:
      "https://images.pexels.com/photos/3738753/pexels-photo-3738753.jpeg",
  },
  {
    name: "Strawberry Cheesecake",
    description: "Creamy cheesecake topped with fresh strawberries.",
    price: 7.25,
    category: "Dessert",
    isVeg: true,
    stock: 10,
    imageUrl:
      "https://images.pexels.com/photos/704569/pexels-photo-704569.jpeg",
  },
  {
    name: "French Fries",
    description: "Crispy golden fries with house seasoning.",
    price: 4.0,
    category: "Sides",
    isVeg: true,
    stock: 40,
    imageUrl:
      "https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg",
  },
];

// ------------------ SHELTERS WITH LOGIN FIELDS ------------------
const shelters = [
  {
    name: "City Shelter – Raleigh",
    contactEmail: "john.smith@cityshelter.org",
    password: "shelter123", // Will be hashed by pre-save middleware
    contactName: "John Smith",
    contactPhone: "+1 919 555 0111",
    capacity: 200,
    address: {
      street: "101 Main St",
      city: "Raleigh",
      state: "NC",
      zipcode: "27601",
    },
  },
  {
    name: "Triangle Food Bank",
    contactEmail: "lisa.green@trianglefb.org",
    password: "shelter123",
    contactName: "Lisa Green",
    contactPhone: "+1 919 555 0112",
    capacity: 150,
    address: {
      street: "22 Triangle Way",
      city: "Raleigh",
      state: "NC",
      zipcode: "27606",
    },
  },
  {
    name: "Community Outreach Center",
    contactEmail: "mark.lee@cocenter.org",
    password: "shelter123",
    contactName: "Mark Lee",
    contactPhone: "+1 919 555 0113",
    capacity: 100,
    address: {
      street: "400 Elm Ave",
      city: "Raleigh",
      state: "NC",
      zipcode: "27607",
    },
  },
  {
    name: "Wake County Relief Shelter",
    contactEmail: "angela.torres@wake-relief.org",
    password: "shelter123",
    contactName: "Angela Torres",
    contactPhone: "+1 919 555 0114",
    capacity: 180,
    address: {
      street: "75 Oak Blvd",
      city: "Cary",
      state: "NC",
      zipcode: "27513",
    },
  },
  {
    name: "Durham Helping Hands",
    contactEmail: "calvin.brooks@helpinghands.org",
    password: "shelter123",
    contactName: "Calvin Brooks",
    contactPhone: "+1 984 555 0115",
    capacity: 130,
    address: {
      street: "19 Ninth St",
      city: "Durham",
      state: "NC",
      zipcode: "27701",
    },
  },
  {
    name: "Chapel Hill Community Pantry",
    contactEmail: "priya.shah@chpantry.org",
    password: "shelter123",
    contactName: "Priya Shah",
    contactPhone: "+1 919 555 0116",
    capacity: 120,
    address: {
      street: "8 Franklin St",
      city: "Chapel Hill",
      state: "NC",
      zipcode: "27514",
    },
  },
  {
    name: "Garner Hope Center",
    contactEmail: "evan.clark@garnerhope.org",
    password: "shelter123",
    contactName: "Evan Clark",
    contactPhone: "+1 919 555 0117",
    capacity: 90,
    address: {
      street: "210 Meadow Rd",
      city: "Garner",
      state: "NC",
      zipcode: "27529",
    },
  },
  {
    name: "Morrisville Food & Shelter",
    contactEmail: "sarah.nguyen@mfs.org",
    password: "shelter123",
    contactName: "Sarah Nguyen",
    contactPhone: "+1 919 555 0118",
    capacity: 110,
    address: {
      street: "310 Park Center Dr",
      city: "Morrisville",
      state: "NC",
      zipcode: "27560",
    },
  },
];

// ------------------ SEED FUNCTION ------------------
async function seed() {
  try {
    console.log("Connecting to MongoDB:", MONGO_URI);
    await mongoose.connect(MONGO_URI, { family: 4 });
    console.log("✔ DB connected");

    console.log("🧹 Clearing old data...");
    await Food.deleteMany({});
    await Shelter.deleteMany({});

    console.log("🍕 Inserting food items...");
    await Food.insertMany(foodItems);

    console.log("🏠 Inserting shelters (with login accounts)...");
    for (const shelter of shelters) {
      const newShelter = new Shelter(shelter);
      await newShelter.save(); // this triggers password hashing
    }

    console.log("🎉 SEEDING COMPLETE!");
    console.log("\n=== Shelter Login Accounts ===");
    shelters.forEach((s) => {
      console.log(`• ${s.name} → ${s.email} / ${s.password}`);
    });
    console.log("==============================\n");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
