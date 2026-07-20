// ===================== MODULE: game-logic =====================
// Core chess logic, i18n, animation, and AI/ECO glue for Regalia.
// Contains: board representation, move generation, move execution, Zobrist
// hashing, FEN generation, game status, constants, i18n (T/toggleLang/_i18n),
// personified move animations (Web Animations API), AI move requests, ECO
// recommendation logic, and setup-mode validation.
// Bundled by build-chess.py after chess960.js + pgn-standard.js + worker-pool.js
// and before ai-bridge.js + tablebase.js + eco-data.js + ui.js. References
// globals (gameState, playerColor, AndroidBridge, audioEngine, …) defined in
// ui.js. See README.license for the module merge order.
//
// Copyright (C) 2026 Regalia
//
// PGN disambiguation and SAN notation logic derived from DroidFish
// (Copyright (C) Peter Österlund, GPL v3)
// Modified by Regalia on 2026-06-15
//
// AI-GEN: AI assisted
// This code was AI-assisted and has been reviewed for GPL v3 compliance.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// ===================== i18n SYSTEM =====================
let _lang='zh';
/**
 * SECURITY FIX v1.0.5 (SonarCloud Hotspot #4):
 * Generate a cryptographically secure random integer in [0, max).
 * Replaces Math.random() for security-sensitive random selection.
 * Uses crypto.getRandomValues with rejection sampling to eliminate modulo bias.
 */
function secureRandomInt(max){
  if(max<=1)return 0;
  // v1.1.2 PHASE 71 (robustness): guard against `crypto` being undefined (e.g.
  // in non-browser test harnesses or if a future WebView config strips it).
  // v1.2.1 round-7 (security hardening): fail-safe by returning 0 instead of
  // falling back to Math.random(). Math.random() is a predictable PRNG; using
  // it for Chess960 SP-ID selection or ECO opening-book picks would defeat the
  // purpose of cryptographic randomization. Returning 0 is safe — it selects
  // the first candidate (a valid game state) rather than a predictable pseudo-
  // random one. Mirrors the fail-safe pattern already used by randomSPID in
  // chess960.js (which returns SP-ID 518 = standard chess position).
  if(typeof crypto==='undefined'||!crypto||typeof crypto.getRandomValues!=='function'){
    console.error('secureRandomInt: crypto API unavailable, returning 0 (fail-safe)');
    return 0;
  }
  const buf=new Uint32Array(1);
  const LIMIT=0xFFFFFFFF - (0xFFFFFFFF % max); // largest multiple of max <= 2^32-1
  for(let i=0;i<8;i++){
    crypto.getRandomValues(buf);
    if(buf[0]<LIMIT)return buf[0]%max;
  }
  return buf[0]%max; // fallback after 8 retries (extremely unlikely)
}

function T(key){return _i18n[key]?.[_lang]||_i18n[key]?.zh||key;}
function toggleLang(){_lang=(_lang==='zh')?'en':'zh';
  try{if(typeof Store!=='undefined'&&Store&&typeof Store.dispatch==='function')Store.dispatch('SET_LANG',_lang);}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}try{localStorage.setItem('Regalia_lang',_lang);}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.saveLangPref)AndroidBridge.saveLangPref(_lang);}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentSet)AndroidBridge.persistentSet('Regalia_lang',_lang);}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}try{if(typeof HapticManager!=='undefined'&&HapticManager.fire)HapticManager.fire('TOGGLE_ON');}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}try{if(typeof playSound==='function')playSound('select');}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
  // v1.2.3 P1 (Round 18 i18n-P1-3): Sync <html lang> so TalkBack uses the
  //   correct TTS engine for the active UI language. Previously the attribute
  //   stayed at zh-CN forever, so English UI users heard Chinese speech.
  try{document.documentElement.lang=(_lang==='zh')?'zh-CN':'en';}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
  render();}
const _i18n={
'app_name':{zh:'Regalia',en:'Regalia'},
'new_game':{zh:'新游戏',en:'New Game'},
'free_opening':{zh:'自由开局',en:'Free Play'},
'undo':{zh:'悔棋',en:'Undo'},
'redo':{zh:'撤悔',en:'Redo'},
'flip':{zh:'翻转',en:'Flip'},
'ai_hint':{zh:'AI提示',en:'AI Hint'},
'sound':{zh:'音效',en:'Sound'},
'ctrl_range':{zh:'控制范围',en:'Control'},
'setup_mode':{zh:'摆棋模式',en:'Setup'},
'setup_done':{zh:'完成',en:'Done'},
'ai_opponent':{zh:'AI对手',en:'AI Opponent'},
'you':{zh:'你',en:'You'},
'your_turn':{zh:'轮到你走',en:'Your turn'},
'thinking':{zh:'思考中...',en:'Thinking...'},
'analyzing':{zh:'即将分析',en:'Analyzing'},
'hint_thinking':{zh:'⏳ 思考中...',en:'⏳ Thinking...'},
'multi_analysis':{zh:'多线分析',en:'Multi-line'},
'eco_id':{zh:'ECO开局识别',en:'ECO Opening'},
'opening_rec':{zh:'开局推荐',en:'Opening Rec.'},
'move_history':{zh:'走法记录',en:'Move History'},
'no_moves':{zh:'暂无走法记录',en:'No moves yet'},
'enter_review_hint':{zh:'点击进入复盘界面（可使用 📚 缓存管理器或 🗃️ 导入 PGN）',en:'Click to enter review mode (use 📚 Cache Manager or 🗃️ to import PGN)'},
'stats':{zh:'统计',en:'Stats'},
'stats_title':{zh:'📊 统计数据',en:'📊 Statistics'},
'stats_export_html':{zh:'💾 HTML',en:'💾 HTML'},
'stats_review':{zh:'🗂️ 复盘',en:'🗂️ Review'},
'stats_save_html':{zh:'保存HTML统计文件',en:'Save HTML stats file'},
'stats_saved':{zh:'HTML统计文件已保存',en:'HTML stats file saved'},
'save_pgn_prompt':{zh:'💾 是否保存PGN文件？',en:'💾 Save PGN file?'},
'save_pgn_yes':{zh:'是',en:'Yes'},
'save_pgn_no':{zh:'否',en:'No'},
'white_concedes_move':{zh:'白方让先（黑方先走）',en:'White concedes the move (black to move)'},
'chess_tips':{zh:'棋理提示',en:'Chess Tips'},
'ctrl_info':{zh:'格子控制信息',en:'Square Control'},
'cur_square':{zh:'当前格子',en:'Square'},
'total_ctrl':{zh:'总控制数',en:'Total'},
'my_ctrl':{zh:'我方控制',en:'My Ctrl'},
'op_ctrl':{zh:'对方控制',en:'Opp Ctrl'},
'net_ctrl':{zh:'净控制',en:'Net Ctrl'},
'click_sq':{zh:'点击或悬停格子查看控制信息',en:'Click or hover a square'},
'setup_label':{zh:'🏗️ 摆棋模式',en:'🏗️ Setup Mode'},
'waiting':{zh:'等待...',en:'Waiting...'},
'manual_config':{zh:'⚙️ 手动设置',en:'⚙️ Custom'},
'ponder':{zh:'预判',en:'Ponder'},
'ponder_hint':{zh:'预判（Ponder）',en:'Ponder'},
'ponder_desc':{zh:'开启后，引擎在AI走棋后继续分析对手可能的应手，提升后续走棋质量。会增加耗电，建议充电时开启',en:'Engine continues analyzing opponent\'s likely reply after AI moves. Improves subsequent move quality. Uses more battery, recommended when charging'},
'book_moves':{zh:'使用ECO开局库',en:'Use ECO Book'},
'eco_book_desc':{zh:'开启后，AI将优先从ECO开局库中选择开局走法，使开局更规范',en:'AI prioritizes ECO opening book moves for more standard openings'},
// Chess960 (Fischer Random Chess) UI strings
'chess960_label':{zh:'菲舍尔任意制象棋',en:'Fischer Random (Chess960)'},
'chess960_enable':{zh:'启用 Chess960 模式',en:'Enable Chess960 mode'},
'chess960_spid':{zh:'起始位置编号',en:'Start Position ID'},
'chess960_random':{zh:'随机',en:'Random'},
'chess960_preview':{zh:'起始排列预览',en:'Starting arrangement preview'},
'chess960_note':{zh:'Chess960 模式下不使用 ECO 开局库（无固定开局理论）。王车易位规则：王走至 g1/c1，车走至 f1/d1，与标准象棋终点相同。',en:'Chess960 mode disables ECO opening book (no fixed opening theory). Castling: King ends on g1/c1, Rook ends on f1/d1 — same final squares as standard chess.'},
// Time Control UI strings
'time_control_label':{zh:'计时赛设置',en:'Time Control'},
'time_control_off':{zh:'不计时（日常对局）',en:'Untimed (casual)'},
'time_control_sudden':{zh:'突然死亡制',en:'Sudden Death'},
'time_control_fischer':{zh:'菲舍尔加秒制',en:'Fischer Increment'},
'time_control_bronstein':{zh:'布朗斯坦延迟制',en:'Bronstein Delay'},
'time_control_usdelay':{zh:'美国延迟制',en:'US Delay'},
'time_control_base_min':{zh:'基础时间（分钟）',en:'Base Time (minutes)'},
'time_control_inc_sec':{zh:'每步加秒',en:'Increment (sec/move)'},
'time_control_delay_sec':{zh:'每步延迟秒数',en:'Delay (sec/move)'},
'time_control_note':{zh:'启用计时赛后，PGN 导出将包含 [TimeControl] 头与每步的 [%clk] 注释（剩余时间）；未启用计时赛时，PGN 注释使用 [%emt]（每步实际用时）。',en:'With time control enabled, PGN export includes [TimeControl] header and per-move [%clk] annotations (remaining clock). Without time control, PGN comments use [%emt] (elapsed move time).'},
'time_control_white_clock':{zh:'白方时钟',en:'White Clock'},
'time_control_black_clock':{zh:'黑方时钟',en:'Black Clock'},
'time_control_flag_fell':{zh:'超时！',en:'Time out!'},
'time_control_low':{zh:'时间紧张！',en:'Time trouble!'},
'classic_openings':{zh:'经典开局（可选）',en:'Classic Openings'},
'free_opening_btn':{zh:'自由开局',en:'Free Play'},
'from_start':{zh:'从初始局面开始',en:'From starting position'},
'eco_search_ph':{zh:'输入ECO编号或开局名搜索',en:'Search ECO code or name'},
'all_categories':{zh:'所有分类',en:'All Categories'},
'load_more':{zh:'加载更多',en:'Load More'},
'ai_book':{zh:'AI开局库',en:'AI Opening Book'},
'about_title':{zh:'关于 Regalia',en:'About Regalia'},
// v1.2.3 P1 (Round 18 i18n-P1-1): short aria-label for the ℹ️ header button.
'about':{zh:'关于',en:'About'},
'about_app':{zh:'应用',en:'App'},
'about_engine':{zh:'引擎',en:'Engine'},
'about_platform':{zh:'平台',en:'Platform'},
'close':{zh:'关闭',en:'Close'},
'copyright_license':{zh:'版权与许可',en:'Copyright & License'},
'copy_fen':{zh:'复制当前局面的FEN',en:'Copy current FEN'},
'import_fen':{zh:'导入FEN字符串',en:'Import FEN'},
'fen':{zh:'FEN',en:'FEN'},
'import_label':{zh:'导入',en:'Import'},
'player_color_w':{zh:'执白',en:'White'},
'player_color_b':{zh:'执黑',en:'Black'},
'start_game':{zh:'开始游戏',en:'Start Game'},
'cancel':{zh:'取消',en:'Cancel'},
'white_wins':{zh:'白方获胜',en:'White wins'},
'black_wins':{zh:'黑方获胜',en:'Black wins'},
'checkmate':{zh:'将杀',en:'Checkmate'},
'draw':{zh:'和棋',en:'Draw'},
'play_again':{zh:'再来一局',en:'Play Again'},
'review':{zh:'复盘',en:'Review'},
'variation_toggle':{zh:'💬 变例',en:'💬 Vars'},
'tb_library':{zh:'Syzygy残局库',en:'Syzygy Endgame'},
'tb_query':{zh:'🔭 点击查询残局库',en:'🔭 Query Endgame DB'},
'tb_unavailable':{zh:'🚫 残局库: 暂不可用',en:'🚫 Endgame DB: Unavailable'},
'recommend':{zh:'推荐',en:'Best'},
'depth':{zh:'深度',en:'Depth'},
'nodes':{zh:'节点',en:'Nodes'},
'eval_label':{zh:'评估',en:'Eval'},
// v1.0.4 Rev35: seldepth label for AI opponent bar (选深 / SelDepth).
// The eval bar keeps the abbreviated "SD" for compactness.
'seldepth_label':{zh:'选深',en:'SelDepth'},
'evaluating':{zh:'局势评估',en:'Position Eval'},
'lang_toggle_zh':{zh:'↔️中',en:'↔️中'},
'lang_toggle_en':{zh:'↔️EN',en:'↔️EN'},
'ponder_depth':{zh:'深度',en:'Depth'},
'ponder_nodes':{zh:'节点',en:'Nodes'},
'ponder_eval':{zh:'评估',en:'Eval'},
'level_1':{zh:'初学者',en:'Beginner'},
'level_2':{zh:'新手',en:'Novice'},
'level_3':{zh:'俱乐部棋手',en:'Club'},
'level_4':{zh:'高级棋手',en:'Advanced'},
'level_5':{zh:'候选大师',en:'Candidate'},
'level_6':{zh:'大师',en:'Master'},
'level_7':{zh:'SL档',en:'SL'},
'level_8':{zh:'⚙️ 手动设置',en:'⚙️ Custom'},
'engine_config':{zh:'引擎配置',en:'Engine Config'},
'threads':{zh:'线程数',en:'Threads'},
'hash_size':{zh:'哈希表大小',en:'Hash Size'},
'multi_pv':{zh:'多线分析',en:'MultiPV'},
'move_overhead':{zh:'走法超时',en:'Move Overhead'},
'show_wdl':{zh:'显示胜和负概率',en:'Show WDL'},
'skill_level':{zh:'技能等级',en:'Skill Level'},
'limit_elo':{zh:'限制ELO',en:'Limit ELO'},
'auto_config':{zh:'默认配置',en:'Default Config'},
'export_settings':{zh:'导出设置',en:'Export'},
'import_settings':{zh:'导入设置',en:'Import'},
'pgn_copied':{zh:'PGN已复制到剪贴板',en:'PGN copied to clipboard'},
'export_pgn':{zh:'导出PGN到文件',en:'Export PGN to file'},
'pgn_exported':{zh:'PGN已导出',en:'PGN exported'},
// v1.1.1 Phase 63: Export dialog asking whether to include new annotations
// v1.1.1 Phase 64: Updated text — 💾 emoji in title, "特殊注释" terminology
'pgn_export_include_annotations_title':{zh:'💾 导出PGN',en:'💾 Export PGN'},
'pgn_export_include_annotations_msg':{zh:'是否在导出的PGN中包含特殊注释（视觉注解 [%csl]/[%cal]、评估注释 [%eval]、每5回合评估描述等）？',en:'Include special annotations in the exported PGN (visual annotations [%csl]/[%cal], eval tags [%eval], every-5-moves eval descriptions, etc.)?'},
'pgn_export_include_annotations_yes':{zh:'是，包含特殊注释',en:'Yes, include special annotations'},
'pgn_export_include_annotations_no':{zh:'否，不包含特殊注释',en:'No, exclude special annotations'},
'fen_copied':{zh:'FEN已复制到剪贴板',en:'FEN copied to clipboard'},
'fen_imported':{zh:'FEN导入成功',en:'FEN imported'},
'settings_imported':{zh:'设置导入成功',en:'Settings imported'},
'settings_import_fail':{zh:'导入失败',en:'Import failed'},
'settings_import_done':{zh:'设置导入完成',en:'Settings import done'},
'engine_unavailable':{zh:'引擎不可用，无法计算提示',en:'Engine unavailable'},
'hint_request_failed':{zh:'引擎提示请求失败',en:'Hint request failed'},
'init_failed':{zh:'应用初始化失败',en:'App init failed'},
'webview_unavailable':{zh:'WebView不可用',en:'WebView unavailable'},
'ui_create_failed':{zh:'界面创建失败',en:'UI creation failed'},
'load_failed':{zh:'加载棋盘页面失败',en:'Failed to load board'},
'review_eval':{zh:'复盘评估',en:'Review Eval'},
'exit_review':{zh:'退出复盘',en:'Exit Review'},
'review_analyze':{zh:'🔄 分析全部',en:'🔄 Analyze All'},
'about_copyright':{zh:'© 2026 Regalia. All rights reserved.',en:'© 2026 Regalia. All rights reserved.'},
'about_agpl':{zh:'本应用整体采用',en:'This application is licensed under'},
'about_source_code':{zh:'源代码：https://github.com/YDW99/Regalia',en:'Source code: https://github.com/YDW99/Regalia'},
// v1.0.4 Round-5 Rev27: Split source-code line into prefix + URL so the URL
// can be rendered as a real <a> hyperlink that opens in the system browser
// via AndroidBridge.openUrlInBrowser(). The full-string variant above is
// kept for backward compatibility (other call sites that don't need the link).
'about_source_code_prefix':{zh:'源代码：',en:'Source code: '},
'about_source_code_url':{zh:'https://github.com/YDW99/Regalia',en:'https://github.com/YDW99/Regalia'},
'about_agpl_desc':{zh:'发布。本项目为 AGPL v3 与 GPL v3 双重许可组合作品：整体同时受两份协议约束，但因 AGPL v3 的网络交互条款（第13条）更为严格，其要求实质上覆盖整个组合作品，确保用户通过网络访问时同样享有获取源代码的权利。',en:'. This project is a combined work under AGPL v3 and GPL v3: the combined work is subject to both licenses, but since AGPL v3 imposes stricter network interaction provisions (Section 13), its requirements effectively cover the entire combination, ensuring users who access the work over a network retain the right to obtain source code.'},
'about_droidfish':{zh:'部分代码源自开源项目 ',en:'Some code derived from the open-source project '},
'about_droidfish_desc':{zh:' (Copyright © Peter Österlund)，采用',en:' (Copyright © Peter Österlund), licensed under'},
'about_droidfish_tail':{zh:'协议。涉及引擎管理（Java/C++）、棋局逻辑、PGN解析、引擎通信及UI交互。修改声明已附于相关源文件头部。',en:' license. Covers engine management (Java/C++), game logic, PGN parsing, engine communication, and UI interaction. Modifications noted in source file headers.'},
'about_stockfish':{zh:'引擎由 ',en:'Engine by '},
'about_stockfish_desc':{zh:' 开源社区开发，采用',en:' community, licensed under'},
'about_gplv3':{zh:'协议。',en:'license.'},
'about_disclaimer':{zh:'本软件按"原样"提供，不提供任何明示或暗示的保证。详见 AGPL v3 第15-16条。',en:'This software is provided "as is", without warranty. See AGPL v3 Sections 15-16.'},
'about_ai':{zh:'本项目的部分代码由 AI 辅助生成，并已进行人工审查与 AGPL v3 / GPL v3 合规确认。',en:'Some code was AI-assisted and reviewed for AGPL v3 / GPL v3 compliance.'},
'loading_ui':{zh:'正在加载界面...',en:'Loading UI...'},
'engine_ready':{zh:'引擎就绪！',en:'Engine ready!'},
'engine_loading_timeout':{zh:'引擎加载超时，部分功能可能不可用',en:'Engine loading timeout, some features may be unavailable'},
'engine_init_failed':{zh:'引擎初始化失败，将以离线模式运行',en:'Engine init failed, running in offline mode'},
'engine_skip':{zh:'已跳过引擎加载',en:'Engine loading skipped'},
'no_move_records':{zh:'暂无走法记录',en:'No move records'},
'copy_failed':{zh:'复制失败，请手动复制',en:'Copy failed, please copy manually'},
'file_browse_failed':{zh:'文件浏览失败',en:'File browse failed'},
'settings_imported_ok':{zh:'设置已导入',en:'Settings imported'},
'settings_read_fail':{zh:'无法读取设置文件',en:'Cannot read settings file'},
'restarting_engine':{zh:'正在重启引擎...',en:'Restarting engine...'},
'engine_unavailable_bridge':{zh:'引擎接口不可用',en:'Engine interface unavailable'},
'restart_failed':{zh:'重启失败',en:'Restart failed'},
'requesting_storage':{zh:'正在请求存储权限...',en:'Requesting storage permission...'},
'settings_exported':{zh:'设置已导出到',en:'Settings exported to'},
'settings_clipboard_fallback':{zh:'设置已复制到剪贴板（文件写入失败）',en:'Settings copied to clipboard (file write failed)'},
'built_in_only':{zh:'v1.0.3: 仅支持内置引擎',en:'v1.0.3: Built-in engine only'},
'engine_error_restart':{zh:'引擎错误，正在重启',en:'Engine error, restarting'},
'engine_error':{zh:'引擎错误',en:'Engine error'},
'view_white':{zh:'视角: 白方(下方)',en:'View: White (bottom)'},
'view_black':{zh:'视角: 黑方(下方)',en:'View: Black (bottom)'},
'new_game_free':{zh:'新游戏: 自由开局',en:'New game: Free Play'},
'sound_on':{zh:'音效已开启',en:'Sound on'},
'sound_off':{zh:'音效已关闭',en:'Sound off'},
'engine_not_ready':{zh:'引擎尚未就绪，请稍后再试',en:'Engine not ready, please try again later'},
'analysis_timeout':{zh:'分析超时，已停止',en:'Analysis timeout, stopped'},
'analyzing_all':{zh:'正在分析所有步骤...',en:'Analyzing all steps...'},
'analysis_done':{zh:'分析完成! 共',en:'Analysis complete! Total'},
'analyzing_progress':{zh:'正在分析...',en:'Analyzing...'},
// v1.2.1 round-16: Clarify that 📊 in review mode opens the stats page
//   automatically once the background batch analysis completes. Without this
//   hint, users see only "正在分析..." and may not realize they need to wait
//   (and that the stats page will open on its own).
'stats_will_open_after_analysis':{zh:'分析完成后将进入统计页面',en:'Statistics will open after analysis completes'},
// v1.2.3 P2 (Issue #47 path 4): Toast shown right before the stats page opens
//   automatically after a deferred analyze-all batch completes. Previously
//   there was no feedback at this transition — the user waited in silence
//   until the stats Activity suddenly appeared.
'analysis_complete_opening_stats':{zh:'分析完成，正在打开统计页面...',en:'Analysis complete, opening statistics...'},
// v1.2.1 round-16: Proper i18n for the 10-min safety-timeout toast in
//   openStatsPage() — previously mixed zh + en ("正在分析... timed out").
'analysis_timed_out_retry':{zh:'分析超时，请重试',en:'Analysis timed out, please retry'},
// v1.1.2 Phase 68 (Issue 30 P2): Long-press-to-prioritize during analyze-all
'priority_eval_toast':{zh:'已优先分析此走法，批量分析将在该步完成后继续',en:'Prioritizing this move. Batch resumes after this step completes.'},
'priority_eval_already_cached':{zh:'此走法已分析完成',en:'This move is already analyzed.'},
'priority_eval_not_in_review':{zh:'长按优先分析仅在复盘模式可用',en:'Long-press priority is only available in review mode.'},
// v1.2.3 round-19: One-time startup hint toast — long-pressing the board
//   toggles the sensor-based board anti-shake (MainActivity
//   toggleStabilization; terminology aligned with its "棋盘防抖 /
//   Board stabilization" toasts).
'board_debounce_hint':{zh:'长按棋盘可开/关棋盘防抖',en:'Long-press the board to toggle board stabilization'},
// v1.2.3 round-19: Hint line shown under the review eval bar while an
//   analyze-all batch is running — tells the user about the existing
//   long-press-to-prioritize feature (_prioritizeReviewStep).
'review_batch_analyzing_hint':{zh:'批量分析进行中… 长按走法可设为优先',en:'Batch analysis in progress… Long-press a move to prioritize it'},
'js_error':{zh:'JS错误',en:'JS error'},
'promise_error':{zh:'Promise错误',en:'Promise error'},
'engine_unavailable_hint':{zh:'引擎不可用',en:'Engine unavailable'},
'ai_timeout':{zh:'AI思考超时，请重试',en:'AI thinking timeout, please retry'},
'tb_querying':{zh:'查询残局库...',en:'Querying endgame tablebase...'},
'fen_copy_prefix':{zh:'FEN已复制: ',en:'FEN copied: '},
'no_valid_review':{zh:'无有效复盘局面',en:'No valid review position'},
'board':{zh:'棋盘',en:'Board'},
'chart_global':{zh:'↹全局',en:'↹Global'},
'step_label':{zh:'第',en:'Step'},
// v1.2.3 round-12 (SonarCloud Bug #1 fix): Descriptive aria-label for the
// review-mode slider <input type="range">. The previous aria-label used
// step_label ("Step" / "第"), which is too terse for screen readers —
// TalkBack would announce just "Step" with no context. This key gives the
// control an unambiguous name (WCAG 2.1 Level A 4.1.2 Name, Role, Value).
'review_move_slider':{zh:'复盘步数',en:'Review move number'},
'built_in':{zh:'内置',en:'Built-in'},
'skill_level_desc':{zh:'降低引擎技术水平（0=最弱，20=最强）',en:'Reduce engine skill (0=weakest, 20=strongest)'},
'skill_elo_note':{zh:'限制Elo开启时，Skill Level由UCI_Elo自动决定',en:'Skill Level auto-set by UCI_Elo when Limit Elo is on'},
// v1.0.6 NEW: Gray-out explanations shown in the New Game dialog when a toggle
// is grayed out. Color matches var(--red) — the same color used by the Engine
// Configuration advanced settings dialog's "skill_elo_note" warning, so the
// visual language is consistent across both dialogs.
'gray_disabled_by_eco_book':{zh:'启用 AI 开局库时，Chess960 不可用（ECO 开局库要求标准初始局面）',en:'Chess960 is unavailable while AI Opening Book is enabled (ECO book requires the standard start position)'},
'gray_disabled_by_chess960':{zh:'启用 Chess960 时，AI 开局库不可用（Chess960 没有固定的开局理论）',en:'AI Opening Book is unavailable while Chess960 is enabled (Chess960 has no fixed opening theory)'},
'fen_invalid':{zh:'FEN格式无效',en:'Invalid FEN format'},
'paste_fen':{zh:'粘贴FEN字符串:',en:'Paste FEN string:'},
'render_error':{zh:'渲染出错，可以尝试刷新恢复对局',en:'Render error, try refreshing to recover'},
// v1.1.1 Phase 60 (audit i18n): Title for the render-error fallback page (was
//   hard-coded English "Render Error" in ui.js).
'render_error_title':{zh:'渲染错误',en:'Render Error'},
'refresh_page':{zh:'刷新页面',en:'Refresh Page'},
'new_game_settings':{zh:'新游戏设置',en:'New Game Settings'},
'play_color':{zh:'执棋颜色',en:'Play Color'},
'white_first':{zh:'白方（先手）',en:'White (first)'},
'black_second':{zh:'黑方（后手）',en:'Black (second)'},
'start_game_pawn':{zh:'开始游戏 ♟',en:'Start Game ♟'},
'piece':{zh:'棋子:',en:'Piece:'},
'color':{zh:'颜色:',en:'Color:'},
'turn_side':{zh:'走棋方:',en:'Turn:'},
'white_side':{zh:'⚪ 白方',en:'⚪ White'},
'black_side':{zh:'⚫ 黑方',en:'⚫ Black'},
'undo_setup':{zh:'撤销摆棋',en:'Undo Setup'},
'redo_setup':{zh:'恢复摆棋',en:'Redo Setup'},
'reset_board':{zh:'重置棋盘',en:'Reset Board'},
'clear_board':{zh:'清空棋盘',en:'Clear Board'},
'copy_fen_btn':{zh:'复制FEN',en:'Copy FEN'},
'import_fen_btn':{zh:'导入FEN',en:'Import FEN'},
'setup_error_title':{zh:'⚠️ 无法完成摆棋',en:'⚠️ Cannot complete setup'},
'understood':{zh:'知道了',en:'OK'},

'tb_mate_dist':{zh:'将杀距离',en:'Mate distance'},
'tb_dtz_dist':{zh:'零进距离',en:'DTZ distance'},
'tb_theory_draw':{zh:'理论和棋',en:'Theoretical draw'},
'tb_resist_dist':{zh:'抵抗距离',en:'Resistance distance'},
'tb_cat_win':{zh:'必胜',en:'Win'},
'tb_cat_syzygy_win':{zh:'必胜',en:'Win'},
'tb_cat_maybe_win':{zh:'可能胜',en:'Maybe win'},
'tb_cat_cursed_win':{zh:'理论胜(50步和)',en:'Cursed win (50-move)'},
'tb_cat_draw':{zh:'和棋',en:'Draw'},
'tb_cat_blessed_loss':{zh:'理论败(50步和)',en:'Blessed loss (50-move)'},
'tb_cat_maybe_loss':{zh:'可能败',en:'Maybe loss'},
'tb_cat_syzygy_loss':{zh:'必败',en:'Loss'},
'tb_cat_loss':{zh:'必败',en:'Loss'},
'tb_steps':{zh:'步',en:'steps'},
'review_analysis':{zh:'📑 复盘分析',en:'📑 Review Analysis'},
'copy_review_pgn':{zh:'复制走法记录PGN',en:'Copy PGN'},
'copy_review_fen':{zh:'复制当前复盘局面的FEN',en:'Copy FEN'},
'return_game':{zh:'返回对局',en:'Return to Game'},
'pgn_cache_manager':{zh:'📚 PGN缓存管理',en:'📚 PGN Cache Manager'},
'pgn_cache_btn':{zh:'PGN缓存',en:'PGN Cache'},
'pgn_cache_empty':{zh:'暂无缓存的PGN对局。点击下方"保存当前PGN到缓存"按钮以创建。',en:'No cached PGN games yet. Click "Save current PGN to cache" below to create one.'},
'pgn_cache_name_prompt':{zh:'请输入缓存名称（如：经典对局1）：',en:'Enter cache name (e.g.: Classic Game 1):'},
'pgn_cache_save_default':{zh:'我的对局',en:'My Game'},
'pgn_cache_name_too_long':{zh:'名称过长（最多60字符）',en:'Name too long (max 60 chars)'},
'pgn_cache_name_invalid':{zh:'名称包含非法字符（/ \\ : * ? \" < > |）',en:'Name contains invalid chars (/ \\ : * ? \" < > |)'},
'pgn_cache_save_current':{zh:'保存当前PGN到缓存',en:'Save current PGN to cache'},
'pgn_cache_import':{zh:'导入',en:'Import'},
'pgn_cache_delete_sel':{zh:'删除选中',en:'Delete Selected'},
'pgn_cache_close':{zh:'关闭',en:'Close'},
'pgn_cache_select_all':{zh:'全选',en:'Select All'},
'pgn_cache_select_none':{zh:'全不选',en:'Select None'},
'pgn_cache_count':{zh:'个缓存',en:'cache(s)'},
'pgn_cache_confirm_delete':{zh:'确定要删除选中的缓存吗？此操作不可撤销。',en:'Delete selected cache entries? This cannot be undone.'},
'pgn_cache_saved':{zh:'已保存到缓存',en:'Saved to cache'},
'pgn_cache_deleted':{zh:'已删除',en:'deleted'},
'pgn_cache_imported':{zh:'已导入PGN缓存',en:'PGN cache imported'},
'pgn_cache_save_failed':{zh:'保存失败',en:'Save failed'},
// v1.1.2 Phase 67 Task 67.2: New i18n keys for incomplete-eval-coverage prompt
'pgn_cache_partial_eval_title':{zh:'💾 部分步骤尚未评估',en:'💾 Some steps not yet analyzed'},
'pgn_cache_partial_eval_msg':{zh:'当前复盘有 N1 步，但仅有 N2 步已评估。完整保存评估注释 [%eval] 需先执行"分析全部"。',en:'This review has N1 steps but only N2 are analyzed. Run "Analyze All" first to capture every [%eval] annotation.'},
'pgn_cache_partial_eval_analyze_first':{zh:'先分析全部（推荐）',en:'Analyze All first (recommended)'},
'pgn_cache_partial_eval_save_as_is':{zh:'仍要保存（注释将缺失）',en:'Save anyway (evals will be missing)'},
'pgn_cache_analyze_then_save':{zh:'分析完成后将自动保存...',en:'Analysis will complete, then auto-save...'},
'pgn_cache_import_failed':{zh:'导入失败：缓存不存在或为空',en:'Import failed: cache not found or empty'},
// v1.0.4 Round-5 Rev20: Rename and Tag features
'pgn_cache_rename':{zh:'重命名',en:'Rename'},
'pgn_cache_rename_prompt':{zh:'请输入新的缓存名称：',en:'Enter new cache name:'},
'pgn_cache_renamed':{zh:'已重命名为',en:'Renamed to'},
'pgn_cache_rename_failed':{zh:'重命名失败：名称已存在或无效',en:'Rename failed: name already exists or invalid'},
'pgn_cache_tags':{zh:'标签',en:'Tags'},
'pgn_cache_tags_prompt':{zh:'请输入标签（用逗号分隔，最多10个，每个≤30字符）：',en:'Enter tags (comma-separated, max 10, each ≤30 chars):'},
'pgn_cache_tags_saved':{zh:'已保存标签',en:'Tags saved for'},
'pgn_cache_tags_save_failed':{zh:'标签保存失败',en:'Failed to save tags'},
// v1.0.4 Round-5 Rev21: Tag filter / search
'pgn_cache_search_placeholder':{zh:'搜索名称或标签…',en:'Search name or tags…'},
'pgn_cache_search_apply':{zh:'应用搜索',en:'Apply search'},
'pgn_cache_search_clear':{zh:'清除筛选',en:'Clear filter'},
'pgn_cache_filter_all':{zh:'全部',en:'All'},
// v1.0.8 PHASE 39: tag-presence filter buttons
'pgn_cache_filter_has_tags':{zh:'有标签',en:'Tagged'},
'pgn_cache_filter_no_tags':{zh:'无标签',en:'Untagged'},
'pgn_cache_filter_by_tag':{zh:'点击按此标签筛选',en:'Click to filter by this tag'},
'pgn_cache_filter_status':{zh:'筛选中：{count}/{total} 个匹配「{filter}」',en:'Filtering: {count}/{total} match "{filter}"'},
'pgn_cache_filter_no_match':{zh:'没有匹配的缓存条目。请尝试其他关键词或清除筛选。',en:'No matching cache entries. Try a different keyword or clear the filter.'},
// v1.0.4 Rev24 NEW: Human player rename feature i18n keys
'rename_player_hint':{zh:'点击重命名',en:'Click to rename'},
'rename_player_prompt':{zh:'输入你的名字（留空重置为"你"）：',en:'Enter your name (empty to reset to "You"):'},
'rename_player_saved':{zh:'已重命名为',en:'Renamed to'},
'rename_player_reset':{zh:'已重置为默认名称',en:'Reset to default name'},
'start_pos':{zh:'起始',en:'Start'},
'end_pos':{zh:'终局',en:'End'},
'step':{zh:'步',en:'step'},
'all_analyzed':{zh:'✅ 全部分析完成',en:'✅ All analyzed'},
'analyze_all_steps':{zh:'📑 分析全部',en:'📑 Analyze All'},
'select_promotion':{zh:'选择升变棋子',en:'Select Promotion'},
'engine_info':{zh:'引擎信息',en:'Engine Info'},
'engine_name':{zh:'名称',en:'Name'},
'engine_author':{zh:'作者',en:'Author'},
'engine_threads':{zh:'线程',en:'Threads'},
'engine_hash':{zh:'哈希',en:'Hash'},
'engine_restart':{zh:'🔄 重启引擎',en:'🔄 Restart Engine'},
'auto_config_hardware':{zh:'使用默认硬件参数',en:'Use default hardware'},
'auto_config_desc':{zh:'使用默认配置自动设定',en:'Auto-set using default configuration'},
'manual_settings':{zh:'手动设置',en:'Manual Settings'},
'thinking_threads':{zh:'思考线程 (Threads)',en:'Threads'},
'threads_rec':{zh:'推荐: 根据CPU核心数自动设置',en:'Recommended: Auto-set based on CPU cores'},
'hash_mb':{zh:'哈希大小 (Hash)',en:'Hash Size'},
'hash_rec':{zh:'推荐: 根据内存大小自动设置',en:'Recommended: Auto-set based on memory'},
'multipv_label':{zh:'多线分析 (MultiPV)',en:'MultiPV'},
'multipv_desc':{zh:'同时分析多条变例，开启后AI提示栏显示所有推荐走法及评分。对局模式建议1，分析模式建议2-5',en:'Analyze multiple lines. Shows all recommended moves in hint area. Suggest 1 for games, 2-5 for analysis'},
'move_overhead_label':{zh:'思考补偿 (Move Overhead)',en:'Move Overhead'},
'move_overhead_desc':{zh:'补偿网络和系统延迟',en:'Compensate for network and system latency'},
'show_wdl_label':{zh:'显示胜平负 (Show WDL)',en:'Show W/D/L'},
'show_wdl_desc':{zh:'在评估中显示胜/平/负概率',en:'Show win/draw/loss probabilities in eval'},
'skill_level_label':{zh:'技术等级 (Skill Level)',en:'Skill Level'},

'limit_elo_label':{zh:'限制Elo等级',en:'Limit ELO'},
'elo_target':{zh:'Elo目标',en:'ELO Target'},
'export_settings_btn':{zh:'📤 导出设置',en:'📤 Export'},
'import_settings_btn':{zh:'📥 导入设置',en:'📥 Import'},
'loading_title':{zh:'Regalia v1.2.3',en:'Regalia v1.2.3'},
'click_skip_loading':{zh:'点击跳过加载',en:'Click to skip loading'},
'white_checkmate':{zh:'白方将杀获胜',en:'White wins by checkmate'},
'black_checkmate':{zh:'黑方将杀获胜',en:'Black wins by checkmate'},
'white_resign':{zh:'白方认输',en:'White resigns'},
'black_resign':{zh:'黑方认输',en:'Black resigns'},
'brilliant':{zh:'妙着',en:'Brilliant'},
'blunder':{zh:'漏着',en:'Blunder'},
'great':{zh:'好着',en:'Great'},
'mistake':{zh:'错着',en:'Mistake'},
'good':{zh:'正着',en:'Good'},
'inaccuracy':{zh:'缓着',en:'Inaccuracy'},
'book':{zh:'平常',en:'Mediocre'},
'winning':{zh:'你赢了',en:'You Won'},
'losing':{zh:'你输了',en:'You Lost'},
'draw_game':{zh:'和棋',en:'Draw'},
'analyzing_ellipsis':{zh:'分析中',en:'Analyzing'},
'white_side_short':{zh:'白方',en:'White'},
'stalemate':{zh:'逼和！平局！',en:'Stalemate! Draw!'},
'fifty_move_draw':{zh:'50步规则和棋！',en:'50-move rule draw!'},
'seventy_five_move_draw':{zh:'75步规则和棋！',en:'75-move rule draw!'},
'threefold_draw':{zh:'三次重复和棋！',en:'Threefold repetition!'},
'fivefold_draw':{zh:'五次重复和棋！',en:'Fivefold repetition!'},
'insufficient_draw':{zh:'子力不足和棋！',en:'Insufficient material!'},
'huge_adv':{zh:'你大优',en:'Huge Advantage'},
'advantage':{zh:'你占优',en:'Advantage'},
'slight_adv':{zh:'你微优',en:'Slight Advantage'},
'equal_pos':{zh:'均势',en:'Equal'},
'slight_dis':{zh:'你微劣',en:'Slight Disadvantage'},
'disadvantage':{zh:'你劣势',en:'Disadvantage'},
'huge_dis':{zh:'你大劣',en:'Huge Disadvantage'},
'you_winning':{zh:'你必胜',en:'You are winning'},
'you_losing':{zh:'你必败',en:'You are losing'},
// v1.1.0 Phase 58: White-perspective eval labels for PGN {}/every-5-moves annotation.
//   These are White-POV (not player-POV) so the PGN comment is unambiguous regardless
//   of which side the human played. Thresholds mirror posDesc() in ui.js.
'pgn_white_winning':{zh:'白方必胜',en:'White winning'},
'pgn_white_huge_adv':{zh:'白方大优',en:'White huge advantage'},
'pgn_white_advantage':{zh:'白方占优',en:'White advantage'},
'pgn_white_slight_adv':{zh:'白方微优',en:'White slight advantage'},
'pgn_equal':{zh:'均势',en:'Equal'},
'pgn_black_slight_adv':{zh:'黑方微优',en:'Black slight advantage'},
'pgn_black_advantage':{zh:'黑方占优',en:'Black advantage'},
'pgn_black_huge_adv':{zh:'黑方大优',en:'Black huge advantage'},
'pgn_black_winning':{zh:'黑方必胜',en:'Black winning'},
'pgn_mate_white':{zh:'白方将杀',en:'White mates'},
'pgn_mate_black':{zh:'黑方将杀',en:'Black mates'},
// v1.1.1 Phase 59 Task 59.5: Resignation/timeout PGN comments follow the app's
//   global language (was hard-coded English). These keys are consumed by
//   _buildPGNString() in ai-bridge.js for the trailing {} comment on the last
//   move of a resigned or timed-out game.
'pgn_resign_white':{zh:'白方认输',en:'White resigns'},
'pgn_resign_black':{zh:'黑方认输',en:'Black resigns'},
'pgn_timeout_white_wins':{zh:'白方超时胜',en:'White wins by timeout'},
'pgn_timeout_black_wins':{zh:'黑方超时胜',en:'Black wins by timeout'},
// v1.2.3 round-25 (FIDE 6.9): timeout with insufficient material → draw comment
'pgn_timeout_draw_insufficient':{zh:'超时但子力不足，和棋',en:'Timeout but insufficient material, draw'},
// v1.1.1 Phase 59 Task 59.4: Prefix label for the initial-position annotation
//   appended to the first move's {} comment (mirrors the every-5-moves
//   annotation but marks it as the initial position so dedup can detect it).
'pgn_initial_position':{zh:'初始局面',en:'Initial position'},
'loading_prefix':{zh:'加载中 ',en:'Loading '},
'empty_dir':{zh:'空目录',en:'Empty directory'},
'import_settings_title':{zh:'📥 导入设置',en:'📥 Import Settings'},
'manual_path':{zh:'手动输入路径',en:'Manual path'},
'cancel_btn':{zh:'取消',en:'Cancel'},
'import_settings_engine':{zh:'引擎',en:'Engine'},
'import_settings_all':{zh:'设置',en:'Settings'},
'file_browse_label':{zh:'文件浏览',en:'File Browser'},
'checkmate_arrow':{zh:'→将杀',en:'→Mate'},
'escape_mate':{zh:'←脱杀',en:'←Unmate'},
'click_engine_config':{zh:'点击打开引擎配置',en:'Click to open engine config'},
'line_label':{zh:'线',en:'Line'},
'advanced_settings':{zh:'高级设置',en:'Advanced'},
'setup_no_white_king':{zh:'缺少白方王',en:'Missing white king'},
'setup_no_black_king':{zh:'缺少黑方王',en:'Missing black king'},
'setup_kings_adjacent':{zh:'双方王不能相邻',en:'Kings cannot be adjacent'},
'setup_no_pieces':{zh:'棋盘上无棋子',en:'No pieces on board'},
'setup_pawn_on_rank':{zh:'兵不能在第',en:' pawn cannot be on rank '},
'setup_check_impossible':{zh:'方王处于被将军状态（非法局面）',en:' king is in check (illegal position)'},
'setup_king_count_over':{zh:'方王数量超过1个',en:' king count exceeds 1'},
'setup_piece_over_limit':{zh:'方棋子数超过上限16',en:' piece count exceeds limit of 16'},
'setup_pawn_over_8':{zh:'方兵超过8个',en:' pawns exceed 8'},
'setup_queen_over_9':{zh:'方后超过9个',en:' queens exceed 9'},
'setup_rook_over_10':{zh:'方车超过10个',en:' rooks exceed 10'},
'setup_bishop_over_10':{zh:'方象超过10个',en:' bishops exceed 10'},
'setup_knight_over_10':{zh:'方马超过10个',en:' knights exceed 10'},
// v1.0.8 PHASE 30: setup_rank en value changed from 'rank' to ' ' to fix broken English
//   concatenation (was producing "WhitePawn cannot be on rank1rank(a1)"). Chinese
//   '行' unchanged (Chinese needs no spaces). The rank number is appended directly
//   after setup_pawn_on_rank (which now ends with a space in English).
'setup_rank':{zh:'行',en:' '},
'setup_white':{zh:'白',en:'White'},
'setup_black':{zh:'黑',en:'Black'},
// PGN Import
'import_title':{zh:'🗃️ 导入',en:'🗃️ Import'},
'paste_fen_opt':{zh:'粘贴FEN（局面文本）',en:'Paste FEN (position text)'},
'paste_pgn_opt':{zh:'粘贴PGN（对局记录）',en:'Paste PGN (game record)'},
'select_pgn_file':{zh:'选择PGN文件',en:'Select PGN File'},
'pgn_imported':{zh:'PGN导入成功',en:'PGN imported'},
'pgn_invalid':{zh:'PGN格式无效',en:'Invalid PGN format'},
// v1.0.8 PHASE 34: loading indicator for async PGN import
'importing_pgn':{zh:'⏳ 正在导入PGN…',en:'⏳ Importing PGN…'},
'pgn_fen_rejected':{zh:'此输入为FEN格式，请使用「粘贴FEN」按钮导入。PGN导入仅接受完整棋谱文本。',en:'This is FEN format. Please use the "Paste FEN" button instead. PGN import only accepts full game notation.'},
'pgn_paste_hint':{zh:'粘贴PGN棋谱字符串（仅限PGN格式，FEN请使用「粘贴FEN」按钮）',en:'Paste PGN game notation only (for FEN, use "Paste FEN" button)'},
'fen_pgn_paste_label':{zh:'粘贴内容:',en:'Paste content:'},
'confirm_import':{zh:'导入',en:'Import'},
// i18n for game-over checkmate message
'checkmate_excl':{zh:'将杀！',en:'Checkmate! '},
'wins_excl':{zh:'获胜！',en:' wins!'},
'white_short':{zh:'⚪ 白方',en:'⚪ White'},
// v1.0.4 Round-5 Rev27: Resign feature (DeepSeek review 2.1)
'resign_btn':{zh:'🏳️ 认输',en:'🏳️ Resign'},
'resign_confirm_title':{zh:'确认认输',en:'Confirm Resignation'},
'resign_confirm_msg':{zh:'你确定要认输吗？这将结束当前对局，对方获胜。',en:'Are you sure you want to resign? This ends the current game; your opponent wins.'},
'resign_yes':{zh:'确认认输',en:'Yes, Resign'},
'resign_no':{zh:'取消',en:'Cancel'},
'white_resigns':{zh:'白方认输',en:'White resigns'},
'black_resigns':{zh:'黑方认输',en:'Black resigns'},
'resigns_suffix':{zh:'认输',en:'resigns'},
// v1.0.4 Rev47: Timeout win suffix for _gameOverStrFromStatus('timeout')
'timeout_win_suffix':{zh:'超时胜',en:'wins by timeout'},
// v1.0.4 Round-5 Rev28: Stats page → main/review PGN import-back prompt
'stats_import_back_title':{zh:'🗃️ 是否将PGN导入到对局？',en:'🗃️ Import PGN to game?'},
'stats_import_back_msg':{zh:'你在统计页面导入过 PGN。是否将其导入到当前对局（会替换主界面/复盘界面已记录的走法）？',en:'You imported a PGN on the stats page. Import it into the current game (replaces the moves recorded in the main/review view)?'},
'stats_import_back_yes':{zh:'是',en:'Yes'},
'stats_import_back_no':{zh:'否',en:'No'},
'stats_import_back_cancel':{zh:'取消',en:'Cancel'},
'stats_import_back_no_pgn':{zh:'统计页面未导入新 PGN，无需同步。',en:'No new PGN imported on the stats page; nothing to sync.'},
// v1.0.7 — Quick toolbar (below the board, above the player bar)
'quick_toolbar':{zh:'快捷工具栏',en:'Quick Toolbar'},
// v1.0.7 — Setup-mode castle-rights marker (🔁) and en-passant marker (⚡)
'setup_castle_marker':{zh:'易位权',en:'Castle'},
'setup_castle_marker_hint':{zh:'易位标记',en:'Castle Mark'},
'setup_castle_marker_tip':{zh:'点击后，再点击格子添加/取消易位标记（仅对在初始行上的同色车生效）',en:'Tap, then tap a square to toggle the castle marker (only valid on same-color rooks on the initial rank)'},
'setup_ep_marker':{zh:'可被吃过路兵',en:'En Passant'},
'setup_ep_marker_hint':{zh:'过路兵标记',en:'En Passant Mark'},
'setup_ep_marker_tip':{zh:'点击后，再点击格子添加/取消过路兵标记（棋盘上最多 1 个，必须与走棋方不同色的兵同格，该兵位于第 4/5 行，且其左或右侧有相邻的异色兵可吃过路兵）',en:'Tap, then tap a square to toggle the en-passant marker (max 1 on board; must share the square with an opposite-color pawn on rank 4/5, with an adjacent enemy pawn that can capture it)'},
'setup_castle_err_not_rook':{zh:'易位标记必须与同色车在同一格',en:'Castle marker must share the square with a same-color rook'},
'setup_castle_err_wrong_rank':{zh:'易位标记所在的同色车必须在初始行（白方 a1–h1；黑方 a8–h8）',en:'Rook with castle marker must be on the initial rank (white: a1–h1; black: a8–h8)'},
'setup_castle_err_wrong_side':{zh:'易位标记所在的车与同色王的相对位置不合法',en:'Rook with castle marker is on the wrong side of the same-color king'},
'setup_castle_err_dup_side':{zh:'同一侧的同色车不能同时存在两个易位标记',en:'Two same-color rooks on the same side cannot both carry castle markers'},
'setup_castle_err_king_missing':{zh:'同色王不在棋盘上，无法判定易位标记的合法性',en:'Same-color king is missing — cannot validate castle marker'},
'setup_ep_err_multiple':{zh:'棋盘上最多只能有一个过路兵标记',en:'At most one en-passant marker is allowed on the board'},
'setup_ep_err_no_pawn':{zh:'过路兵标记必须与兵在同一格',en:'En-passant marker must share the square with a pawn'},
'setup_ep_err_wrong_rank':{zh:'过路兵标记所在的兵必须在第 4 行（白兵）或第 5 行（黑兵）',en:'Pawn with en-passant marker must be on rank 4 (white) or rank 5 (black)'},
'setup_ep_err_blocked':{zh:'过路兵的跳过格或起始格被占用，该标记非法',en:'En-passant marker illegal: skipped or origin square is occupied'},
'setup_ep_err_wrong_color':{zh:'过路兵标记所在的兵的颜色必须与走棋方不同',en:'Pawn with en-passant marker must be the opposite color of the side to move'},
'setup_ep_err_no_capturer':{zh:'过路兵标记所在的兵的左或右侧必须有相邻的异色兵（可吃过路兵的兵）',en:'Pawn with en-passant marker must have an adjacent enemy pawn that can capture it'},
};
// Auto-detect language on startup
(function(){
  try{const saved=localStorage.getItem('Regalia_lang');if(saved==='zh'||saved==='en'){_lang=saved;return;}}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
  // v1.0.4 Round-5 Rev16: Fall back to persistent Java store when HyperOS 3 wiped localStorage
  try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.persistentGet){const persisted=AndroidBridge.persistentGet('Regalia_lang');if(persisted==='zh'||persisted==='en'){_lang=persisted;try{localStorage.setItem('Regalia_lang',persisted);}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}return;}}}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
  try{if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.getSystemLanguage==='function'){const sysLang=AndroidBridge.getSystemLanguage();_lang=(sysLang&&sysLang.startsWith('zh'))?'zh':'en';return;}}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
  try{const navLang=navigator.language||navigator.userLanguage||'';_lang=navLang.startsWith('zh')?'zh':'en';}catch(e){_lang='zh';}
})();
// v1.2.3 P1 (Round 18 i18n-P1-3): Sync <html lang> with the detected startup
//   language so TalkBack uses the correct TTS engine before the first toggle.
try{document.documentElement.lang=(_lang==='zh')?'zh-CN':'en';}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}

