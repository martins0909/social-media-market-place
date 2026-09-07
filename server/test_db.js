const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URL);
  
  const count = await mongoose.connection.db.collection('catalogproducts').countDocuments();
  console.log('Document count:', count);
  
  console.time('Fetch Image Sizes Only');
  const d = await mongoose.connection.db.collection('catalogproducts').find({}, { projection: { image: 1 } }).toArray();
  console.timeEnd('Fetch Image Sizes Only');

  console.time('Fetch Meta (No Images, No Serials)');
  const d2 = await mongoose.connection.db.collection('catalogproducts').find({}, { projection: { serialNumbers: 0, image: 0 } }).toArray();
  console.timeEnd('Fetch Meta (No Images, No Serials)');
  
  process.exit(0);
}
check().catch(console.error);