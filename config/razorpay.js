
import Razorpay from 'razorpay'
const instance = new Razorpay({
  key_id: 'YOUR_KEY_ID',
  key_secret: 'YOUR_KEY_SECRET'
});

// Create order
app.post('/create/order', (req, res) => {
  const options = {
    amount: 500,  // amount in smallest currency unit
    currency: "INR",
    receipt: "order_rcptid_11"
  };
  
  instance.orders.create(options, (err, order) => {
    if(err) {
      return res.status(500).json(err);
    }
    return res.status(200).json(order);
  });
});

// Verify signature
app.post('/verify/signature', (req, res) => {
  const { order_id, payment_id, signature } = req.body;
  
  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(order_id + "|" + payment_id)
    .digest('hex');
    
  if(generated_signature === signature) {
    // Payment is successful and authentic
    // Update your database here
    return res.status(200).json({ success: true });
  }
  
  return res.status(400).json({ success: false });
});