window.onerror=function(msg,url,line,col,error){
    const errInfo={
        message:String(msg),
        url:String(url||''),
        line:line||0,
        column:col||0,
        stack:error?.stack?String(error.stack):'no stack',
        timestamp:new Date().toISOString(),
        engineReady:typeof _engineReady!=='undefined'?_engineReady:undefined
    };
    console.error('=== Regalia JS Error ===',errInfo);
    // NON-DESTRUCTIVE: Show toast instead of replacing entire DOM
    // Previous implementation destroyed app.innerHTML which made the app unusable
    showToast(T('js_error')+': '+String(msg).substring(0,80)+(line?' (line:'+line+')':''), 4000);
    // For severe errors, log but don't destroy the UI
    return true; // Suppress default error handling
};
window.addEventListener('unhandledrejection',function(e){
    console.error('=== Unhandled Promise Rejection ===',e.reason);
    showToast(T('promise_error')+': '+(e.reason&&e.reason.message?e.reason.message.substring(0,80):String(e.reason).substring(0,80)), 4000);
});

const PV={pawn:100,knight:325,bishop:338,rook:500,queen:975,king:20000};// Piece values for ECO path selection only (not position evaluation)
const OPP_COLOR={white:'black',black:'white'};
// Board square constants (avoid repetition)
const SQ_LIGHT='linear-gradient(135deg,#e8d5b0,#f0dcc0,#e8d5b0)';const SQ_DARK='linear-gradient(135deg,#8b6914,#7a5c12,#8b6914)';

