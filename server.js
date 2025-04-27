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
  return path.join(deviceDir, randomFile);
};

// 路由：返回随机图片
app.get('/', (req, res) => {
  const userAgent = req.get('User-Agent');  // 获取请求头中的 User-Agent
  const imagePath = getRandomImage(userAgent);
  res.sendFile(imagePath);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
