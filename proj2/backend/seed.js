// seed.js
// Run with:  node seed.js
// Make sure: MONGODB_URI in .env points to your local DB

import mongoose from "mongoose";
import dotenv from "dotenv";

// TODO: adjust these imports to match your actual model filenames
// Example: if you have models/foodModel.js with `export default mongoose.model("Food", foodSchema);`
// then:  import Food from "./models/foodModel.js";
import Food from "./models/foodModel.js";      // <-- change filename/name if needed
import Shelter from "./models/shelterModel.js"; // <-- change if needed

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27018/food-del";

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

const shelters = [
  {
    name: "Downtown Community Shelter",
    address: "123 Main St, Raleigh, NC 27606",
    contactName: "John Doe",
    contactPhone: "9195550101",
    capacity: 80,
  },
  {
    name: "Hope Haven Shelter",
    address: "42 Oakwood Ave, Raleigh, NC 27603",
    contactName: "Jane Smith",
    contactPhone: "9195550115",
    capacity: 50,
  },
];

async function seed() {
  try {
    console.log("Connecting to MongoDB:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("DB connected");

    // Wipe existing data for a clean slate
    console.log("Clearing old data...");
    await Food.deleteMany({});
    await Shelter.deleteMany({});

    console.log("Inserting food items...");
    await Food.insertMany(foodItems);

    console.log("Inserting shelters...");
    await Shelter.insertMany(shelters);

    console.log("✅ Seeding complete!");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
