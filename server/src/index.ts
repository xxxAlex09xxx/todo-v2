// server/src/index.ts
import { config } from './config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initDb } from './db'; // 👈 Импортируем функцию инициализации
import { authRouter } from './routes/auth';
import { todosRouter } from './routes/todos';
import { usersRouter } from './routes/users';

const app = express();
//const PORT = config.port; // для dev разработки
const PORT = Number(process.env.PORT) || config.port;

// CORS
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:555',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:555',
    'http://192.168.250.149:555',
    process.env.FRONTEND_URL || 'https://your-app.com',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            console.warn(`❌ Блокирован запрос с ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
}));

app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/todos', todosRouter);
app.use('/admin/users', usersRouter);

app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
});

//для dev разработки

/*
// 👇 Запускаем сервер только после инициализации базы данных
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error('❌ Не удалось запустить сервер из-за ошибки БД:', err);
});*/


initDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
    });
}).catch((err) => {
    console.error('❌ Не удалось запустить сервер:', err);
    process.exit(1);
});