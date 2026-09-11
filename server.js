const express = require('express');
const cors = require('cors');
const { NalogApi } = require('lknpd-nalog-api');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const SERVER_URL = process.env.SERVER_URL || 'https://neyra-studio-server.relaxdev.ru';

// Клиент для «Мой налог» (авторизация по ИНН и паролю)
const nalogApi = new NalogApi({
  inn: process.env.NALOG_INN,
  password: process.env.NALOG_PASSWORD
});

// Главная страница для проверки
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Neyra Studio сервер работает' });
});

// Создание платежа в ЮKassa
app.post('/create-payment', async (req, res) => {
  try {
    const { amount, description } = req.body;
    const auth = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': Date.now().toString(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: { value: amount, currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${SERVER_URL}/payment-success`
        },
        description: description || 'Покупка генераций в Neyra Studio'
      })
    });

    const data = await response.json();

    if (data.confirmation && data.confirmation.confirmation_url) {
      res.json({ paymentUrl: data.confirmation.confirmation_url });
    } else {
      res.status(500).json({ error: 'Не удалось создать платёж', details: data });
    }
  } catch (error) {
    console.error('Ошибка создания платежа:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Страница успешной оплаты
app.get('/payment-success', (req, res) => {
  res.send('<h1>Оплата прошла успешно!</h1><p>Вернитесь в приложение.</p>');
});

// 🔔 Вебхук от ЮKassa: автоматическое создание чека в «Мой налог»
app.post('/yookassa-webhook', async (req, res) => {
  const event = req.body;
  console.log('Вебхук от ЮKassa:', JSON.stringify(event));

  if (event.event === 'payment.succeeded') {
    const amount = parseFloat(event.object.amount.value);
    const description = event.object.description || 'Генерация в Neyra Studio';

    console.log('Платёж успешен! Сумма:', amount);

    try {
      const receipt = await nalogApi.addIncome({
        name: description,
        amount: amount,
        quantity: 1
      });
      console.log('Чек успешно создан! Ответ:', JSON.stringify(receipt));
    } catch (error) {
      console.error('Ошибка создания чека в «Мой налог»:', error.message);
    }
  }

  res.status(200).json({ status: 'ok' });
});

// Генерация изображения через Polza.AI
app.post('/generate', async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Нет промпта' });
    }

    const POLZA_KEY = process.env.POLZA_API_KEY;

    const response = await fetch('https://api.polza.ai/api/v1/media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${POLZA_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash-image',
        input: { prompt: prompt, aspect_ratio: '1:1' }
      })
    });

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url || data.url || data.image_url;

    if (!imageUrl) {
      return res.status(500).json({ error: 'Не удалось получить картинку', details: data });
    }

    res.json({ imageUrl: imageUrl });
  } catch (error) {
    console.error('Ошибка генерации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
