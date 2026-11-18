/* 后端开关。默认全部留空 = 纯本地模式，页面不会请求任何外部地址。
   要接阿里云函数计算，按 docs/BACKEND-ALIYUN.md 部署后把 apiBase 填进来。 */
window.RUMI_CONFIG = {
  apiBase: "",
  allowUpload: false,
  timeoutMs: 8000,
  contact: ""
};
