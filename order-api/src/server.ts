import express from 'express';
import cors from 'cors';
import orderRoutes from './routes/order.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/v1/orders', orderRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

app.listen(PORT, () => {
    console.log(`Order API running on http://localhost:${PORT}`);
});
