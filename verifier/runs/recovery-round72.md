# Regalia round-72 恢复与证据边界

日期：2026-11-22（UTC）。

## 权威来源

1. 固定比较基线：`f78317919818a02c1fa169a99b85cad6ebf8a1fe`（PR #59 变更前 head）。
2. 本轮开始及定稿前再次查询的远端 `upload`：`a245de549b473812aa36f0158f3f8b1a98a4a3e5`。
3. round-72 新源码 ZIP 是本轮验证器和文档的交付快照；round-71 原始 ZIP 保持原哈希，不被覆盖。
4. `/tmp/regalia-r72/work` 是易失本地 Git 工作树；本地验证提交不表示远端推送。持久证据位于 `/mnt/agents/work/regalia-r72/recovery/`。

## 许可包保护记录

实施前先将远端当前 `LICENSE&NOTICE.zip` 独立保存为 recovery 中的 `LICENSE&NOTICE.current.zip`。本次观察值：56,011 B，SHA-256 `d4bd3cd4752421aac192475bda7bdb5042964b5eec3102c836265c25f666595b`，CRC 正常。它与 round-71 原始 ZIP 内同大小但不同 SHA-256 的历史快照不同，未执行 restore、旧 ZIP 覆盖或 reset 回退。

这些数值只识别本次当前版本。后续人工更新仍然优先，不得强制回到上述大小或哈希。任何清理措施都不删除当前根许可包。

## 自动解压通道恢复

远端当前树缺 round-71 的 Dependabot 配置，CodeQL/MobSF 工作流也落后于最终 round-71 ZIP。本轮只恢复以下已验证项：

- CodeQL：tracked JNI/C++ 的 `c-cpp` no-build；checkout `persist-credentials: false`。
- MobSF：`mobsfscan==1.2.0`。
- Dependabot：Gradle/GitHub Actions 周检配置。
- `gradlew`：Git index mode `100755`。

未从旧 ZIP 覆盖根许可包，未改业务源码或资源。

## 验证器历史

v4–v10 保留。v9 页首新增“被 v10/v11 取代”标记，但旧条款未删除。v11 新增固定基线、通用有界递归扫描、脱敏诊断、完整 manifest、独占输出与日志、当前许可包规则和实际下载 APK 门禁。测试脚本自身曾出现计数与累积 glob 断言错误；失败日志保留，修正后重新运行，不将失败运行算作通过。

## 日志与最终 ZIP 自引用

v11 wrapper 日志位于源码树 `verifier/runs/`。最终源码 ZIP 写出后产生的 verify、secret-scan 和交付身份记录属于 post-package 证据，只写入 recovery/交付清单，不回写已验证 ZIP。若未来有意重新打包，必须将其视为新产物并重新验证、另记哈希。

## 秘密边界

两项口令只在扫描进程环境中从用户上传签名信息读取，值不打印、不写入脚本、日志、源码 ZIP、指南或交付清单。测试使用明确的合成 sentinel，不使用真实口令。密钥库不进入源码包。
