/* 后端地址按主机名分流，不写死任何第三方域名。
   GitHub Pages 静态演示：apiBase 留空 = 纯本地，页面不会发出任何网络请求。
   qoder.zone 正式站点：走同源 Function（/functions/v1/app），
   但即便在这里，也只有用户在「我的 → 数据与隐私」里手动打开上传开关，页面才会发数据。 */
(function () {
  var host = (location.hostname || "").toLowerCase();
  var local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  var live = /(^|\.)qoder\.zone$/.test(host) || local;
  window.RUMI_CONFIG = {
    apiBase: live ? "/functions/v1/app" : "",
    allowUpload: live,
    timeoutMs: 8000,
    contact: ""
  };
})();
