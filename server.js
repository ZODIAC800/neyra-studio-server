const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Главная страница для проверки
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Neyra Studio сервер работает' });
});

// Эндпоинт для генерации картинки
app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Нет промпта' });
    }

    const POLZA_KEY = process.env.POLZA_API_KEY;
    
    if (!POLZA_KEY) {
      return res.status(500).json({ error: 'Не настроен ключ Polza.AI' });
    }

    // Запрос к Polza.AI для генерации картинки через Nano Banana 2 Lite
    const response = await fetch('https://api.polza.ai/api/v1/media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${POLZA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image', // Nano Banana 2
        input: {
          prompt: prompt,
          aspect_ratio: '1:1'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ошибка Polza.AI:', response.status, errorText);
      return res.status(response.status).json({ error: 'Ошибка генерации' });
    }

    const data = await response.json();
    
    // Извлекаем URL картинки из ответа (структура может отличаться, проверьте документацию Polza.AI)
    const imageUrl = data.data?.[0]?.url || data.url || data.image_url;
    
    if (!imageUrl) {
      console.error('Не найден URL в ответе:', JSON.stringify(data));
      return res.status(500).json({ error: 'Не удалось получить картинку' });
    }

    res.json({ imageUrl: imageUrl });
  } catch (error) {
    console.error('Ошибка сервера:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