const SQ_SEL='#5a4030';const LBL_LIGHT='#4a3a0a';const LBL_DARK='#f0dcb0';
// Coordinate label stroke colors: dark squares use dark stroke, light squares use bright stroke
// This ensures readability regardless of board background — the main label color OR the stroke
// will always have sufficient contrast against the square color.
const LBL_STROKE_LIGHT='rgba(255,230,150,0.85)'; // Bright stroke for light-square labels
const LBL_STROKE_DARK='rgba(30,15,0,0.85)';      // Dark stroke for dark-square labels
const SYM={white:{king:'♔\uFE0E',queen:'♕\uFE0E',rook:'♖\uFE0E',bishop:'♗\uFE0E',knight:'♘\uFE0E',pawn:'♙\uFE0E'},black:{king:'♚\uFE0E',queen:'♛\uFE0E',rook:'♜\uFE0E',bishop:'♝\uFE0E',knight:'♞\uFE0E',pawn:'♟\uFE0E'}};
const PN={king:'王',queen:'后',rook:'车',bishop:'象',knight:'马',pawn:'兵'};
const PN_EN={king:'K',queen:'Q',rook:'R',bishop:'B',knight:'N',pawn:'P'};
function pieceName(type){return _lang==='en'?(PN_EN[type]||type):(PN[type]||type);}
function _principlesHTML(){
const zh='<div class="tip-item"><b>中心控制</b>：尽早控制中心格(d4,d5,e4,e5)，这是棋盘各方向的交叉点。马在中心控制8格，在边角仅2-4格。控制中心能最大化子力效能，限制对手发展，迫其在局促边翼行棋</div><div class="tip-item"><b>快速出子</b>：尽快出动轻子（马、象）投入战斗，避免重复走同一子或过早出后。让全军协同作战，而非让个别棋子成为"孤狼"</div><div class="tip-item"><b>王的安全</b>：不要轻率推进王城兵（f,g,h兵），兵墙是王翼的坚固堡垒，推进会破坏兵链暴露致命斜线和开放线。尽早易位将王藏于兵盾之后</div><div class="tip-item"><b>兵链完整</b>：孤兵、叠兵和落后兵机动性受限且极易成为攻击靶子。维持相互保护的兵链是确保阵地稳固的关键，正如卡斯帕罗夫所言："兵的结构决定局面的长期优劣"</div><div class="tip-item"><b>空间优势</b>：用稳健的兵链向前推进挤压对手生存空间，使其子力互相干涉、协调困难，从而为你创造致命的战术漏洞</div><div class="tip-item"><b>通路兵</b>：制造并推进通路兵（尤其是连接通路兵），它是中残局的终极武器。通路兵能牵制对手大量子力防守，逼近底线升变将直接决定胜负</div><div class="tip-item"><b>子力协调</b>：单个棋子无论多强都无法独自赢棋。优秀的协调意味着子力间相互支援、合力攻击同一目标，并避免"孤狼综合征"</div><div class="tip-item"><b>开放线</b>：一旦出现开放线或半开放线，迅速用车（或双车重叠）占领，这是重子入侵敌方底线的最有效途径</div><div class="tip-item"><b>侧翼突破</b>：中心封闭时，沿兵链指向的侧翼发起兵突破打开战线。例如：白方兵链d4-e5指向王翼应在王翼突破；黑方d5-e6指向后翼应在后翼突破</div><div class="tip-item"><b>兑换原则</b>："优势时简化，劣势时复杂"。占优时主动兑换导入胜势残局；劣势时保留复杂以寻找战术反击（如长将、陷阱）的机会</div>';
const en='<div class="tip-item"><b>Center Control</b>: Seize center squares (d4, d5, e4, e5) early — the crossroads of the board. A Knight in the center controls 8 squares vs. only 2-4 on the edge. Controlling the center maximizes piece efficiency, restricts the opponent, and forces them to play on cramped wings</div><div class="tip-item"><b>Piece Development</b>: Develop minor pieces (Knights, Bishops) quickly into battle; avoid moving the same piece twice or bringing the Queen out too early. Let your army fight as a team, not as lone wolves</div><div class="tip-item"><b>King Safety</b>: Do not push kingside pawns (f, g, h) prematurely — the pawn wall is the King\'s fortress. Pushing them breaks the pawn chain and exposes fatal diagonals and open files. Castle early to tuck the King behind the pawn shield</div><div class="tip-item"><b>Pawn Structure</b>: Isolated, doubled, and backward pawns have limited mobility and become easy targets. Maintain a mutually protective pawn chain to secure your position. As Kasparov noted: "Pawn structure determines the long-term character of the position"</div><div class="tip-item"><b>Space Advantage</b>: Advance your pawn chain to squeeze the opponent\'s space, causing their pieces to interfere with each other and creating fatal tactical vulnerabilities</div><div class="tip-item"><b>Passed Pawns</b>: Create and advance passed pawns (especially connected passed pawns) — the ultimate weapon in the middlegame and endgame. They tie down enemy pieces for defense, and promotion near the back rank decides the game</div><div class="tip-item"><b>Piece Coordination</b>: No single piece, however powerful, can win a game alone. Good coordination means pieces support each other and attack the same target — avoid the "lone wolf syndrome"</div><div class="tip-item"><b>Open Files</b>: Once an open or semi-open file appears, quickly occupy it with Rooks (or doubled Rooks) — the most effective path for heavy pieces to invade the opponent\'s back rank</div><div class="tip-item"><b>Flank Breakthrough</b>: When the center is locked, launch a pawn break on the flank where your pawn chain points. E.g., White pawns d4-e5 point kingside → break kingside; Black pawns d5-e6 point queenside → break queenside</div><div class="tip-item"><b>Exchange Principle</b>: "Simplify when ahead, complicate when behind." Actively trade pieces to reach a winning endgame when you have the advantage; keep the position complex to find tactical counterplay (perpetual check, traps) when behind</div>';
return _lang==='en'?en:zh;
}
let CELL=50;
let REVIEW_CELL=40;
// v1.0.7 PHASE 5: Read safe-area insets from CSS custom properties (set by
// AndroidManifest shortEdges mode + viewport-fit=cover). These tell us how
// much space the system reserves for notches/cutouts/R-corners. We must
// subtract them from the available viewport when sizing the board, otherwise
// the board's rightmost column (h-file) gets clipped by the safe-area inset.
let _safeInsets={top:0,bottom:0,left:0,right:0};
function _readSafeInsets(){
  try{
    const cs=getComputedStyle(document.documentElement);
    const _parse=(v)=>{const m=Number.parseFloat(v);return Number.isNaN(m)?0:m;};
    _safeInsets.top=_parse(cs.getPropertyValue('--safe-top'))||0;
    _safeInsets.bottom=_parse(cs.getPropertyValue('--safe-bottom'))||0;
    _safeInsets.left=_parse(cs.getPropertyValue('--safe-left'))||0;
    _safeInsets.right=_parse(cs.getPropertyValue('--safe-right'))||0;
  }catch(e){/* defaults stay 0 */}
}
// v1.0.7 PHASE 5: First-principles board sizing.
// Available width = viewport width - safe-area insets - 3px finger-grip
// clearance (right) - board border (4px total, 2px each side) - anti-shake
// stabilization clearance (6px, only in portrait) - 28px row-label column
// (the .rlbl div to the LEFT of the board).
// Available height (portrait) = viewport height - safe-area insets - header
// (~50px) - AI/player bars (~80px each = 160px) - quick toolbar (~40px) -
// file labels (~16px) - some padding (~24px).
// We then take the floor of (min(availW, availH) / 8) and clamp to [30, 90].
// The previous implementation used hard-coded thresholds (vh>500?50:...) that
// didn't account for safe-area insets, the 3px right grip clearance, OR the
// 28px row-label column — causing the h-file to be clipped on notched phones
// and on phones where the row labels pushed the board past the right edge.
function _recalcCellSize(){
  _readSafeInsets();
  const vw=window.innerWidth;
  const vh=window.innerHeight;
  const isLandscape=vw>vh;
  // v1.0.7 PHASE 7: Use the ACTUAL available content width of #app, not
  // window.innerWidth. #app has padding-right:calc(env(safe-area-inset-right)+3px)
  // and padding-left:env(safe-area-inset-left). The previous code used
  // window.innerWidth and then ALSO subtracted safe-area + 3px grip, which
  // double-counted the #app padding. But the real problem was that .main
  // ALSO has its own padding (8px in portrait, 6px in landscape), which was
  // NOT being subtracted at all — causing the board to overflow by ~16px.
  // Fix: read #app's computed content width directly, then subtract .main's
  // padding. This is the ground-truth available width for the board + row labels.
  let _appContentW=vw;
  let _appContentH=vh;
  try{
    const appEl=document.getElementById('app');
    if(appEl?.clientWidth>0){
      const cs=getComputedStyle(appEl);
      // With box-sizing:border-box, clientWidth = content + padding.
      // Content width = clientWidth - paddingLeft - paddingRight.
      const pl=Number.parseFloat(cs.paddingLeft)||0;
      const pr=Number.parseFloat(cs.paddingRight)||0;
      const pt=Number.parseFloat(cs.paddingTop)||0;
      const pb=Number.parseFloat(cs.paddingBottom)||0;
      _appContentW=appEl.clientWidth-pl-pr;
      _appContentH=appEl.clientHeight-pt-pb;
      // v1.0.7 PHASE 7: if the computed content width is unreasonably small
      // (e.g. #app hasn't been laid out yet), fall back to vw-based calculation
      // with safe-area subtraction.
      if(_appContentW<100||_appContentH<100){
        _appContentW=vw-_safeInsets.left-_safeInsets.right-3;
        _appContentH=vh-_safeInsets.top-_safeInsets.bottom;
      }
    }else{
      // #app not yet in DOM — use vw with safe-area subtraction.
      _appContentW=vw-_safeInsets.left-_safeInsets.right-3;
      _appContentH=vh-_safeInsets.top-_safeInsets.bottom;
    }
  }catch(e){
    _appContentW=vw-_safeInsets.left-_safeInsets.right-3;
    _appContentH=vh-_safeInsets.top-_safeInsets.bottom;
  }
  // .main padding (from CSS): portrait=8px each side, landscape=6px each side.
  const _mainPad=isLandscape?6:8;
  // Board border: 4px total (2px each side in base CSS, but portrait overrides
  // to 3px). We use the larger value (4px) to be safe.
  const _boardBorder=4;
  // Anti-shake margin: reserves space on BOTH sides of the board for the
  // ±8px translate3d applied by StabilizationHelper. Previously only 8px was
  // reserved (in _horizOverhead), but the board is left-aligned in .bsec —
  // when anti-shake shifts it RIGHTward by 8px, the right edge needs 8px of
  // clearance to avoid being clipped by .main's overflow-x:hidden.
  // v1.0.8 PHASE 26 (fix): reserve 12px total (8px for max displacement +
  // 4px buffer) so the board's right edge is never clipped when anti-shake
  // is active. This slightly shrinks the landscape board as the user requested.
  const _antiShake=12;
  // Row-label column (.rlbl): 28px wide, sits LEFT of the board.
  const _rowLabelW=28;
  // v1.0.7 PHASE 7: Total horizontal overhead = .main padding (left+right) +
  // row labels + board border + anti-shake. We do NOT subtract safe-area or
  // 3px grip again because #app's content width already excludes them (they're
  // in #app's padding).
  const _horizOverhead=(_mainPad*2)+_rowLabelW+_boardBorder+_antiShake;
  if(isLandscape){
    // Landscape: board height is the primary constraint.
    // v1.0.7 PHASE 10: Reserve enough vertical space for header (~36px) +
    // file labels (~14px) + AI bar (~40px) + player bar (~40px) + quick
    // toolbar (~36px) + gaps/padding (~24px) = ~190px. Plus .main padding
    // (12px). Total vertical overhead = 202px.
    // Also add a proportional reserve: on very tall screens (tablets), the
    // board shouldn't dominate — cap at 60px so the panel gets enough room.
    const _vertOverhead=202;
    const availH=_appContentH-_vertOverhead-(_mainPad*2);
    const maxByHeight=Math.floor(availH/8);
    // v1.0.7 PHASE 10: Increase panel minimum width to 240 so the
    // "走法记录" (move history) panel has enough room. Also compute the
    // panel width as a PROPORTION of the available width (at least 30%),
    // so on wide tablets the panel grows with the screen.
    const _panelMin=240;
    const _panelProportional=Math.floor(_appContentW*0.30);
    const _panelW=Math.max(_panelMin,_panelProportional);
    const _gap=6;
    const availW=_appContentW-_panelW-_gap-_horizOverhead;
    const maxByWidth=Math.floor(availW/8);
    // v1.0.7 PHASE 10: Lower the landscape cap from 72 to 60 to prevent the
    // board from squeezing the move history panel on phones and tablets.
    // 60px * 8 = 480px board, still very readable.
    CELL=Math.max(30,Math.min(maxByHeight,maxByWidth,60));
  }else{
    // Portrait: width is the primary constraint, but height also matters.
    const availW=_appContentW-_horizOverhead;
    const maxByWidth=Math.floor(availW/8);
    // Available height: viewport - header (~50px) - AI bar (~50px) - player
    // bar (~50px) - quick toolbar (~40px) - file labels (~16px) - padding.
    const _vertOverhead=246;
    const availH=_appContentH-_vertOverhead;
    const maxByHeight=Math.floor(availH/8);
    CELL=Math.max(30,Math.min(maxByWidth,maxByHeight,90));
  }
  REVIEW_CELL=Math.max(28,Math.round(CELL*0.8));
}
_recalcCellSize();
// v1.0.4 Rev31 FIX: orientation change / resize scroll restoration bug.
// Previously: after orientation change, render() rebuilt the DOM. The save
// phase read _oldReviewBody.scrollTop from the OLD (portrait/landscape)
// layout, then the restore phase applied that scrollTop to the NEW layout
// — where the same pixel offset points to a DIFFERENT move (or no move at
// all, since scrollHeight differs between portrait and landscape). The
// review-moves-list scroll-into-view logic didn't fire either, because
// _lastReviewStepScrolled still matched reviewStep (no step change).
// Result: the review move list appeared at a wrong/random scroll position
// after orientation change, "jumping away" from the active move.
//
// Fix: on resize/orientationchange, force _lastReviewStepScrolled=-2 (the
// sentinel "never scrolled" value) so that the next render's scroll-into-
// view logic re-centers the active move in the NEW layout. Also reset
// _mlistScrollState.valid=false so the main move list doesn't restore a
// stale pixel offset (it'll re-snapshot from the new DOM). For review-body,
// we DON'T restore the old scrollTop on orientation change (the active-move
// scroll-into-view handles re-centering instead).
let _resizeTimer=0;let _isOrientationChange=false;
// v1.0.4 Rev31: flag set by orientationchange, consumed by the next render()
// cycle to skip the stale-scrollTop restore for .review-body (the active-move
// scroll-into-view logic handles re-centering instead).
let _skipReviewBodyScrollRestore=false;
window.addEventListener('resize',()=>{
  clearTimeout(_resizeTimer);
  _resizeTimer=setTimeout(()=>{
    const _oldCell=CELL;
    _recalcCellSize();
    if(CELL!==_oldCell||_isOrientationChange){
      // Force re-scroll of the active review move after layout change
      if(typeof _lastReviewStepScrolled!=='undefined')_lastReviewStepScrolled=-2;
      // Invalidate main move-list scroll state so it re-snapshots
      if(typeof _mlistScrollState!=='undefined'){_mlistScrollState.valid=false;}
      // Skip the stale review-body scrollTop restore on this render
      _skipReviewBodyScrollRestore=true;
      _isOrientationChange=false;
      render();
    }
  },150);
});
// orientationchange fires before resize on most Android devices; use it as
// a signal that the layout change is a rotation (not a keyboard popup etc.)
window.addEventListener('orientationchange',()=>{_isOrientationChange=true;});
const KNIGHT_OFFSETS=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const DIR_ROOK=[[0,1],[0,-1],[1,0],[-1,0]];
const DIR_BISHOP=[[1,1],[1,-1],[-1,1],[-1,-1]];
const DIR_QUEEN=[...DIR_ROOK,...DIR_BISHOP];
function posAlg(p){return String.fromCodePoint(97+p.col)+(8-p.row)}
function algPos(a){if(!a)return null;
  // Type coercion: if input is a number, try converting to string first
  if(typeof a==='number')a=String(a);
  // v1.0.8 PHASE 30: also reject strings longer than 2 chars (e.g. 'e4e5' move
  //   strings, 'e10' malformed input) which were silently truncated before.
  if(typeof a!=='string'||a.length!==2)return null;
  try{const col=a.charCodeAt(0)-97,row=8-Number.parseInt(a[1],10);if(col<0||col>7||Number.isNaN(row)||row<0||row>7)return null;return{row,col}}catch(e){return null}}
function inB(r,c){return r>=0&&r<8&&c>=0&&c<8}

// AI-GEN: AI assisted
// This code was AI-assisted and has been reviewed for AGPL v3 compliance.
//
// v1.0.8 PHASE 22: Personified piece-move animation system.
// Redesigned per "棋魂 · 国际象棋拟人化走棋动画" reference. Each piece has a
// distinct personality expressed through per-piece keyframe animations:
//   pawn  (胆小 timid)      — hesitate-back then dart forward
//   knight(灵活 agile)      — L-shape parabolic jump with rotation
//   bishop(机敏 sharp)      — quick diagonal with golden glow trail
//   rook  (生猛 fierce)     — charge-dash-impact with light board shake
//   queen (沉重 heavy)     — graceful arc with heavy board shake
//   king  (庄严 solemn)     — heavy measured step with heavy board shake
//
// Implementation:
//   - Web Animations API (el.animate()) for GPU-composited 120fps motion
//   - All keyframes use translate3d + scale + optional rotate/drop-shadow
//   - Board shake (.bwrap.shake-light/.shake-heavy) for landing impact
//   - prefers-reduced-motion fully respected (skip animation, keep sound)
//   - Chess960 castling: king + rook animate concurrently (kingStayedPut
//     skips king overlay when king is already on its castling target)
//   - _animGen generation counter prevents stale closures from corrupting
//     newer animation state (race-condition guard from v1.0.7 Phase 18)
//   - _activeAnimEls tracks overlay nodes for re-attach after DOM rebuild
//
// Durations are ~60% of the reference spec (reference is for demo mode;
// gameplay needs to stay responsive). Personality ordering preserved:
//   pawn < bishop < rook < knight < queen < king (timid → solemn).
const ANIM_DURATIONS={pawn:260,knight:380,bishop:270,rook:290,queen:520,king:560};
const ANIM_EASINGS={
  pawn:'cubic-bezier(0.25,0.05,0.25,1.15)',
  knight:'cubic-bezier(0.34,1.42,0.64,1)',
  bishop:'cubic-bezier(0.05,0.92,0.18,1)',
  rook:'cubic-bezier(0.95,0.05,0.25,1)',
  queen:'cubic-bezier(0.5,0,0.1,1)',
  king:'cubic-bezier(0.5,0,0.05,1)'
};
// Board shake durations (used by _triggerBoardShake)
// v1.0.8 PHASE 26: queen shake is now 'massive' — heavier than king's 'heavy',
//   which is heavier than rook's 'light'. This makes the queen landing feel
//   "铸锩有声、掷地有声" (resounding/ground-shaking) per the user's request.
const SHAKE_LIGHT_DUR=280;   // rook landing — light tremor
const SHAKE_HEAVY_DUR=450;   // king landing — heavy tremor
const SHAKE_MASSIVE_DUR=620; // queen landing — massive tremor (heaviest)

let _cachedBwrap=null;
let animationInProgress=false;
let _lastAnimMv=null; // set by callers of animateMove for Chess960 castling detection
// v1.0.8 PHASE 22: _animGen prevents stale _finishAnim closures from a prior
// animateMove call corrupting newer animation state. Bumped on every entry.
let _animGen=0;
// v1.0.8 PHASE 22: Track active overlay nodes so they can be re-attached
// after render() rebuilds the .bwrap DOM (e.g., on cell-size recalculation).
let _activeAnimEls=[];

// Trigger board shake. strength: 'light' (rook), 'heavy' (king), or 'massive' (queen).
// Uses void offsetWidth trick to restart CSS animation on rapid successive calls.
// v1.0.8 PHASE 26: 'massive' is the heaviest — reserved for queen landing.
// v1.0.8 PHASE 26 (anti-shake coexistence): StabilizationHelper applies a
//   CSS transform to .bwrap.stabilized for sensor-based translation compensation.
//   If we add .shake-* while .stabilized is active, the shake animation's
//   transform overrides the stabilization transform, causing a visual jump.
//   Fix: temporarily remove .stabilized for the shake duration, then restore.
//   The StabilizationHelper re-applies .stabilized on the next sensor event
//   (within ~20ms), so the gap is imperceptible.
function _triggerBoardShake(strength){
  try{
    const bwrap=_cachedBwrap||(_cachedBwrap=document.querySelector('.bwrap'));
    if(!bwrap||!bwrap.parentNode){_cachedBwrap=null;return;}
    const cls=strength==='massive'?'shake-massive':(strength==='heavy'?'shake-heavy':'shake-light');
    // v1.0.8 PHASE 26: temporarily suspend stabilization so shake isn't fought
    const wasStabilized=bwrap.classList.contains('stabilized');
    if(wasStabilized)bwrap.classList.remove('stabilized');
    bwrap.classList.remove(cls);
    void bwrap.offsetWidth; // force reflow to restart animation
    bwrap.classList.add(cls);
    const baseDur=strength==='massive'?SHAKE_MASSIVE_DUR:(strength==='heavy'?SHAKE_HEAVY_DUR:SHAKE_LIGHT_DUR);
    const dur=baseDur+30;
    setTimeout(()=>{
      try{bwrap.classList.remove(cls);}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
      // Restoration of .stabilized happens naturally on the next sensor event;
      // we don't force-restore here to avoid conflicting with a mid-flight
      // sensor sample that may have a different translation.
    },dur);
  }catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
}

// Personified piece animations. Each returns a Promise resolving on finish.
// dx/dy are total pixel offsets from source to destination.
// All keyframes use translate3d for GPU compositing; scale/rotate/filter
// add personality without breaking the composited layer.

// 兵 · 瑟瑟发抖：颤颤巍巍、轻飘飘，仿佛随时会被风吹走
// v1.0.8 PHASE 26 (optimization): The pawn now "瑟瑟发抖" (shivers/quivers).
//   Design intent: a timid pawn that hesitates, trembles with high-frequency
//   low-amplitude jitter, drifts forward "轻飘飘" (feather-light) with reduced
//   scale, and lands softly. The trembling is achieved via many small keyframes
//   with alternating ±offset. All keyframes mutate ONLY transform (GPU-composited)
//   to sustain high fps — no per-frame filter/shadow changes.
function _animPawn(el,dx,dy,dur,easing){
  return new Promise(resolve=>{
    const kfs=[];
    const steps=22;
    // Tremor parameters: high-frequency, low-amplitude jitter.
    // The jitter amplitude is proportional to cell size so it scales with board.
    const tremorAmp=CELL*0.018; // ~1.8% of cell — visible but not jarring
    const tremorFreq=14; // alternations across the journey (high freq = "发抖")
    // The pawn drifts forward on a slightly non-linear path (hesitate → drift → settle).
    // Scale stays below 1.0 for most of the journey to feel "轻飘飘" (light/airy),
    // then briefly expands to 1.0 on landing (gentle touchdown, no impact).
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      // Non-linear progress: hesitate (0-0.2), drift (0.2-0.8), settle (0.8-1.0)
      let progress;
      if(t<0.2)progress=t*0.5;           // hesitant start (slow)
      else if(t<0.8)progress=0.1+(t-0.2)*1.1; // drift (faster)
      else progress=0.76+(t-0.8)*1.2;    // settle
      // Base position
      let x=dx*progress, y=dy*progress;
      // Tremor: alternating ±offset on both axes, decaying toward landing
      const tremorDecay=t<0.85?1:(1-(t-0.85)/0.15); // fade tremor in last 15%
      const phase=t*tremorFreq*Math.PI*2;
      x+=Math.sin(phase*1.7)*tremorAmp*tremorDecay;
      y+=Math.cos(phase*2.3)*tremorAmp*0.7*tremorDecay;
      // Scale: < 1.0 for most of journey (轻飘飘), gentle 1.0 at landing
      let scale;
      if(t<0.9)scale=0.82+Math.sin(t*Math.PI)*0.06; // 0.82-0.88, feather-light
      else scale=0.88+(t-0.9)/0.1*0.12; // expand to 1.0 for soft landing
      kfs.push({transform:'translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) scale('+scale.toFixed(3)+')'});
    }
    const a=el.animate(kfs,{duration:dur,easing:easing,fill:'forwards'});
    a.onfinish=function(){resolve();};
  });
}

// 马 · 灵活：L形抛物线跳跃，带轻微弹跳和旋转 (agile: L-shape parabolic jump)
// v1.0.8 PHASE 22 (优化): keyframe 数量从 24 减至 18 以降低 GC 压力，
//   提升流畅度。运动公式不变（抛物线弧 + L 形偏向 + 旋转）。
// v1.0.8 PHASE 23 (smoothness): removed per-frame `filter: drop-shadow`
//   from keyframes — the static drop-shadow on `.move-anim` (CSS) is
//   composited once and cached, so each frame is a pure transform update.
function _animKnight(el,dx,dy,dur,easing){
  return new Promise(resolve=>{
    const steps=18;
    const kfs=[];
    const arcHeight=CELL*0.28; // 28% of cell size
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const arc=4*t*(1-t);            // parabola: 0→1→0
      const phaseBias=Math.sin(t*Math.PI)*0.15;
      // L-shape feel: bias toward the longer axis mid-flight
      const x=dx*t+(Math.abs(dy)>Math.abs(dx)?phaseBias*Math.sign(dy)*arcHeight*0.15:0);
      const y=dy*t+(Math.abs(dx)>Math.abs(dy)?phaseBias*Math.sign(dx)*arcHeight*0.15:0)-arc*arcHeight;
      const scale=1+arc*0.18;
      const rot=Math.sin(t*Math.PI*2)*4;
      kfs.push({transform:'translate3d('+x+'px,'+y+'px,0) scale('+scale+') rotate('+rot+'deg)'});
    }
    const a=el.animate(kfs,{duration:dur,easing:easing,fill:'forwards'});
    a.onfinish=function(){resolve();};
  });
}

// 象 · 机敏：极快斜线 (sharp: quick diagonal)
// v1.0.8 PHASE 23 (smoothness): removed per-frame `filter: drop-shadow`
//   (golden glow) from keyframes — static drop-shadow on `.move-anim` is
//   cached by the compositor. The bishop's signature "golden trail" is
//   now conveyed by the scale curve alone, which is sufficient for the
//   short 270ms duration.
function _animBishop(el,dx,dy,dur,easing){
  return new Promise(resolve=>{
    const kfs=[
      {transform:'translate3d(0px,0px,0) scale(1)',offset:0},
      {transform:'translate3d('+(dx*0.15)+'px,'+(dy*0.15)+'px,0) scale(1.05)',offset:0.15},
      {transform:'translate3d('+(dx*0.5)+'px,'+(dy*0.5)+'px,0) scale(1.08)',offset:0.5},
      {transform:'translate3d('+(dx*0.85)+'px,'+(dy*0.85)+'px,0) scale(1.03)',offset:0.85},
      {transform:'translate3d('+dx+'px,'+dy+'px,0) scale(1)',offset:1}
    ];
    const a=el.animate(kfs,{duration:dur,easing:easing,fill:'forwards'});
    a.onfinish=function(){resolve();};
  });
}

// 车 · 生猛：蓄力顿挫，猛冲到目标，伴随轻震 (fierce: charge-dash-impact)
function _animRook(el,dx,dy,dur,easing){
  return new Promise(resolve=>{
    const kfs=[
      {transform:'translate3d(0px,0px,0) scale(1)',offset:0},
      {transform:'translate3d(0px,0px,0) scale(1.08)',offset:0.08},
      {transform:'translate3d(0px,0px,0) scale(0.96)',offset:0.14},
      {transform:'translate3d('+(dx*0.04)+'px,'+(dy*0.04)+'px,0) scale(1.02)',offset:0.18},
      {transform:'translate3d('+(dx*0.92)+'px,'+(dy*0.92)+'px,0) scale(1.05)',offset:0.86},
      {transform:'translate3d('+dx+'px,'+dy+'px,0) scale(1.12)',offset:0.94},
      {transform:'translate3d('+dx+'px,'+dy+'px,0) scale(0.98)',offset:0.98},
      {transform:'translate3d('+dx+'px,'+dy+'px,0) scale(1)',offset:1}
    ];
    const a=el.animate(kfs,{duration:dur,easing:easing,fill:'forwards'});
    a.onfinish=function(){_triggerBoardShake('light');resolve();};
  });
}

// 后 · 铿锵有力、掷地有声：最沉重的移动 + 落地巨型震屏（比车更震撼）
// v1.0.8 PHASE 26 (optimization): The queen now "铿锵有声、掷地有声" — heavier
//   than the rook. Design: long duration (520ms), large scale swell mid-flight
//   (queen is the most powerful piece — she carries weight), a dramatic
//   pre-landing compression (t>0.85: scale dips to 0.92 then snaps to 1.18 on
//   impact), and a MASSIVE board shake on landing (heavier than king's heavy).
//   The pre-landing dip + impact snap creates the "铿锵" (clanking/resounding)
//   feel. All keyframes mutate ONLY transform to sustain high fps.
function _animQueen(el,dx,dy,dur,easing){
  return new Promise(resolve=>{
    const steps=18;
    const kfs=[];
    const arcSign=(Math.abs(dx)>Math.abs(dy))?-1:1;
    const arcAmt=Math.min(Math.abs(dx),Math.abs(dy))*0.18+CELL*0.10;
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      const sin=Math.sin(t*Math.PI);
      const x=dx*t+(dy!==0?sin*arcAmt*arcSign*0.4:0);
      const y=dy*t-(dx!==0?sin*arcAmt*arcSign*0.4:0)-sin*5;
      let scale;
      if(t<0.85){
        // Mid-flight: large swell (queen carries weight — she is the strongest)
        scale=1+sin*0.12;
      }else{
        // Pre-landing compression (dip to 0.92) then impact snap (1.18 → 1.0)
        // This creates the "铿锵" clanking feel — wind up, then slam.
        const lt=(t-0.85)/0.15; // 0→1 over last 15%
        if(lt<0.35)scale=1.12-lt*0.57;        // wind down: 1.12 → 0.92
        else if(lt<0.55)scale=0.92+(lt-0.35)*1.3; // snap up: 0.92 → 1.18
        else scale=1.18-(lt-0.55)/0.45*0.18;  // settle: 1.18 → 1.0
      }
      kfs.push({transform:'translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) scale('+scale.toFixed(3)+')'});
    }
    const a=el.animate(kfs,{duration:dur,easing:easing,fill:'forwards'});
    // v1.0.8 PHASE 26: queen landing triggers MASSIVE shake (heaviest, > king's heavy)
    a.onfinish=function(){_triggerBoardShake('massive');resolve();};
  });
}

