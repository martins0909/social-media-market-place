const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URL);
  
  const d = await mongoose.connection.db.collection('catalogproducts').findOne({}, { projection: { image: 1 } });
  if (d && d.image) {
    console.log(d.image.substring(0, 100));
  } else {
    console.log("No image found");
  }
  process.exit(0);
}
check().catch(console.error);