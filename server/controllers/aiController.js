const buildAiErrorMessage = (error) => {
  const statusCode = error?.status || error?.response?.status;
  const errorCode = error?.code || error?.error?.code;

  if (statusCode === 401 || errorCode === 'INVALID_ARGUMENT' || errorCode === 'invalid_api_key') {
    return 'Gemini API key is invalid or expired. Please replace GEMINI_API_KEY in server/.env with a valid Google AI Studio key.';
  }

  if (statusCode === 429) {
    return 'Gemini quota or rate limit has been reached. Please try again later or use a different key.';
  }

  if (statusCode === 400) {
    return 'The AI request could not be processed. Please check the request details and try again.';
  }

  return 'AI response failed. Please try again in a moment.';
};

const getGeminiApiKey = () => process.env.GEMINI_API_KEY;

exports.chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const geminiApiKey = getGeminiApiKey();

    if (!geminiApiKey) {
      return res.status(500).json({
        message:
          'AI service is not configured. Please add GEMINI_API_KEY in the backend environment.',
      });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: 'You are a helpful academic tutor for students and teachers. Provide clear, concise, educational answers and stay focused on learning.',
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: message.trim() }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      const providerError = new Error(payload?.error?.message || 'Gemini request failed.');
      providerError.status = response.status;
      providerError.code = payload?.error?.status || payload?.error?.code;
      providerError.error = payload?.error;
      throw providerError;
    }

    const reply = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!reply) {
      return res.status(500).json({ message: 'AI service returned an empty response.' });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('AI chat error:', error.message);
    const statusCode = error?.status || 500;
    return res.status(statusCode).json({
      message: buildAiErrorMessage(error),
    });
  }
};