// 王 · 威严庄重：比车更沉稳，每步微沉，落地重击 (solemn: heavier than rook)
// v1.0.8 PHASE 26 (optimization): The king now "威严庄重" — more solemn/steady
//   than the rook. Design: longest duration (560ms), four measured "steps"
//   (the king does not glide — he plants each foot deliberately), a very subtle
//   scale breath (1.0 → 1.02 → 1.0) to convey regal gravitas, and a HEAVY shake
//   on landing (lighter than queen's massive, but heavier than rook's light).
//   The step-wise y-wobble is retained but smoothed. All keyframes mutate ONLY
//   transform to sustain high fps.
function _animKing(el,dx,dy,dur,easing){
  return new Promise(resolve=>{
    const steps=28;
    const kfs=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      let x=dx*t, y=dy*t;
      // Four deliberate steps: y dips slightly at each step landing, then
      // recovers. Unlike the old version, the dip is smooth (no hard cutoff)
      // and deeper (0.6px → CELL*0.025) to feel "沉稳" (steady/heavy).
      const stepPhase=t*4;
      const stepFrac=stepPhase-Math.floor(stepPhase);
      // Smooth bell curve per step (sin), peaking at stepFrac=0.5
      const stepDip=Math.sin(stepFrac*Math.PI)*CELL*0.025;
      y+=stepDip;
      // Subtle scale breath: 1.0 → 1.02 → 1.0 over the whole journey
      // (conveys "威严" — regal presence, not a fragile tremor like the pawn)
      const scale=1+Math.sin(t*Math.PI)*0.02;
      kfs.push({transform:'translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) scale('+scale.toFixed(3)+')'});
    }
    const a=el.animate(kfs,{duration:dur,easing:easing,fill:'forwards'});
    a.onfinish=function(){_triggerBoardShake('heavy');resolve();};
  });
}

// Dispatch piece animation by type. Returns Promise<void>.
function _runPieceAnim(el,pieceType,dx,dy){
  const dur=ANIM_DURATIONS[pieceType]||300;
  const easing=ANIM_EASINGS[pieceType]||'linear';
  switch(pieceType){
    case 'pawn':   return _animPawn(el,dx,dy,dur,easing);
    case 'knight': return _animKnight(el,dx,dy,dur,easing);
    case 'bishop': return _animBishop(el,dx,dy,dur,easing);
    case 'rook':   return _animRook(el,dx,dy,dur,easing);
    case 'queen':  return _animQueen(el,dx,dy,dur,easing);
    case 'king':   return _animKing(el,dx,dy,dur,easing);
    default:
      return new Promise(resolve=>{
        el.style.transition='transform '+dur+'ms '+easing;
        el.style.transform='translate3d('+dx+'px,'+dy+'px,0)';
        setTimeout(resolve,dur);
      });
  }
}

// v1.0.8 PHASE 22: Trigger per-piece sound via audioEngine (defined in ui.js).
// Defensive: typeof check guards against load-order issues during development.
// For captures: playCapture (impact burst) + per-piece sound (movement) play
// concurrently — the capture sound represents the captured piece's "hit" and
// the per-piece sound represents the mover's approach. The compressor in the
// audio routing chain prevents clipping when both sounds overlap.
// v1.0.8 PHASE 22 (bug fix): Check soundOn before playing — this function is
// called directly from animateMove (bypassing playSound's soundOn guard), so
// without this check, move sounds would play even when the user muted sound.
function _playPieceSound(pieceType,isCapture){
  try{
    if(soundOn !== undefined&&!soundOn)return;
    if(typeof audioEngine!=='undefined'&&audioEngine){
      if(isCapture&&typeof audioEngine.playCapture==='function'){
        audioEngine.playCapture();
      }
      const fnName='play'+pieceType.charAt(0).toUpperCase()+pieceType.slice(1);
      const fn=audioEngine[fnName];
      if(typeof fn==='function')fn.call(audioEngine);
    }
  }catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
}

// v1.0.8 PHASE 22: Trigger castle sound via audioEngine (rook move + king + rook land).
// v1.0.8 PHASE 22 (bug fix): Check soundOn before playing (same reason as above).
function _playCastleSound(){
  try{
    if(soundOn !== undefined&&!soundOn)return;
    if(typeof audioEngine!=='undefined'&&audioEngine){
      if(typeof audioEngine.playCastleRookMove==='function')audioEngine.playCastleRookMove();
    }
  }catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
}

// Main animation entry point. Signature preserved from v1.0.7:
//   animateMove(from,to,pieceSym,pieceType,isCapture,isCheck,pieceColor)
// All callers in ui.js use this exact signature — DO NOT change.
function animateMove(from,to,pieceSym,pieceType,isCapture,isCheck,pieceColor){
  // v1.0.8 PHASE 22: prefers-reduced-motion — skip animation entirely.
  // Still trigger sound so the user hears the move (sound is independent of
  // animation per the v1.0.8 design — see ChessAudioEngine in ui.js).
  let _reducedMotion=false;
  try{
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      _reducedMotion=true;
    }
  }catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
  if(_reducedMotion){
    animationInProgress=false;
    _activeAnimEls=[];
    _playPieceSound(pieceType,!!isCapture);
    return;
  }

  // Castling detection (Chess960-aware via _castleSide helper).
  let _castleside=null;
  try{
    if(typeof _lastAnimMv!=='undefined'&&_lastAnimMv&&typeof _castleSide==='function'){
      _castleside=_castleSide(_lastAnimMv);
    }
  }catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
  if(!_castleside&&pieceType==='king'&&Math.abs(to.col-from.col)===2){
    _castleside=to.col===6?'kingside':'queenside';
  }
  // Chess960: when king starts on its castling target square (e.g. SP-ID
  // where white king starts on g1 castling kingside), the king does NOT
  // move — only the rook moves. Skip king overlay; leave king visible.
  const _kingStayedPut=!!_castleside&&from.row===to.row&&from.col===to.col;

  animationInProgress=true;
  _activeAnimEls=[];

  // Hide source piece during animation (overlay replaces it).
  // Hide captured piece too (so the overlay can take its place visually).
  const _srcPc=document.querySelector('.sq[data-r="'+from.row+'"][data-c="'+from.col+'"] .pc');
  if(!_kingStayedPut&&_srcPc)_srcPc.style.opacity='0';
  if(isCapture){
    const _tgtPc=document.querySelector('.sq[data-r="'+to.row+'"][data-c="'+to.col+'"] .pc');
    if(_tgtPc)_tgtPc.style.opacity='0';
  }

  // Resolve .bwrap (cached). Fall back to querySelector if cache is stale.
  const bwrap=_cachedBwrap||(_cachedBwrap=document.querySelector('.bwrap'));
  if(!bwrap||!bwrap.parentNode){
    _cachedBwrap=null;
    animationInProgress=false;
    if(_srcPc)_srcPc.style.opacity='';
    _playPieceSound(pieceType,!!isCapture);
    return;
  }

  // Remove stale overlay nodes from any prior animation.
  const oldAnims=bwrap.querySelectorAll('.move-anim');
  for(let i=0;i<oldAnims.length;i++)oldAnims[i].remove();

  const cs=CELL;
  const _flip=playerColor==='black';
  const _fc=_flip?7-from.col:from.col, _fr=_flip?7-from.row:from.row;
  const _tc=_flip?7-to.col:to.col,    _tr=_flip?7-to.row:to.row;
  const dx=(_tc-_fc)*cs, dy=(_tr-_fr)*cs;

  // Bump generation counter so any prior _finishAnim closure self-invalidates.
  ++_animGen;
  const _myGen=_animGen;
  let _animDone=false;

  // Create king overlay (skip if king stayed put for Chess960 castling).
  let el=null;
  if(!_kingStayedPut){
    el=document.createElement('div');
    el.className='move-anim anim-'+pieceType+(pieceColor==='white'?' w-piece':' bk-piece');
    el.textContent=pieceSym;
    el.style.cssText='left:'+(_fc*cs)+'px;top:'+(_fr*cs)+'px;width:'+cs+'px;height:'+cs+'px;transform:translate3d(0,0,0);opacity:1;will-change:transform';
    bwrap.appendChild(el);
    // v1.0.8 PHASE 30: include lastCell=CELL so _reattachActiveAnimations can
    //   detect a CELL change on the FIRST re-attach (previously lastCell was
    //   undefined, skipping the snap-to-dest correction if orientation changed
    //   in the first few ms of an animation).
    _activeAnimEls.push({el:el,from:{row:from.row,col:from.col},dx:dx,dy:dy,lastCell:cs});
  }

  // Castling: also create rook overlay (Chess960-aware via chess960CastlingRookMove)
  let rookEl=null;
  let rdx=0, rdy=0;
  const isCastling=!!_castleside;
  if(isCastling&&pieceColor){
    let rFromCol=-1, rToCol=-1;
    try{
      if(typeof chess960CastlingRookMove==='function'){
        const rm=chess960CastlingRookMove(gameState,pieceColor,_castleside);
        if(rm){rFromCol=rm.rookFrom;rToCol=rm.rookTo;}
      }
    }catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
    // Fallback to standard chess rook positions if helper fails
    if(rFromCol<0){
      if(_castleside==='kingside'){rFromCol=7;rToCol=5;}
      else{rFromCol=0;rToCol=3;}
    }
    if(rFromCol>=0&&rFromCol!==rToCol){
      // Hide source rook during animation
      const _srcRookPc=document.querySelector('.sq[data-r="'+from.row+'"][data-c="'+rFromCol+'"] .pc');
      if(_srcRookPc)_srcRookPc.style.opacity='0';
      const rFrom={row:from.row,col:rFromCol}, rTo={row:from.row,col:rToCol};
      const _rfc=_flip?7-rFrom.col:rFrom.col, _rfr=_flip?7-rFrom.row:rFrom.row;
      const _rtc=_flip?7-rTo.col:rTo.col,     _rtr=_flip?7-rTo.row:rTo.row;
      rdx=(_rtc-_rfc)*cs; rdy=(_rtr-_rfr)*cs;
      rookEl=document.createElement('div');
      rookEl.className='move-anim anim-rook'+(pieceColor==='white'?' w-piece':' bk-piece');
      rookEl.textContent=SYM[pieceColor].rook;
      rookEl.style.cssText='left:'+(_rfc*cs)+'px;top:'+(_rfr*cs)+'px;width:'+cs+'px;height:'+cs+'px;transform:translate3d(0,0,0);opacity:1;will-change:transform';
      bwrap.appendChild(rookEl);
      // v1.0.8 PHASE 30: include lastCell=cs (same fix as king overlay above)
      _activeAnimEls.push({el:rookEl,from:rFrom,dx:rdx,dy:rdy,lastCell:cs});
    }
  }

  // Trigger sound at animation start (synced with keyframe t=0).
  if(isCastling){
    _playCastleSound();
  }else{
    _playPieceSound(pieceType,!!isCapture);
  }

  // Run piece animations concurrently (king + rook for castling).
  const promises=[];
  if(el){
    promises.push(_runPieceAnim(el,pieceType,dx,dy));
  }
  if(rookEl){
    promises.push(_runPieceAnim(rookEl,'rook',rdx,rdy));
  }

  // _finishAnim: cleanup closure. Self-invalidates if a newer animation started.
  function _finishAnim(){
    if(_animDone)return;
    _animDone=true;
    // v1.0.8 PHASE 23 (flicker fix, first-principles):
    // Previously this function called el.remove() / rookEl.remove() to detach
    // the overlay nodes the instant the Web Animations API fired onfinish.
    // However, the post-move render() (which rebuilds the DOM with the new
    // piece position) is scheduled separately via setTimeout(ANIMATION_DEFER_MS)
    // → requestAnimationFrame(updateAfterMove) → render(). That creates a
    // ~40–56ms window between overlay removal and the next paint in which both
    // the source square (opacity:0) and destination square (no overlay, no new
    // DOM yet) appear empty — perceived by the user as a piece flicker.
    //
    // First-principles fix: do NOT remove the overlay here. The overlay stays
    // visible at the destination square until render() runs. render() does
    // `app.innerHTML = h`, which destroys the entire .bwrap subtree (including
    // the overlay) and rebuilds it with the new game state in a single
    // synchronous DOM mutation. The browser then paints the new state in the
    // same frame — no flicker window exists.
    //
    // _activeAnimEls is still cleared so that _reattachActiveAnimations()
    // (called by render after innerHTML replacement) does NOT re-append the
    // now-stale overlay nodes to the new DOM.
    if(_myGen!==_animGen){
      // Stale closure (a newer animation started). The overlay elements may
      // still be in the DOM if the newer animation hasn't started yet, or may
      // have been removed by the newer animation's cleanup. Safe to remove.
      if(el)el.remove();
      if(rookEl)rookEl.remove();
      return;
    }
    animationInProgress=false;
    _activeAnimEls=[];
    _lastAnimMv=null;
    // NOTE: el.remove() / rookEl.remove() intentionally omitted — see comment
    // above. The overlay is destroyed by the next render()'s innerHTML reset.
  }

  // Wait for all piece animations, then finish.
  if(promises.length>0){
    Promise.all(promises).then(function(){_finishAnim();});
  }else{
    // No overlay created (e.g., kingStayedPut with no rookEl) — finish now.
    _finishAnim();
  }

  // Safety timeout: if Web Animations API fails (e.g., browser quirk), still
  // clean up. Duration is max piece duration + 100ms buffer.
  const _maxDur=Math.max(
    ANIM_DURATIONS[pieceType]||300,
    rookEl?(ANIM_DURATIONS.rook||300):0
  )+100;
  setTimeout(function(){
    if(_myGen===_animGen&&!_animDone){_finishAnim();}
  },_maxDur);
}

// v1.0.8 PHASE 22: Re-attach active animation overlay nodes after DOM rebuild.
// Called by ui.js render() when the .bwrap innerHTML is regenerated during an
// active animation. Without this, the overlay would be lost mid-animation.
// v1.0.8 PHASE 24 (bug fix): If CELL changed (orientation change mid-animation),
//   the WAAPI animation's dx/dy are stale. We cancel the animation and snap
//   the overlay to the (new) destination position so it doesn't land on the
//   wrong square. The overlay will be destroyed by the next render's innerHTML
//   reset as usual.
function _reattachActiveAnimations(){
  if(!_activeAnimEls.length)return;
  const bwrap=_cachedBwrap||(_cachedBwrap=document.querySelector('.bwrap'));
  if(!bwrap||!bwrap.parentNode){_cachedBwrap=null;return;}
  const cs=CELL;
  const _flip=playerColor==='black';
  for(const a of _activeAnimEls){
    // v1.0.8 PHASE 28 (bug fix): _fc/_fr must be computed OUTSIDE the if-block
    //   (they were const-scoped inside, causing ReferenceError in the snap-to-dest
    //   path below). Also fixed the snap formula: the overlay's left/top already
    //   positions it at the source square, so the transform should be just the
    //   scaled dx/dy (not source + dx/dy — that would double-count the source).
    const _fc=_flip?7-a.from.col:a.from.col, _fr=_flip?7-a.from.row:a.from.row;
    if(!a.el||!a.el.parentNode){
      a.el.style.left=(_fc*cs)+'px';
      a.el.style.top=(_fr*cs)+'px';
      a.el.style.width=cs+'px';
      a.el.style.height=cs+'px';
      bwrap.appendChild(a.el);
    }
    // v1.0.8 PHASE 24: If cell size changed since the animation started, the
    // cached dx/dy are wrong. Cancel the WAAPI animation and snap to dest.
    // v1.0.8 PHASE 28 (bug fix): transform = scaled dx/dy only (source position
    //   is already handled by left/top). Old formula added _fc*cs again.
    if(a.lastCell&&a.lastCell!==cs){
      try{
        a.el.getAnimations().forEach(an=>an.cancel());
        const _sx=a.dx*(cs/a.lastCell), _sy=a.dy*(cs/a.lastCell);
        a.el.style.transform='translate3d('+_sx.toFixed(2)+'px,'+_sy.toFixed(2)+'px,0)';
      }catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
    }
    a.lastCell=cs;
  }
}


function initBoard(){const b=Array.from({length:8},()=>Array(8).fill(null));const backRank=['rook','knight','bishop','queen','king','bishop','knight','rook'];for(let c=0;c<8;c++){b[0][c]={type:backRank[c],color:'black'};b[1][c]={type:'pawn',color:'black'};b[6][c]={type:'pawn',color:'white'};b[7][c]={type:backRank[c],color:'white'}}return b}
// Returns all squares this piece attacks
function attacked(board,pos){const b=board,p=b[pos.row][pos.col];if(!p)return[];const r=pos.row,c=pos.col,co=p.color,mv=[];if(p.type==='pawn'){const d=co==='white'?-1:1;for(const dc of[-1,1])if(inB(r+d,c+dc))mv.push({row:r+d,col:c+dc})}else if(p.type==='knight'){for(const[dr,dc]of KNIGHT_OFFSETS)if(inB(r+dr,c+dc))mv.push({row:r+dr,col:c+dc})}else if(p.type==='king'){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&inB(r+dr,c+dc))mv.push({row:r+dr,col:c+dc})}else{const dirs=p.type==='rook'?DIR_ROOK:p.type==='bishop'?DIR_BISHOP:DIR_QUEEN;for(const[dr,dc]of dirs){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){mv.push({row:nr,col:nc});if(b[nr][nc])break;nr+=dr;nc+=dc}}}return mv}
function initState(){const s={board:initBoard(),currentTurn:'white',castlingRights:{whiteKingside:true,whiteQueenside:true,blackKingside:true,blackQueenside:true,
// v1.2.3 round-20 (A-1): standard chess designates the corner rooks (h/a files)
whiteKingsideRookFile:7,whiteQueensideRookFile:0,blackKingsideRookFile:7,blackQueensideRookFile:0},enPassantTarget:null,halfMoveClock:0,fullMoveNumber:1,moveHistory:[],posCount:new Map(),wk:{row:7,col:4},bk:{row:0,col:4},hash:0,boardVersion:1};syncHash(s);s.posCount.set(s.hash,1);return s}
// v1.0.7: validateSetupPosition now also validates the manual 🔁 castle markers
// and the ⚡ en-passant marker carried on s.setupCastleMarks (a Set of "r*8+c"
// keys) and s.setupEpMark ({row,col}|null). Both validations follow the
// Fischer-Random / Chess960 castling convention (king + rook on the initial
// rank, king strictly between the two castle-marked rooks of that color, max
// one marker per side per color). En-passant marker must share a square with
// an opposite-color pawn on rank 4 (white) or rank 5 (black); only one marker
// is allowed on the entire board.
function validateSetupPosition(s){
  // First pass: locate kings (existing behavior)
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=s.board[r][c];if(p?.type==='king'){if(p.color==='white')s.wk={row:r,col:c};else s.bk={row:r,col:c}}}
  const errs=[];
  const wPieces=[],bPieces=[];
  // v1.0.8 PHASE 24 (PERF + bug fix): single-pass piece collection with
  //   per-type counters, replacing 12+ separate .filter() passes. Also
  //   validates pawns on both rank 1 AND rank 8 (previously only checked
  //   one rank per color with swapped rank-number literals in errors).
  const _wCnt={pawn:0,knight:0,bishop:0,rook:0,queen:0,king:0};
  const _bCnt={pawn:0,knight:0,bishop:0,rook:0,queen:0,king:0};
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=s.board[r][c];
    if(!p)continue;
    if(p.color==='white'){wPieces.push(p);_wCnt[p.type]++;}
    else{bPieces.push(p);_bCnt[p.type]++;}
    if(p.type==='pawn'&&(r===0||r===7)){
      // v1.0.8 PHASE 28 FIX: rank formula — row 0 = rank 8 (black), row 7 = rank 1 (white).
      const rank=(r===0)?8:1;
      errs.push((p.color==='white'?T('setup_white'):T('setup_black'))+T('setup_pawn_on_rank')+rank+T('setup_rank')+'('+posAlg({row:r,col:c})+')');
    }
  }
  const wk=s.wk,bk=s.bk;
  if(_wCnt.king===0)errs.push(T('setup_no_white_king'));
  if(_bCnt.king===0)errs.push(T('setup_no_black_king'));
  if(_wCnt.king>1)errs.push(T('setup_white')+T('setup_king_count_over'));
  if(_bCnt.king>1)errs.push(T('setup_black')+T('setup_king_count_over'));
  if(wk&&bk&&Math.abs(wk.row-bk.row)<=1&&Math.abs(wk.col-bk.col)<=1)errs.push(T('setup_kings_adjacent'));
  const nonMoveColor=OPP_COLOR[s.currentTurn];
  const nonMoveKing=nonMoveColor==='white'?s.wk:s.bk;
  if(nonMoveKing&&inCheck(s.board,nonMoveColor,nonMoveKing))errs.push((nonMoveColor==='white'?T('setup_white'):T('setup_black'))+T('setup_check_impossible'));
  if(wPieces.length>16)errs.push(T('setup_white')+T('setup_piece_over_limit'));
  if(bPieces.length>16)errs.push(T('setup_black')+T('setup_piece_over_limit'));
  if(_wCnt.pawn>8)errs.push(T('setup_white')+T('setup_pawn_over_8'));
  if(_bCnt.pawn>8)errs.push(T('setup_black')+T('setup_pawn_over_8'));
  if(_wCnt.queen>9)errs.push(T('setup_white')+T('setup_queen_over_9'));
  if(_bCnt.queen>9)errs.push(T('setup_black')+T('setup_queen_over_9'));
  if(_wCnt.rook>10)errs.push(T('setup_white')+T('setup_rook_over_10'));
  if(_bCnt.rook>10)errs.push(T('setup_black')+T('setup_rook_over_10'));
  if(_wCnt.bishop>10)errs.push(T('setup_white')+T('setup_bishop_over_10'));
  if(_bCnt.bishop>10)errs.push(T('setup_black')+T('setup_bishop_over_10'));
  if(_wCnt.knight>10)errs.push(T('setup_white')+T('setup_knight_over_10'));
  if(_bCnt.knight>10)errs.push(T('setup_black')+T('setup_knight_over_10'));
  // v1.0.7 — Validate 🔁 castle markers and ⚡ en-passant marker
  _validateSetupCastleMarks(s,errs);
  _validateSetupEpMark(s,errs);
  // v1.0.8 PHASE 22 (bug fix): Re-sync Zobrist hash after validation modifies
  // castlingRights and enPassantTarget. Without this, gameState.hash is stale,
  // causing posCount inconsistency and potential castling-rights detection
  // issues (the engine receives a FEN derived from the correct castlingRights,
  // but the internal hash-based position tracking is wrong, which can cause
  // subtle issues with threefold repetition and state restoration).
  syncHash(s);
  return errs
}

// v1.0.7: Validate Fischer-Random-style castle markers.
// Marker source of truth: s.setupCastleMarks (a Set of "r*8+c" string keys).
// For each marker:
//   1. The square must hold a rook of SOME color.
//   2. That rook must be on its initial rank (white: row 7 = rank 1; black: row 0 = rank 8).
//   3. The same-color king must also be on its initial rank.
//   4. The rook must be on the correct side of the same-color king:
//      - kingside (h-side): rook's col > king's col
//      - queenside (a-side): rook's col < king's col
//   5. Two same-color rooks on the SAME side of the king cannot both carry markers
//      (a side has only one castle right).
// If valid, the corresponding castlingRights[color][side] flag is set true; all
// other flags are set false. This explicit assignment overrides any prior
// auto-computed rights — fully manual control per the v1.0.7 spec.
function _validateSetupCastleMarks(s,errs){
  if(!errs)return;
  if(!s.setupCastleMarks||s.setupCastleMarks.size===0){
    // No markers → no castling rights for either color.
    // v1.2.3 round-20 (A-1): also reset the designated rook files.
    s.castlingRights={whiteKingside:false,whiteQueenside:false,blackKingside:false,blackQueenside:false,whiteKingsideRookFile:null,whiteQueensideRookFile:null,blackKingsideRookFile:null,blackQueensideRookFile:null};
    return;
  }
  // Reset all rights — only marker-validated rights will be set true.
  s.castlingRights={whiteKingside:false,whiteQueenside:false,blackKingside:false,blackQueenside:false,whiteKingsideRookFile:null,whiteQueensideRookFile:null,blackKingsideRookFile:null,blackQueensideRookFile:null};
  // Group markers by color of the rook on that square.
  const byColor={white:[],black:[]};
  for(const key of s.setupCastleMarks){
    const idx=Number.parseInt(key,10);
    // v1.2.1 round-9: Guard against malformed keys. parseInt returns NaN for
    // non-numeric strings; `NaN>>3` is 0 and `NaN&7` is 0, so a malformed key
    // would silently map to (row=0, col=0) = a8 and either be incorrectly
    // accepted (if a8 has a rook) or produce a spurious "not a rook" error
    // for a8. Reject non-integer or out-of-range keys explicitly.
    if(!Number.isInteger(idx)||idx<0||idx>=64){
      errs.push(T('setup_castle_err_not_rook')+' ('+String(key)+')');
      continue;
    }
    const r=idx>>3,c=idx&7;
    const p=s.board[r]&&s.board[r][c];
    if(!p){errs.push(T('setup_castle_err_not_rook')+' ('+posAlg({row:r,col:c})+')');continue;}
    if(p.type!=='rook'){errs.push(T('setup_castle_err_not_rook')+' ('+posAlg({row:r,col:c})+')');continue;}
    byColor[p.color].push({r,c});
  }
  // Validate per color
  for(const color of ['white','black']){
    const rooks=byColor[color];
    if(!rooks.length)continue;
    const king=color==='white'?s.wk:s.bk;
    if(!king){errs.push(T('setup_castle_err_king_missing'));continue;}
    const initRow=color==='white'?7:0;
    if(king.row!==initRow){errs.push(T('setup_castle_err_wrong_rank'));continue;}
    // Partition rooks into kingside (col>king.col) and queenside (col<king.col).
    // Rooks on the same column as the king are illegal (no side).
    const ksr=[],qsr=[];
    for(const rook of rooks){
      if(rook.r!==initRow){errs.push(T('setup_castle_err_wrong_rank')+' ('+posAlg({row:rook.r,col:rook.c})+')');continue;}
      if(rook.c>king.col)ksr.push(rook);
      else if(rook.c<king.col)qsr.push(rook);
      else errs.push(T('setup_castle_err_wrong_side')+' ('+posAlg({row:rook.r,col:rook.c})+')');
    }
    if(ksr.length>1)errs.push(T('setup_castle_err_dup_side')+' ('+(color==='white'?'O-O':'o-o')+')');
    if(qsr.length>1)errs.push(T('setup_castle_err_dup_side')+' ('+(color==='white'?'O-O-O':'o-o-o')+')');
    // Mark valid rights (no error if exactly one rook on the side)
    // v1.2.3 round-20 (A-1): the explicitly 🔁-marked rook IS the designated
    //   castling rook — record its file so later ambiguity resolution
    //   (findDesignatedCastlingRook) needs no heuristic.
    if(ksr.length===1){s.castlingRights[color+'Kingside']=true;s.castlingRights[color+'KingsideRookFile']=ksr[0].c;}
    if(qsr.length===1){s.castlingRights[color+'Queenside']=true;s.castlingRights[color+'QueensideRookFile']=qsr[0].c;}
  }
}

