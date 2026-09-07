const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URL).then(async () => {
    try {
        const db = mongoose.connection.db;
        const products = await db.collection('catalogproducts').find({}).toArray();
        let totalStock = 0;
        let count = 0;

        for (const p of products) {
            const unused = p.serialNumbers ? p.serialNumbers.filter(s => s.isUsed === false).length : 0;
            await db.collection('catalogproducts').updateOne(
                { _id: p._id }, 
                { $set: { cachedAvailableStock: unused } }
            );
            totalStock += unused;
            count++;
        }
        
        console.log(`Migration complete! Assessed ${count} products.`);
        console.log(`Total Unused Stock Found: ${totalStock}`);
        process.exit(0);
    } catch(e) {
        console.error("Migration error:", e);
        process.exit(1);
    }
});