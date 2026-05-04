// Server is only used locally for publishing Redis message for translation evaluation
import express from 'express';
import Redis from 'ioredis';
import cors from 'cors';

const app = express();
const redis = new Redis('redis://localhost:6379');

app.use(cors());
app.use(express.json());

app.post('/publishTranslationsForEvaluation', async (req, res) => {
    const topic = 'evaluator-dev';
    const { data } = req.body;
    await redis.publish(topic, JSON.stringify(data));
    res.json({ ok: true });
});

app.listen(3001, () => console.log('listening on 3001'));
