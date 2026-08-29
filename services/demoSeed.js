const User = require("../models/User");
const Product = require("../models/Product");

const products = [
  ["Wireless Headphones", "Electronics", 1499, "Bluetooth over-ear headphones with comfortable cushions and long battery life.", 25, "sample-headphones.svg"],
  ["Smart Fitness Watch", "Electronics", 1999, "Fitness smartwatch with activity tracking, notifications and heart-rate monitoring.", 18, "sample-smartwatch.svg"],
  ["Wireless Mouse", "Electronics", 899, "Compact wireless mouse for laptops, desktops, study and office work.", 35, "sample-mouse.svg"],
  ["Mechanical Keyboard", "Electronics", 2499, "Responsive mechanical keyboard with a comfortable layout for work and gaming.", 14, "sample-keyboard.svg"],
  ["College Backpack", "Bags", 799, "Durable everyday backpack with multiple compartments for college, office and travel.", 30, "sample-backpack.svg"],
  ["Running Shoes", "Footwear", 2299, "Lightweight running shoes designed for daily walking, jogging and workouts.", 20, "sample-shoes.svg"],
  ["Stainless Steel Bottle", "Home", 599, "Reusable insulated stainless-steel bottle for school, college, office and travel.", 40, "sample-bottle.svg"],
  ["Cotton T-Shirt", "Clothing", 699, "Soft regular-fit cotton T-shirt suitable for everyday casual wear.", 45, "sample-tshirt.svg"],
  ["Desk Lamp", "Home", 1099, "Modern LED desk lamp for study tables and workspaces with adjustable neck.", 16, "sample-lamp.svg"],
  ["Sunglasses", "Accessories", 999, "Classic everyday sunglasses with a lightweight frame and UV-protection lenses.", 22, "sample-sunglasses.svg"]
];

async function seedDemoProducts() {
  const count = await Product.countDocuments();
  if (count > 0) return false;

  const owner = await User.findOne({ role: { $in: ["admin", "host"] } });
  if (!owner) {
    console.log("No admin/host found. Sample products will be added after an admin or host is created.");
    return false;
  }

  await Product.insertMany(products.map(([name, category, price, description, quantity, file]) => ({
    name, category, price, description, quantity,
    image: `/uploads/${file}`,
    owner: owner._id
  })));

  console.log("10 sample products loaded successfully.");
  return true;
}

module.exports = seedDemoProducts;
