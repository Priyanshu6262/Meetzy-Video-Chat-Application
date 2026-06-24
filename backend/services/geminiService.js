const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

const initGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    console.warn('⚠️ GEMINI_API_KEY is not configured or is a placeholder. AI suggestions will be disabled.');
    return false;
  }
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    console.log('✅ Gemini AI successfully initialized');
    return true;
  } catch (err) {
    console.error('❌ Failed to initialize Gemini AI:', err);
    return false;
  }
};

const mockSuggestions = (lastMessageText) => {
  const text = (lastMessageText || '').toLowerCase();

  if (text.includes('meeting') || text.includes('schedule') || text.includes('connect') || text.includes('time') || text.includes('11')) {
    return {
      detectedLanguage: "en",
      english: [
        "Sure, 11 AM works for me.",
        "Yes, let's connect then.",
        "Sounds good, see you tomorrow."
      ],
      hinglish: [
        "Haan, 11 AM mere liye theek hai.",
        "Bilkul, kal connect karte hain.",
        "Theek hai, kal milte hain."
      ]
    };
  }

  if (text.includes('hi') || text.includes('hello') || text.includes('hey')) {
    return {
      detectedLanguage: "en",
      english: [
        "Hello! How can I help you?",
        "Hey! What's up?",
        "Hi there! Good to hear from you."
      ],
      hinglish: [
        "Hello! Kaise ho?",
        "Hey! Kya chal raha hai?",
        "Hi! Sab theek?"
      ]
    };
  }

  return {
    detectedLanguage: "en",
    english: [
      "Sure, sounds good!",
      "Let's do it.",
      "Thanks for the update.",
      "I'll get back to you soon."
    ],
    hinglish: [
      "Haan, bilkul hai.",
      "Theek hai, karte hain.",
      "Batane ke liye shukriya.",
      "Main thodi der mein reply karta hoon."
    ]
  };
};

const generateSuggestions = async (messages) => {
  const lastMessageText = messages.length > 0 ? messages[messages.length - 1].text : '';

  if (!model) {
    if (!initGemini()) {
      console.warn('⚠️ GEMINI_API_KEY is not configured. Returning mock suggestions.');
      return mockSuggestions(lastMessageText);
    }
  }

  const prompt = `
You are an AI assistant built into Meetzy, a modern real-time video chat application.
Analyze the conversation history and generate 3 to 5 reply suggestions for the last message in the chat.
Suggestions should be short (5-20 words), natural, ready-to-send, and contextually appropriate.
Generate suggestion options in both English and Hinglish (Hindi written in English letters, e.g. "Haan, kal connect karte hain").

Detect if the conversation's primary language is English or Hindi/Hinglish. Set the "detectedLanguage" field to "en" or "hi" accordingly.

Return the response strictly as a JSON object with this structure:
{
  "detectedLanguage": "en" | "hi",
  "english": [
    "Suggestion 1",
    "Suggestion 2",
    "Suggestion 3"
  ],
  "hinglish": [
    "Suggestion 1",
    "Suggestion 2",
    "Suggestion 3"
  ]
}

Conversation History (chronological order):
${messages.map(m => `${m.senderName}: ${m.text}`).join('\n')}
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error('❌ Error generating suggestions from Gemini, falling back to mocks:', error);
    return mockSuggestions(lastMessageText);
  }
};

const mockAutoReply = (lastMessageText, style, languagePref) => {
  const text = (lastMessageText || '').toLowerCase();

  let isHinglish = languagePref === 'hinglish';
  if (languagePref === 'auto') {
    const hindiWords = ['kya', 'hai', 'kal', 'milte', 'theek', 'haan', 'na', 'kuch', 'baje', 'karna', 'ho'];
    isHinglish = hindiWords.some(w => text.includes(w));
  }

  if (style === 'professional') {
    if (isHinglish) {
      return "Main is baare mein check karke aapko jald hi batata hoon.";
    }
    return "Thank you for your message. I will check the details and get back to you shortly.";
  } else if (style === 'casual') {
    if (isHinglish) {
      return "Theek hai, badhiya! Kal baat karte hain.";
    }
    return "Cool, sounds good! Talk to you later.";
  } else {
    if (isHinglish) {
      return "Haan bilkul, main jald hi connect karta hoon! Tab tak take care.";
    }
    return "Sure, that sounds wonderful! Looking forward to connecting with you soon.";
  }
};

const generateAutoReply = async (messages, style = 'friendly', languagePref = 'auto') => {
  const lastMessageText = messages.length > 0 ? messages[messages.length - 1].text : '';

  if (!model) {
    if (!initGemini()) {
      console.warn('⚠️ GEMINI_API_KEY is not configured. Returning mock auto-reply.');
      return { shouldReply: true, replyText: mockAutoReply(lastMessageText, style, languagePref) };
    }
  }

  const prompt = `
You are Meetzy Smart Auto Reply Assistant.
Your job is to analyze the conversation history and write a natural, concise, human-like reply on behalf of the last participant's peer.
Analyze the sentiment, tone, and intent of the last message.

Language Rules:
- If language preference is "auto": Detect the conversation language automatically. Reply in English if the conversation is in English. Reply in Hinglish if the conversation is in Hindi or Hinglish.
- If language preference is "english": Write the reply in English.
- If language preference is "hinglish": Write the reply in Hinglish (Hindi written in English letters, e.g. "Haan, kal milte hain").

Tone Rules:
- If response style is "professional": Keep it polite, formal, helpful, and professional.
- If response style is "friendly": Keep it warm, encouraging, polite, and friendly.
- If response style is "casual": Keep it relaxed, informal, short, and casual.

Smart Conditions:
- Keep the reply concise (5-20 words).
- Do not mention that you are an AI assistant.
- If a response is unnecessary, redundant, or spam, reply with exactly "SKIP_REPLY".
- Avoid repetitive or duplicate responses.

Return the response strictly as a JSON object:
{
  "shouldReply": true | false,
  "replyText": "The auto-generated reply text here"
}
Do not output anything else but raw JSON. No markdown.

Conversation History (chronological):
${messages.map(m => `${m.senderName}: ${m.text}`).join('\n')}
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    if (data.replyText === 'SKIP_REPLY') {
      data.shouldReply = false;
    }
    return data;
  } catch (error) {
    console.error('❌ Error generating auto-reply from Gemini, falling back to mocks:', error);
    return { shouldReply: true, replyText: mockAutoReply(lastMessageText, style, languagePref) };
  }
};

module.exports = {
  generateSuggestions,
  generateAutoReply,
  initGemini
};
