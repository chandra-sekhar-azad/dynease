const mongoose = require('mongoose');
require('dotenv').config();

const Ad = require('./src/models/platform/Ad');

const initialBanners = [
  {
    title: "Chef's Handcrafted Feast",
    subtitle: "Authentic delicacies prepared with fresh local seasonal ingredients.",
    badge: "CHEF'S SPECIAL",
    buttonText: "Explore Now",
    rightBadge: "FRESH TODAY",
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    targetUrl: "",
    status: "Active"
  },
  {
    title: "Royal Dum Biryani Festival",
    subtitle: "Slow cooked fragrant long-grain rice with rich spices and herbs.",
    badge: "LIMITED OFFER",
    buttonText: "Order Biryani",
    rightBadge: "20% OFF",
    imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80",
    targetUrl: "",
    status: "Active"
  }
];

async function seedBanners() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dynease');
    console.log('Connected to MongoDB');

    const count = await Ad.countDocuments();
    if (count === 0) {
      await Ad.insertMany(initialBanners);
      console.log('Seeded initial two-part banners successfully');
    } else {
      console.log(`Already have ${count} banners in database.`);
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding banners:', error);
    process.exit(1);
  }
}

seedBanners();
