# 使用官方 Node.js 镜像
FROM node:16

# 设置工作目录
WORKDIR /app

# 将当前目录下的所有文件复制到容器的 /app 目录
COPY . .

# 安装依赖
RUN npm install

# 暴露应用端口
EXPOSE 3000

# 启动服务器
CMD ["node", "server.js"]
