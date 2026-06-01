import 'dotenv/config';
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePost } from './generator.js';
import { postToFacebook } from './facebook.js';
import { selectImage, logImageSelection } from './images.js';
import { selectTopic } from './topics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_LOG_FILE = path.join(__dirname, 'posts-log.json');
const FAILED_POSTS_FILE = path.join(__dirname, 'failed-posts.json');
const MAX_LOG_ENTRIES = 30;

function timestamp() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[${timestamp()}] ${message}`);
}

function logError(message, error) {
  const detail = error?.message || String(error);
  console.error(`[${timestamp()}] ERROR: ${message} — ${detail}`);
  if (error?.stack) {
    console.error(error.stack);
  }
}

async function loadPostsLog() {
  try {
    const raw = await fs.readFile(POSTS_LOG_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.posts) ? data : { posts: [] };
  } catch {
    return { posts: [] };
  }
}

async function savePostLog(entry) {
  const logData = await loadPostsLog();
  logData.posts.unshift(entry);
  logData.posts = logData.posts.slice(0, MAX_LOG_ENTRIES);
  await fs.writeFile(POSTS_LOG_FILE, JSON.stringify(logData, null, 2), 'utf-8');
}

async function saveFailedAttempt(entry) {
  let failures = [];
  try {
    const raw = await fs.readFile(FAILED_POSTS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    failures = Array.isArray(data) ? data : [];
  } catch {
    failures = [];
  }
  failures.push(entry);
  await fs.writeFile(FAILED_POSTS_FILE, JSON.stringify(failures, null, 2), 'utf-8');
}

function getLastCategoryId(posts) {
  return posts.length > 0 ? posts[0].categoryId : null;
}

function getRecentlyUsedImages(posts) {
  return posts.map((post) => post.imagePath).filter(Boolean);
}

async function runDailyPost() {
  log('Starting daily post job...');

  try {
    const logData = await loadPostsLog();
    const lastCategoryId = getLastCategoryId(logData.posts);
    const now = new Date();
    const { category, formatAngle, formatAnglePrompt } = selectTopic(lastCategoryId, now);

    log(`Selected category: ${category.name} | Format: ${formatAngle}`);

    const { imagePath, poolSize } = await selectImage(getRecentlyUsedImages(logData.posts));
    logImageSelection(imagePath, poolSize, log);

    const content = await generatePost(now, category, formatAnglePrompt, (msg) =>
      console.log(msg)
    );

    const postId = await postToFacebook(content, {
      imagePath,
      log: (msg) => console.log(msg),
    });

    await savePostLog({
      timestamp: timestamp(),
      categoryId: category.id,
      categoryName: category.name,
      formatAngle,
      content,
      imagePath,
      facebookPostId: postId,
    });

    log('Daily post job completed successfully.');
  } catch (error) {
    logError('Daily post job failed', error);
    await saveFailedAttempt({
      timestamp: timestamp(),
      error: error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message,
    }).catch((saveErr) => logError('Could not save to failed-posts.json', saveErr));
    process.exitCode = 1;
  }
}

function validateEnv() {
  const required = [
    'ANTHROPIC_API_KEY',
    'FACEBOOK_PAGE_ID',
    'FACEBOOK_PAGE_ACCESS_TOKEN',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function startScheduler() {
  const hour = process.env.POST_HOUR || '20';
  const minute = process.env.POST_MINUTE || '0';
  const timezone = process.env.TIMEZONE || 'Africa/Cairo';

  const cronExpression = `${minute} ${hour} * * *`;

  log(`Scheduler started — daily at ${hour}:${String(minute).padStart(2, '0')} (${timezone})`);
  log(`Cron expression: ${cronExpression}`);

  cron.schedule(
    cronExpression,
    () => {
      runDailyPost();
    },
    { timezone }
  );
}

async function main() {
  const runNow = process.argv.includes('--now');

  try {
    validateEnv();
  } catch (error) {
    logError('Environment validation failed', error);
    process.exit(1);
  }

  if (runNow) {
    log('Running immediate post (--now flag)...');
    await runDailyPost();
    process.exit(process.exitCode || 0);
  }

  startScheduler();
  log('Waiting for scheduled run. Press Ctrl+C to stop.');
}

main().catch((error) => {
  logError('Unhandled error in main', error);
  process.exit(1);
});
