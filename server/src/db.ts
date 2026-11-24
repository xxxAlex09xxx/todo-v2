// server/src/db.ts
import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';

export const db: Database = new sqlite3.Database('./todos.db', (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err.message);
    } else {
        console.log('✅ Подключено к SQLite');
        // 👇 КРИТИЧНО: без этого ON DELETE CASCADE не сработает!
        db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
            if (pragmaErr) {
                console.error('❌ Не удалось включить foreign_keys:', pragmaErr.message);
            } else {
                console.log('✅ PRAGMA foreign_keys = ON');
            }
            createTables();
        });
    }
});

function createTables(): void {
    // Таблица пользователей
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы users:', err.message);
        } else {
            console.log('✅ Таблица users готова');
        }
    });

    // Таблица refresh-токенов
    db.run(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            revoked INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы refresh_tokens:', err.message);
        } else {
            console.log('✅ Таблица refresh_tokens готова');
        }
    });

    // Таблица задач
    db.run(`
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            completed INTEGER DEFAULT 0,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы todos:', err.message);
        } else {
            console.log('✅ Таблица todos готова');
        }
    });

    // ⚠️ Миграция для старых БД — description у todos
    db.run(`ALTER TABLE todos ADD COLUMN description TEXT NOT NULL DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Миграция description не удалась:', err.message);
        }
    });

    // ⚠️ Миграции для users (сброс пароля)
    db.run(`ALTER TABLE users ADD COLUMN reset_token TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Миграция reset_token не удалась:', err.message);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN reset_token_expires DATETIME`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Миграция reset_token_expires не удалась:', err.message);
        }
    });

    // ⚠️ Миграция для users (роль)
    db.run(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Миграция role не удалась:', err.message);
        } else {
            console.log('✅ Колонка role готова (или уже была)');
        }
    });

    // 👇 НОВОЕ: имя пользователя (нужно для админки)
    db.run(`ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Миграция name не удалась:', err.message);
        } else {
            console.log('✅ Колонка name готова (или уже была)');
        }
    });

    // 👇 НОВОЕ: статус пользователя (нужно для админки)
    db.run(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('❌ Миграция status не удалась:', err.message);
        } else {
            console.log('✅ Колонка status готова (или уже была)');
        }
    });
}