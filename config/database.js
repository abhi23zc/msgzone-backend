import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_DB_URL);
        // const conn = await mongoose.connect("mongodb://127.0.0.1:27017/msgzone");
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        // restoreSessions()
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;