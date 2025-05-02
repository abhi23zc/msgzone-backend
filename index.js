import express from 'express'
import authRouter from './routes/auth.route.js';
import whatsappRouter from './routes/whatsapp.route.js';
import connectDB from './config/database.js';

const PORT = 8080
const app = express();

connectDB()
app.use(express.json())
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/wp", whatsappRouter)

app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}` )
})