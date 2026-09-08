import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildProfile } from './src/profile/profileBuilder.js';
import { runPipeline } from './src/pipeline.js';
import { geminiStatus } from './src/llm/llmClient.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const app = express();
const port = Number(process.env.PORT || 3000);

if (process.env.GEMINI_API_KEY) {
  console.log('[GEMINI API STATUS]: ACTIVE (Key detected)');
  console.log(`[GEMINI MODEL]: ${process.env.GEMINI_MODEL || 'auto fallback: gemini-3.5-flash → gemini-3.1-flash-lite → gemini-2.5-flash'}`);
} else {
  console.warn('[GEMINI API STATUS]: INACTIVE (GEMINI_API_KEY missing). Server remains online so the UI can show a clear configuration error.');
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true, methods: ['GET', 'POST'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(isPdf ? null : new Error('Only PDF files are allowed.'), isPdf);
  }
});

async function extractPdf(file, label) {
  if (!file) {
    const error = new Error(`${label} PDF is required.`);
    error.status = 400;
    throw error;
  }
  let parsed;
  try {
    parsed = await pdfParse(file.buffer);
  } catch {
    const error = new Error(`${label} PDF could not be read. Upload a valid text-based PDF.`);
    error.status = 422;
    throw error;
  }
  const text = String(parsed.text || '').replace(/\u0000/g, '').trim();
  if (text.length < 20) {
    const error = new Error(`${label} PDF has insufficient extractable text. Scanned/image-only PDFs are not supported yet.`);
    error.status = 422;
    throw error;
  }
  return text;
}

app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.get('/api/health', (_req, res) => res.json({ ok: true, gemini: geminiStatus() }));

app.post('/api/evaluate', upload.fields([
  { name: 'resumeFile', maxCount: 1 },
  { name: 'transcriptFile', maxCount: 1 },
  { name: 'jdFile', maxCount: 1 }
]), async (req, res, next) => {
  try {
    const files = req.files || {};
    const [resumeText, transcriptText, jdText] = await Promise.all([
      extractPdf(files.resumeFile?.[0], 'Resume'),
      extractPdf(files.transcriptFile?.[0], 'Transcript'),
      extractPdf(files.jdFile?.[0], 'Job Description')
    ]);

    const profile = buildProfile({ resumeText, transcriptText, jdText });
    const result = await runPipeline(profile);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || (error instanceof multer.MulterError ? 400 : 500);
  const code = error.code || 'REQUEST_FAILED';
  console.error(`[${code}]`, error.message);
  const message = status >= 500
    ? 'Evaluation could not be completed. Check the server configuration and Gemini model availability.'
    : error.message;
  res.status(status).json({ ok: false, error: { code, message } });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}

export default app;
