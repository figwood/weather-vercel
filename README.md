## Weather Dashboard (Vercel + Next.js)

一个使用 Next.js 部署到 Vercel 的天气可视化小应用，数据来源 **OpenWeatherMap**。主页展示：

1. 天气文字描述 (description)
2. 当前温度 (current temp)
3. 未来 24 小时的 3 小时间隔预报温度曲线
4. 最高/最低温度 (max / min)
5. 风向、风速 (wind direction / speed)
6. 降雨量 (过去 1~3 小时 & 未来 3 小时间隔预报雨量)
7. 湿度、气压

图表使用 `chart.js + react-chartjs-2`，多 Y 轴展示 温度、降雨、风速。

### 目录结构

```
app/
	api/weather/route.ts      # 后端 API (Edge/Serverless) 聚合当前+预报数据
	components/WeatherChart.tsx
	weather-dashboard.tsx     # 前端页面逻辑（SWR 获取数据、卡片、图表）
	page.tsx                  # 首页入口
	layout.tsx / globals.css  # 布局 & 全局样式
```

### 安装 & 本地运行

1. 克隆仓库后安装依赖：

```bash
npm install
```

2. 添加环境变量：在根目录创建 `.env.local`：

```
OPENWEATHER_API_KEY=你的OpenWeatherMap密钥
```

获取密钥：https://openweathermap.org/ - 注册后在 Dashboard 里查看 API key。

3. 启动开发：

```bash
npm run dev
```

访问 http://localhost:3000 即可。

### 部署到 Vercel

1. 直接导入 Git 仓库
2. 在 Vercel 项目 Settings -> Environment Variables 添加：
	 - `OPENWEATHER_API_KEY` = 你的密钥
3. 触发构建或重新部署
4. 部署完成后访问生成的域名即可

Next.js `app/api/weather/route.ts` 已设置合适的缓存头：`s-maxage=300, stale-while-revalidate=600`，可减少频繁请求。

### API 返回示例

```json
{
	"location": "Calgary",
	"description": "scattered clouds",
	"currentTemp": 12.34,
	"minTemp": 10.5,
	"maxTemp": 15.6,
	"wind": { "speed": 3.2, "deg": 250, "direction": "WSW" },
	"rainLastPeriod": 0,
	"forecast": [
		{ "time": "2025-09-09 03:00:00", "temp": 11.2, "rain3h": 0, "windSpeed": 2.7, "windDir": "SW" }
	]
}
```

### 说明

- 使用 `/data/2.5/weather` 获取当前天气；`/data/2.5/forecast` 获取未来 24 小时（8 * 3h）预报。
- 如果需要更精细的分钟级/一体化数据，可升级到 One Call API 3.0。
- 风向通过度数转换为 16 方位字母（N, NNE, NE...）。
- 图表多轴：温度(折线, 填充)、降雨(柱状)、风速(虚线)。

### 后续可扩展

- 添加缓存层 / Redis 以进一步降低 API 调用
- 夜间/白天主题切换
- 加入 OneCall 历史数据对比
- 增加多个城市切换 & 用户自选收藏

### License

MIT