// v1.0.7: Validate the ⚡ en-passant marker.
// Marker source of truth: s.setupEpMark ({row,col}|null) — the square where the
// ⚡ marker is shown, which is the square of the pawn that just double-stepped
// (the opponent's pawn that can be captured en passant).
// Rules:
//   1. At most one marker on the entire board.
//   2. The marker must share its square with a pawn.
//   3. That pawn must be on rank 4 (white pawn → row 4) or rank 5 (black pawn → row 3).
//   4. The pawn's color must be the OPPOSITE of s.currentTurn.
//   5. v1.0.7 PHASE 7 NEW: There must be an adjacent enemy pawn that can
//      actually capture en passant. The enemy pawn must be on the SAME rank
//      as the marked pawn, on an adjacent file (col±1), and of the color
//      that is the side to move (s.currentTurn). Without this check, the user
//      could place a ⚡ marker on a pawn that has no enemy pawn nearby — the
//      en-passant target would be set but never usable, which is misleading.
// If valid, s.enPassantTarget is set to the SKIPPED square (the square an
// enemy pawn would land on after capturing en passant).
function _validateSetupEpMark(s,errs){
  if(!errs)return;
  if(!s.setupEpMark){s.enPassantTarget=null;return;}
  const {row,col}=s.setupEpMark;
  const p=s.board[row]&&s.board[row][col];
  if(!p||p.type!=='pawn'){errs.push(T('setup_ep_err_no_pawn')+' ('+posAlg({row,col})+')');s.enPassantTarget=null;return;}
  if(p.color==='white'&&row!==4){errs.push(T('setup_ep_err_wrong_rank')+' ('+posAlg({row,col})+')');s.enPassantTarget=null;return;}
  if(p.color==='black'&&row!==3){errs.push(T('setup_ep_err_wrong_rank')+' ('+posAlg({row,col})+')');s.enPassantTarget=null;return;}
  if(p.color===s.currentTurn){errs.push(T('setup_ep_err_wrong_color')+' ('+posAlg({row,col})+')');s.enPassantTarget=null;return;}
  // v1.0.7 PHASE 7: Check for an adjacent enemy pawn that can capture en passant.
  // The capturing pawn must be on the SAME rank as the marked pawn, on an
  // adjacent file (col-1 or col+1), and of the side-to-move color (s.currentTurn).
  const capturerColor=s.currentTurn; // the side that would capture
  let _hasCapturer=false;
  for(const dc of [-1,1]){
    const nc=col+dc;
    if(nc<0||nc>7)continue;
    const cp=s.board[row]&&s.board[row][nc];
    if(cp?.type==='pawn'&&cp.color===capturerColor){_hasCapturer=true;break;}
  }
  if(!_hasCapturer){
    errs.push(T('setup_ep_err_no_capturer')+' ('+posAlg({row,col})+')');
    s.enPassantTarget=null;return;
  }
  // v1.0.7 PHASE 6: en-passant target = the SKIPPED square.
  const epTargetRow=p.color==='white'?row+1:row-1;
  // v1.2.3 round-18 (bug fix): the skipped square AND the pawn's origin
  //   square must both be EMPTY — a double push passes over the skipped
  //   square from the origin, so an occupied square on either makes the
  //   en-passant marker illegal (fenToState has the same gap, noted in the
  //   round-18 review). Origin: white pawn on row 4 came from row 6; black
  //   pawn on row 3 came from row 1.
  const _epOriginRow=p.color==='white'?row+2:row-2;
  if((s.board[epTargetRow]&&s.board[epTargetRow][col])||(s.board[_epOriginRow]&&s.board[_epOriginRow][col])){
    errs.push(T('setup_ep_err_blocked')+' ('+posAlg({row,col})+')');
    s.enPassantTarget=null;return;
  }
  s.enPassantTarget={row:epTargetRow,col};
}

// v1.0.7 PHASE 3: Compute the visible 🔁 castle-rights marker set from the
// current game state's castlingRights + king/rook positions. Used by the
// renderer to display 🔁 markers in ALL modes (setup, play, review).
//
// In setup mode, the user's setupCastleMarks (Set of "r*8+c" string keys) is
// the source of truth and is returned directly — that's the input.
// In play/review mode, we derive markers FROM castlingRights:
//   - For each side with castling rights, find the closest same-color rook on
//     the relevant side of the king on the initial rank. If found, mark it.
// This means markers automatically appear/disappear as castling rights are
// gained/lost during play, satisfying the user's requirement that markers
// "auto-remove when no longer eligible per the rules".
function computeVisibleCastleMarks(s){
  // v1.0.8 PHASE 40: only use setupCastleMarks when actually in setup mode.
  //   Previously, if setupCastleMarks persisted after exiting setup mode
  //   (via FEN import, PGN import, new game, etc.), this function would
  //   return the stale markers instead of deriving from castlingRights.
  //   Now we check setupMode explicitly, so stale markers are ignored.
  if(typeof setupMode!=='undefined'&&setupMode&&s.setupCastleMarks&&s.setupCastleMarks instanceof Set&&s.setupCastleMarks.size>0){
    return s.setupCastleMarks;
  }
  const marks=new Set();
  if(!s.castlingRights)return marks;
  // White
  if(s.wk&&s.wk.row===7){
    const wkCol=s.wk.col;
    if(s.castlingRights.whiteKingside){
      // Find closest white rook to the right of king on row 7
      for(let c=wkCol+1;c<8;c++){
        const p=s.board[7][c];
        if(p?.type==='rook'&&p.color==='white'){marks.add(String(7*8+c));break;}
      }
    }
    if(s.castlingRights.whiteQueenside){
      for(let c=wkCol-1;c>=0;c--){
        const p=s.board[7][c];
        if(p?.type==='rook'&&p.color==='white'){marks.add(String(7*8+c));break;}
      }
    }
  }
  // Black
  if(s.bk&&s.bk.row===0){
    const bkCol=s.bk.col;
    if(s.castlingRights.blackKingside){
      for(let c=bkCol+1;c<8;c++){
        const p=s.board[0][c];
        if(p?.type==='rook'&&p.color==='black'){marks.add(String(0*8+c));break;}
      }
    }
    if(s.castlingRights.blackQueenside){
      for(let c=bkCol-1;c>=0;c--){
        const p=s.board[0][c];
        if(p?.type==='rook'&&p.color==='black'){marks.add(String(0*8+c));break;}
      }
    }
  }
  return marks;
}

// v1.0.7 PHASE 3: Compute the visible ⚡ en-passant marker from the current
// game state's enPassantTarget. Used by the renderer to display ⚡ in ALL
// modes (setup, play, review).
//
// In setup mode, the user's setupEpMark ({row,col}|null) is the source of
// truth (the pawn's square). setupEpMark is a setup-only transient field:
// toggleSetup() sets it on entry and clears it on exit, and initState()/
// fenToState()/cloneS() never populate it. So s.setupEpMark is truthy IFF
// we're in setup mode — no separate setupMode guard is needed.
// In play/review mode, we derive the marker FROM enPassantTarget (the square
// BEHIND the pawn): convert it back to the pawn's current square. A white
// pawn on row 4 has enPassantTarget on row 5; a black pawn on row 3 has
// enPassantTarget on row 2.
//
// Returns {row,col}|null — the square where the ⚡ badge should be rendered
// (the pawn's current square, not the FEN target square).
function computeVisibleEpMark(s){
  // v1.0.8 PHASE 40: only use setupEpMark when actually in setup mode.
  //   Same fix as computeVisibleCastleMarks — prevents stale setupEpMark
  //   from overriding enPassantTarget after exiting setup mode.
  if(typeof setupMode!=='undefined'&&setupMode&&s.setupEpMark)return s.setupEpMark;
  if(!s.enPassantTarget)return null;
  const {row,col}=s.enPassantTarget;
  // Derive the pawn's square from enPassantTarget (the skipped square) and
  // verify the pawn is actually there with the correct color. The
  // double-stepped pawn is the OPPOSITE color of the side to move.
  if(row===5){
    // White pawn just double-stepped; pawn sits on row 4
    const p=s.board[4]&&s.board[4][col];
    if(p?.type==='pawn'&&p.color==='white'){
      if(s.currentTurn==='black')return {row:4,col};
    }
  }else if(row===2){
    // Black pawn just double-stepped; pawn sits on row 3
    const p=s.board[3]&&s.board[3][col];
    if(p?.type==='pawn'&&p.color==='black'){
      if(s.currentTurn==='white')return {row:3,col};
    }
  }
  return null;
}
// Piece objects are immutable (makeMv creates new objects for promotions)
// Only clone array structure — reduces 64 object copies to 8 array slices per clone
function cloneB(b){return b.map(r=>r.slice())}
// posCount deep-copied for search correctness
// v1.2.3 P1 (Round 17 P1-1): cloneS() now copies Chess960-specific fields
//   chess960 and spid. Previously these were dropped on clone, so any state
//   produced by makeMv(s,mv) (which calls cloneS) lost its Chess960 identity.
//   Effect: Shredder-FEN generation, Chess960 castling rights, and SP-ID
//   round-trip verification all silently degraded after the first move.
function cloneS(s){return{board:cloneB(s.board),currentTurn:s.currentTurn,castlingRights:{...s.castlingRights},enPassantTarget:s.enPassantTarget?{...s.enPassantTarget}:null,halfMoveClock:s.halfMoveClock,fullMoveNumber:s.fullMoveNumber,// moveHistory: array shallow-copied (move objects are never mutated in place,
// only pushed/popped), so sharing by reference would corrupt the parent's array
moveHistory:s.moveHistory?s.moveHistory.slice():[],posCount:new Map(s.posCount),wk:s.wk?{...s.wk}:null,bk:s.bk?{...s.bk}:null,hash:s.hash||0,boardVersion:s.boardVersion||0,
// Chess960 identity fields — only present on Chess960 states (chess960.js).
// Using conditional spread avoids adding undefined keys to standard-chess states.
...(s.chess960?{chess960:true}:{}),
...(s.spid!=null?{spid:s.spid}:{})}}

function sqAttackedFast(b,pos,byCo){if(!b||!pos||!inB(pos.row,pos.col))return false;const r=pos.row,c=pos.col;const pd=byCo==='white'?1:-1;if(inB(r+pd,c-1)&&b[r+pd][c-1]&&b[r+pd][c-1].color===byCo&&b[r+pd][c-1].type==='pawn')return true;if(inB(r+pd,c+1)&&b[r+pd][c+1]&&b[r+pd][c+1].color===byCo&&b[r+pd][c+1].type==='pawn')return true;for(const[dr,dc]of KNIGHT_OFFSETS){if(inB(r+dr,c+dc)&&b[r+dr][c+dc]&&b[r+dr][c+dc].color===byCo&&b[r+dr][c+dc].type==='knight')return true}for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;if(inB(r+dr,c+dc)&&b[r+dr][c+dc]&&b[r+dr][c+dc].color===byCo&&b[r+dr][c+dc].type==='king')return true}for(const[dr,dc]of DIR_ROOK){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){const p=b[nr][nc];if(p){if(p.color===byCo&&(p.type==='rook'||p.type==='queen'))return true;break}nr+=dr;nc+=dc}}for(const[dr,dc]of DIR_BISHOP){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){const p=b[nr][nc];if(p){if(p.color===byCo&&(p.type==='bishop'||p.type==='queen'))return true;break}nr+=dr;nc+=dc}}return false}
/**
 * Check if the given color's king is in check.
 * @param {Array} b - 8x8 board array
 * @param {string} co - Color to check ('white' or 'black')
 * @param {Object|null} kPos - King position {row, col}, or null to return false (does NOT search for the king)
 * @returns {boolean} True if the king is in check
 */
function inCheck(b,co,kPos=null){const k=kPos;return k?sqAttackedFast(b,k,OPP_COLOR[co]):false}
function pseudoMoves(s,pos){const b=s.board,p=b[pos.row][pos.col];if(!p)return[];const r=pos.row,c=pos.col,co=p.color,mv=[],opp=OPP_COLOR[co],pr=co==='white'?0:7,d=co==='white'?-1:1;
if(p.type==='pawn'){
if(inB(r+d,c)&&!b[r+d][c]){if(r+d===pr)for(const pt of['queen','rook','bishop','knight'])mv.push({row:r+d,col:c,promotion:pt});else{mv.push({row:r+d,col:c});if(r===(co==='white'?6:1)&&!b[r+2*d][c])mv.push({row:r+2*d,col:c})}}
for(const dc of[-1,1])if(inB(r+d,c+dc)){if(b[r+d][c+dc]&&b[r+d][c+dc].color!==co){if(r+d===pr)for(const pt of['queen','rook','bishop','knight'])mv.push({row:r+d,col:c+dc,promotion:pt});else mv.push({row:r+d,col:c+dc})}if(s.enPassantTarget&&s.enPassantTarget.row===r+d&&s.enPassantTarget.col===c+dc)mv.push({row:r+d,col:c+dc})}}
else if(p.type==='knight'){for(const[dr,dc]of KNIGHT_OFFSETS)if(inB(r+dr,c+dc)&&(!b[r+dr][c+dc]||b[r+dr][c+dc].color!==co))mv.push({row:r+dr,col:c+dc})}
else if(p.type==='king'){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&inB(r+dr,c+dc)&&(!b[r+dr][c+dc]||b[r+dr][c+dc].color!==co))mv.push({row:r+dr,col:c+dc});
// v1.0.4 ROUND-5 REV16: Chess960 castling
// v1.0.6: Tag castling moves with an explicit `castle` flag so downstream
// code (makeMv / makeMvInPlace / moveAlg / animateMove / _uciToSimple) can
// unambiguously detect castling in Chess960 where the king may move only
// 1 column (e.g. king at f1 castling kingside to g1). The legacy
// `Math.abs(to.col-from.col)===2` check is still used as a fallback for
// moves reconstructed from PGN that don't carry the flag.
const hr=co==='white'?7:0;
// v1.0.7 PHASE 3: ALWAYS use the Chess960 castling rule (Fischer Random castling).
// First-principles analysis: the user reported "有合法的🔁、⚡标记的棋子在对局中
// 没有获得相应的可行走法" — when the user sets up a position via Setup mode and
// marks a rook with 🔁 that is NOT on the standard h1/a1 square, the old
// standard-chess-only castling generator (which hard-coded king on e1, rook on
// h1/a1) would NOT generate castling moves, even though castlingRights were
// correctly set by _validateSetupCastleMarks.
//
// The Chess960 castling rule (Fischer Random) is a SUPERSET of the standard
// chess castling rule: when the king is on e1 and the rook is on h1, Chess960
// castling produces the exact same result (king to g1, rook to f1) as standard
// castling. So switching to Chess960 castling unconditionally is SAFE and does
// not change the behavior of standard-chess games.
//
// This also fixes a latent bug: in standard chess, if the user uses Setup mode
// to place the king on e1 and a rook on h1 (with 🔁 marker), the old code path
// would only generate castling if `gameVariant === 'chess960'`, which is not
// set when the user enters Setup mode from a standard-chess game. Now the
// Chess960 rule is used universally, so castling works regardless of variant.
if(typeof isChess960CastlingLegal==='function'){
  if(r===hr){
    if(s.castlingRights[co+'Kingside']&&isChess960CastlingLegal(s,co,'kingside'))mv.push({row:hr,col:6,castle:'kingside'});
    if(s.castlingRights[co+'Queenside']&&isChess960CastlingLegal(s,co,'queenside'))mv.push({row:hr,col:2,castle:'queenside'});
  }
}else{
  // Fallback (only used if chess960.js failed to load): original standard-chess logic
  if(r===hr&&c===4){const cr=s.castlingRights;if(cr[co+'Kingside']&&!b[hr][5]&&!b[hr][6]&&b[hr][7]&&b[hr][7].type==='rook'&&b[hr][7].color===co&&!sqAttackedFast(b,{row:hr,col:4},opp)&&!sqAttackedFast(b,{row:hr,col:5},opp)&&!sqAttackedFast(b,{row:hr,col:6},opp))mv.push({row:hr,col:6,castle:'kingside'});if(cr[co+'Queenside']&&!b[hr][3]&&!b[hr][2]&&!b[hr][1]&&b[hr][0]&&b[hr][0].type==='rook'&&b[hr][0].color===co&&!sqAttackedFast(b,{row:hr,col:4},opp)&&!sqAttackedFast(b,{row:hr,col:3},opp)&&!sqAttackedFast(b,{row:hr,col:2},opp))mv.push({row:hr,col:2,castle:'queenside'})}
}}
else{const dirs=p.type==='rook'?DIR_ROOK:p.type==='bishop'?DIR_BISHOP:DIR_QUEEN;for(const[dr,dc]of dirs){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){if(!b[nr][nc])mv.push({row:nr,col:nc});else{if(b[nr][nc].color!==co)mv.push({row:nr,col:nc});break}nr+=dr;nc+=dc}}}
return mv}
// Optimized: uses makeMvInPlace/unmakeMv instead of cloneB per candidate move
// Same pattern as hasLegalMoves() — eliminates ~5-10x board allocations
/**
 * Get all legal moves for a piece at the given position.
 * @param {Object} s - Game state
 * @param {Object} pos - Position {row, col}
 * @returns {Array} Array of legal move target positions [{row, col, promotion?}]
 */
function legalMoves(s,pos){
  if(pos===null||pos===undefined){
    const all=[];
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const p=s.board[r][c];
      if(p?.color===s.currentTurn){
        const pm=pseudoMoves(s,{row:r,col:c});
        for(const m of pm){
          const mv={from:{row:r,col:c},to:m,piece:p,promotion:m.promotion};
          const undo=makeMvInPlace(s,mv);
          if(!undo)continue;
          // v1.2.3 round-36 (dedup): use _kingPosAfterMove (shared with hasLegalMoves/moveAlg).
          const kPos=_kingPosAfterMove(s, p, m);
          const isLegal=kPos?!inCheck(s.board,p.color,kPos):false;
          unmakeMv(s,undo);
          if(isLegal)all.push(mv);
        }
      }
    }
    return all;
  }
  const pm=pseudoMoves(s,pos),p=s.board[pos.row][pos.col];if(!p)return[];const legal=[];for(const m of pm){const mv={from:{row:pos.row,col:pos.col},to:m,piece:p,promotion:m.promotion};const undo=makeMvInPlace(s,mv);if(!undo)continue;const kPos=_kingPosAfterMove(s,p,m);const isLegal=kPos?!inCheck(s.board,p.color,kPos):false;unmakeMv(s,undo);if(isLegal)legal.push(m)}return legal}
// Fast game-over check: returns true as soon as ONE legal move is found
// v1.2.3 round-36 (dedup): uses _kingPosAfterMove (shared with legalMoves/moveAlg).
function hasLegalMoves(s){for(let r=0;r<8;r++){for(let c=0;c<8;c++){const p=s.board[r][c];if(p?.color===s.currentTurn){const pm=pseudoMoves(s,{row:r,col:c});for(const m of pm){const mv={from:{row:r,col:c},to:m,piece:p,promotion:m.promotion};const undo=makeMvInPlace(s,mv);if(!undo)continue;const kPos=_kingPosAfterMove(s,p,m);const legal=kPos?!inCheck(s.board,p.color,kPos):false;unmakeMv(s,undo);if(legal)return true}}}}return false}
// Move execution
/**
 * v1.0.6: Detect whether a move is a castling move.
 * Returns 'kingside' | 'queenside' | null.
 * Primary signal: the explicit `mv.castle` flag set by pseudoMoves().
 * Fallback: `piece.type==='king' && Math.abs(to.col-from.col)===2`
 * (works for standard chess where king always moves 2 cols to castle;
 * also works for Chess960 PGN replay where mv.castle may not be set on
 * moves reconstructed from SAN, but the king destination col is 6 or 2
 * AND the king moved 2+ cols — which is the common Chess960 case).
 * For Chess960 positions where the king moved only 1 col (e.g. king at
 * f1 castling kingside to g1), the SAN-based import path in tablebase.js
 * now sets mv.castle explicitly based on the O-O / O-O-O token.
 */
function _castleSide(mv,s){
  if(!mv||!mv.to||!mv.from||!mv.piece)return null;
  // Primary signal: explicit castle flag set by pseudoMoves() or by the
  // king-then-rook gesture handler in sqClick().
  // v1.0.8 PHASE 51: pseudoMoves() attaches the castle flag to the `to` object
  //   ({row,col,castle}), and legalMoves() builds the full move as
  //   {from,to:{row,col,castle},piece}. So mv.castle (top-level) is undefined
  //   for moves coming from legalMoves() — the flag is at mv.to.castle.
  //   executeMove() (ui.js) copies it to mv.castle before calling makeMv, but
  //   _applySANMove (PGN replay path) calls makeMvInPlace directly with the
  //   legalMoves() object, so mv.castle is undefined there. This caused PGN
  //   round-trip failure: castling moves (O-O / O-O-O) only moved the KING,
  //   not the rook, so subsequent rook moves (e.g. Re1) failed to parse and
  //   were silently dropped from the move list. Fix: check both mv.castle
  //   (top-level, set by executeMove) and mv.to.castle (set by pseudoMoves).
  if(mv.castle)return mv.castle;
  if(mv.to&&mv.to.castle)return mv.to.castle;
  // Fallback: detect by piece type + destination column.
  // In BOTH standard chess and Chess960, the king always ends on col 6
  // (kingside) or col 2 (queenside) after castling. The distance the king
  // travels varies (1-5 cols in Chess960, always 2 in standard), so we
  // check the DESTINATION COLUMN rather than the distance.
  // This is only applied when the piece is a king on its home rank (row 7
  // for white, row 0 for black) moving to col 6 or col 2 — the castling
  // destinations.
  //
  // v1.0.7 PHASE 4: In standard chess (gameVariant !== 'chess960'), keep
  // the `Math.abs(to.col-from.col)>=2` requirement — a 1-col king move to
  // g1/c1 in standard chess is a normal king move (the king cannot legally
  // be on f1/d1 with castling rights still active in standard chess, since
  // moving the king clears all castling rights). The `>=2` check prevents
  // false-positive castling detection for normal king moves.
  // In Chess960 mode, the king may start on col 5 (f1) and castle kingside
  // to col 6 (g1) — a 1-col move — so we relax the requirement. The
  // explicit mv.castle flag (set by pseudoMoves) is the primary signal;
  // this fallback covers moves reconstructed from UCI/PGN that don't carry
  // the flag.
  if(mv.piece.type==='king'){
    const _homeRow=mv.piece.color==='white'?7:0;
    if(mv.from.row===_homeRow&&mv.to.row===_homeRow){
      // v1.2.3 round-36 (dedup): use the canonical isChess960Active()
      //   helper from chess960.js instead of the inline 2-clause OR.
      const _is960=isChess960Active();
      const _minDist=_is960?1:2;
      // v1.0.8 PHASE 30: In Chess960, _minDist=1 means ANY king move to col 6/2 on
      //   the home row would be classified as castling — including normal king
      //   captures (e.g. Kxg1 when the king starts on f1). Guard by checking that
      //   the corresponding castling right is actually present. This prevents
      //   silent piece destruction + incorrect rook displacement + wrong 50-move
      //   clock when the engine plays a normal king capture to g1/c1 in 960.
      // v1.0.8 PHASE 49: The Phase 30 guard is insufficient — a king capture to
      //   col 6/2 still satisfies "castling right present" but is a real capture,
      //   not castling. Add the destination guard below.
      // v1.1.0 Phase 55 CORRECTION: The Phase 49 comment claimed "Castling
      //   destination squares are ALWAYS empty (the rook ends up BESIDE the
      //   king, not under it)". This is INCORRECT for Chess960 — the king's
      //   destination CAN be the participating rook's source square (e.g.
      //   king on d1, rook on c1: O-O-O puts the king on c1 = rook's source).
      //   The rook still ends up beside the king (at d1), but the king's
      //   destination was NOT empty before the move. The corrected guard:
      //   destination must be empty OR contain a same-color rook (which is
      //   the participating castling rook that will move away). A same-color
      //   non-rook piece or an enemy piece on the destination still blocks
      //   castling (it's a real move/capture, not castling).
      // v1.0.9 PHASE 52 CRITICAL FIX: the previous code checked `gameState.board`
      //   and `gameState.castlingRights` — the GLOBAL final state — for the
      //   destination-empty and castling-rights-present guards. During PGN
      //   replay (enterReview / importPGN), the LOCAL state `s` being moved
      //   differs from `gameState` (which is the final state after ALL moves
      //   have been applied). This caused the fallback to use the WRONG board:
      //   e.g. if the white king ended on g1 in the final state, the
      //   destination-empty check for an EARLIER castling move (O-O to g1)
      //   returned false, suppressing castling detection. The king moved to g1
      //   but the rook stayed on h1, corrupting all subsequent move replays
      //   (moves involving the misplaced rook were silently skipped, and the
      //   board state diverged from the intended game — manifesting to the
      //   user as "extra pieces / extra kings on the review board").
      //   Fix: accept an optional `s` (the state being moved) parameter and
      //   use ITS board and castlingRights for the fallback. If `s` is not
      //   provided (e.g. animation-only callers in ui.js that don't have a
      //   local state), fall back to `gameState` (the live game state during
      //   interactive play, which is correct for that use case).
      const _st=s||(typeof gameState!=='undefined'?gameState:null);
      const _cr=(_st?.castlingRights)?_st.castlingRights:null;
      // v1.1.0 Phase 55 FIX: In Chess960, the king's destination square may
      //   be occupied by the participating rook (e.g. SP-ID with king on d1
      //   and queenside rook on c1: O-O-O puts the king on c1, which IS the
      //   rook's source square). The previous `_destEmpty` check rejected
      //   this case, causing the king to "capture" its own rook and silently
      //   lose it. Now we allow the destination to contain a same-color rook
      //   on the castling side (the participating rook, which moves away).
      //   Standard chess is unaffected (rook is always on a1/h1, king dest
      //   c1/g1 is always empty).
      // v1.2.3 round-29 (PR52 S6582): collapse `_st?.board && _st.board[mv.to.row] ? _st.board[mv.to.row][mv.to.col] : null`
      //   into the equivalent `_st?.board?.[mv.to.row]?.[mv.to.col] ?? null`.
      //   Note: the new form returns `null` (not `undefined`) when the square
      //   is empty — the only consumer (`!_destPiece || ...`) treats both the
      //   same, so behavior is preserved.
      const _destPiece=_st?.board?.[mv.to.row]?.[mv.to.col]??null;
      const _destValid=!_destPiece||(_destPiece.type==='rook'&&_destPiece.color===mv.piece.color);
      // v1.1.2 PHASE 71 (defense-in-depth): Chess960 0-distance castling.
      // When the engine emits a UCI castling move for an SP-ID where the king
      // already sits on its castling target (e.g. king on g1, kingside rook on
      // h1 → UCI "g1h1" → uciToCoords rewrites to "g1g1"), the king's source
      // and destination are the SAME square. The distance check below
      // (`Math.abs(to.col-from.col)>=_minDist`) rejects this (0 < 1). The
      // primary castle-flag path (`mv.to.castle`, set by uciToCoords in
      // Phase 71) catches it before this fallback, but we add an explicit
      // 0-distance branch here as defense-in-depth so that any future code
      // path that produces a 0-distance king move with castling rights
      // present is still correctly recognized as castling. The king itself
      // occupies the destination square (so `_destValid` is false), which is
      // why we bypass `_destValid` for this case — the king stays put and
      // only the rook moves (handled by makeMv's `from===to` branch added in
      // v1.0.7 PHASE 17).
      const _isZeroDist=mv.from.col===mv.to.col;
      if(_is960&&_isZeroDist&&_cr){
        if(mv.to.col===6&&_cr[mv.piece.color+'Kingside'])return 'kingside';
        if(mv.to.col===2&&_cr[mv.piece.color+'Queenside'])return 'queenside';
      }
      if(mv.to.col===6&&Math.abs(mv.to.col-mv.from.col)>=_minDist){
        if(_destValid&&(!_is960||(_cr&&_cr[mv.piece.color+'Kingside'])))return 'kingside';
      }
      if(mv.to.col===2&&Math.abs(mv.to.col-mv.from.col)>=_minDist){
        if(_destValid&&(!_is960||(_cr&&_cr[mv.piece.color+'Queenside'])))return 'queenside';
      }
    }
  }
  return null;
}

// v1.2.3 round-36 (dedup + robustness): shared helpers for makeMv /
//   makeMvInPlace. These two functions previously hand-duplicated ~80% of
//   their logic; the duplicates were a maintenance burden and a source of
//   latent bugs (a fix applied at one site could be missed at the other).
//   The helpers below are pure (no side effects beyond the passed-in state
//   mutation, which is the caller's intent) and byte-for-byte equivalent to
//   the previous inline code. See game-logic duplicate-logic analysis L3/L7/L8.

/**
 * Compute the en-passant target square after a pawn double-push, or null if
 * no enemy pawn can actually capture (per FIDE rule: the EP target is only
 * set when an enemy pawn is positioned to capture). Pure function over the
 * board array.
 * @param {Array} board - 8x8 board
 * @param {Object} from - {row, col} source square
 * @param {Object} to - {row, col} destination square
 * @param {string} pieceColor - 'white' | 'black' (the moving pawn's color)
 * @returns {{row,col}|null} EP target square, or null
 */
function _computeEpTarget(board, from, to, pieceColor){
  if(Math.abs(to.row-from.row)!==2)return null;
  const epRow=(from.row+to.row)/2;
  const opp=OPP_COLOR[pieceColor];
  const pd=opp==='white'?1:-1;
  for(const dc of[-1,1]){
    const cr=epRow+pd,cc=from.col+dc;
    if(inB(cr,cc)&&board[cr][cc]&&board[cr][cc].type==='pawn'&&board[cr][cc].color===opp){
      return {row:epRow,col:from.col};
    }
  }
  return null;
}

/**
 * Apply king-move side effects: update the king-position cache (s.wk/s.bk)
 * and clear ALL castling rights for the moving color (king move forfeits
 * both kingside and queenside rights). Pure mutation of the passed-in state.
 * @param {Object} s - Game state to mutate
 * @param {string} color - 'white' | 'black' (the moving king's color)
 * @param {Object} to - {row, col} king's destination square
 */
