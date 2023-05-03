const express = require('express');
const { WebClient } = require('@slack/web-api');
const OpenAI = require('openai');
require('dotenv').config();

const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const webClient = new WebClient(SLACK_BOT_TOKEN);
OpenAI.apiKey = OPENAI_API_KEY;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function chatWithGPT(prompt) {
  const response = await OpenAI.ChatCompletion.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0].message.content.trim();
}

// Handle app_mention and message events
app.post('/events', async (req, res) => {
  const event = req.body.event;

  if (event.type === 'app_mention' || (event.type === 'message' && event.channel_type === 'im')) {
    const text = event.text;
    const user = event.user;

    const assistantReply = await chatWithGPT(text);

    await webClient.chat.postMessage({
      channel: event.channel,
      text: `<@${user}> ${assistantReply}`,
    });
  }

  res.sendStatus(200);
});

// Handle slash command events
app.post('/slackgpt', async (req, res) => {
  const text = req.body.text;

  try {
    const assistantReply = await chatWithGPT(text);

    res.json({
      response_type: 'in_channel',
      text: assistantReply,
    });
  } catch (error) {
    console.error(`Error handling slash command: ${error}`);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
