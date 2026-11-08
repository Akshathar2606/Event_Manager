const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { CateringService } = require('../src/models/CateringService');
const { User } = require('../src/models/User');

const DEMO_PROFILES = [
  {
    businessName: 'Juniper & Millet Demo Kitchen',
    description: 'Fictional demo listing. Illustrative sample menu and prices only; not a real business.',
    locality: 'Siddaganga area (illustrative)',
    location: { type: 'Point', coordinates: [77.10, 13.34] },
    cuisineTypes: ['Indian', 'Healthy & Organic'],
    packages: [{
      name: 'Demo Vegetarian Lunch',
      description: 'Illustrative sample menu and price.',
      pricePerPlate: 180,
      minOrder: 20,
      maxGuests: 250,
      menuItems: ['Seasonal vegetable pulao', 'Dal', 'Salad', 'Fruit'],
      dietaryOptions: ['Vegetarian'],
      isArchived: false
    }]
  },
  {
    businessName: 'Copper Leaf Campus Demo Catering',
    description: 'Fictional demo listing. Illustrative sample menu and prices only; not a real business.',
    locality: 'Tumakuru city area (illustrative)',
    location: { type: 'Point', coordinates: [77.11, 13.35] },
    cuisineTypes: ['Indian', 'Continental'],
    packages: [{
      name: 'Demo Seminar Buffet',
      description: 'Illustrative sample menu and price.',
      pricePerPlate: 240,
      minOrder: 30,
      maxGuests: 500,
      menuItems: ['Vegetable starter', 'Rice and curry', 'Bread', 'Dessert'],
      dietaryOptions: ['Vegetarian', 'Nut-Free'],
      isArchived: false
    }]
  },
  {
    businessName: 'Blue Pebble Event Meals Demo',
    description: 'Fictional demo listing. Illustrative sample menu and prices only; not a real business.',
    locality: 'Tumakuru outskirts (illustrative)',
    location: { type: 'Point', coordinates: [77.08, 13.33] },
    cuisineTypes: ['Indian', 'Buffet & Finger Foods'],
    packages: [{
      name: 'Demo Conference Meal',
      description: 'Illustrative sample menu and price.',
      pricePerPlate: 210,
      minOrder: 15,
      maxGuests: 350,
      menuItems: ['Lemon rice', 'Vegetable curry', 'Curd', 'Sweet'],
      dietaryOptions: ['Vegetarian', 'Gluten-Free'],
      isArchived: false
    }]
  }
];

const sanitizeErrorMessage = (error) =>
  String(error?.message || 'Unknown error')
    .replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://***:***@');

const seedDemoProfiles = async (vendorIds) => {
  if (vendorIds.length === 0 || vendorIds.length > DEMO_PROFILES.length) {
    throw new Error('Provide between one and three existing vendor account ObjectIds.');
  }
  if (vendorIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new Error('Every vendor account ID must be a valid MongoDB ObjectId.');
  }
  const normalizedVendorIds = vendorIds.map((id) => id.toLowerCase());
  if (new Set(normalizedVendorIds).size !== normalizedVendorIds.length) {
    throw new Error('Each existing vendor account ID may be supplied only once.');
  }

  await connectDB();
  try {
    const vendors = await User.find({
      _id: { $in: normalizedVendorIds.map((id) => new mongoose.Types.ObjectId(id)) },
      role: 'vendor'
    }).select('_id');
    const existingVendorIds = new Set(vendors.map((vendor) => vendor._id.toString()));
    const missingVendorIds = normalizedVendorIds.filter((id) => !existingVendorIds.has(id));
    if (missingVendorIds.length > 0) {
      throw new Error('One or more supplied account IDs do not belong to existing vendor accounts.');
    }

    let created = 0;
    let skipped = 0;
    for (let index = 0; index < normalizedVendorIds.length; index += 1) {
      const vendorId = normalizedVendorIds[index];
      const existingProfile = await CateringService.findOne({ vendorId }).select('_id');
      if (existingProfile) {
        skipped += 1;
        continue;
      }

      const demo = DEMO_PROFILES[index];
      await CateringService.create({
        ...demo,
        vendorId,
        city: 'Tumakuru',
        fullAddress: 'Illustrative demo location only',
        serviceArea: 'Tumakuru and nearby event locations (demo)',
        contactEmail: '',
        contactPhone: '',
        isDemoListing: true,
        isAvailable: true,
        isArchived: false
      });
      created += 1;
    }

    console.log(`Demo catering seed complete: ${created} created, ${skipped} existing profiles left unchanged.`);
  } finally {
    await mongoose.disconnect();
  }
};

seedDemoProfiles(process.argv.slice(2)).catch((error) => {
  console.error(`[Demo seed error] ${sanitizeErrorMessage(error)}`);
  process.exitCode = 1;
});