function _applyKingMove(s, color, to){
  if(color==='white'){
    s.wk={row:to.row,col:to.col};
    s.castlingRights.whiteKingside=false;
    s.castlingRights.whiteQueenside=false;
    s.castlingRights.whiteKingsideRookFile=null;
    s.castlingRights.whiteQueensideRookFile=null;
  }else{
    s.bk={row:to.row,col:to.col};
    s.castlingRights.blackKingside=false;
    s.castlingRights.blackQueenside=false;
    s.castlingRights.blackKingsideRookFile=null;
    s.castlingRights.blackQueensideRookFile=null;
  }
}

/**
 * Return the king position AFTER a trial move. If the moving piece is the
 * king, the destination is the new king position; otherwise the cached
 * king position (s.wk/s.bk) is used. Used by legality checks (legalMoves,
 * hasLegalMoves) and SAN disambiguation (moveAlg).
 * @param {Object} s - Game state (king cache must be up-to-date)
 * @param {Object} piece - the moving piece ({type, color, ...})
 * @param {Object} to - {row, col} destination square
 * @returns {{row,col}|null} king position, or null if cache is empty
 */
function _kingPosAfterMove(s, piece, to){
  if(piece.type==='king')return {row:to.row,col:to.col};
  return piece.color==='white'?s.wk:s.bk;
}

/**
 * Apply a move to a game state, returning a new state (immutable).
 * @param {Object} s - Current game state
 * @param {Object} mv - Move object with from, to, piece, promotion, etc.
 * @returns {Object} New game state with the move applied
 */
function makeMv(s,mv){const ns=cloneS(s);const{from,to,piece,promotion}=mv;
// v1.1.2 Phase 67: Code review P1 fix - validate both from/to coords via inB() before any board access.
// Previously only from.row was bounds-checked; an out-of-range to coord (e.g., from setup mode
// or a malformed FEN-derived move) would silently throw on ns.board[to.row][to.col] and corrupt state.
if(!piece||!inB(from.row,from.col)||!inB(to.row,to.col))return ns;
if(!ns.board[from.row][from.col])return ns;
// v1.0.6 FIX: Detect castling BEFORE moving the king. In Chess960, the
// rook's source square may be the same as the king's destination square
// (e.g. rook on g1, king castles kingside to g1). If we move the king
// first (overwriting the rook), the rook is lost and the king ends up on
// the wrong square. Fix: detect castling first, and if it IS castling,
// (1) suppress the capture (castling never captures), (2) save the rook
// before moving the king, (3) move the king, (4) place the rook at its
// destination.
// v1.0.9 PHASE 52: pass `s` (the original pre-move state) to _castleSide
// so the fallback castling detection checks the LOCAL board state and
// LOCAL castling rights, not the global final gameState.
const _cs=_castleSide(mv,s);
let _rookFrom=-1,_rookTo=-1,_savedRook=null;
if(_cs){
  // Compute rook from/to BEFORE moving the king, and save the rook piece.
  // v1.0.7 PHASE 3: Always use Chess960 castling rook move logic (same
  // first-principles rationale as pseudoMoves — Chess960 is a superset of
  // standard chess castling). This ensures that when the user has used Setup
  // mode to place a king + rook with 🔁 marker on non-standard squares,
  // castling actually works in the resulting game.
  if(typeof chess960CastlingRookMove==='function'){
    const rm=chess960CastlingRookMove(s,piece.color,_cs);
    if(rm?.rookFrom!==rm.rookTo){
      _rookFrom=rm.rookFrom;_rookTo=rm.rookTo;
      _savedRook=ns.board[rm.row][rm.rookFrom]; // save rook before king overwrites it
    }
  }else{
    // Fallback (only if chess960.js failed to load): standard chess rook positions
    if(_cs==='kingside'){_rookFrom=7;_rookTo=5;}
    else{_rookFrom=0;_rookTo=3;}
    _savedRook=ns.board[from.row][_rookFrom]; // save rook
  }
}
// For castling, there is no capture (the "capPiece" at king's destination
// is the castling rook in Chess960, which is NOT captured — it moves).
// For non-castling moves, capPiece is the actual captured piece (if any).
const capPiece=_cs?null:ns.board[to.row][to.col];
// v1.0.7 PHASE 17 FIX (Chess960 "king self-capture" bug): When the king is
// ALREADY on its castling destination square (e.g. SP-ID where white king
// starts on g1), `from === to` (from.row===to.row && from.col===to.col).
// Per the Fischer Random Chess rules (see uploaded reference PDF
// "菲舍尔任意制国际象棋的王车易位规则"): "只动王，车不动 / 只动车，王不动 /
// 原地易位 — 如果王或车的初始位置刚好就是它们易位后的目标格，只要满足所有易位
// 条件，依然可以宣布易位，此时该棋子'原地不动'，另一枚棋子移动到指定位置".
//
// The previous code unconditionally ran:
//     ns.board[to.row][to.col] = ns.board[from.row][from.col];  // self-copy
//     ns.board[from.row][from.col] = null;                       // ← BUG: nulled the king
// When from === to, the second line NULLS the king's own square AFTER the
// self-copy. The king vanishes, and downstream code sees an empty board.
//
// Fix: when castling AND from === to (king already on target), SKIP the
// king move entirely (the rook move below handles the actual board change).
// The king's piece object remains untouched at its square, the rook moves
// from its source to its destination, and king pos / castling-rights are
// still updated correctly at the king-handling block further below.
if(_cs&&from.row===to.row&&from.col===to.col){
  // King stays put — only the rook moves. Fall through to the rook-placement
  // block (which uses _savedRook saved BEFORE this branch).
}else{
  ns.board[to.row][to.col]=ns.board[from.row][from.col];
  ns.board[from.row][from.col]=null;
}
if(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col){const cr=piece.color==='white'?to.row+1:to.row-1;
// v1.1.2 PHASE 71 (robustness): bounds-check `cr` before indexing ns.board.
//   In normal play `to.row` is always 2 (white capturing) or 5 (black capturing),
//   so `cr` is 3 or 4 — always in-bounds. But if a corrupted FEN import or
//   setup-mode misuse produces an out-of-range enPassantTarget, `cr` could be
//   -1 or 8, and `ns.board[cr]` would be undefined → TypeError. Defense-in-depth.
if(inB(cr,to.col)){const epP=ns.board[cr][to.col];if(epP?.type==='pawn'&&epP.color!==piece.color){ns.board[cr][to.col]=null}else if(epP){console.error('[En Passant Bug] Target set but captured piece is not an opposing pawn:',epP)}}}
// v1.0.6 FIX: Move the rook for castling. _savedRook was saved BEFORE the
// king moved, so it's the actual rook piece (not the king that overwrote
// it). Place it at the rook destination, clear the rook source.
// v1.0.7 PHASE 17 FIX: When `from === to` (king already on target square),
// the king's square was NOT cleared above. The rook's source square may
// STILL be different from the king's square (rook is on a different col),
// so we still need to clear it. The existing `_rookFrom !== to.col` guard
// already handles the case where rook source === king destination (which
// happens when the rook source === the king's castling target — in that
// case the king moved to that square, so we must NOT null it).
if(_cs&&_savedRook&&_rookFrom>=0&&_rookTo>=0){
  ns.board[from.row][_rookTo]=_savedRook;
  // Only clear rook source if it's different from king destination (the
  // king destination was already cleared by the king move above when
  // rookFrom !== to.col; when rookFrom === to.col, the king already
  // occupies that square so we must NOT null it).
  if(_rookFrom!==to.col){
    ns.board[from.row][_rookFrom]=null;
  }
}
if(promotion)ns.board[to.row][to.col]={type:promotion,color:piece.color};
// v1.2.3 round-36 (dedup): use _applyKingMove (shared with makeMvInPlace).
//   The previous inline block hand-duplicated the 8-field castling-rights
//   clear (4 flags + 4 rook-file fields). Centralizing eliminates the risk
//   of a future castling-rights schema change (e.g., adding a 5th field)
//   being applied at one site but not the other.
if(piece.type==='king')_applyKingMove(ns, piece.color, to);
if(piece.type==='rook'){
// v1.0.7 PHASE 3: Always use Chess960 rook-position detection (findCastlingRooks)
// so that castling rights are correctly cleared when a rook that holds castle
// rights moves — even in non-Chess960 games where the user has used Setup mode
// to place a rook with 🔁 marker on a non-standard square.
if(typeof findCastlingRooks==='function'){
  const rooks=findCastlingRooks(s.board,piece.color);
  if(rooks){
    // v1.2.3 round-20 (A-1): the rook whose move clears a right is the
    //   FEN/game-DESIGNATED one when recorded (same-side-two-rooks
    //   disambiguation); the closest-rook heuristic is only the fallback.
    const _mvKs=(typeof findDesignatedCastlingRook==='function')?findDesignatedCastlingRook(s,piece.color,'kingside'):rooks.kingside;
    const _mvQs=(typeof findDesignatedCastlingRook==='function')?findDesignatedCastlingRook(s,piece.color,'queenside'):rooks.queenside;
    if(piece.color==='white'){if(from.col===_mvKs){ns.castlingRights.whiteKingside=false;ns.castlingRights.whiteKingsideRookFile=null;}if(from.col===_mvQs){ns.castlingRights.whiteQueenside=false;ns.castlingRights.whiteQueensideRookFile=null;}}
    else{if(from.col===_mvKs){ns.castlingRights.blackKingside=false;ns.castlingRights.blackKingsideRookFile=null;}if(from.col===_mvQs){ns.castlingRights.blackQueenside=false;ns.castlingRights.blackQueensideRookFile=null;}}
  }
}else{
  if(from.row===7&&from.col===0){ns.castlingRights.whiteQueenside=false;ns.castlingRights.whiteQueensideRookFile=null;}if(from.row===7&&from.col===7){ns.castlingRights.whiteKingside=false;ns.castlingRights.whiteKingsideRookFile=null;}if(from.row===0&&from.col===0){ns.castlingRights.blackQueenside=false;ns.castlingRights.blackQueensideRookFile=null;}if(from.row===0&&from.col===7){ns.castlingRights.blackKingside=false;ns.castlingRights.blackKingsideRookFile=null;}
}
}
if(capPiece?.type==='rook'){
if(typeof findCastlingRooks==='function'){
  const rooks=findCastlingRooks(s.board,capPiece.color);
  if(rooks){
    // v1.2.3 round-20 (A-1): designated-file precedence (see rook-move above).
    const _cpKs=(typeof findDesignatedCastlingRook==='function')?findDesignatedCastlingRook(s,capPiece.color,'kingside'):rooks.kingside;
    const _cpQs=(typeof findDesignatedCastlingRook==='function')?findDesignatedCastlingRook(s,capPiece.color,'queenside'):rooks.queenside;
    if(capPiece.color==='white'){if(to.col===_cpKs){ns.castlingRights.whiteKingside=false;ns.castlingRights.whiteKingsideRookFile=null;}if(to.col===_cpQs){ns.castlingRights.whiteQueenside=false;ns.castlingRights.whiteQueensideRookFile=null;}}
    else{if(to.col===_cpKs){ns.castlingRights.blackKingside=false;ns.castlingRights.blackKingsideRookFile=null;}if(to.col===_cpQs){ns.castlingRights.blackQueenside=false;ns.castlingRights.blackQueensideRookFile=null;}}
  }
}else{
  if(capPiece.color==='white'){if(to.row===7&&to.col===0){ns.castlingRights.whiteQueenside=false;ns.castlingRights.whiteQueensideRookFile=null;}if(to.row===7&&to.col===7){ns.castlingRights.whiteKingside=false;ns.castlingRights.whiteKingsideRookFile=null;}}else{if(to.row===0&&to.col===0){ns.castlingRights.blackQueenside=false;ns.castlingRights.blackQueensideRookFile=null;}if(to.row===0&&to.col===7){ns.castlingRights.blackKingside=false;ns.castlingRights.blackKingsideRookFile=null;}}
}
}
// v1.2.3 round-36 (dedup): _computeEpTarget centralizes the EP-target
//   computation between makeMv and makeMvInPlace. The previous inline
//   copies were byte-identical except for ns/s — centralizing eliminates
//   the risk of a future Chess960 corner-case fix being applied to one
//   site but not the other.
ns.enPassantTarget=(piece.type==='pawn')?_computeEpTarget(ns.board, from, to, piece.color):null;
const cap=!!capPiece||(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col);ns.halfMoveClock=(piece.type==='pawn'||cap)?0:ns.halfMoveClock+1;if(piece.color==='black')ns.fullMoveNumber++;
ns.currentTurn=OPP_COLOR[ns.currentTurn];ns.moveHistory=[...s.moveHistory,{from,to,piece,promotion}];
// Incremental Zobrist hash update
let h=typeof s.hash==='number'?s.hash:computeHash(s);
// 1. Remove piece from from-square
h^=zobrist.pieceTable[from.row*8+from.col][pieceZobristIdx(piece)];
// 2. Remove captured piece at to-square if any
// v1.0.2 CLEANUP: Use capPiece (already extracted at line 631 from
// ns.board[to.row][to.col] before mutation) instead of re-reading from
// s.board[to.row][to.col]. Since ns is a deep clone of s, the two values
// are identical — the second read was redundant.
if(capPiece)h^=zobrist.pieceTable[to.row*8+to.col][pieceZobristIdx(capPiece)];
// 3. Place piece (or promoted piece) at to-square
const placedPiece=promotion?{type:promotion,color:piece.color}:piece;
h^=zobrist.pieceTable[to.row*8+to.col][pieceZobristIdx(placedPiece)];
// 4. En passant capture: remove captured pawn (with defensive check)
if(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col){const cr=piece.color==='white'?to.row+1:to.row-1;const epPiece={type:'pawn',color:OPP_COLOR[piece.color]};
// v1.1.2 PHASE 71 (robustness): bounds-check `cr` before indexing s.board
//   (mirrors the makeMv/makeMvInPlace en-passant bounds checks above).
if(inB(cr,to.col)){const epP=s.board[cr][to.col];if(epP?.type==='pawn'&&epP.color!==piece.color){h^=zobrist.pieceTable[cr*8+to.col][pieceZobristIdx(epPiece)]};}}
// 5. Castling: move rook (v1.0.6: use actual rook from/to cols for Chess960)
if(_cs&&_rookFrom>=0&&_rookTo>=0){
  const rookIdx=pieceZobristIdx({type:'rook',color:piece.color});
  h^=zobrist.pieceTable[from.row*8+_rookFrom][rookIdx];
  h^=zobrist.pieceTable[from.row*8+_rookTo][rookIdx];
}
// 6. Toggle side to move
h^=zobrist.side;
// 7. Update en passant file
if(s.enPassantTarget)h^=zobrist.enPassant[s.enPassantTarget.row===2?s.enPassantTarget.col:8+s.enPassantTarget.col];
if(ns.enPassantTarget)h^=zobrist.enPassant[ns.enPassantTarget.row===2?ns.enPassantTarget.col:8+ns.enPassantTarget.col];
// 8. Update castling rights (only false transitions)
if(s.castlingRights.whiteKingside&&!ns.castlingRights.whiteKingside)h^=zobrist.castling[0];
if(s.castlingRights.whiteQueenside&&!ns.castlingRights.whiteQueenside)h^=zobrist.castling[1];
if(s.castlingRights.blackKingside&&!ns.castlingRights.blackKingside)h^=zobrist.castling[2];
if(s.castlingRights.blackQueenside&&!ns.castlingRights.blackQueenside)h^=zobrist.castling[3];
ns.hash=(h>>>0);
// v1.0.2 PERF (audit): bump boardVersion so _updateBoardIncremental can
// skip the JSON.stringify dirty check (which serializes the 8x8 board on
// every render tick). Integer compare is ~100x cheaper.
ns.boardVersion=(s.boardVersion||0)+1;
ns.posCount.set(ns.hash,(ns.posCount.get(ns.hash)||0)+1);
return ns}
// ===================== MAKE/UNMAKE (INCREMENTAL) =====================
// Make/Unmake replaces cloneS for search nodes (eliminates posCount Map clone)
// makeMvInPlace: modifies state IN PLACE, returns undo object. ~10x faster than cloneS.
// unmakeMv: restores state from undo object.

/**
 * Apply a move to a game state in-place (mutable). Returns undo info for unmakeMv().
 * @param {Object} s - Game state to modify
 * @param {Object} mv - Move object with from, to, piece, promotion, etc.
 * @returns {Object|null} Undo information object, or null if move is invalid
 */
function makeMvInPlace(s,mv){
const{from,to,piece,promotion}=mv;
// v1.1.2 Phase 70: Apply the same P1 bounds check as makeMv (Phase 67) —
//   validate both from/to coords via inB() before any board access.
//   Previously only from.row was bounds-checked, allowing an out-of-range
//   to coord to silently throw on s.board[to.row][to.col].
if(!piece||!inB(from.row,from.col)||!inB(to.row,to.col))return null;
if(!s.board[from.row]||!s.board[from.row][from.col])return null;
// v1.0.6 FIX: Detect castling BEFORE moving the king (same fix as makeMv).
// In Chess960, the rook's source may be the king's destination. Save the
// rook before the king overwrites it.
// v1.0.9 PHASE 52: pass `s` to _castleSide for correct local-state checks.
const _cs=_castleSide(mv,s);
let _rookFrom=-1,_rookTo=-1,_savedRook=null;
if(_cs){
  // v1.0.7 PHASE 3: Always use Chess960 castling rook move logic (Chess960
  // castling is a superset of standard chess castling). See makeMv for the
  // detailed first-principles rationale.
  if(typeof chess960CastlingRookMove==='function'){
    const rm=chess960CastlingRookMove(s,piece.color,_cs);
    if(rm?.rookFrom!==rm.rookTo){
      _rookFrom=rm.rookFrom;_rookTo=rm.rookTo;
      _savedRook=s.board[rm.row][rm.rookFrom];
    }
  }else{
    // Fallback (only if chess960.js failed to load): standard chess rook positions
    if(_cs==='kingside'){_rookFrom=7;_rookTo=5;}
    else{_rookFrom=0;_rookTo=3;}
    _savedRook=s.board[from.row][_rookFrom];
  }
}
// For castling, there is no capture (capPiece would be the rook in Chess960).
const capPiece=_cs?null:s.board[to.row][to.col];
// v1.0.7 PHASE 18 Task 3 (bug fix): Snapshot castling-rights delta BEFORE
// mutating the board. Previously, steps 6 & 7 called findCastlingRooks(s.board)
// AFTER the rook had already moved (step 3) or been captured (step 1), so the
// rook was no longer at its source square and findCastlingRooks would not
// identify it — causing the castling right to NOT be cleared. This was a
// latent bug masked by single-ply search, but would produce phantom castling
// moves in any future deeper JS-side search. By snapshotting here (pre-mutation),
// we correctly identify which side the moving/captured rook belongs to.
let _movingRookSide=null;   // 'kingside' | 'queenside' | null
let _capturedRookSide=null;
if(!_cs && piece.type==='rook' && typeof findCastlingRooks==='function'){
  const _r=findCastlingRooks(s.board,piece.color);
  if(_r){
    // v1.2.3 round-20 (A-1): designated-file precedence over closest-rook.
    const _mvKs2=(typeof findDesignatedCastlingRook==='function')?findDesignatedCastlingRook(s,piece.color,'kingside'):_r.kingside;
    const _mvQs2=(typeof findDesignatedCastlingRook==='function')?findDesignatedCastlingRook(s,piece.color,'queenside'):_r.queenside;
    if(_mvKs2!==null&&_mvKs2===from.col)_movingRookSide='kingside';
    else if(_mvQs2!==null&&_mvQs2===from.col)_movingRookSide='queenside';
  }
}
if(!_cs && capPiece && capPiece.type==='rook' && typeof findCastlingRooks==='function'){
  const _r=findCastlingRooks(s.board,capPiece.color);
  if(_r){
    // v1.2.3 round-20 (A-1): designated-file precedence over closest-rook.
    const _cpKs2=(typeof findDesignatedCastlingRook==='function')?findDesignatedCastlingRook(s,capPiece.color,'kingside'):_r.kingside;
    const _cpQs2=(typeof findDesignatedCastlingRook==='function')?findDesignatedCastlingRook(s,capPiece.color,'queenside'):_r.queenside;
    if(_cpKs2!==null&&_cpKs2===to.col)_capturedRookSide='kingside';
    else if(_cpQs2!==null&&_cpQs2===to.col)_capturedRookSide='queenside';
  }
}
// Capture undo info
const undo={
from:{r:from.row,c:from.col},to:{r:to.row,c:to.col},
piece:{type:piece.type,color:piece.color},
capPiece:capPiece?{type:capPiece.type,color:capPiece.color}:null,
epCaptured:null,castlingRook:null,
oldWk:s.wk?{r:s.wk.row,c:s.wk.col}:null,
oldBk:s.bk?{r:s.bk.row,c:s.bk.col}:null,
oldCastling:{...s.castlingRights},
oldEnPassant:s.enPassantTarget?{r:s.enPassantTarget.row,c:s.enPassantTarget.col}:null,
oldHalfMove:s.halfMoveClock,
oldFullMove:s.fullMoveNumber,
oldHash:s.hash,
oldBoardVersion:s.boardVersion||0,
promotion:promotion||null,
oldMoveHistoryLength:s.moveHistory?s.moveHistory.length:0,
isBlackMove:piece.color==='black'
};
// 1. Move piece (king for castling)
// v1.0.7 PHASE 17 FIX (Chess960 "king self-capture" bug — see makeMv for full
// analysis): when castling AND from === to (king already on its castling
// destination square, e.g. SP-ID where white king starts on g1), do NOT
// null the king's own square. Skip the king move entirely; the rook move
// below handles the only board change for this castling.
if(_cs&&from.row===to.row&&from.col===to.col){
  // King stays put — only the rook moves (handled in step 3 below).
}else{
  s.board[to.row][to.col]=s.board[from.row][from.col];
  s.board[from.row][from.col]=null;
}
// 2. En passant capture
if(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col){
const cr=piece.color==='white'?to.row+1:to.row-1;
// v1.1.2 PHASE 71 (robustness): bounds-check `cr` before indexing s.board
//   (defense-in-depth — mirrors the makeMv fix above).
if(inB(cr,to.col)){
const epP=s.board[cr][to.col];
if(epP?.type==='pawn'&&epP.color!==piece.color){
undo.epCaptured={r:cr,c:to.col,piece:{type:epP.type,color:epP.color}};
s.board[cr][to.col]=null;
}
}
}
// 3. Castling: move rook (v1.0.6 FIX: use _savedRook saved before king move)
if(_cs&&_savedRook&&_rookFrom>=0&&_rookTo>=0){
  s.board[from.row][_rookTo]=_savedRook;
  if(_rookFrom!==to.col){
    s.board[from.row][_rookFrom]=null;
  }
  // v1.0.7 PHASE 18 Task 3 (critical bug fix): Save the rook PIECE in the undo
  // record, not just its from/to coordinates. Previously, unmakeMv read the rook
  // back from s.board[cr.to] — but step 2 of unmakeMv may have already
  // overwritten cr.to with the king (when the rook's destination coincides
  // with the king's source square, which happens in ~half of all Chess960
  // SP-ID positions, e.g. white king on f1 castling kingside: rook goes to f1
  // = king's source). Saving the piece here lets unmakeMv restore correctly
  // without relying on the board state at unmake time.
  undo.castlingRook={from:{r:from.row,c:_rookFrom},to:{r:from.row,c:_rookTo},piece:{type:_savedRook.type,color:_savedRook.color}};
}
// 4. Promotion
if(promotion)s.board[to.row][to.col]={type:promotion,color:piece.color};
// 5. Update king position + castling rights
// v1.2.3 round-36 (dedup): use _applyKingMove (shared with makeMv).
if(piece.type==='king')_applyKingMove(s, piece.color, to);
// 6. Update castling rights for rook moves
// v1.0.7 PHASE 18 Task 3 (bug fix): Use the pre-mutation snapshot
// (_movingRookSide) instead of calling findCastlingRooks again. The old code
// called findCastlingRooks(s.board) AFTER the rook had already moved, so it
// could not find the rook at from.col and the castling right was NOT cleared.
// This also removes two redundant findCastlingRooks scans per rook move/capture
// (a small perf win).
if(piece.type==='rook'&&_movingRookSide){
  if(piece.color==='white'){
    if(_movingRookSide==='kingside'){s.castlingRights.whiteKingside=false;s.castlingRights.whiteKingsideRookFile=null;}
    else{s.castlingRights.whiteQueenside=false;s.castlingRights.whiteQueensideRookFile=null;}
  }else{
    if(_movingRookSide==='kingside'){s.castlingRights.blackKingside=false;s.castlingRights.blackKingsideRookFile=null;}
    else{s.castlingRights.blackQueenside=false;s.castlingRights.blackQueensideRookFile=null;}
  }
}else if(piece.type==='rook'&&!_movingRookSide){
  // Fallback: chess960.js not loaded OR rook not on a castling source square.
  // Use standard-chess rook positions as a safe default.
  if(from.row===7&&from.col===0){s.castlingRights.whiteQueenside=false;s.castlingRights.whiteQueensideRookFile=null;}
  if(from.row===7&&from.col===7){s.castlingRights.whiteKingside=false;s.castlingRights.whiteKingsideRookFile=null;}
  if(from.row===0&&from.col===0){s.castlingRights.blackQueenside=false;s.castlingRights.blackQueensideRookFile=null;}
  if(from.row===0&&from.col===7){s.castlingRights.blackKingside=false;s.castlingRights.blackKingsideRookFile=null;}
}
// 7. Update castling rights for rook captures
if(capPiece?.type==='rook'&&_capturedRookSide){
  if(capPiece.color==='white'){
    if(_capturedRookSide==='kingside'){s.castlingRights.whiteKingside=false;s.castlingRights.whiteKingsideRookFile=null;}
    else{s.castlingRights.whiteQueenside=false;s.castlingRights.whiteQueensideRookFile=null;}
  }else{
    if(_capturedRookSide==='kingside'){s.castlingRights.blackKingside=false;s.castlingRights.blackKingsideRookFile=null;}
    else{s.castlingRights.blackQueenside=false;s.castlingRights.blackQueensideRookFile=null;}
  }
}else if(capPiece?.type==='rook'&&!_capturedRookSide){
  // Fallback: standard-chess rook positions.
  if(capPiece.color==='white'){if(to.row===7&&to.col===0){s.castlingRights.whiteQueenside=false;s.castlingRights.whiteQueensideRookFile=null;}if(to.row===7&&to.col===7){s.castlingRights.whiteKingside=false;s.castlingRights.whiteKingsideRookFile=null;}}
  else{if(to.row===0&&to.col===0){s.castlingRights.blackQueenside=false;s.castlingRights.blackQueensideRookFile=null;}if(to.row===0&&to.col===7){s.castlingRights.blackKingside=false;s.castlingRights.blackKingsideRookFile=null;}}
}
// 8. Set en passant target (only if an enemy pawn can actually capture)
// v1.2.3 round-36 (dedup): use _computeEpTarget (shared with makeMv).
const oldEP=s.enPassantTarget;
s.enPassantTarget=(piece.type==='pawn')?_computeEpTarget(s.board, from, to, piece.color):null;
// 9. Update half-move clock + full-move number
const cap=!!capPiece||(piece.type==='pawn'&&oldEP&&to.row===oldEP.row&&to.col===oldEP.col);
s.halfMoveClock=(piece.type==='pawn'||cap)?0:undo.oldHalfMove+1;
if(piece.color==='black')s.fullMoveNumber++;
// 10. Switch turn
s.currentTurn=OPP_COLOR[s.currentTurn];
if(s.moveHistory)s.moveHistory.push({from:{row:from.row,col:from.col},to:{row:to.row,col:to.col},piece:{type:piece.type,color:piece.color},promotion:promotion||null});
// 11. Incremental hash update
let h=undo.oldHash;
h^=zobrist.pieceTable[from.row*8+from.col][pieceZobristIdx(piece)];
if(capPiece)h^=zobrist.pieceTable[to.row*8+to.col][pieceZobristIdx(capPiece)];
const placedPiece=promotion?{type:promotion,color:piece.color}:piece;
h^=zobrist.pieceTable[to.row*8+to.col][pieceZobristIdx(placedPiece)];
// En passant hash (use undo.epCaptured which has correct info)
if(undo.epCaptured){
h^=zobrist.pieceTable[undo.epCaptured.r*8+undo.epCaptured.c][pieceZobristIdx(undo.epCaptured.piece)];
}
// Castling hash (v1.0.6: use actual rook from/to cols for Chess960)
if(_cs&&_rookFrom>=0&&_rookTo>=0){
const rookIdx=pieceZobristIdx({type:'rook',color:piece.color});
h^=zobrist.pieceTable[from.row*8+_rookFrom][rookIdx];
h^=zobrist.pieceTable[from.row*8+_rookTo][rookIdx];
}
// Side to move hash
h^=zobrist.side;
// En passant file hash
if(undo.oldEnPassant)h^=zobrist.enPassant[undo.oldEnPassant.r===2?undo.oldEnPassant.c:8+undo.oldEnPassant.c];
if(s.enPassantTarget)h^=zobrist.enPassant[s.enPassantTarget.row===2?s.enPassantTarget.col:8+s.enPassantTarget.col];
// Castling rights hash
if(undo.oldCastling.whiteKingside&&!s.castlingRights.whiteKingside)h^=zobrist.castling[0];
if(undo.oldCastling.whiteQueenside&&!s.castlingRights.whiteQueenside)h^=zobrist.castling[1];
if(undo.oldCastling.blackKingside&&!s.castlingRights.blackKingside)h^=zobrist.castling[2];
if(undo.oldCastling.blackQueenside&&!s.castlingRights.blackQueenside)h^=zobrist.castling[3];
s.hash=(h>>>0);
// v1.0.2 PERF (audit): bump boardVersion so _updateBoardIncremental can use
// an integer compare instead of JSON.stringify on every render tick.
s.boardVersion=(s.boardVersion||0)+1;
// 12. Incremental posCount
s.posCount.set(s.hash,(s.posCount.get(s.hash)||0)+1);
return undo;
}

