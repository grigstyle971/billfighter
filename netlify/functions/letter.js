// Generates a formal appeal/dispute letter based on the analysis. Called after payment.
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

  const { analysis, billText } = body;
  if (!analysis) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'No analysis' }) };

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Service not configured' }) };

  const issuesText = (analysis.issues || []).map((i, n) =>
    `${n + 1}. [${i.severity}] ${i.type}: "${i.line_item}" — ${i.problem} (Action: ${i.action})`
  ).join('\n');

  const prompt = `You are a medical billing advocate writing a formal dispute letter on behalf of a patient. Write a professional, firm but polite letter the patient will mail/email to the hospital billing department to dispute the issues found.

RULES:
- Reference ONLY the specific issues provided below. Do not invent new ones.
- Use a confident, professional tone that signals the patient knows their rights.
- Request an itemized review and correction of each issue.
- Mention the patient's right to request an itemized bill and to dispute charges.
- Include placeholders in [BRACKETS] for: patient name, address, account number, date — so the user can fill them in.
- Cite the specific line items and dollar amounts from the issues.
- End with a clear request and a reasonable deadline (30 days).
- Keep it to one page. Output PLAIN TEXT only (no markdown, no JSON).

BILL SUMMARY:
- Total billed: ${analysis.total_billed || 'see bill'}
- Patient responsibility: ${analysis.patient_responsibility || 'see bill'}
- Estimated disputed amount: ${analysis.estimated_total_savings || 'see issues'}

ISSUES TO DISPUTE:
${issuesText}

Write the complete letter now:`;

  const reqBody = JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2000,
    temperature: 0.4,
    messages: [
      { role: 'system', content: 'You write professional medical billing dispute letters for US patients. Plain text only. Firm, polite, specific. Never fabricate facts beyond the provided issues.' },
      { role: 'user', content: prompt },
    ],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.groq.com', path: '/openai/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY, 'Content-Length': Buffer.byteLength(reqBody) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return resolve({ statusCode: 500, headers: cors, body: JSON.stringify({ error: parsed.error.message }) });
          const letter = parsed.choices[0].message.content.trim();
          resolve({ statusCode: 200, headers: cors, body: JSON.stringify({ letter }) });
        } catch (e) {
          resolve({ statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Letter generation error: ' + e.message }) });
        }
      });
    });
    req.on('error', e => resolve({ statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) }));
    req.write(reqBody); req.end();
  });
};
