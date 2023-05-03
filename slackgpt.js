const { WebClient } = require('@slack/web-api');
const { SocketModeClient } = require('@slack/socket-mode');
const OpenAI = require('openai');
require('dotenv').config();

const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const webClient = new WebClient(SLACK_BOT_TOKEN);
const socketModeClient = new SocketModeClient({
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
});

OpenAI.apiKey = OPENAI_API_KEY;

const conversationCache = new Map();

async function chatWithGPT(prompt, conversationID) {
  const previousMessages = conversationCache.get(conversationID) || [
    { role: 'system', content: 'You are a helpful assistant.' },
  ];

  const response = await OpenAI.ChatCompletion.create({
    model: 'gpt-3.5-turbo',
    messages: [...previousMessages, { role: 'user', content: prompt }],
  });

  const assistantReply = response.choices[0].message.content.trim();

  conversationCache.set(conversationID, [
    ...previousMessages,
    { role: 'user', content: prompt },
    { role: 'assistant', content: assistantReply },
  ]);

  return assistantReply;
}

socketModeClient.on('events_api', async ({ event, body, ack }) => {
  console.log('Received event:', JSON.stringify(event));

  try {
    if (event.type === 'app_mention') {
      const text = event.text.replace(/<@[^>]+>/g, '').trim(); // Remove mention from text
      const user = event.user;
      const channel = event.channel;

      console.log('Processing app_mention event...');

      const assistantReply = await chatWithGPT(text, channel);

      await webClient.chat.postMessage({
        channel,
        text: `<@${user}> ${assistantReply}`,
      });

      console.log('Replied to app_mention event');
    } else if (event.type === 'message' && event.channel_type === 'im') {
      const text = event.text;
      const user = event.user;
      const channel = event.channel;

      console.log('Processing direct message event...');

      const assistantReply = await chatWithGPT(text, channel);

      await webClient.chat.postMessage({
        channel,
        text: `<@${user}> ${assistantReply}`,
      });

      console.log('Replied to direct message event');
    } else {
      console.log('Unhandled event type:', event.type);
    }
    await ack();
  } catch (error) {
    console.error(`Error handling event: ${error}`);
    await ack();
  }
});

(async () => {
  try {
    await socketModeClient.start();
    console.log('App started with Socket Mode');
  } catch (error) {
    console.error(`Error starting the app: ${error}`);
  }
})();
