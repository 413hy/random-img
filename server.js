const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 存放图片的目录路径
const imagesDir = path.join(__dirname, 'images');

// 获取随机图片文件，根据设备类型选择不同的目录
const getRandomImage = (userAgent) => {
  let deviceType = 'computer'; // 默认设备类型为电脑
  
  // 检查 User-Agent 来识别设备类型
  if (/mobile/i.test(userAgent)) {
    deviceType = 'phone';  // 如果是手机
  }

  const deviceDir = path.join(imagesDir, deviceType);
  const files = fs.readdirSync(deviceDir);
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return {
    path: path.join(deviceDir, randomFile),
    filename: randomFile
  };
};

// 路由：返回随机图片
app.get('/', (req, res) => {
  const userAgent = req.get('User-Agent');  // 获取请求头中的 User-Agent
  const image = getRandomImage(userAgent);
  
  // 返回HTML页面，而不是直接返回图片
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
app.get('/image', (req, res) => {
  const userAgent = req.get('User-Agent');
  const image = getRandomImage(userAgent);
  
  // 设置响应头，防止图片压缩
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'image/jpeg');
  
  // 发送文件
  res.sendFile(image.path);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
