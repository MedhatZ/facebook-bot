import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAILED_POSTS_FILE = path.join(__dirname, 'failed-posts.json');
const GRAPH_API_VERSION = 'v19.0';

function timestamp() {
  return new Date().toISOString();
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

async function loadFailedPosts() {
  try {
    const raw = await fs.readFile(FAILED_POSTS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveFailedPost(entry) {
  const failures = await loadFailedPosts();
  failures.push(entry);
  await fs.writeFile(FAILED_POSTS_FILE, JSON.stringify(failures, null, 2), 'utf-8');
}

async function resolvePageAccessToken(pageId, accessToken, log) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}`,
      {
        params: {
          access_token: accessToken,
          fields: 'access_token',
        },
        timeout: 30000,
      }
    );

    if (response.data?.access_token) {
      log(`[${timestamp()}] Resolved Page access token for page ${pageId}`);
      return response.data.access_token;
    }
  } catch (error) {
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    log(`[${timestamp()}] Could not resolve Page token, using provided token: ${detail}`);
  }

  return accessToken;
}

async function postTextOnly(pageId, pageAccessToken, content) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`;

  const response = await axios.post(
    url,
    null,
    {
      params: {
        message: content,
        access_token: pageAccessToken,
      },
      timeout: 30000,
    }
  );

  return response.data?.id;
}

async function postWithPhoto(pageId, pageAccessToken, content, imagePath, log) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photos`;
  const fileBuffer = await fs.readFile(imagePath);
  const mimeType = getMimeType(imagePath);
  const fileName = path.basename(imagePath);

  const form = new FormData();
  form.append('message', content);
  form.append('published', 'true');
  form.append('access_token', pageAccessToken);
  form.append('source', new Blob([fileBuffer], { type: mimeType }), fileName);

  log(`[${timestamp()}] Uploading photo: ${fileName} (${fileBuffer.length} bytes)`);

  const response = await fetch(url, {
    method: 'POST',
    body: form,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Facebook photo upload failed');
    error.response = { data };
    throw error;
  }

  return data?.post_id || data?.id;
}

/**
 * Post content to Facebook Page feed, optionally with a local image.
 * @param {string} content
 * @param {{ imagePath?: string, log?: (msg: string) => void }} [options]
 * @returns {Promise<string>}
 */
export async function postToFacebook(content, options = {}) {
  const { imagePath, log = console.log } = options;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId) {
    throw new Error('FACEBOOK_PAGE_ID is not set in environment variables');
  }
  if (!accessToken) {
    throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN is not set in environment variables');
  }

  try {
    const pageAccessToken = await resolvePageAccessToken(pageId, accessToken, log);

    const postId = imagePath
      ? await postWithPhoto(pageId, pageAccessToken, content, imagePath, log)
      : await postTextOnly(pageId, pageAccessToken, content);

    if (!postId) {
      throw new Error('Facebook API did not return a post ID');
    }

    log(`[${timestamp()}] Posted to Facebook successfully — Post ID: ${postId}`);
    return postId;
  } catch (error) {
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;

    log(`[${timestamp()}] Facebook post failed: ${detail}`);

    await saveFailedPost({
      timestamp: timestamp(),
      content,
      imagePath: imagePath || null,
      error: detail,
    });

    throw error;
  }
}
