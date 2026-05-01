// Lambda with Function URL enabled
export const handler = async (event) => {
  const deeplProdApiKey = process.env.DEEPL_API_KEY;
  const deeplDevApiKey = process.env.DEEPL_DEV_API_KEY;

  let body;
  if (typeof event.body === 'string') {
    body = JSON.parse(event.body);
  } else {
    body = event.body;
  }

  // Get environment from request body, default to 'prod'
  const environment = body?.environment || 'prod';

  // Determine API URL and key based on environment
  const apiBaseUrl = environment === 'dev'
    ? 'https://api-dev.deepl.com'
    : 'https://api.deepl.com';

  const apiKey = environment === 'dev' ? deeplDevApiKey : deeplProdApiKey;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `Missing API key for ${environment} environment. Please set DEEPL_${environment.toUpperCase()}_API_KEY environment variable.`
      })
    };
  }

  try {
    const reqBody = JSON.stringify({
      source_media_content_type: body.source_media_content_type || 'audio/pcm;encoding=s16le;rate=16000',
      target_media_content_type: body.target_media_content_type || 'audio/pcm;encoding=s16le;rate=16000',
      source_language: body.source_language || 'en',
      source_language_mode: body.source_language_mode || 'fixed',
      target_languages: body.target_languages,
      target_media_languages: body.target_media_languages || body.target_languages,
      target_media_voice: body.target_media_voice || 'female',
      formality: body.formality || 'default'
    })
    console.log(`[${environment.toUpperCase()}] Sending request to ${apiBaseUrl}/v3/voice/realtime`)
    console.log(`Request body: ${reqBody}`)
    const response = await fetch(`${apiBaseUrl}/v3/voice/realtime`, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: reqBody
    });

    const rawResponseBody = await response.text();
    let data;
    try {
      data = JSON.parse(rawResponseBody);
    } catch {
      data = { raw: rawResponseBody };
    }

    console.log(`DeepL response status: ${response.status}`);
    console.log(`DeepL response body: ${JSON.stringify(data)}`);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: `DeepL API error: ${response.status}`,
          deepl: data
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};