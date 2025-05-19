import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config()
export const isApiAuthenticated = (req, res, next) => {
  const { apikey} = req.query;
//   console.log(apikey) 
  let token = apikey;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "abhi@321");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "apikey is not valid",
      data: null,
    });
  }
};
