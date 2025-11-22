const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

// 注意：原来使用本地 `images/` 目录，这里改为调用 Bing 图片接口并代理图片流
const imagesDir = path.join(__dirname, 'images');

// 从 Bing 获取壁纸列表（最近若干张），随机挑一张返回完整 URL
const fetchJson = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
  }).on('error', reject);
});

const getRandomBingImageUrl = async () => {
  // 请求最近 8 张壁纸（idx=0 最新, n=8）；mkt 可改为 zh-CN
  const api = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN';
  const json = await fetchJson(api);
  if (!json || !json.images || !json.images.length) throw new Error('Bing API 返回空');
  const pick = json.images[Math.floor(Math.random() * json.images.length)];
  // 图片 URL 通常以 /... 开头，需补全域名
  const url = pick.url.startsWith('http') ? pick.url : `https://www.bing.com${pick.url}`;
  // 有些 url 带有参数，保留原样
  return url;
};

// 路由：返回随机图片
app.get('/', (req, res) => {
  // 返回HTML页面，页面中的 `<img>` 会请求 `/image` 获取实际图片
  res.send(`
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>随机图片</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }
        .image-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #000;
        }
        .full-image {
          object-fit: cover;
          width: 100%;
          height: 100%;
          display: block;
          max-width: none;
          max-height: none;
        }
      </style>
    </head>
    <body>
      <div class="image-container">
        <img src="/image" class="full-image" alt="随机图片" />
      </div>
    </body>
    </html>
  `);
});

// 新路由：直接获取图片文件
app.get('/image', async (req, res) => {
  try {
    const url = await getRandomBingImageUrl();

    // 代理请求 Bing 图片并把响应头转发给客户端
    https.get(url, (remoteRes) => {
      // 转发内容类型与缓存控制
      res.setHeader('Cache-Control', 'no-store');
      if (remoteRes.headers['content-type']) {
        res.setHeader('Content-Type', remoteRes.headers['content-type']);
      } else {
        res.setHeader('Content-Type', 'image/jpeg');
      }
      // 如果远端返回非 200，直接传回 502
      if (remoteRes.statusCode !== 200) {
        res.status(502).send('Failed to fetch image from Bing');
        return;
      }
      remoteRes.pipe(res);
    }).on('error', (err) => {
      console.error('Error fetching image:', err);
      res.status(500).send('Error fetching image');
    });
  } catch (e) {
    console.error('Failed to get Bing image URL:', e);
    res.status(500).send('Failed to get image');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