function unmakeMv(s,undo){
if(!undo)return;
// 1. Decrement posCount for current hash
const curCount=s.posCount.get(s.hash)||1;
if(curCount<=1)s.posCount.delete(s.hash);else s.posCount.set(s.hash,curCount-1);
// 2. Restore board
const f=undo.from,t=undo.to;
// v1.0.7 PHASE 17 FIX: Detect the "king already on target" castling case
// (from === to). Per the makeMv fix, in that scenario the king's square was
// never cleared or overwritten by the king move — only the rook moved. So
// unmake must NOT overwrite the king's square (which is also the to square)
// with undo.piece OR null it via the capPiece branch. Detect this case via
// undo.castlingRook presence + from===to.
const _kingStayedPut=!!undo.castlingRook&&f.r===t.r&&f.c===t.c;
// Restore moved piece (original piece, not promoted) at the from square.
// Skip when the king stayed put — its piece is already at f===t.
if(!_kingStayedPut){
  s.board[f.r][f.c]={...undo.piece};
  // Restore captured piece at destination (or null if no capture)
  if(undo.capPiece)s.board[t.r][t.c]={...undo.capPiece};else s.board[t.r][t.c]=null;
}
// Restore en passant captured piece
if(undo.epCaptured){const ep=undo.epCaptured;s.board[ep.r][ep.c]={...ep.piece};}
// Restore castling rook
// v1.0.7 PHASE 18 Task 3 (critical bug fix): Restore the rook from the saved
// piece in undo.castlingRook.piece, NOT by reading s.board[cr.to]. The old
// code did: s.board[cr.from] = s.board[cr.to]; s.board[cr.to] = null;
// This read the rook from its destination — but step 2 above may have already
// overwritten cr.to with the king (when cr.to === f, i.e. the rook's
// destination is the king's source square, which happens in ~half of all
// Chess960 SP-ID positions). The old code would then copy the KING to the
// rook's source and null the king's square — silently corrupting the board,
// king position, and search state.
//
// The fix: use the saved piece. Also, only null cr.to if it does NOT coincide
// with the king's source square f — because step 2 already restored the king
// there (or, in the king-stayed-put case, the king was never moved). Nulling
// f would remove the king.
if(undo.castlingRook){
  const cr=undo.castlingRook;
  // Restore the rook at its source square from the saved piece.
  if(cr.piece)s.board[cr.from.r][cr.from.c]={type:cr.piece.type,color:cr.piece.color};
  else s.board[cr.from.r][cr.from.c]=null;
  // Clear the rook's destination — UNLESS it coincides with the king's source
  // (f), because step 2 already placed the king there (or the king never
  // moved in the stayed-put case). Nulling it would remove the king.
  // Also skip when the rook's destination === rook's source (rook didn't
  // move, e.g. SP-ID where rook starts on its castling target).
  if(!(cr.to.r===f.r&&cr.to.c===f.c)&&!(cr.to.r===cr.from.r&&cr.to.c===cr.from.c)){
    s.board[cr.to.r][cr.to.c]=null;
  }
}
// 3. Restore king positions
s.wk=undo.oldWk?{row:undo.oldWk.r,col:undo.oldWk.c}:null;
s.bk=undo.oldBk?{row:undo.oldBk.r,col:undo.oldBk.c}:null;
// 4. Restore all other fields
s.castlingRights={...undo.oldCastling};
s.enPassantTarget=undo.oldEnPassant?{row:undo.oldEnPassant.r,col:undo.oldEnPassant.c}:null;
s.halfMoveClock=undo.oldHalfMove;
s.fullMoveNumber=undo.oldFullMove;
s.hash=undo.oldHash;
// v1.0.2 PERF (audit): restore boardVersion so dirty-check still works after unmake.
s.boardVersion=undo.oldBoardVersion||0;
if(s.moveHistory&&undo.oldMoveHistoryLength!==undefined)s.moveHistory.length=undo.oldMoveHistoryLength;
s.currentTurn=undo.isBlackMove?'black':'white';
}

// gameStatus: checks all game-ending conditions per FIDE Laws of Chess (2023)
// CRITICAL: Checkmate/stalemate MUST be checked BEFORE draw conditions.
// FIDE 5.1.1: The game is won by the player who has checkmated their opponent's king.
// This immediately ends the game — checkmate takes precedence over ALL draw conditions
// (50-move rule, 75-move rule, repetition, dead position). Previously, draw conditions
// were checked first, causing checkmate positions with high halfMoveClock (common in
// endgames like K+R vs K) to be incorrectly classified as draws, producing eval=0
// instead of eval=±99999 in the review interface.
function gameStatus(s){
// Step 1: Check for checkmate/stalemate FIRST (FIDE 5.1.1: takes absolute precedence)
if(!hasLegalMoves(s)){
  const k=s.currentTurn==='white'?s.wk:s.bk;
  return inCheck(s.board,s.currentTurn,k)?'checkmate':'draw_stalemate';
}
// Step 2: Draw conditions (only relevant when there ARE legal moves)
// FIDE 9.6.2: 75-move rule — mandatory auto-draw
if(s.halfMoveClock>=150)return'draw_75move';
// FIDE 9.6.1: Fivefold repetition — mandatory auto-draw
const repCount=(s.posCount.get(s.hash)||0);
if(repCount>=5)return'draw_5fold';
// FIDE 9.3: 50-move rule — claimable (auto in app)
if(s.halfMoveClock>=100)return'draw_50move';
// FIDE 9.2: Threefold repetition — claimable (auto in app)
if(repCount>=3)return'draw_repetition';
// FIDE 5.2.2: Dead position — no possible checkmate by any series of legal moves
if(isDeadPosition(s))return'draw_insufficient';
// Position has legal moves and no draw condition: check or ongoing
const k=s.currentTurn==='white'?s.wk:s.bk;return inCheck(s.board,s.currentTurn,k)?'check':'ongoing'}

// isDeadPosition: FIDE 5.2.2 — no possible checkmate by any series of legal moves
// Covers: K vs K, K+minor vs K, K+B vs K+B (same color), K+B+B(same color) vs K
// Note: K+N+N vs K is NOT a dead position (checkmate possible with opponent's help)
// v1.2.3 round-29 (PR52): winnerLacksMatingMaterial added for FIDE 6.9 — checks
//   whether a SPECIFIC side has enough material to checkmate the opponent.
//   isDeadPosition checks the WHOLE position (both sides); for FIDE 6.9 timeout
//   draws we need to check the WINNER side only. Example: White flags, Black has
//   K+N only → Black wins on time but cannot mate → FIDE 6.9 draw. isDeadPosition
//   returns false here (White may have a queen), so the old code wrongly judged
//   "Black wins". winnerLacksMatingMaterial(state,'black') returns true → draw.
// v1.2.3 round-31 (PR52 SonarCloud S3776): refactored to reduce cognitive
//   complexity from 29 → ~6 by extracting _scanWinnerMaterial() and
//   _bishopParityIsUniform(). The 11-test FIDE 6.9 suite (round-30) still
//   passes — semantics are byte-for-byte equivalent.
function winnerLacksMatingMaterial(s,winnerColor){
  // v1.2.3 round-35 (PR52 SonarCloud S6582): use optional chaining —
  //   `!s?.board` returns true when s is null/undefined OR s.board is falsy,
  //   equivalent to the previous `!s||!s.board` short-circuit.
  if(!s?.board)return false;
  const counts=_scanWinnerMaterial(s.board,winnerColor);
  // Sanity: winner must have exactly one king (otherwise state is corrupt).
  if(counts.king!==1)return false;
  // Any pawn / rook / queen → mating is possible.
  if(counts.pawn>0||counts.rook>0||counts.queen>0)return false;
  // K vs K (winner has only king) → cannot mate.
  if(counts.knight===0&&counts.bishop===0)return true;
  // K + single minor (N or B) → cannot mate.
  if(counts.knight+counts.bishop===1)return true;
  // K + 2N → cannot force mate (FIDE rules; help-mate possible but not forced).
  if(counts.knight===2&&counts.bishop===0)return true;
  // K + B+B same color (no knight) → cannot force mate (enemy king escapes
  // to the opposite-color squares). The parity check ensures ALL bishops
  // are the same color; the no-knight guard excludes K+N+B+B(same color)
  // which CAN mate (knight attacks both square colors).
  // v1.2.3 round-30: added this case (was missing — the FIDE 6.9 timeout
  //   draw was incorrectly judged a win for K+B+B same-color winners).
  if(counts.bishop>=2&&counts.knight===0&&_bishopParityIsUniform(counts.bishopParity))return true;
  // K + B+B same color + knight → CAN mate.
  // K + B+B opposite color → CAN mate (covers both square colors).
  // K + N+B → CAN mate.
  // K + 2N+anything else → CAN mate (the anything-else enables mate).
  return false;
}

/**
 * Scan the board and return the winner's non-king piece counts plus the
 * bishop square-color parity. Loser-side material is irrelevant to FIDE 6.9
 * — the winner's mating ability depends only on the winner's own pieces.
 *
 * @param {Array} board - 8×8 array of pieces (or null)
 * @param {string} winnerColor - 'white' | 'black'
 * @returns {Object} {pawn,knight,bishop,rook,queen,king,bishopParity}
 *   bishopParity: -1 = no bishop seen; 0/1 = light/dark uniform; -2 = mixed
 */
function _scanWinnerMaterial(board,winnerColor){
  let pawn=0,knight=0,bishop=0,rook=0,queen=0,king=0;
  let bishopParity=-1;
  for(let r=0;r<8;r++){
    const row=board[r];
    if(!row)continue;
    for(let c=0;c<8;c++){
      const p=row[c];
      // v1.2.3 round-35 (PR52 SonarCloud S6582): optional chaining — when p
      //   is null/undefined, `p?.color` evaluates to undefined, and
      //   `undefined !== winnerColor` is true → continue (same as `!p||...`).
      if(p?.color!==winnerColor)continue;
      switch(p.type){
        case'pawn':pawn++;break;
        case'knight':knight++;break;
        case'rook':rook++;break;
        case'queen':queen++;break;
        case'king':king++;break;
        case'bishop':{
          bishop++;
          const parity=(r+c)%2;
          if(bishopParity===-1)bishopParity=parity;
          else if(bishopParity!==parity)bishopParity=-2; // mixed-parity flag
          break;
        }
      }
    }
  }
  return {pawn:pawn,knight:knight,bishop:bishop,rook:rook,queen:queen,king:king,bishopParity:bishopParity};
}

/**
 * Returns true iff all bishops the winner owns sit on the SAME square color.
 * Used by the FIDE 6.9 K+B+B same-color rule: K+B+B(uniform color) vs K cannot
 * force mate (the enemy king escapes to the opposite-color squares).
 * bishopParity === -2 means mixed colors; any other non-negative value means
 * uniform (or no bishops, in which case the caller's `bishop>=2` guard fails
 * first).
 */
function _bishopParityIsUniform(bishopParity){
  return bishopParity>=0;
}

// v1.2.3 round-36 (dedup + robustness): canonical eval-bucket classifier.
//   Returns an integer -4..+4 representing the eval strength bucket
//   (-4 = losing, 0 = equal, +4 = winning). The thresholds ±50/±150/±350/±600
//   were previously duplicated between ui.js:posDesc() (player-POV labels)
//   and pgn-standard.js:_pgnWhitePerspectiveLabel() (White-POV labels).
//   Duplicating the thresholds risked silent drift — a future tuning round
//   could change one copy without the other, causing the in-UI eval-bar
//   label to disagree with the exported PGN annotation label for the same
//   position. Centralizing the thresholds here eliminates that risk.
//   Both call sites use _POV_LABEL_KEYS.player[evalBucket(ev)] or
//   _POV_LABEL_KEYS.white[evalBucket(ev)] to look up their respective i18n keys.
function evalBucket(ev){
  if(ev>600)return 4;
  if(ev>350)return 3;
  if(ev>150)return 2;
  if(ev>50)return 1;
  if(ev>-50)return 0;
  if(ev>-150)return -1;
  if(ev>-350)return -2;
  if(ev>-600)return -3;
  return -4;
}
// Player-POV i18n keys (used by ui.js posDesc).
const _POV_LABEL_KEYS_PLAYER={
  4:'you_winning',3:'huge_adv',2:'advantage',1:'slight_adv',0:'equal_pos',
  '-1':'slight_dis','-2':'disadvantage','-3':'huge_dis','-4':'you_losing'
};
// White-POV i18n keys (used by pgn-standard.js _pgnWhitePerspectiveLabel).
// White-POV labels are absolute (always from White's perspective, regardless
// of which side the human played) so PGN annotations are unambiguous.
const _POV_LABEL_KEYS_WHITE={
  4:'pgn_white_winning',3:'pgn_white_huge_adv',2:'pgn_white_advantage',1:'pgn_white_slight_adv',0:'pgn_equal',
  '-1':'pgn_black_slight_adv','-2':'pgn_black_advantage','-3':'pgn_black_huge_adv','-4':'pgn_black_winning'
};
function isDeadPosition(s){
// v1.0.2 PERF (first-principles): single-pass piece scan with early returns.
// The previous code allocated a pcs[] array, then ran multiple .filter() /
// .map() passes on it. The early-return logic below covers the same cases
// (K vs K, K+minor vs K, K+B vs K+B same-color, K+B+B same-color vs K)
// in a single 64-square scan with O(1) per-square work, and exits the
// moment the position is provably NOT dead (e.g. a queen or rook present,
// or a pawn present which can always promote).
// Piece counters by color + type. We only need to know:
//   - total piece count (must be ≤ 4 for any dead position)
//   - per-side non-king piece counts + types
//   - bishop square-color parity (for same-color bishop checks)
let total=0;
// Per-side: [pawn, knight, bishop, rook, queen, king] counts (index by type)
const wCount={pawn:0,knight:0,bishop:0,rook:0,queen:0,king:0};
const bCount={pawn:0,knight:0,bishop:0,rook:0,queen:0,king:0};
let wBishopParity=-1,bBishopParity=-1; // -1 = no bishop seen yet
let wBishopCount=0,bBishopCount=0;
const b=s.board;
for(let r=0;r<8;r++){
  const row=b[r];if(!row)continue;
  for(let c=0;c<8;c++){
    const p=row[c];
    if(!p)continue;
    total++;
    // Early exit: pawns / rooks / queens can always force or avoid checkmate
    // → not a dead position. (K vs K is the only all-king case.)
    if(p.type==='pawn'||p.type==='rook'||p.type==='queen')return false;
    const cnt=p.color==='white'?wCount:bCount;
    if(p.type==='king'){cnt.king++;continue;}
    if(p.type==='knight'){cnt.knight++;continue;}
    // Bishop — track count + square-color parity
    if(p.color==='white'){
      wBishopCount++;
      const parity=(r+c)%2;
      if(wBishopParity===-1)wBishopParity=parity;
      else if(wBishopParity!==parity)wBishopParity=-2; // mixed-parity flag
    }else{
      bBishopCount++;
      const parity=(r+c)%2;
      if(bBishopParity===-1)bBishopParity=parity;
      else if(bBishopParity!==parity)bBishopParity=-2;
    }
  }
}
// Sanity: dead positions require both kings present
if(wCount.king!==1||bCount.king!==1)return false;
const wMinor=wCount.knight+wBishopCount;
const bMinor=bCount.knight+bBishopCount;
// K vs K
if(total===2)return true;
// K+minor vs K (either side has only K, other has K + at most one minor)
if(wMinor===0&&bMinor<=1)return true;
if(bMinor===0&&wMinor<=1)return true;
// K+B vs K+B (both sides have exactly 1 bishop, same square color)
if(wMinor===1&&bMinor===1&&wBishopCount===1&&bBishopCount===1
   &&wBishopParity>=0&&bBishopParity>=0&&wBishopParity===bBishopParity)return true;
// K+B+B(same color) vs K — any number of same-color bishops cannot force checkmate.
// v1.0.8 PHASE 30: was wBishopCount===2 (exactly 2), now >=2 (2 or more, e.g. 3
//   bishops via promotion — all same color, still no checkmate possible). The
//   wBishopParity>=0 check already ensures ALL bishops are the same color.
// v1.0.8 PHASE 33: added wCount.knight===0 guard. K+N+B+B(same color) vs K is
//   NOT a dead position — the knight attacks both square colors, so combined
//   with same-color bishops checkmate IS possible. The old code (===2 and >=2)
//   both missed this edge case.
if(bMinor===0&&wBishopCount>=2&&wBishopParity>=0&&wCount.knight===0)return true;
if(wMinor===0&&bBishopCount>=2&&bBishopParity>=0&&bCount.knight===0)return true;
return false;
}
// PGN-standard SAN notation with proper disambiguation (DroidFish TextIO.moveToString algorithm)
// Disambiguation rules per PGN spec:
//   1. If only one piece of that type can reach the target → no qualifier
//   2. If file suffices to disambiguate → file only (e.g., Rae1)
//   3. If rank suffices → rank only (e.g., R1e1)
//   4. If neither suffices alone → both file AND rank (e.g., Qa1b2)
// For pawns, file is only included on captures (e.g., exd5)
function moveAlg(s,mv,postState){const{from,to,piece,promotion}=mv;const isCap=!!s.board[to.row][to.col]||(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col);let n='';
// v1.0.6: Use _castleSide() for unambiguous castling detection.
// In Chess960, the king may move only 1 column when castling (e.g. f1→g1),
// so `Math.abs(to.col-from.col)===2` alone is insufficient.
// v1.0.9 PHASE 52: pass `s` to _castleSide for correct local-state checks.
const _cs=_castleSide(mv,s);
if(_cs){n=_cs==='kingside'?'O-O':'O-O-O'}else{
if(piece.type!=='pawn'){
n+=piece.type==='knight'?'N':piece.type[0].toUpperCase();
// Disambiguation: find all same-type, same-color pieces with legal moves to same target
// v1.0.2 PERF (first-principles): use makeMvInPlace/unmakeMv instead of cloneB
// per candidate. The previous code cloned the entire 8×8 board for every
// same-type piece that could reach the target (up to 8 clones per moveAlg
// call, e.g. with 8 pawns on the 2nd rank all able to capture on the same
// file). makeMvInPlace modifies the board in place + returns an undo object
// that unmakeMv uses to restore — no board allocation at all.
// This mirrors the optimization already applied to legalMoves() and
// hasLegalMoves() (see comments above legalMoves).
let numSameTarget=0,numSameFile=0,numSameRow=0;
// v1.2.3 round-36 (dedup): use _kingPosAfterMove (shared with legalMoves/hasLegalMoves).
//   The previous inline used the (p.color==='white'?s.wk:s.bk) syntax while
//   legalMoves/hasLegalMoves used s[p.color==='white'?'wk':'bk'] — two
//   syntaxes for the same logic. Centralizing eliminates the divergence
//   risk (if s.wk/s.bk ever diverge from s['wk']/s['bk'] due to a future
//   refactor, the two syntaxes could disagree).
for(let r=0;r<8;r++)for(let c=0;c<8;c++){if(r===from.row&&c===from.col)continue;const p=s.board[r][c];if(p?.type===piece.type&&p.color===piece.color){const pm=pseudoMoves(s,{row:r,col:c});if(pm.some(m=>m.row===to.row&&m.col===to.col)){const mv2={from:{row:r,col:c},to:{row:to.row,col:to.col},piece:p,promotion:undefined};const undo=makeMvInPlace(s,mv2);if(undo){const kPos=_kingPosAfterMove(s,p,to);if(kPos&&!inCheck(s.board,p.color,kPos)){numSameTarget++;if(c===from.col)numSameFile++;if(r===from.row)numSameRow++;}unmakeMv(s,undo);}}}}
// PGN standard disambiguation: file first, then rank, then both
if(numSameTarget>0){if(numSameFile===0)n+=String.fromCodePoint(97+from.col);else if(numSameRow===0)n+=(8-from.row);else n+=String.fromCodePoint(97+from.col)+(8-from.row)}
}
if(piece.type==='pawn'&&isCap)n+=String.fromCodePoint(97+from.col);if(isCap)n+='x';n+=posAlg(to);if(promotion)n+='='+(promotion==='knight'?'N':promotion[0].toUpperCase())}
// v1.1.2 PHASE 71 (robustness): guard against `setupMode` being undefined
// (e.g. if moveAlg is called before ui.js has declared the global). Other
// call sites in this file use `typeof setupMode!=='undefined'&&setupMode`;
// this site was missed and would throw a ReferenceError. Falling through to
// the check/checkmate suffix computation is harmless for setup-mode moves
// (the post-state would just be undefined → no suffix added).
if(typeof setupMode!=='undefined'&&setupMode)return n;
// Check/checkmate suffix: use actual post-move state when available (avoids manual board
// construction bugs — missing posCount, stale castlingRights, etc.)
const ps=postState;
if(ps){const opp=OPP_COLOR[piece.color];const kPos=opp==='white'?ps.wk:ps.bk;if(kPos&&inCheck(ps.board,opp,kPos)){n+=hasLegalMoves(ps)?'+':'#'}}
return n}
// v1.0.8 PHASE 31 PERF: getCtrlMap allocation reduction via hidden-class stability.
//   Previous implementation allocated 64 {white:[],black:[]} object literals on
//   EVERY call (192 allocations including the 128 empty arrays). getCtrlMap is
//   called on every render tick when the control heatmap is on, so this was
//   significant GC pressure.
//
//   Optimization: use a factory function (_newCtrlCell) that builds each cell
//   from the SAME code path. V8 can then assign the SAME hidden class to all 64
//   cell objects (object literals at different source locations can sometimes
//   get different hidden classes). This improves inline-cache hit rates for
//   downstream property access (cm[r][c].white, .black) in the hot rendering
//   loop. The factory also reads cleaner than an inline literal.
//
//   We CANNOT reuse a single buffer object across calls because callers cache
//   the result (cachedCtrlMap keyed by gameState.hash) and a concurrent
//   _computeAndCacheVisualAnnotations call (which uses postState.board, a
//   DIFFERENT board) would corrupt the cached data if we cleared in place. So
//   each call still produces a fresh 64-cell grid.
//
//   The attacker {piece, position} objects are still allocated per push, but the
//   position object is hoisted per-piece (Rev55 optimization), so we allocate at
//   most 32 position objects per call.
function _newCtrlCell(){return{white:[],black:[]}}
function getCtrlMap(b){const cm=[];for(let r=0;r<8;r++){cm[r]=[];for(let c=0;c<8;c++)cm[r][c]=_newCtrlCell()}
// v1.0.5 Rev55 PERF: hoist the attacker-position object out of the inner loop.
// Each piece at (r,c) attacks multiple squares, but its `position` field is the
// SAME for all those pushes. Previously we allocated a fresh {row:r,col:c} object
// on every push (≈256 allocations per ctrl-map = per render tick when heatmap
// is on). Now we allocate ONE position object per piece (max 32) and reuse it.
for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(p){const atks=attacked(b,{row:r,col:c});const _pos={row:r,col:c};for(const a of atks){cm[a.row][a.col][p.color].push({piece:p,position:_pos})}
}}return cm}


// ===================== CHESS AI =====================

// Synced with Java ELO_MAP in StockfishNative.java
const ELO_MATCH=[0,800,1350,1700,2000,2200,2350];
function getAI_LEVELS(){return[
{id:1,name:T('level_1'),desc:T('level_1')},
{id:2,name:T('level_2'),desc:T('level_2')},
{id:3,name:T('level_3'),desc:T('level_3')},
{id:4,name:T('level_4'),desc:T('level_4')},
{id:5,name:T('level_5'),desc:T('level_5')},
{id:6,name:T('level_6'),desc:T('level_6')},
{id:7,name:T('level_7'),desc:T('level_7')},
{id:8,name:T('level_8'),desc:T('level_8')}
];}
// Use getAI_LEVELS() for current translations — AI_LEVELS was frozen at init and became stale after language toggle

/**
 * Compute the effective AI level displayed in the toolbar.
 * Returns 1-7 when UCI_Elo matches a preset, 8 (⚙️) when it does not.
 * This ensures the AI level buttons always reflect the actual backend config.
 * When displaying ⚙️, aiLevel still holds the last explicitly selected level (1-7)
 * for engineGo() — ⚙️ is purely a display indicator, not an operational level.
 */
function getEffectiveAILevel(){
  if(!engineSettingsData)return aiLevel;
  // Level 7: UCI_LimitStrength explicitly disabled
  if(engineSettingsData.limitStrength===false)return 7;
  // Levels 1-6: find matching preset Elo (undefined limitStrength treated as ON)
  const e=engineSettingsData.elo||0;
  for(var i=1;i<=6;i++){
    if(e===ELO_MATCH[i])return i;
  }
  // No match → manual profile (⚙️)
  return 8;
}

// Audio system
// ===================== ZOBRIST HASH TABLES =====================
function initZobristTables(){
  // Deterministic seeded PRNG (xorshift32) — ensures reproducible hash tables
  // across sessions, eliminating theoretical collision risk from Math.random()
  let _seed=0x12345678;
  function _xorshift32(){_seed^=_seed<<13;_seed^=_seed>>17;_seed^=_seed<<5;return(_seed>>>0)/0x100000000;}
  function _randInt(){return Math.floor(_xorshift32()*0x7FFFFFFF);}
  const pieceTable=new Array(64);
  for(let sq=0;sq<64;sq++){
    pieceTable[sq]=new Array(12);
    for(let i=0;i<12;i++)pieceTable[sq][i]=_randInt();
  }
  const side=_randInt();
  const castling=[0,0,0,0].map(()=>_randInt());
  const enPassant=new Array(16);
  for(let i=0;i<16;i++)enPassant[i]=_randInt();
  return{pieceTable,side,castling,enPassant};
}
const zobrist=initZobristTables();
// v1.0.2 PERF (first-principles): pre-compute piece→index map once at module
// load instead of building a fresh {pawn:0,knight:1,...} object on every
// pieceZobristIdx() call. pieceZobristIdx is called 32+ times per computeHash
// (once per occupied square), and computeHash is called on every state clone
// (syncHash) + every makeMv incremental update fallback. The object-literal
// construction was a hidden per-call allocation that added up under heavy
// engine search.
const _PIECE_TYPE_IDX={pawn:0,knight:1,bishop:2,rook:3,queen:4,king:5};
function pieceZobristIdx(p){
  const typeIdx=_PIECE_TYPE_IDX[p.type];
  if(typeIdx===undefined) return 0;
  return typeIdx*2+(p.color==='white'?0:1);
}
function computeHash(s){
  let h=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=s.board[r][c];if(p)h^=zobrist.pieceTable[r*8+c][pieceZobristIdx(p)];}
  if(s.currentTurn==='black')h^=zobrist.side;
  if(s.castlingRights.whiteKingside)h^=zobrist.castling[0];
  if(s.castlingRights.whiteQueenside)h^=zobrist.castling[1];
  if(s.castlingRights.blackKingside)h^=zobrist.castling[2];
  if(s.castlingRights.blackQueenside)h^=zobrist.castling[3];
  if(s.enPassantTarget)h^=zobrist.enPassant[s.enPassantTarget.row===2?s.enPassantTarget.col:8+s.enPassantTarget.col];
  return (h>>>0);
}
// Hash synchronization: recomputes Zobrist hash from scratch
// Used as fallback when incremental updates may be unreliable
function syncHash(s){s.hash=computeHash(s)}

