import express, { Application } from 'express';
import contactRoutes from './routes/contactRoutes';

const app: Application = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Routes
app.use('/', contactRoutes); // You can prefix with /api if desired

export default app;