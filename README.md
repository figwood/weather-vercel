## Weather Dashboard (Vercel + Next.js)

一个使用 Next.js 部署到 Vercel 的天气可视化小应用，数据来源 **OpenWeatherMap**。主页展示：

1. 天气文字描述 (description)
2. 当前温度 (current temp)
3. 未来 24 小时的 3 小时间隔预报温度曲线
4. 当日最高/最低温度 (max / min)，并写入 Vercel KV 构建月度历史
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

Next.js `app/api/weather/route.ts` 现在结合 **Vercel KV** 做多城市缓存：

- KV key 形如：`weather:<city>:<units>:v1`
- 软过期 1h（命中直接返回），KV 硬过期 24h
- 支持查询参数：`city`, `units` (`metric|imperial|standard`), `refresh=58X3KMMmvnY2ZjW` 强制重新抓取并写入 KV

示例：

```
/api/weather?city=Toronto&units=imperial
/api/weather?city=Vancouver&refresh=58X3KMMmvnY2ZjW
```

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

### 已实现功能扩展

- Vercel KV 缓存（多城市、多单位）
- 月度高低温历史持久化（自动每日写入 /api/history）
	- 导出 CSV：`/api/history?city=Calgary&units=metric&year=2025&month=9&format=csv`
- 前端可切换城市、单位，支持快速刷新

### 仍可扩展方向

- 夜间/白天主题切换
- OneCall 历史/统计数据对比
- 用户收藏城市列表持久化（KV List / Postgres / Edge Config）
- 错误重试与速率限制保护

### License

MIT

