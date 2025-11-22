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
  return url;
};

// 新：根据环境变量选择图片来源，默认使用 `picsum`（每次请求都会返回不同图片）
const getRandomImageUrl = async (options = {}) => {
  const source = (process.env.IMAGE_SOURCE || 'picsum').toLowerCase();
  const { w, h, seed, grayscale, blur } = options;
  if (source === 'bing') {
    return await getRandomBingImageUrl();
  }

  // Picsum 用法：/width/height 或 /seed/{seed}/width/height
  // 如果没有提供尺寸，使用 1920x1080 作为默认
  const width = parseInt(w, 10) || 1920;
  const height = parseInt(h, 10) || 1080;

  let url = '';
  if (seed) {
    url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
  } else {
    url = `https://picsum.photos/${width}/${height}`;
  }

  const params = [];
  if (grayscale) params.push('grayscale');
  if (blur) params.push(`blur=${encodeURIComponent(blur)}`);
  // 为了避免浏览器缓存导致重复图片，可在每次请求时添加随机参数或时间戳
  params.push(`random=${Date.now()}`);
  if (params.length) url += `?${params.join('&')}`;

  return url;
};

// 路由：返回随机图片
app.get('/', (req, res) => {
  // 返回HTML页面，页面中的 `<img>` 会请求 `/image?w=...&h=...` 获取针对设备尺寸的图片
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
        <img id="randImg" src="/image" class="full-image" alt="随机图片" />
      </div>
      <script>
        (function () {
          const img = document.getElementById('randImg');
          const DPR = window.devicePixelRatio || 1;
          const maxWidth = 3840; // 限制最大宽度，避免请求过大图片
          const maxHeight = 2160;

          function updateSrc() {
            const w = Math.min(Math.round(window.innerWidth * DPR), maxWidth);
            const h = Math.min(Math.round(window.innerHeight * DPR), maxHeight);
            // 使用 timestamp 避免缓存重复
            img.src = '/image?w=' + w + '&h=' + h + '&random=' + Date.now();
          }

          // 首次设置
          updateSrc();

          // resize 时防抖处理
          let t = null;
          window.addEventListener('resize', function () {
            clearTimeout(t);
            t = setTimeout(updateSrc, 250);
          });

          // 当页面恢复可见时也更新（例如从后台切回），以防设备像素比变化
          document.addEventListener('visibilitychange', function () {
            if (!document.hidden) updateSrc();
          });
        })();
      </script>
    </body>
    </html>
  `);
});

// 新路由：直接获取图片文件
app.get('/image', async (req, res) => {
  try {
    const url = await getRandomImageUrl();

    // 支持跟随重定向的代理函数（最大重定向 5 次）
    const maxRedirects = 5;
    const { URL } = require('url');

    const fetchAndPipe = (targetUrl, redirectsLeft) => {
      https.get(targetUrl, (remoteRes) => {
        // 处理 3xx 重定向
        if (remoteRes.statusCode >= 300 && remoteRes.statusCode < 400 && remoteRes.headers.location) {
          if (redirectsLeft <= 0) {
            res.status(502).send('Too many redirects');
            return;
          }
          // 处理相对 location
          const next = new URL(remoteRes.headers.location, targetUrl).toString();
          remoteRes.resume(); // 丢弃当前响应数据
          fetchAndPipe(next, redirectsLeft - 1);
          return;
        }

        // 非 200 视为错误（除去已经处理的重定向）
        if (remoteRes.statusCode !== 200) {
          res.status(502).send('Failed to fetch image');
          return;
        }

        // 转发 headers
        res.setHeader('Cache-Control', 'no-store');
        if (remoteRes.headers['content-type']) {
          res.setHeader('Content-Type', remoteRes.headers['content-type']);
        } else {
          res.setHeader('Content-Type', 'image/jpeg');
        }
        remoteRes.pipe(res);
      }).on('error', (err) => {
        console.error('Error fetching image:', err);
        res.status(500).send('Error fetching image');
      });
    };

    fetchAndPipe(url, maxRedirects);
  } catch (e) {
    console.error('Failed to get image URL:', e);
    res.status(500).send('Failed to get image');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
