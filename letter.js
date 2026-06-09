// Analyzes extracted bill text via Groq. Returns structured, factual issues.
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

  const billText = (body.billText || '').slice(0, 12000);
  if (!billText || billText.length < 20) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'No bill text' }) };

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Service not configured' }) };

  const prompt = `You are an expert US medical billing advocate. Analyze this medical bill and find EVERY potential billing problem. Patients overpay because of errors like these — your job is to catch them.

ABSOLUTE RULES:
- ONLY cite charges, codes, and amounts that ACTUALLY appear in the bill text. NEVER invent anything.
- Quote the exact line item verbatim.
- If a fair-price comparison is uncertain, say "request itemized verification" rather than inventing a Medicare rate.
- Be thorough: examine EVERY line. A typical bill has 3-7 issues.

CHECK FOR ALL OF THESE:
1. DUPLICATE CHARGES — identical code or service appearing more than once.
2. UPCODING — ER visit codes 99281(1) to 99285(5). Level 5 (99285) is for life-threatening emergencies. If the bill shows routine tests (CBC, X-ray) without critical intervention, a Level 5 may be upcoded — flag as POSSIBLE upcoding and tell them to request the medical records justification.
3. ROUTINE ITEMS billed separately that should be bundled — single pills (ibuprofen, Tylenol), gauze, gloves, basic supplies. These are usually included in the room/facility fee.
4. FACILITY FEES — often large, sometimes negotiable or duplicated. Flag for review.
5. SERVICES THAT MAY NOT MATCH THE VISIT — e.g., contrast material without imaging that uses it, or procedures inconsistent with the visit type. Flag as POSSIBLE.
6. UNBUNDLING — lab panels (e.g., 80053 metabolic panel) billed alongside individual component tests that are already part of the panel.
7. BALANCE BILLING — if insurance EOB is present, confirm patient is only charged the allowed amount, not the full sticker price.

Return ONLY valid JSON (no markdown fences):
{
  "summary": "2 sentence plain-English overview, mention the total savings opportunity",
  "total_billed": "exact amount from bill or 'Not stated'",
  "patient_responsibility": "exact amount or 'Not stated'",
  "issues": [
    {
      "severity": "high|medium|low",
      "type": "duplicate|upcoding|routine_item|facility_fee|mismatch|unbundling|balance_billing|other",
      "line_item": "exact verbatim quote from bill",
      "problem": "clear 1-2 sentence explanation of why this may be wrong",
      "action": "specific action the patient should take or question to ask",
      "potential_savings": "dollar amount if calculable from the bill, else 'Verify with provider'"
    }
  ],
  "estimated_total_savings": "a dollar range, e.g. '$500 - $2,500'",
  "next_steps": ["3-5 concrete steps the patient should take, in order"]
}

MEDICAL BILL TEXT:
${billText}`;

  const reqBody = JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 3500,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You are a precise, thorough medical billing analyst for US patients. You respond ONLY with valid JSON. You NEVER fabricate charges or amounts not present in the input. You catch every plausible billing error.' },
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
          const text = parsed.choices[0].message.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const result = JSON.parse(text);
          resolve({ statusCode: 200, headers: cors, body: JSON.stringify(result) });
        } catch (e) {
          resolve({ statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Analysis parse error: ' + e.message }) });
        }
      });
    });
    req.on('error', e => resolve({ statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) }));
    req.write(reqBody); req.end();
  });
};
