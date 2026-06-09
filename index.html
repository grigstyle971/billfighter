// Extracts text from an uploaded medical bill (PDF or image)
// PDF: parsed with pdf-parse. Image: OCR via OCR.space free API.
const https = require('https');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Bad JSON' }) }; }

  const { fileBase64, fileType, fileName } = body;
  if (!fileBase64) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'No file provided' }) };

  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const isPdf = (fileType && fileType.includes('pdf')) || (fileName && fileName.toLowerCase().endsWith('.pdf'));

    let text = '';
    if (isPdf) {
      // Import the internal lib directly: the package's index.js runs debug code
      // that reads a local test PDF, which crashes in serverless environments.
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      const data = await pdfParse(buffer);
      text = (data.text || '').trim();
      // If PDF has almost no text, it's likely a scanned image PDF -> OCR fallback
      if (text.length < 40) {
        text = await ocrSpace(fileBase64, 'application/pdf');
      }
    } else {
      // Image -> OCR
      text = await ocrSpace(fileBase64, fileType || 'image/jpeg');
    }

    if (!text || text.trim().length < 20) {
      return { statusCode: 422, headers: cors, body: JSON.stringify({ error: 'Could not read text from this file. Please upload a clearer photo or a PDF.' }) };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ text: text.trim() }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Extraction failed: ' + e.message }) };
  }
};

// OCR.space free API - no signup needed with the free 'helloworld' key (rate limited)
// We use a real free key set via env OCR_SPACE_KEY for reliability.
function ocrSpace(base64, mime) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OCR_SPACE_KEY || 'helloworld';
    const dataUrl = `data:${mime};base64,${base64}`;
    const postData = new URLSearchParams({
      base64Image: dataUrl,
      language: 'eng',
      isOverlayRequired: 'false',
      OCREngine: '2',
      scale: 'true',
      detectOrientation: 'true',
    }).toString();

    const req = https.request({
      hostname: 'api.ocr.space',
      path: '/parse/image',
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.IsErroredOnProcessing) return reject(new Error(j.ErrorMessage ? j.ErrorMessage[0] : 'OCR error'));
          const parsed = (j.ParsedResults || []).map(r => r.ParsedText).join('\n');
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}
