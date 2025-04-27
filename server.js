const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 存放图片的目录路径
const imagesDir = path.join(__dirname, 'images');

// 获取随机图片文件
const getRandomImage = () => {
  const files = fs.readdirSync(imagesDir);
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, randomFile);
};

// 路由：返回随机图片
app.get('/', (req, res) => {
  const imagePath = getRandomImage();
  res.sendFile(imagePath);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
