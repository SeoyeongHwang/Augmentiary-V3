import express from 'express';
import augmentRouter from './augment';

const app = express();
const port = 3000;

app.use(express.json());
app.use(augmentRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 