// v1.0.7: recomputeCastlingRights REMOVED — castling rights now owned by 🔁
// marker validation (_validateSetupCastleMarks). initState/initChess960State
// still construct castlingRights={all:true} directly.

// Refresh game state after setup mode piece placement.
// v1.0.7: No longer touches castlingRights — they are now owned entirely by
// the 🔁 marker validation pass. We DO still reset enPassantTarget here
// because en-passant is a transient state that doesn't survive board edits.
// (The ⚡ marker is re-applied on "Done" via _validateSetupEpMark.)
function _refreshStateAfterSetup(s){
s.wk=null;s.bk=null;s.enPassantTarget=null;
for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=s.board[r][c];if(p){if(p.type==='king'&&p.color==='white')s.wk={row:r,col:c};if(p.type==='king'&&p.color==='black')s.bk={row:r,col:c};}}
// v1.0.7: When the board is mutated (place/remove piece, clear, reset), any
// previously-applied 🔁 marker may now point at a square that no longer holds
// a rook. We DON'T auto-delete the marker — the validation pass on "Done"
// will surface the error and let the user fix it. But we DO need to ensure
// castlingRights are not left in a stale "true" state from a prior
// validation pass. Reset them here; they'll be re-derived on "Done".
s.castlingRights={whiteKingside:false,whiteQueenside:false,blackKingside:false,blackQueenside:false};
syncHash(s);
// v1.0.2 PERF (audit): bump boardVersion so _updateBoardIncremental detects
// setup-mode board mutations (piece placement/deletion/clear-board/reset-board).
s.boardVersion=(s.boardVersion||0)+1;
}

// NOTE: All position evaluation comes exclusively from Stockfish18. No JS-side eval code.


function _requestStockfishMove(){
// Try ECO book move first for instant opening play (only if player enabled it)
if(useBookMoves){
try{
const bookMove=queryECOBookMove(gameState);
if(bookMove){
  // v1.0.4 Rev32 FIX (CRITICAL): "Engine sometimes unresponsive" bug.
  // When the ECO book provides a move, the engine is NOT called, so onBestMove
  // never fires. The doAIMove() caller increments _aiRetryCount on EVERY call
  // (expecting it to be reset by onBestMove). After 3 consecutive book moves,
  // _aiRetryCount reaches 3 → doAIMove() falsely concludes "AI move failed
  // after 3 consecutive timeouts" → shows ai_timeout toast and RETURNS WITHOUT
  // CALLING THE ENGINE. The engine appears "unresponsive" — but it's actually
  // the retry counter that's stuck.
  // Fix: reset _aiRetryCount=0 on a successful book move (the "request" was
  // satisfied, just by the book instead of the engine). Also clear the safety
  // timer (already done) so it doesn't fire a spurious retry.
  isAIThinking=false;_aiBarInfo='';_aiRetryCount=0;
  if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
  executeMove(bookMove.from,bookMove.to,bookMove.promotion);
  return;
}
}catch(e){console.error('ECO book move lookup error:',e);}
}
if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.isEngineReady==='function'&&AndroidBridge.isEngineReady()){
// v1.0.6: Sanitize the FEN before sending to the engine to strip
// inconsistent castling rights that can cause the engine to hang.
const fen=(typeof _sanitizeFenForEngine==='function')?_sanitizeFenForEngine(generateFEN(gameState)):generateFEN(gameState);
// v1.0.4 LATEST: if the game is timed, use engineGoTimed() so Stockfish 18
// manages its own time allocation via UCI wtime/btime/winc/binc parameters.
// This is the correct way to play timed games — the engine will think longer
// in critical positions and shorter in simple ones, just like a human.
if(gameClocks !== undefined&&gameClocks&&typeof AndroidBridge.engineGoTimed==='function'){
  const wMs=Math.round(gameClocks.white.remainingSec*1000);
  const bMs=Math.round(gameClocks.black.remainingSec*1000);
  const wincMs=(gameClocks.type==='fischer')?Math.round((gameClocks.incrementSec||0)*1000):0;
  const bincMs=(gameClocks.type==='fischer')?Math.round((gameClocks.incrementSec||0)*1000):0;
  try{
    if(_needNewGameForEngine){
      _needNewGameForEngine=false;
      AndroidBridge.engineGoTimed(fen,aiLevel,true,wMs,bMs,wincMs,bincMs);
    }else{
      AndroidBridge.engineGoTimed(fen,aiLevel,false,wMs,bMs,wincMs,bincMs);
    }
  }catch(e){
    console.error('engineGoTimed error:',e);
    // Fallback to untimed engineGo
    // v1.2.3 round-37 (SonarCloud S7718): nested catch uses `error` (not
    //   `e2`) per the project's modern catch-param naming convention.
    if(_needNewGameForEngine){_needNewGameForEngine=false;try{AndroidBridge.engineGoNewGame(fen,aiLevel);}catch(error){}}
    else{try{AndroidBridge.engineGo(fen,aiLevel);}catch(error){}}
    isAIThinking=false;_aiBarInfo='';render();
  }
  return;
}
// Untimed game — use the original movetime-based engineGo
if(_needNewGameForEngine){_needNewGameForEngine=false;try{AndroidBridge.engineGoNewGame(fen,aiLevel);}catch(e){console.error('engineGoNewGame error:',e);isAIThinking=false;_aiBarInfo='';render();}return;}
else{try{AndroidBridge.engineGo(fen,aiLevel);}catch(e){console.error('engineGo error:',e);isAIThinking=false;_aiBarInfo='';render();}return;}
}
console.warn('_requestStockfishMove: engine not available, _engineReady=',_engineReady);
showToast(T('engine_unavailable_hint'));
isAIThinking=false;_aiBarInfo='';
render();
}

// Safety timeout timer ID for AI move — cancelled when bestmove arrives
let _aiSafetyTimerId=null;
let _aiRetryCount=0;
let _aiMoveRequestId=0;
let _currentAiRequestId=0;
function doAIMove(){
if(gameOver||reviewMode||setupMode||isAIThinking)return;
if(gameState.currentTurn===playerColor)return;
// Clear any stale safety timer from a previous failed attempt
if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
isAIThinking=true;
// v1.0.8 PHASE 22 supplement: AI-think-start sound (轻微滴声)
try{if(typeof playSound==='function')playSound('aiThinkStart');}catch(e){console.warn('[GameLogic]',e?.message?e.message:e);}
hintText='';isHintLoading=false;_hintBarInfo='';_ponderGen++;_ponderBarInfo='';_ponderMoveSAN='';_pendingPonderMoveUCI=null;
aiThinkInfo=T('thinking');_aiBarInfo=T('thinking');_updateAIThinkDisplay();
// v1.0.8 PHASE 22: Lightweight UI update — avoid full render() which would
// destroy the piece-move animation overlay. _updateAIThinkDisplay() handles
// the "思考中..." indicator. Full render is deferred until the animation
// completes (_finishAnim clears animationInProgress) or AI responds.
// Note: _landingAnimActive removed in v1.0.8 — WAAPI overlay is independent; skip render only during piece-move animation.
if(!animationInProgress)render();
// Safety timeout: if engine doesn't respond within 360s, reset AI state and retry
// v1.0.4 Rev45: Extended from 15s to 30s to better accommodate timed-game mode.
// v1.0.4 Rev46: Extended from 30s to 360s (6 minutes) to fully accommodate
// long timed games where the engine may use several minutes for a critical
// move at high difficulty levels. In a 5+3 Fischer game, the engine can
// legitimately use 2-4 minutes on a complex middlegame position. 30s was
// still too short for long time controls.
_aiRetryCount++;
if(_aiRetryCount>=3){
  console.error('AI move failed after 3 consecutive timeouts');
  isAIThinking=false;_aiBarInfo='';_aiRetryCount=0;
  showToast(T('ai_timeout'));
  render();
  return;
}
const _aiSafetyTimer=setTimeout(()=>{
  if(isAIThinking){
    console.warn('AI move timeout — retrying ('+_aiRetryCount+'/3)');
    isAIThinking=false;_aiBarInfo='';
    doAIMove();
  }
},360000);
_aiSafetyTimerId=_aiSafetyTimer;
_currentAiRequestId=++_aiMoveRequestId;
setTimeout(()=>{
// P0 FIX: Validate state freshness — game may have changed during 0ms delay
if(gameOver||reviewMode||setupMode||gameState.currentTurn===playerColor||!isAIThinking)return;
// Level 7: probe tablebase for endgame positions (7 pieces or fewer) before Stockfish
// v1.2.1 round-11 (review fix): restore the typeof guard around pieceCountLE7.
//   tablebase.js is loaded AFTER game-logic.js in build-chess.py's module
//   order, and is also a network-fetched fallback (the worker-pool path may
//   fail to register on extreme WebView implementations). If pieceCountLE7
//   is somehow undefined (script load failure, worker error), an unguarded
//   call would throw ReferenceError and completely halt AI move generation
//   — the user would see "AI thinking" forever with no recovery path. The
//   typeof guard degrades gracefully: if tablebase isn't available, we skip
//   the tablebase probe and fall through to Stockfish (which is always
//   available once the engine is ready).
if(aiLevel===7&&typeof pieceCountLE7==='function'&&pieceCountLE7(gameState.board)){
_tbLoading=true;_aiBarInfo='⏳ '+T('tb_querying');_updateAIThinkDisplay();render();
// Save board reference BEFORE async call to prevent race condition
// (gameState may change while tablebase query is in-flight)
const _tbSavedBoard=gameState.board;
probeTablebase(gameState).then(function(tbData){
_tbLoading=false;_tbRetryCount=0;
if(tbData){
const tbMove=bestMoveFromTablebase(tbData);
if(tbMove){
const coords=uciToCoords(tbMove.uci);
// Use saved board reference to validate move still applies
// v1.2.3 round-18 (bug fix): also require the live board to BE the saved
//   board (reference equality). The TB fetch is async — if the position
//   changed while in-flight (undo/new game), the saved-board check alone
//   would pass and executeMove would inject the TB move into a DIFFERENT
//   game. On mismatch fall through to the Stockfish path, which recomputes
//   from the fresh state.
if(coords&&gameState.board===_tbSavedBoard&&_tbSavedBoard[coords.from.row]&&_tbSavedBoard[coords.from.row][coords.from.col]){
// v1.0.4 Rev32 FIX: same as ECO book move — reset _aiRetryCount so the
// safety-counter doesn't accumulate across tablebase-served moves.
isAIThinking=false;_aiBarInfo='';_aiRetryCount=0;if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
executeMove(coords.from,coords.to,coords.promotion);
return;
}
}
}
// TB data arrived but no valid move — fall back to Stockfish
_requestStockfishMove();
}).catch(function(){
_tbLoading=false;
_tbRetryCount++;
if(_tbRetryCount<=2){
isAIThinking=false;_aiBarInfo='';doAIMove();
}else{
_tbRetryCount=0;
_requestStockfishMove();
}
});
return;
}
_requestStockfishMove();
},0);
}


function queryECO(s, openingId) {
  _ensureEcoParsed();
  if (openingId) {
    // Book lookup mode: try ALL variants (not just first) to find matching line
    const opList = ECO_BY_ID[openingId];
    if (!opList || !opList.length) return null;
    let bestOp = null, bestLen = 0;
    for (const op of opList) {
      if (!op.moves || !op.moves.length) continue;
      let match = true;
      for (let i = 0; i < s.moveHistory.length; i++) {
        const offset = i * 4;
        if (offset + 3 >= op.moves.length) { match = false; break; }
        const mh = s.moveHistory[i];
        if (!mh || mh.from.row !== op.moves[offset] || mh.from.col !== op.moves[offset + 1] || mh.to.row !== op.moves[offset + 2] || mh.to.col !== op.moves[offset + 3]) { match = false; break; }
      }
      if (match && op.moves.length > bestLen) { bestOp = op; bestLen = op.moves.length; }
    }
    if (!bestOp) return null;
    const stepOffset = s.moveHistory.length * 4;
    // v1.0.8 PHASE 49: need >= +4 (not just >= stepOffset) — we read
    //   m[stepOffset..stepOffset+3]. The old `>= length` guard allowed
    //   partial reads producing undefined from/to (defended by if(piece)
    //   downstream, but logically wrong).
    if (stepOffset + 4 > bestOp.moves.length) return null;
    const m = bestOp.moves;
    const from = { row: m[stepOffset], col: m[stepOffset + 1] };
    const to = { row: m[stepOffset + 2], col: m[stepOffset + 3] };
    const piece = s.board[from.row][from.col];
    return piece ? { from, to, piece, opening: bestOp } : null;
  }
  // Auto-detect mode: find best matching ECO from move history
  const hist = s.moveHistory || [];
  if (!hist.length) return null;
  const ck = hist.length + ':' + hist.map(h => '' + h.from.row + h.from.col + h.to.row + h.to.col).join(',');
  if (ck === _ecoCacheKey) return _ecoCacheResult;
  _ecoCacheKey = ck;
  // Use hash index to narrow search by first move
  let searchSet = ECO_OPENINGS;
  if (hist.length >= 1 && ecoHashMap) {
    const h0 = hist[0];
    const key = h0.from.row + ',' + h0.from.col + ',' + h0.to.row + ',' + h0.to.col;
    const indexed = ecoHashMap.get(key);
    if (indexed) searchSet = indexed;
  }
  let bestMatch = null, maxLen = 0;
  for (const o of searchSet) {
    const mv = o.moves;
    if (mv.length <= maxLen * 4) continue;
    let match = true;
    for (let i = 0; i < Math.min(hist.length, mv.length / 4); i++) {
      const h = hist[i], j = i * 4;
      if (h.from.row !== mv[j] || h.from.col !== mv[j + 1] || h.to.row !== mv[j + 2] || h.to.col !== mv[j + 3]) { match = false; break; }
    }
    if (match && mv.length / 4 > maxLen) { maxLen = mv.length / 4; bestMatch = o; }
  }
  _ecoCacheResult = bestMatch;
  return bestMatch;
}

function buildEcoHashMap() {
    _ensureEcoParsed();
    ecoHashMap = new Map();
    ecoHashMap2 = new Map();
    ecoHashMap3 = new Map();
    for (const o of ECO_OPENINGS) {
        const mv = o.moves;
        // Level 1: index by first move (4 values)
        if (mv.length >= 4) {
            const key1 = mv[0] + ',' + mv[1] + ',' + mv[2] + ',' + mv[3];
            if (!ecoHashMap.has(key1)) ecoHashMap.set(key1, []);
            ecoHashMap.get(key1).push(o);
        }
        // Level 2: index by first 2 moves (8 values)
        if (mv.length >= 8) {
            const key2 = mv[0] + ',' + mv[1] + ',' + mv[2] + ',' + mv[3] + ',' + mv[4] + ',' + mv[5] + ',' + mv[6] + ',' + mv[7];
            if (!ecoHashMap2.has(key2)) ecoHashMap2.set(key2, []);
            ecoHashMap2.get(key2).push(o);
        }
        // Level 3: index by first 3 moves (12 values)
        if (mv.length >= 12) {
            const key3 = mv.slice(0, 12).join(',');
            if (!ecoHashMap3.has(key3)) ecoHashMap3.set(key3, []);
            ecoHashMap3.get(key3).push(o);
        }
    }
}

function queryECOBookMove(s) {
  _ensureEcoParsed();
  const hist = s.moveHistory || [];
  if (hist.length >= 10) return null;
  // Use multi-depth hash index for faster lookup
  if (!ecoHashMap) buildEcoHashMap();
  const candidates = [];
  let searchSet = ECO_OPENINGS;
  // Try deepest available index level for fastest narrowing
  if (hist.length >= 3 && ecoHashMap3) {
    const k3 = hist.slice(0, 3).map(h => h.from.row + ',' + h.from.col + ',' + h.to.row + ',' + h.to.col).join(',');
    const indexed = ecoHashMap3.get(k3);
    if (indexed) searchSet = indexed;
    else if (ecoHashMap2) {
      const k2 = hist.slice(0, 2).map(h => h.from.row + ',' + h.from.col + ',' + h.to.row + ',' + h.to.col).join(',');
      const idx2 = ecoHashMap2.get(k2);
      if (idx2) searchSet = idx2;
      // v1.0.3-p5 audit FIX: fall through to level-1 index when level-3 and
      // level-2 both miss. Previously this branch ended without checking
      // ecoHashMap, degrading to a full ECO_OPENINGS scan.
      else if (ecoHashMap) {
        const h0 = hist[0];
        const key1 = h0.from.row + ',' + h0.from.col + ',' + h0.to.row + ',' + h0.to.col;
        const idx1 = ecoHashMap.get(key1);
        if (idx1) searchSet = idx1;
      }
    }
  } else if (hist.length >= 2 && ecoHashMap2) {
    const k2 = hist.slice(0, 2).map(h => h.from.row + ',' + h.from.col + ',' + h.to.row + ',' + h.to.col).join(',');
    const indexed = ecoHashMap2.get(k2);
    if (indexed) searchSet = indexed;
  } else if (hist.length >= 1 && ecoHashMap) {
    const h0 = hist[0];
    const key = h0.from.row + ',' + h0.from.col + ',' + h0.to.row + ',' + h0.to.col;
    const indexed = ecoHashMap.get(key);
    if (indexed) searchSet = indexed;
  }
  for (const o of searchSet) {
    const mv = o.moves;
    if (mv.length < hist.length * 4 + 4) continue;
    let match = true;
    for (let i = 0; i < hist.length; i++) {
      const h = hist[i], j = i * 4;
      if (h.from.row !== mv[j] || h.from.col !== mv[j+1] || h.to.row !== mv[j+2] || h.to.col !== mv[j+3]) { match = false; break; }
    }
    if (match) {
      const stepOffset = hist.length * 4;
      const from = { row: mv[stepOffset], col: mv[stepOffset+1] };
      const to = { row: mv[stepOffset+2], col: mv[stepOffset+3] };
      const piece = s.board[from.row][from.col];
      if (piece) candidates.push({ from, to, piece, depth: mv.length / 4 });
    }
  }
  if (!candidates.length) return null;
  // Prefer longer/deeper book lines, with some randomness for variety
  candidates.sort((a, b) => b.depth - a.depth);
  const topN = candidates.slice(0, Math.min(5, candidates.length));
  return topN[secureRandomInt(topN.length)];
}

// ECO Opening Recommendation for player's turn (LRU cache using Map)
let _ecoRecCache=new Map();const _ECO_REC_CACHE_MAX=200;
function getECORecommendation(s){
_ensureEcoParsed();
const hist=s.moveHistory||[];
if(!hist.length)return null;
const ck=hist.map(h=>''+h.from.row+h.from.col+h.to.row+h.to.col).join(',');
// v1.0.5 Round-6 Rev62 (2026.6.27) PERF: refresh LRU order on cache hit.
// Previously, a cache hit returned immediately without delete+re-insert,
// so frequently-accessed entries could be evicted before rarely-accessed
// ones. The tablebase cache (_tbCache) already has this fix applied.
if(_ecoRecCache.has(ck)){const v=_ecoRecCache.get(ck);_ecoRecCache.delete(ck);_ecoRecCache.set(ck,v);return v;}
if(_ecoRecCache.size>=_ECO_REC_CACHE_MAX){const firstKey=_ecoRecCache.keys().next().value;_ecoRecCache.delete(firstKey);}
if(!ecoHashMap)buildEcoHashMap();
// Find matching opening lines that have a next move for the player
const candidates=[];
let searchSet=ECO_OPENINGS;
if(hist.length>=1&&ecoHashMap){
const h0=hist[0];const key=h0.from.row+','+h0.from.col+','+h0.to.row+','+h0.to.col;
const indexed=ecoHashMap.get(key);if(indexed)searchSet=indexed;
}
for(const o of searchSet){
const mv=o.moves;if(mv.length<hist.length*4+4)continue;
let match=true;
for(let i=0;i<hist.length;i++){
const h=hist[i],j=i*4;
if(h.from.row!==mv[j]||h.from.col!==mv[j+1]||h.to.row!==mv[j+2]||h.to.col!==mv[j+3]){match=false;break;}
}
if(match){
const stepOffset=hist.length*4;
const from={row:mv[stepOffset],col:mv[stepOffset+1]};
const to={row:mv[stepOffset+2],col:mv[stepOffset+3]};
const piece=s.board[from.row][from.col];
if(piece?.color===playerColor){
// Lightweight material eval to pick best among multiple paths
let score=0;
const cap=s.board[to.row][to.col];
if(cap)score+=PV[cap.type]||0;
// Center control bonus
if((to.row===3||to.row===4)&&(to.col===3||to.col===4))score+=30;
// Development bonus for minor pieces
if(piece.type==='knight'||piece.type==='bishop')score+=15;
candidates.push({from,to,piece,name:o.id+' '+o.name,score,depth:mv.length/4});
}
}
}
if(!candidates.length){_ecoRecCache.set(ck,null);return null;}
candidates.sort((a,b)=>b.score-a.score);
const best=candidates[0];
// FIX: Detect pawn promotion for correct SAN notation (missing =Q suffix bug)
const isPromo=best.piece.type==='pawn'&&(best.to.row===0||best.to.row===7);
const promoMove=isPromo?{from:best.from,to:best.to,piece:best.piece,promotion:'queen'}:{from:best.from,to:best.to,piece:best.piece};
const notation=moveAlg(s,promoMove,makeMv(s,promoMove));
const result={notation,name:best.name};
_ecoRecCache.set(ck,result);
return result;
}

let _ecoComposing=false;let _ecoSearchFocused=false;let _ecoBlurTimer=0;let ecoSearchTimer=0;let ecoDisplayList=[];let ecoShowCount=30;function setEcoQuery(v){window.ecoSearchQuery=v;ecoShowCount=30;if(ecoSearchTimer)clearTimeout(ecoSearchTimer);if(_ecoComposing){ecoSearchTimer=setTimeout(_ecoUpdateResults,300)}else{ecoSearchTimer=setTimeout(_ecoUpdateResults,80)}}function _ecoUpdateResults(){_ensureEcoParsed();if(!showNewGameDialog)return;const listEl=document.querySelector('.op-list');if(!listEl)return;const el=document.getElementById('ecoSearch');if(el)window.ecoSearchQuery=el.value;const q=(window.ecoSearchQuery||'').trim().toUpperCase();let results=q?searchEco(q):ECO_OPENINGS;const ff=window.ecoFamilyFilter;if(ff)results=results.filter(o=>o.family===ff);ecoDisplayList=results.slice(0,ecoShowCount);let oh='<button class="op-btn'+(!dlgOpeningId?' act':'')+'" onclick="dlgOpeningId=null;window.ecoSearchQuery=\'\';window.ecoFamilyFilter=\'\';ecoShowCount=30;_ecoUpdateResults()"><div class="on">'+T('free_opening')+'</div><div class="os">'+T('from_start')+'</div></button>';for(const o of ecoDisplayList){const isOpen=o.moves&&o.moves.length>=4;oh+=`<button class="op-btn${dlgOpeningId===o.id+'|'+o.name?' act':''}" onclick="dlgOpeningId='${_escJs(o.id)}|${_escJs(o.name)}';ecoShowCount=30;_ecoUpdateResults()"><div class="on">${_esc(o.id)} ${_esc(o.name)}</div>${isOpen?'<div class="os">'+_esc(o.family)+'</div>':''}</button>`}listEl.innerHTML=oh;_ecoRestoreFocus()}function _ecoRestoreFocus(){if(!_ecoSearchFocused)return;const ae=document.activeElement;if(ae&&(ae.tagName==='BUTTON'||ae.tagName==='SELECT'||ae.tagName==='OPTION'))return;const el=document.getElementById('ecoSearch');if(el&&document.activeElement!==el){el.focus();try{const len=el.value.length;el.setSelectionRange(len,len)}catch(e){/* v1.2.1 round-16: setSelectionRange may fail on hidden/disabled inputs — non-critical, user can still type. */console.warn('[ECO] setSelectionRange failed:',e?.message?e.message:e);}}}function _ecoDoSearch(){if(ecoSearchTimer)clearTimeout(ecoSearchTimer);const el=document.getElementById('ecoSearch');if(el){window.ecoSearchQuery=el.value;_ecoComposing=false;if(_ecoBlurTimer){clearTimeout(_ecoBlurTimer);_ecoBlurTimer=0}}_ecoSearchFocused=true;_ecoUpdateResults()}


function posEmoji(ev){if(ev>600)return'🏆';if(ev>350)return'😄';if(ev>150)return'😊';if(ev>50)return'🙂';if(ev>-50)return'😐';if(ev>-150)return'😟';if(ev>-350)return'😰';if(ev>-600)return'😱';return'💀'}

// v1.0.2 FIX: Black-to-move opening move record fix.
//
// When a new game starts with black to move (FEN with 'b' turn, setup mode with
// turn=black, ECO opening with odd move count, or PGN with [FEN "... b ..."]),
// moveRecords=[] is empty. When black's first move is later pushed by executeMove(),
// it lands in moveRecords[0] — which is the WHITE slot — causing black's first move
// to incorrectly appear in white's position in the move history and PGN export.
//
// Fix: At each of the 4 new-game entry points (startGame, _applyImportedFEN,
// exitSetup, importPGN), call this helper AFTER gameState is fully set up and
// BEFORE any move is executed. It prepends a `null` placeholder so that black's
// first move correctly lands in moveRecords[1] (the black slot).
//
// The `null` placeholder renders as "..." (PGN skip marker) in both the UI move
// history and the exported PGN string, correctly indicating that white conceded
// the move (a "give odds" or "black to move" scenario).
//
// The helper is idempotent and only acts on an empty moveRecords — once real
// moves have been pushed, calling it again is a no-op.
function _prependBlackToMovePlaceholder(){
  // Only act when (a) we have a gameState, (b) black is to move, and
  // (c) moveRecords is still empty (no moves executed yet).
  if(gameState?.currentTurn==='black' && moveRecords.length===0){
    moveRecords.push(null);
    // Also sync stateHistory[0].moveRecords so undoing past the first move
    // doesn't lose the placeholder. Without this, undoing all the way back
    // would restore moveRecords=[] — then the next move (black's) would
    // land in the white slot, reintroducing the original bug.
    if(stateHistory.length>0 && stateHistory[0].moveRecords
       && stateHistory[0].moveRecords.length===0){
      stateHistory[0].moveRecords=[null];
    }
  }
}

// ---- Exports ----
// v1.2.1 round-9: Two corrections:
//   1. Added `makeMv` — defined at line 1885, used by ai-bridge.js
//      (lines 1805/2399/2498/2521) and tablebase.js (lines 906/921), but
//      was missing from the export list. In source-module mode this would
//      cause a ReferenceError; in bundled mode build-chess.py strips the
//      `export {}` line so there was no production impact, but the list
//      was incomplete/misleading.
//   2. Removed `fenToState` — it is defined in tablebase.js (line 1729),
//      NOT in this file. It belongs in tablebase.js's export list (added
//      there in this round). The previous entry here was wrong.
// v1.2.3 round-18: Removed `generateFEN`/`uciToCoords`/`_esc` (defined in
//   ai-bridge.js and exported there) and `posDesc` (defined in ui.js and
//   exported there). Exporting symbols not declared in this module is a
//   link-time SyntaxError in source-module mode; bundled mode strips this
//   line so production was unaffected, but the list was misleading.
export {PV,OPP_COLOR,SQ_LIGHT,SQ_DARK,SQ_SEL,LBL_LIGHT,LBL_DARK,LBL_STROKE_LIGHT,LBL_STROKE_DARK,SYM,PN,PN_EN,pieceName,_principlesHTML,KNIGHT_OFFSETS,DIR_ROOK,DIR_BISHOP,DIR_QUEEN,ELO_MATCH,getAI_LEVELS,CELL,REVIEW_CELL,zobrist,initBoard,attacked,initState,validateSetupPosition,cloneB,cloneS,sqAttackedFast,inCheck,pseudoMoves,legalMoves,hasLegalMoves,moveAlg,getCtrlMap,makeMv,makeMvInPlace,unmakeMv,gameStatus,isDeadPosition,winnerLacksMatingMaterial,posAlg,algPos,inB,pieceZobristIdx,computeHash,syncHash,_refreshStateAfterSetup,_recalcCellSize,getEffectiveAILevel,posEmoji,T,toggleLang,_lang,_i18n,_prependBlackToMovePlaceholder,_reattachActiveAnimations,_activeAnimEls,computeVisibleCastleMarks,computeVisibleEpMark};
