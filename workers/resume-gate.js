const VALID_CODES = new Set([
  "W66LMCCV", "AFXUR6WM", "X5LLYMNX", "4DMD9QDT", "JUGXHX32",
  "GCBANCAH", "2AP8DFYC", "HANYDTGX", "NGC6ZKM9", "XLWL3RTY",
  "VDBHWSCM", "MAD2U6SQ", "9TERLUNA", "JEBDHPGY", "5SLXTFDG",
  "NTLC8R2H", "84UTLK4K", "Y5L4M68G", "2YHBHFPB", "QA76NG8U",
  "Y7TPB82S", "CVBGYFVC", "AB6U2DRL", "EDKDNUTE", "CQ5DXA78",
  "MYKM4DKJ", "AU4ZVGZA", "7D7SRWG2", "3NPW5PTB", "WR6D4GPF",
  "JSR6NCXQ", "QHC7RGXF", "CMR6YHAA", "C5ZBQS9A", "LWMJXZ8Z",
  "NFNR24T5", "W4XT5DNX", "VMT34Q9F", "2ZQXMHDG", "Z3AKYT75",
  "PZKYQW9N", "LMM3GY6H", "XUE8WH3J", "GJCUPWJ3", "U4U3GPTB",
  "48AUKZGC", "PEFPEV4E", "FW9VTJXC", "VDJP2J6W", "V2LXTQFG",
  "YH6JCAD9", "EYX3SBJV", "TEH6T94X", "7S26AENH", "SEWN5YN3",
  "UCL9V3NG", "RU8UL6HK", "L6N67Z28", "5Q8K9W6K", "FNZ4M83G",
  "7LYW69K7", "GVW2TYGL", "5WJRLQAW", "3YTEDLCC", "WPBKF7A2",
  "3XKF7FHJ", "VERMLK3L", "M6R3MDC3", "322GBJ8E", "Q6PJ822N",
  "EHAQKFC7", "5MM882RF", "V38FN4KV", "XQBJVBNC", "RDSEKN3H",
  "YM3SHJU2", "FHSLEVAM", "JRNLG5C9", "XAT98RMW", "KYSFEHQN",
  "W68WUB6X", "KCW7F3LT", "YVXVDDL7", "9GEEB66Z", "6VEK74XQ",
  "33LJG9RH", "4ZWDDX3D", "5ZZ9PLTT", "STSP453H", "XHYTAZX7",
  "WWW9QYVR", "A9GXNRK9", "7DTVLRQ2", "GEXHW6VG", "VQUFHYSE",
  "YPJTH9XK", "W9KZZNCJ", "P83RB7Q7", "CZRRCLKF", "ATXRYPUW"
]);

const ALLOWED_ORIGINS = ['https://uxaiworx.com', 'https://www.uxaiworx.com'];
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const WEB3FORMS_KEY = '41cec85b-25c7-4a56-bcd6-a4b68a4365ff';

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rlKey = `rl:${ip}`;
    const now = Date.now();

    // Rate limit check
    let rl = null;
    try {
      const stored = await env.RATE_LIMIT.get(rlKey);
      if (stored) rl = JSON.parse(stored);
    } catch {}

    if (rl && (now - rl.windowStart) < WINDOW_MS && rl.count >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({ valid: false, rateLimited: true }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ valid: false }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const code = String(body.code || '').trim().toUpperCase();

    if (VALID_CODES.has(code)) {
      const timestamp = new Date().toISOString();

      // Notify via Web3Forms (non-blocking)
      try {
        await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            subject: `Resume Download — Code ${code}`,
            from_name: 'UXAI worx Resume Gate',
            email: 'uxaiworx@gmail.com',
            message: `Access code "${code}" was used to download the resume.\nTimestamp: ${timestamp}`,
          }),
        });
      } catch {}

      return new Response(JSON.stringify({ valid: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Invalid — increment rate limit counter
    const newRl = (!rl || (now - rl.windowStart) >= WINDOW_MS)
      ? { count: 1, windowStart: now }
      : { count: rl.count + 1, windowStart: rl.windowStart };

    try {
      await env.RATE_LIMIT.put(rlKey, JSON.stringify(newRl), { expirationTtl: 300 });
    } catch {}

    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
