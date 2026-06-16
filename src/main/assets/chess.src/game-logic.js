// ===================== MODULE: game-logic =====================
// Pure chess logic — no UI or engine dependencies
// Contains: board representation, move generation, move execution,
// Zobrist hashing, FEN generation, game status, constants
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
function T(key){return _i18n[key]?.[_lang]||_i18n[key]?.zh||key;}
function toggleLang(){_lang=(_lang==='zh')?'en':'zh';try{localStorage.setItem('Regalia_lang',_lang);}catch(e){}try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.saveLangPref)AndroidBridge.saveLangPref(_lang);}catch(e){}render();}
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
'classic_openings':{zh:'经典开局（可选）',en:'Classic Openings'},
'free_opening_btn':{zh:'自由开局',en:'Free Play'},
'from_start':{zh:'从初始局面开始',en:'From starting position'},
'eco_search_ph':{zh:'输入ECO编号或开局名搜索',en:'Search ECO code or name'},
'all_categories':{zh:'所有分类',en:'All Categories'},
'load_more':{zh:'加载更多',en:'Load More'},
'ai_book':{zh:'AI开局库',en:'AI Opening Book'},
'about_title':{zh:'关于 Regalia',en:'About Regalia'},
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
'variation_toggle':{zh:'💬变例',en:'💬Vars'},
'tb_library':{zh:'Syzygy残局库',en:'Syzygy Endgame'},
'tb_query':{zh:'🔭 点击查询残局库',en:'🔭 Query Endgame DB'},
'tb_unavailable':{zh:'🚫 残局库: 暂不可用',en:'🚫 Endgame DB: Unavailable'},
'recommend':{zh:'推荐',en:'Best'},
'depth':{zh:'深度',en:'Depth'},
'nodes':{zh:'节点',en:'Nodes'},
'eval_label':{zh:'评估',en:'Eval'},
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
'about_agpl_desc':{zh:'发布。本项目为 AGPL v3 与 GPL v3 双重许可组合作品：整体同时受两份协议约束，但因 AGPL v3 的网络交互条款（第13条）更为严格，其要求实质上覆盖整个组合作品，确保用户通过网络访问时同样享有获取源代码的权利。',en:'. This project is a combined work under AGPL v3 and GPL v3: the combined work is subject to both licenses, but since AGPL v3 imposes stricter network interaction provisions (Section 13), its requirements effectively cover the entire combination, ensuring users who access the work over a network retain the right to obtain source code.'},
'about_droidfish':{zh:'部分代码源自开源项目 DroidFish (Copyright © Peter Österlund)，采用',en:'Some code derived from DroidFish (Copyright © Peter Österlund), licensed under'},
'about_droidfish_desc':{zh:'协议。涉及引擎管理（Java/C++）、棋局逻辑、PGN解析、引擎通信及UI交互。修改声明已附于相关源文件头部。',en:'. Covers engine management (Java/C++), game logic, PGN parsing, engine communication, and UI interaction. Modifications noted in source file headers.'},
'about_stockfish':{zh:'引擎 Stockfish 由 Stockfish 开源社区开发，采用',en:'Stockfish engine by the Stockfish community, licensed under'},
'about_disclaimer':{zh:'本软件按"原样"提供，不提供任何明示或暗示的保证。详见 AGPL v3 第15-16条。',en:'This software is provided "as is", without warranty. See AGPL v3 Sections 15-16.'},
'about_ai':{zh:'本项目的部分代码由 AI 辅助生成，并已进行人工审查与 AGPL v3 / GPL v3 合规确认。',en:'Some code was AI-assisted and reviewed for AGPL v3 / GPL v3 compliance.'},
'about_gplv3':{zh:'协议',en:'license'},
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
'built_in_only':{zh:'v1.0.0: 仅支持内置引擎',en:'v1.0.0: Built-in engine only'},
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
'built_in':{zh:'内置',en:'Built-in'},
'skill_level_desc':{zh:'降低引擎技术水平（0=最弱，20=最强）',en:'Reduce engine skill (0=weakest, 20=strongest)'},
'skill_elo_note':{zh:'限制Elo开启时，Skill Level由UCI_Elo自动决定',en:'Skill Level auto-set by UCI_Elo when Limit Elo is on'},
'fen_invalid':{zh:'FEN格式无效',en:'Invalid FEN format'},
'paste_fen':{zh:'粘贴FEN字符串:',en:'Paste FEN string:'},
'render_error':{zh:'渲染出错，可以尝试刷新恢复对局',en:'Render error, try refreshing to recover'},
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
'loading_title':{zh:'Regalia v1.0.0',en:'Regalia v1.0.0'},
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
'book':{zh:'标准',en:'Mediocre'},
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
'setup_pawn_on_rank':{zh:'兵不能在第',en:'Pawn cannot be on rank'},
'setup_check_impossible':{zh:'方王处于被将军状态（非法局面）',en:' king is in check (illegal position)'},
'setup_king_count_over':{zh:'方王数量超过1个',en:' king count exceeds 1'},
'setup_piece_over_limit':{zh:'方棋子数超过上限16',en:' piece count exceeds limit of 16'},
'setup_pawn_over_8':{zh:'方兵超过8个',en:' pawns exceed 8'},
'setup_queen_over_9':{zh:'方后超过9个',en:' queens exceed 9'},
'setup_rook_over_10':{zh:'方车超过10个',en:' rooks exceed 10'},
'setup_bishop_over_10':{zh:'方象超过10个',en:' bishops exceed 10'},
'setup_knight_over_10':{zh:'方马超过10个',en:' knights exceed 10'},
'setup_rank':{zh:'行',en:'rank'},
'setup_white':{zh:'白',en:'White'},
'setup_black':{zh:'黑',en:'Black'},
// PGN Import
'import_title':{zh:'导入',en:'Import'},
'paste_fen_opt':{zh:'粘贴FEN（局面文本）',en:'Paste FEN (position text)'},
'paste_pgn_opt':{zh:'粘贴PGN（对局记录）',en:'Paste PGN (game record)'},
'select_pgn_file':{zh:'选择PGN文件',en:'Select PGN File'},
'pgn_imported':{zh:'PGN导入成功',en:'PGN imported'},
'pgn_invalid':{zh:'PGN格式无效',en:'Invalid PGN format'},
'pgn_fen_rejected':{zh:'此输入为FEN格式，请使用「粘贴FEN」按钮导入。PGN导入仅接受完整棋谱文本。',en:'This is FEN format. Please use the "Paste FEN" button instead. PGN import only accepts full game notation.'},
'pgn_paste_hint':{zh:'粘贴PGN棋谱字符串（仅限PGN格式，FEN请使用「粘贴FEN」按钮）',en:'Paste PGN game notation only (for FEN, use "Paste FEN" button)'},
'fen_pgn_paste_label':{zh:'粘贴内容:',en:'Paste content:'},
'confirm_import':{zh:'导入',en:'Import'},
// i18n for game-over checkmate message
'checkmate_excl':{zh:'将杀！',en:'Checkmate! '},
'wins_excl':{zh:'获胜！',en:' wins!'},
'white_short':{zh:'⚪ 白方',en:'⚪ White'},
};
// Auto-detect language on startup
(function(){
  try{const saved=localStorage.getItem('Regalia_lang');if(saved==='zh'||saved==='en'){_lang=saved;return;}}catch(e){}
  try{if(typeof AndroidBridge!=='undefined'&&typeof AndroidBridge.getSystemLanguage==='function'){const sysLang=AndroidBridge.getSystemLanguage();_lang=(sysLang&&sysLang.startsWith('zh'))?'zh':'en';return;}}catch(e){}
  try{const navLang=navigator.language||navigator.userLanguage||'';_lang=navLang.startsWith('zh')?'zh':'en';}catch(e){_lang='zh';}
})();

// ===================== CODE DEDUPLICATION =====================
/**
 * Apply a move to a board array (creates new board, does not mutate original).
 * @param {Array} board - 8x8 board array
 * @param {Object} move - Move object with from, to, piece, captured, etc.
 * @returns {Array} New 8x8 board array with move applied
 */
function _applyMoveToBoard(board, move) {
  const newBoard = board.map(row => row.slice());
  const {from, to, piece} = move;

  // Clear source square
  newBoard[from.row][from.col] = null;

  // Place piece at destination
  newBoard[to.row][to.col] = piece;

  // Handle special moves
  if (move.enPassant) {
    const epRow = piece.color === 'white' ? to.row + 1 : to.row - 1;
    newBoard[epRow][to.col] = null;
  }
  if (move.castling) {
    const rookFromCol = move.castling === 'kingside' ? 7 : 0;
    const rookToCol = move.castling === 'kingside' ? 5 : 3;
    const rook = newBoard[from.row][rookFromCol];
    newBoard[from.row][rookFromCol] = null;
    newBoard[from.row][rookToCol] = rook;
  }
  if (move.promotion) {
    newBoard[to.row][to.col] = {type: move.promotion, color: piece.color};
  }

  return newBoard;
}

window.onerror=function(msg,url,line,col,error){
    const errInfo={
        message:String(msg),
        url:String(url||''),
        line:line||0,
        column:col||0,
        stack:error&&error.stack?String(error.stack):'no stack',
        timestamp:new Date().toISOString(),
        engineReady:typeof _engineReady!=='undefined'?_engineReady:'undefined'
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
function _recalcCellSize(){
  const vw=window.innerWidth;
  const vh=window.innerHeight;
  const isLandscape=vw>vh;
  if(isLandscape){
    // In landscape, board height is the primary constraint.
    // Reserve ~36px for header + 24px for board labels/AI bar + 12px padding = ~72px overhead
    const availH=vh-72;
    const maxByHeight=Math.floor(availH/8);
    // Also check width constraint — board should leave room for the panel (min 200px)
    const availW=vw-200-32; // 200px min panel + 32px padding/gaps
    const maxByWidth=Math.floor(availW/8);
    CELL=Math.max(36,Math.min(maxByHeight,maxByWidth,72)); // Cap at 72px per cell
  }else{
    // Portrait: width is the primary constraint
    const maxVW=Math.min(vw,600);
    const maxByHeight=vh>500?50:vh>420?46:vh>360?42:vh>320?38:36;
    CELL=Math.max(36,Math.min(maxByHeight,Math.floor((maxVW-32)/8)));
  }
  REVIEW_CELL=Math.max(28,Math.round(CELL*0.8));
}
_recalcCellSize();
let _resizeTimer=0;window.addEventListener('resize',()=>{clearTimeout(_resizeTimer);_resizeTimer=setTimeout(()=>{const _oldCell=CELL;_recalcCellSize();if(CELL!==_oldCell)render()},150)});
const KNIGHT_OFFSETS=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const DIR_ROOK=[[0,1],[0,-1],[1,0],[-1,0]];
const DIR_BISHOP=[[1,1],[1,-1],[-1,1],[-1,-1]];
const DIR_QUEEN=[...DIR_ROOK,...DIR_BISHOP];
function posAlg(p){return String.fromCharCode(97+p.col)+(8-p.row)}
function algPos(a){if(!a)return null;
  // Type coercion: if input is a number, try converting to string first
  if(typeof a==='number')a=String(a);
  if(typeof a!=='string'||a.length<2)return null;
  try{const col=a.charCodeAt(0)-97,row=8-parseInt(a[1],10);if(col<0||col>7||isNaN(row)||row<0||row>7)return null;return{row,col}}catch(e){return null}}
function inB(r,c){return r>=0&&r<8&&c>=0&&c<8}

// Animation: cleanup stale elements, cache bwrap ref
let _cachedBwrap=null;
let animationInProgress=false;
let _lastAnimPieceType='';
let _lastAnimTarget=null;
let _lastCaptureFlag=false;
let _lastCheckFlag=false;
// Landing animation: block render() while CSS @keyframes is playing, then auto-render
let _landingAnimActive=false;
let _landingAnimTimer=null;
function _startLandingTimer(pieceType){
if(_landingAnimTimer)clearTimeout(_landingAnimTimer);
const _maxDur=({pawn:600,knight:800,bishop:700,rook:600,queen:800,king:700}[pieceType]||700);
_landingAnimTimer=setTimeout(()=>{_landingAnimActive=false;_landingAnimTimer=null;render();},_maxDur+50);
}
function animateMove(from,to,pieceSym,pieceType,isCapture,isCheck,pieceColor){
animationInProgress=true;
_lastAnimPieceType=pieceType||'pawn';
_lastAnimTarget=null;
_landingAnimActive=false;
if(_landingAnimTimer){clearTimeout(_landingAnimTimer);_landingAnimTimer=null;}
_lastCaptureFlag=!!isCapture;
_lastCheckFlag=!!isCheck;
// Hide source piece during animation (overlay replaces it); also hide captured piece & castling rook
const _srcPc=document.querySelector('.sq[data-r="'+from.row+'"][data-c="'+from.col+'"] .pc');
if(_srcPc)_srcPc.style.opacity='0';
if(isCapture){const _tgtPc=document.querySelector('.sq[data-r="'+to.row+'"][data-c="'+to.col+'"] .pc');if(_tgtPc)_tgtPc.style.opacity='0';}
const bwrap=_cachedBwrap||(_cachedBwrap=document.querySelector('.bwrap'));if(!bwrap||!bwrap.parentNode){_cachedBwrap=null;animationInProgress=false;if(_srcPc)_srcPc.style.opacity='';return;}
// Remove stale animation elements
const oldAnims=bwrap.querySelectorAll('.move-anim');for(let i=0;i<oldAnims.length;i++)oldAnims[i].remove();
const cs=CELL;const _flip=playerColor==='black';
const _fc=_flip?7-from.col:from.col,_fr=_flip?7-from.row:from.row,_tc=_flip?7-to.col:to.col,_tr=_flip?7-to.row:to.row;
const dx=(_tc-_fc)*cs,dy=(_tr-_fr)*cs;
const el=document.createElement('div');el.className='move-anim anim-'+_lastAnimPieceType+(pieceColor==='white'?' w-piece':' bk-piece');
el.textContent=pieceSym;
el.style.cssText='left:'+(_fc*cs)+'px;top:'+(_fr*cs)+'px;width:'+cs+'px;height:'+cs+'px;transform:translate3d(0,0,0);opacity:1;will-change:transform';
bwrap.appendChild(el);
// Castling: also animate the rook
let rookEl=null;
const isCastling=pieceType==='king'&&Math.abs(to.col-from.col)===2;
if(isCastling&&pieceColor){
let rFromCol,rToCol;
if(to.col===6){rFromCol=7;rToCol=5;}else if(to.col===2){rFromCol=0;rToCol=3;}
if(rFromCol!=null){
// Hide castling rook at source during animation
const _srcRookPc=document.querySelector('.sq[data-r="'+from.row+'"][data-c="'+rFromCol+'"] .pc');
if(_srcRookPc)_srcRookPc.style.opacity='0';
const rFrom={row:from.row,col:rFromCol},rTo={row:from.row,col:rToCol};
const _rfc=_flip?7-rFrom.col:rFrom.col,_rfr=_flip?7-rFrom.row:rFrom.row,_rtc=_flip?7-rTo.col:rTo.col,_rtr=_flip?7-rTo.row:rTo.row;
rookEl=document.createElement('div');rookEl.className='move-anim anim-rook'+(pieceColor==='white'?' w-piece':' bk-piece');
rookEl.textContent=SYM[pieceColor].rook;
rookEl.style.cssText='left:'+(_rfc*cs)+'px;top:'+(_rfr*cs)+'px;width:'+cs+'px;height:'+cs+'px;transform:translate3d(0,0,0);opacity:1;will-change:transform';
// Compute rook deltas here alongside rookEl creation (cleaner than separate block)
rookEl._rdx=(_rtc-_rfc)*cs;rookEl._rdy=(_rtr-_rfr)*cs;
bwrap.appendChild(rookEl);
}
}
const durations={pawn:240,knight:300,bishop:270,rook:240,queen:320,king:270};
const dur=durations[_lastAnimPieceType]||240;
let _animDone=false;
function _finishAnim(){
if(_animDone)return;_animDone=true;
el.remove();if(rookEl)rookEl.remove();animationInProgress=false;_lastAnimTarget={row:to.row,col:to.col};
if(_lastCaptureFlag){
const sq=document.querySelector(`.sq[data-r="${to.row}"][data-c="${to.col}"]`);
if(sq)sq.classList.add('capture-flash');setTimeout(()=>{if(sq)sq.classList.remove('capture-flash')},1200);
}
if(_lastCheckFlag){
const ck=gameState.currentTurn==='white'?gameState.wk:gameState.bk;
if(ck){const ksq=document.querySelector(`.sq[data-r="${ck.row}"][data-c="${ck.col}"]`);if(ksq)ksq.classList.add('in-check')}
}
}
el.addEventListener('transitionend',function(e){if(e.propertyName==='transform')_finishAnim()},{once:true});
requestAnimationFrame(()=>{
el.style.transform='translate3d('+dx+'px,'+dy+'px,0)';
if(rookEl)rookEl.style.transform='translate3d('+rookEl._rdx+'px,'+rookEl._rdy+'px,0)';
});
setTimeout(_finishAnim,dur+60);
}

function initBoard(){const b=Array.from({length:8},()=>Array(8).fill(null));const backRank=['rook','knight','bishop','queen','king','bishop','knight','rook'];for(let c=0;c<8;c++){b[0][c]={type:backRank[c],color:'black'};b[1][c]={type:'pawn',color:'black'};b[6][c]={type:'pawn',color:'white'};b[7][c]={type:backRank[c],color:'white'}}return b}
// Returns all squares this piece attacks
function attacked(board,pos){const b=board,p=b[pos.row][pos.col];if(!p)return[];const r=pos.row,c=pos.col,co=p.color,mv=[];if(p.type==='pawn'){const d=co==='white'?-1:1;for(const dc of[-1,1])if(inB(r+d,c+dc))mv.push({row:r+d,col:c+dc})}else if(p.type==='knight'){for(const[dr,dc]of KNIGHT_OFFSETS)if(inB(r+dr,c+dc))mv.push({row:r+dr,col:c+dc})}else if(p.type==='king'){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&inB(r+dr,c+dc))mv.push({row:r+dr,col:c+dc})}else{const dirs=p.type==='rook'?DIR_ROOK:p.type==='bishop'?DIR_BISHOP:DIR_QUEEN;for(const[dr,dc]of dirs){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){mv.push({row:nr,col:nc});if(b[nr][nc])break;nr+=dr;nc+=dc}}}return mv}
function initState(){const s={board:initBoard(),currentTurn:'white',castlingRights:{whiteKingside:true,whiteQueenside:true,blackKingside:true,blackQueenside:true},enPassantTarget:null,halfMoveClock:0,fullMoveNumber:1,moveHistory:[],posCount:new Map(),wk:{row:7,col:4},bk:{row:0,col:4},hash:0};syncHash(s);s.posCount.set(s.hash,1);return s}
function validateSetupPosition(s){for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=s.board[r][c];if(p&&p.type==='king'){if(p.color==='white')s.wk={row:r,col:c};else s.bk={row:r,col:c}}}const errs=[];const wPieces=[],bPieces=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=s.board[r][c];if(p){if(p.color==='white')wPieces.push(p);else bPieces.push(p)}}const wk=s.wk,bk=s.bk;const wKingCount=wPieces.filter(p=>p.type==='king').length,bKingCount=bPieces.filter(p=>p.type==='king').length;if(wKingCount===0)errs.push(T('setup_no_white_king'));if(bKingCount===0)errs.push(T('setup_no_black_king'));if(wKingCount>1)errs.push(T('setup_white')+T('setup_king_count_over'));if(bKingCount>1)errs.push(T('setup_black')+T('setup_king_count_over'));if(wk&&bk&&Math.abs(wk.row-bk.row)<=1&&Math.abs(wk.col-bk.col)<=1)errs.push(T('setup_kings_adjacent'));const nonMoveColor=OPP_COLOR[s.currentTurn];const nonMoveKing=nonMoveColor==='white'?s.wk:s.bk;if(nonMoveKing&&inCheck(s.board,nonMoveColor,nonMoveKing))errs.push((nonMoveColor==='white'?T('setup_white'):T('setup_black'))+T('setup_check_impossible'));for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=s.board[r][c];if(p&&p.type==='pawn'){if(p.color==='white'&&r===0)errs.push(T('setup_white')+T('setup_pawn_on_rank')+'1'+T('setup_rank')+'('+posAlg({row:r,col:c})+')');if(p.color==='black'&&r===7)errs.push(T('setup_black')+T('setup_pawn_on_rank')+'8'+T('setup_rank')+'('+posAlg({row:r,col:c})+')')}}if(wPieces.length>16)errs.push(T('setup_white')+T('setup_piece_over_limit'));if(bPieces.length>16)errs.push(T('setup_black')+T('setup_piece_over_limit'));if(wPieces.filter(p=>p.type==='pawn').length>8)errs.push(T('setup_white')+T('setup_pawn_over_8'));if(bPieces.filter(p=>p.type==='pawn').length>8)errs.push(T('setup_black')+T('setup_pawn_over_8'));if(wPieces.filter(p=>p.type==='queen').length>9)errs.push(T('setup_white')+T('setup_queen_over_9'));if(bPieces.filter(p=>p.type==='queen').length>9)errs.push(T('setup_black')+T('setup_queen_over_9'));if(wPieces.filter(p=>p.type==='rook').length>10)errs.push(T('setup_white')+T('setup_rook_over_10'));if(bPieces.filter(p=>p.type==='rook').length>10)errs.push(T('setup_black')+T('setup_rook_over_10'));if(wPieces.filter(p=>p.type==='bishop').length>10)errs.push(T('setup_white')+T('setup_bishop_over_10'));if(bPieces.filter(p=>p.type==='bishop').length>10)errs.push(T('setup_black')+T('setup_bishop_over_10'));if(wPieces.filter(p=>p.type==='knight').length>10)errs.push(T('setup_white')+T('setup_knight_over_10'));if(bPieces.filter(p=>p.type==='knight').length>10)errs.push(T('setup_black')+T('setup_knight_over_10'));return errs}
// Piece objects are immutable (makeMv creates new objects for promotions)
// Only clone array structure — reduces 64 object copies to 8 array slices per clone
function cloneB(b){return b.map(r=>r.slice())}
// posCount deep-copied for search correctness
function cloneS(s){return{board:cloneB(s.board),currentTurn:s.currentTurn,castlingRights:{...s.castlingRights},enPassantTarget:s.enPassantTarget?{...s.enPassantTarget}:null,halfMoveClock:s.halfMoveClock,fullMoveNumber:s.fullMoveNumber,// moveHistory: deep-copied to prevent shared-reference corruption
// (makeMvInPlace pushes to existing array, unmakeMv truncates it — sharing by reference
// would silently corrupt the original state's moveHistory)
moveHistory:s.moveHistory?s.moveHistory.slice():[],posCount:new Map(s.posCount),wk:s.wk?{...s.wk}:null,bk:s.bk?{...s.bk}:null,hash:s.hash||0}}

function sqAttackedFast(b,pos,byCo){if(!b||!pos||!inB(pos.row,pos.col))return false;const r=pos.row,c=pos.col;const pd=byCo==='white'?1:-1;if(inB(r+pd,c-1)&&b[r+pd][c-1]&&b[r+pd][c-1].color===byCo&&b[r+pd][c-1].type==='pawn')return true;if(inB(r+pd,c+1)&&b[r+pd][c+1]&&b[r+pd][c+1].color===byCo&&b[r+pd][c+1].type==='pawn')return true;for(const[dr,dc]of KNIGHT_OFFSETS){if(inB(r+dr,c+dc)&&b[r+dr][c+dc]&&b[r+dr][c+dc].color===byCo&&b[r+dr][c+dc].type==='knight')return true}for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;if(inB(r+dr,c+dc)&&b[r+dr][c+dc]&&b[r+dr][c+dc].color===byCo&&b[r+dr][c+dc].type==='king')return true}for(const[dr,dc]of DIR_ROOK){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){const p=b[nr][nc];if(p){if(p.color===byCo&&(p.type==='rook'||p.type==='queen'))return true;break}nr+=dr;nc+=dc}}for(const[dr,dc]of DIR_BISHOP){let nr=r+dr,nc=c+dc;while(inB(nr,nc)){const p=b[nr][nc];if(p){if(p.color===byCo&&(p.type==='bishop'||p.type==='queen'))return true;break}nr+=dr;nc+=dc}}return false}
/**
 * Check if the given color's king is in check.
 * @param {Array} b - 8x8 board array
 * @param {string} co - Color to check ('white' or 'black')
 * @param {Object|null} kPos - King position override {row, col}, or null to find king
 * @returns {boolean} True if the king is in check
 */
function inCheck(b,co,kPos=null){const k=kPos;return k?sqAttackedFast(b,k,OPP_COLOR[co]):false}
function pseudoMoves(s,pos){const b=s.board,p=b[pos.row][pos.col];if(!p)return[];const r=pos.row,c=pos.col,co=p.color,mv=[],opp=OPP_COLOR[co],pr=co==='white'?0:7,d=co==='white'?-1:1;
if(p.type==='pawn'){
if(inB(r+d,c)&&!b[r+d][c]){if(r+d===pr)for(const pt of['queen','rook','bishop','knight'])mv.push({row:r+d,col:c,promotion:pt});else{mv.push({row:r+d,col:c});if(r===(co==='white'?6:1)&&!b[r+2*d][c])mv.push({row:r+2*d,col:c})}}
for(const dc of[-1,1])if(inB(r+d,c+dc)){if(b[r+d][c+dc]&&b[r+d][c+dc].color!==co){if(r+d===pr)for(const pt of['queen','rook','bishop','knight'])mv.push({row:r+d,col:c+dc,promotion:pt});else mv.push({row:r+d,col:c+dc})}if(s.enPassantTarget&&s.enPassantTarget.row===r+d&&s.enPassantTarget.col===c+dc)mv.push({row:r+d,col:c+dc})}}
else if(p.type==='knight'){for(const[dr,dc]of KNIGHT_OFFSETS)if(inB(r+dr,c+dc)&&(!b[r+dr][c+dc]||b[r+dr][c+dc].color!==co))mv.push({row:r+dr,col:c+dc})}
else if(p.type==='king'){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&inB(r+dr,c+dc)&&(!b[r+dr][c+dc]||b[r+dr][c+dc].color!==co))mv.push({row:r+dr,col:c+dc});const hr=co==='white'?7:0;if(r===hr&&c===4){const cr=s.castlingRights;if(cr[co+'Kingside']&&!b[hr][5]&&!b[hr][6]&&b[hr][7]&&b[hr][7].type==='rook'&&b[hr][7].color===co&&!sqAttackedFast(b,{row:hr,col:4},opp)&&!sqAttackedFast(b,{row:hr,col:5},opp)&&!sqAttackedFast(b,{row:hr,col:6},opp))mv.push({row:hr,col:6});if(cr[co+'Queenside']&&!b[hr][3]&&!b[hr][2]&&!b[hr][1]&&b[hr][0]&&b[hr][0].type==='rook'&&b[hr][0].color===co&&!sqAttackedFast(b,{row:hr,col:4},opp)&&!sqAttackedFast(b,{row:hr,col:3},opp)&&!sqAttackedFast(b,{row:hr,col:2},opp))mv.push({row:hr,col:2})}}
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
      if(p&&p.color===s.currentTurn){
        const pm=pseudoMoves(s,{row:r,col:c});
        for(const m of pm){
          const mv={from:{row:r,col:c},to:m,piece:p,promotion:m.promotion};
          const undo=makeMvInPlace(s,mv);
          if(!undo)continue;
          const kPos=p.type==='king'?{row:m.row,col:m.col}:s[p.color==='white'?'wk':'bk'];
          const isLegal=kPos?!inCheck(s.board,p.color,kPos):false;
          unmakeMv(s,undo);
          if(isLegal)all.push(mv);
        }
      }
    }
    return all;
  }
  const pm=pseudoMoves(s,pos),p=s.board[pos.row][pos.col];if(!p)return[];const legal=[];for(const m of pm){const mv={from:{row:pos.row,col:pos.col},to:m,piece:p,promotion:m.promotion};const undo=makeMvInPlace(s,mv);if(!undo)continue;const kPos=p.type==='king'?{row:m.row,col:m.col}:s[p.color==='white'?'wk':'bk'];const isLegal=kPos?!inCheck(s.board,p.color,kPos):false;unmakeMv(s,undo);if(isLegal)legal.push(m)}return legal}
// Fast game-over check: returns true as soon as ONE legal move is found
function hasLegalMoves(s){for(let r=0;r<8;r++){for(let c=0;c<8;c++){const p=s.board[r][c];if(p&&p.color===s.currentTurn){const pm=pseudoMoves(s,{row:r,col:c});for(const m of pm){const mv={from:{row:r,col:c},to:m,piece:p,promotion:m.promotion};const undo=makeMvInPlace(s,mv);if(!undo)continue;const kPos=p.type==='king'?{row:m.row,col:m.col}:s[p.color==='white'?'wk':'bk'];const legal=kPos?!inCheck(s.board,p.color,kPos):false;unmakeMv(s,undo);if(legal)return true}}}}return false}
// Move execution
/**
 * Apply a move to a game state, returning a new state (immutable).
 * @param {Object} s - Current game state
 * @param {Object} mv - Move object with from, to, piece, promotion, etc.
 * @returns {Object} New game state with the move applied
 */
function makeMv(s,mv){const ns=cloneS(s);const{from,to,piece,promotion}=mv;if(!piece||!ns.board[from.row]||!ns.board[from.row][from.col])return ns;const capPiece=ns.board[to.row][to.col];ns.board[to.row][to.col]=ns.board[from.row][from.col];ns.board[from.row][from.col]=null;
if(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col){const cr=piece.color==='white'?to.row+1:to.row-1;const epP=ns.board[cr][to.col];if(epP&&epP.type==='pawn'&&epP.color!==piece.color){ns.board[cr][to.col]=null}else if(epP){console.error('[En Passant Bug] Target set but captured piece is not an opposing pawn:',epP)}}
if(piece.type==='king'&&Math.abs(to.col-from.col)===2){if(to.col===6){ns.board[from.row][5]=ns.board[from.row][7];ns.board[from.row][7]=null}if(to.col===2){ns.board[from.row][3]=ns.board[from.row][0];ns.board[from.row][0]=null}}
if(promotion)ns.board[to.row][to.col]={type:promotion,color:piece.color};
if(piece.type==='king'){if(piece.color==='white'){ns.wk={row:to.row,col:to.col};ns.castlingRights.whiteKingside=false;ns.castlingRights.whiteQueenside=false}else{ns.bk={row:to.row,col:to.col};ns.castlingRights.blackKingside=false;ns.castlingRights.blackQueenside=false}}
if(piece.type==='rook'){if(from.row===7&&from.col===0)ns.castlingRights.whiteQueenside=false;if(from.row===7&&from.col===7)ns.castlingRights.whiteKingside=false;if(from.row===0&&from.col===0)ns.castlingRights.blackQueenside=false;if(from.row===0&&from.col===7)ns.castlingRights.blackKingside=false}
if(capPiece&&capPiece.type==='rook'){if(capPiece.color==='white'){if(to.row===7&&to.col===0)ns.castlingRights.whiteQueenside=false;if(to.row===7&&to.col===7)ns.castlingRights.whiteKingside=false}else{if(to.row===0&&to.col===0)ns.castlingRights.blackQueenside=false;if(to.row===0&&to.col===7)ns.castlingRights.blackKingside=false}}
if(piece.type==='pawn'&&Math.abs(to.row-from.row)===2){const epRow=(from.row+to.row)/2;const opp=OPP_COLOR[piece.color];const pd=opp==='white'?1:-1;let _epH=false;for(const dc of[-1,1]){const cr=epRow+pd,cc=from.col+dc;if(inB(cr,cc)&&ns.board[cr][cc]&&ns.board[cr][cc].type==='pawn'&&ns.board[cr][cc].color===opp){_epH=true;break;}}ns.enPassantTarget=_epH?{row:epRow,col:from.col}:null;}else{ns.enPassantTarget=null;}
const cap=!!capPiece||(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col);ns.halfMoveClock=(piece.type==='pawn'||cap)?0:ns.halfMoveClock+1;if(piece.color==='black')ns.fullMoveNumber++;
ns.currentTurn=OPP_COLOR[ns.currentTurn];ns.moveHistory=[...s.moveHistory,{from,to,piece,promotion}];
// Incremental Zobrist hash update
let h=typeof s.hash==='number'?s.hash:computeHash(s);
// 1. Remove piece from from-square
h^=zobrist.pieceTable[from.row*8+from.col][pieceZobristIdx(piece)];
// 2. Remove captured piece at to-square if any
const captured=s.board[to.row][to.col];
if(captured)h^=zobrist.pieceTable[to.row*8+to.col][pieceZobristIdx(captured)];
// 3. Place piece (or promoted piece) at to-square
const placedPiece=promotion?{type:promotion,color:piece.color}:piece;
h^=zobrist.pieceTable[to.row*8+to.col][pieceZobristIdx(placedPiece)];
// 4. En passant capture: remove captured pawn (with defensive check)
if(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col){const cr=piece.color==='white'?to.row+1:to.row-1;const epPiece={type:'pawn',color:OPP_COLOR[piece.color]};const epP=s.board[cr][to.col];if(epP&&epP.type==='pawn'&&epP.color!==piece.color){h^=zobrist.pieceTable[cr*8+to.col][pieceZobristIdx(epPiece)]};}
// 5. Castling: move rook
if(piece.type==='king'&&Math.abs(to.col-from.col)===2){const rookColor=piece.color;const rookIdx=pieceZobristIdx({type:'rook',color:rookColor});if(to.col===6){h^=zobrist.pieceTable[from.row*8+7][rookIdx];h^=zobrist.pieceTable[from.row*8+5][rookIdx];}if(to.col===2){h^=zobrist.pieceTable[from.row*8+0][rookIdx];h^=zobrist.pieceTable[from.row*8+3][rookIdx];}}
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
if(!piece||!s.board[from.row]||!s.board[from.row][from.col])return null;
const capPiece=s.board[to.row][to.col];
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
promotion:promotion||null,
oldMoveHistoryLength:s.moveHistory?s.moveHistory.length:0,
isBlackMove:piece.color==='black'
};
// 1. Move piece
s.board[to.row][to.col]=s.board[from.row][from.col];
s.board[from.row][from.col]=null;
// 2. En passant capture
if(piece.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col){
const cr=piece.color==='white'?to.row+1:to.row-1;
const epP=s.board[cr][to.col];
if(epP&&epP.type==='pawn'&&epP.color!==piece.color){
undo.epCaptured={r:cr,c:to.col,piece:{type:epP.type,color:epP.color}};
s.board[cr][to.col]=null;
}
}
// 3. Castling: move rook
if(piece.type==='king'&&Math.abs(to.col-from.col)===2){
if(to.col===6){s.board[from.row][5]=s.board[from.row][7];s.board[from.row][7]=null;undo.castlingRook={from:{r:from.row,c:7},to:{r:from.row,c:5}}}
if(to.col===2){s.board[from.row][3]=s.board[from.row][0];s.board[from.row][0]=null;undo.castlingRook={from:{r:from.row,c:0},to:{r:from.row,c:3}}}
}
// 4. Promotion
if(promotion)s.board[to.row][to.col]={type:promotion,color:piece.color};
// 5. Update king position + castling rights
if(piece.type==='king'){
if(piece.color==='white'){s.wk={row:to.row,col:to.col};s.castlingRights.whiteKingside=false;s.castlingRights.whiteQueenside=false}
else{s.bk={row:to.row,col:to.col};s.castlingRights.blackKingside=false;s.castlingRights.blackQueenside=false}
}
// 6. Update castling rights for rook moves
if(piece.type==='rook'){
if(from.row===7&&from.col===0)s.castlingRights.whiteQueenside=false;
if(from.row===7&&from.col===7)s.castlingRights.whiteKingside=false;
if(from.row===0&&from.col===0)s.castlingRights.blackQueenside=false;
if(from.row===0&&from.col===7)s.castlingRights.blackKingside=false;
}
// 7. Update castling rights for rook captures
if(capPiece&&capPiece.type==='rook'){
if(capPiece.color==='white'){if(to.row===7&&to.col===0)s.castlingRights.whiteQueenside=false;if(to.row===7&&to.col===7)s.castlingRights.whiteKingside=false}
else{if(to.row===0&&to.col===0)s.castlingRights.blackQueenside=false;if(to.row===0&&to.col===7)s.castlingRights.blackKingside=false}
}
// 8. Set en passant target (only if an enemy pawn can actually capture)
const oldEP=s.enPassantTarget;
if(piece.type==='pawn'&&Math.abs(to.row-from.row)===2){const epRow=(from.row+to.row)/2;const opp=OPP_COLOR[piece.color];const pd=opp==='white'?1:-1;let _epHasCapturer=false;for(const dc of[-1,1]){const cr=epRow+pd,cc=from.col+dc;if(inB(cr,cc)&&s.board[cr][cc]&&s.board[cr][cc].type==='pawn'&&s.board[cr][cc].color===opp){_epHasCapturer=true;break;}}s.enPassantTarget=_epHasCapturer?{row:epRow,col:from.col}:null;}else{s.enPassantTarget=null;}
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
// Castling hash
if(piece.type==='king'&&Math.abs(to.col-from.col)===2){
const rookIdx=pieceZobristIdx({type:'rook',color:piece.color});
if(to.col===6){h^=zobrist.pieceTable[from.row*8+7][rookIdx];h^=zobrist.pieceTable[from.row*8+5][rookIdx];}
if(to.col===2){h^=zobrist.pieceTable[from.row*8+0][rookIdx];h^=zobrist.pieceTable[from.row*8+3][rookIdx];}
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
// Restore moved piece (original piece, not promoted)
s.board[f.r][f.c]={...undo.piece};
// Restore captured piece at destination
if(undo.capPiece)s.board[t.r][t.c]={...undo.capPiece};else s.board[t.r][t.c]=null;
// Restore en passant captured piece
if(undo.epCaptured){const ep=undo.epCaptured;s.board[ep.r][ep.c]={...ep.piece};}
// Restore castling rook
if(undo.castlingRook){const cr=undo.castlingRook;s.board[cr.from.r][cr.from.c]=s.board[cr.to.r][cr.to.c];s.board[cr.to.r][cr.to.c]=null;}
// 3. Restore king positions
s.wk=undo.oldWk?{row:undo.oldWk.r,col:undo.oldWk.c}:null;
s.bk=undo.oldBk?{row:undo.oldBk.r,col:undo.oldBk.c}:null;
// 4. Restore all other fields
s.castlingRights={...undo.oldCastling};
s.enPassantTarget=undo.oldEnPassant?{row:undo.oldEnPassant.r,col:undo.oldEnPassant.c}:null;
s.halfMoveClock=undo.oldHalfMove;
s.fullMoveNumber=undo.oldFullMove;
s.hash=undo.oldHash;
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
function isDeadPosition(s){
const pcs=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=s.board[r][c];if(p)pcs.push({type:p.type,color:p.color,row:r,col:c})}
// K vs K
if(pcs.length===2)return true;
const wP=pcs.filter(p=>p.color==='white');
const bP=pcs.filter(p=>p.color==='black');
const wT=wP.map(p=>p.type),bT=bP.map(p=>p.type);
// Helper: does this side have only king + at most one minor piece?
const onlyKingMinor=(types)=>{const nonKing=types.filter(t=>t!=='king');return nonKing.length===0||(nonKing.length===1&&(nonKing[0]==='bishop'||nonKing[0]==='knight'))};
// K+minor vs K (either side)
if(onlyKingMinor(wT)&&onlyKingMinor(bT)){
  // Both sides have at most K+minor: check specific combinations
  const wN=wT.filter(t=>t!=='king'),bN=bT.filter(t=>t!=='king');
  // K vs K
  if(wN.length===0&&bN.length===0)return true;
  // K+minor vs K
  if(wN.length===0||bN.length===0)return true;
  // K+B vs K+B: draw only if bishops on same square color
  if(wN.length===1&&bN.length===1&&wN[0]==='bishop'&&bN[0]==='bishop'){
    const wB=wP.find(p=>p.type==='bishop'),bB=bP.find(p=>p.type==='bishop');
    if(((wB.row+wB.col)%2)===((bB.row+bB.col)%2))return true;
  }
  return false; // K+N vs K+B, K+N vs K+N, etc. — checkmate possible
}
// K+B+B(same color) vs K — two same-color bishops cannot force checkmate
for(const co of['white','black']){
  const side=co==='white'?wP:bP,opp=co==='white'?bP:wP;
  if(opp.length===1&&side.length===3){
    const bishops=side.filter(p=>p.type==='bishop');
    if(bishops.length===2&&((bishops[0].row+bishops[0].col)%2)===((bishops[1].row+bishops[1].col)%2))return true;
  }
}
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
if(piece.type==='king'&&Math.abs(to.col-from.col)===2){n=to.col===6?'O-O':'O-O-O'}else{
if(piece.type!=='pawn'){
n+=piece.type==='knight'?'N':piece.type[0].toUpperCase();
// Disambiguation: find all same-type, same-color pieces with legal moves to same target
// Uses pseudoMoves + board clone + inCheck filter (same as legalMoves but cheaper per candidate)
let numSameTarget=0,numSameFile=0,numSameRow=0;
for(let r=0;r<8;r++)for(let c=0;c<8;c++){if(r===from.row&&c===from.col)continue;const p=s.board[r][c];if(p&&p.type===piece.type&&p.color===piece.color){const pm=pseudoMoves(s,{row:r,col:c});if(pm.some(m=>m.row===to.row&&m.col===to.col)){const b2=cloneB(s.board);b2[to.row][to.col]=b2[r][c];b2[r][c]=null;if(p.type==='pawn'&&s.enPassantTarget&&to.row===s.enPassantTarget.row&&to.col===s.enPassantTarget.col){const cr=p.color==='white'?to.row+1:to.row-1;b2[cr][to.col]=null}if(p.type==='king'&&Math.abs(to.col-c)===2){if(to.col===6){b2[r][5]=b2[r][7];b2[r][7]=null}else if(to.col===2){b2[r][3]=b2[r][0];b2[r][0]=null}}const kPos=p.type==='king'?{row:to.row,col:to.col}:(p.color==='white'?s.wk:s.bk);if(kPos&&!inCheck(b2,p.color,kPos)){numSameTarget++;if(c===from.col)numSameFile++;if(r===from.row)numSameRow++;}}}}
// PGN standard disambiguation: file first, then rank, then both
if(numSameTarget>0){if(numSameFile===0)n+=String.fromCharCode(97+from.col);else if(numSameRow===0)n+=(8-from.row);else n+=String.fromCharCode(97+from.col)+(8-from.row)}
}
if(piece.type==='pawn'&&isCap)n+=String.fromCharCode(97+from.col);if(isCap)n+='x';n+=posAlg(to);if(promotion)n+='='+(promotion==='knight'?'N':promotion[0].toUpperCase())}
if(setupMode)return n;
// Check/checkmate suffix: use actual post-move state when available (avoids manual board
// construction bugs — missing posCount, stale castlingRights, etc.)
const ps=postState;
if(ps){const opp=OPP_COLOR[piece.color];const kPos=opp==='white'?ps.wk:ps.bk;if(kPos&&inCheck(ps.board,opp,kPos)){n+=hasLegalMoves(ps)?'+':'#'}}
return n}
function getCtrlMap(b){const cm=[];for(let r=0;r<8;r++){cm[r]=[];for(let c=0;c<8;c++)cm[r][c]={white:[],black:[]}}
for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(p){const atks=attacked(b,{row:r,col:c});for(const a of atks){cm[a.row][a.col][p.color].push({piece:p,position:{row:r,col:c}})}
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
function pieceZobristIdx(p){
  const typeIdx={pawn:0,knight:1,bishop:2,rook:3,queen:4,king:5}[p.type];
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

// Recompute castling rights from board position (used after setup mode edits)
function recomputeCastlingRights(s){
s.castlingRights={whiteKingside:false,whiteQueenside:false,blackKingside:false,blackQueenside:false};
if(s.board[7]&&s.board[7][4]&&s.board[7][4].type==='king'&&s.board[7][4].color==='white'&&s.board[7][7]&&s.board[7][7].type==='rook'&&s.board[7][7].color==='white')s.castlingRights.whiteKingside=true;
if(s.board[7]&&s.board[7][4]&&s.board[7][4].type==='king'&&s.board[7][4].color==='white'&&s.board[7][0]&&s.board[7][0].type==='rook'&&s.board[7][0].color==='white')s.castlingRights.whiteQueenside=true;
if(s.board[0]&&s.board[0][4]&&s.board[0][4].type==='king'&&s.board[0][4].color==='black'&&s.board[0][7]&&s.board[0][7].type==='rook'&&s.board[0][7].color==='black')s.castlingRights.blackKingside=true;
if(s.board[0]&&s.board[0][4]&&s.board[0][4].type==='king'&&s.board[0][4].color==='black'&&s.board[0][0]&&s.board[0][0].type==='rook'&&s.board[0][0].color==='black')s.castlingRights.blackQueenside=true;
}

// Refresh game state after setup mode piece placement
function _refreshStateAfterSetup(s){
s.wk=null;s.bk=null;s.enPassantTarget=null;
for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=s.board[r][c];if(p){if(p.type==='king'&&p.color==='white')s.wk={row:r,col:c};if(p.type==='king'&&p.color==='black')s.bk={row:r,col:c};}}
recomputeCastlingRights(s);
syncHash(s);
}

// NOTE: All position evaluation comes exclusively from Stockfish18. No JS-side eval code.


function _requestStockfishMove(){
// Try ECO book move first for instant opening play (only if player enabled it)
if(useBookMoves){
try{
const bookMove=queryECOBookMove(gameState);
if(bookMove){isAIThinking=false;_aiBarInfo='';if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}executeMove(bookMove.from,bookMove.to,bookMove.promotion);return;}
}catch(e){console.error('ECO book move lookup error:',e);}
}
if(typeof AndroidBridge!=='undefined'&&AndroidBridge.isEngineReady()){
const fen=generateFEN(gameState);
// After startGame()/importFEN(), first engineGo must include ucinewgame
// atomically on the SAME Java thread to prevent command interleaving
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
hintText='';isHintLoading=false;_hintBarInfo='';_ponderGen++;_ponderBarInfo='';_ponderMoveSAN='';_pendingPonderMoveUCI=null;
aiThinkInfo=T('thinking');_aiBarInfo=T('thinking');_updateAIThinkDisplay();
// Lightweight UI update: avoid full render() which would destroy the landing animation.
// _updateAIThinkDisplay() handles the "思考中..." indicator.
// Full render is deferred until _startLandingTimer completes or AI responds.
if(!_landingAnimActive)render();
// Safety timeout: if engine doesn't respond within 15s, reset AI state and retry
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
},15000);
_aiSafetyTimerId=_aiSafetyTimer;
_currentAiRequestId=++_aiMoveRequestId;
setTimeout(()=>{
// P0 FIX: Validate state freshness — game may have changed during 0ms delay
if(gameOver||reviewMode||setupMode||gameState.currentTurn===playerColor||!isAIThinking)return;
// Level 7: probe tablebase for endgame positions (7 pieces or fewer) before Stockfish
if(aiLevel===7&&pieceCountLE7(gameState.board)){
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
if(coords&&_tbSavedBoard[coords.from.row]&&_tbSavedBoard[coords.from.row][coords.from.col]){
isAIThinking=false;_aiBarInfo='';if(_aiSafetyTimerId){clearTimeout(_aiSafetyTimerId);_aiSafetyTimerId=null;}
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
    if (stepOffset >= bestOp.moves.length) return null;
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
    if (mv.length <= hist.length * 4) continue;
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
  return topN[Math.floor(Math.random() * topN.length)];
}

// ECO Opening Recommendation for player's turn (LRU cache using Map)
let _ecoRecCache=new Map();const _ECO_REC_CACHE_MAX=200;
function getECORecommendation(s){
_ensureEcoParsed();
const hist=s.moveHistory||[];
if(!hist.length)return null;
const ck=hist.map(h=>''+h.from.row+h.from.col+h.to.row+h.to.col).join(',');
if(_ecoRecCache.has(ck))return _ecoRecCache.get(ck);if(_ecoRecCache.size>=_ECO_REC_CACHE_MAX){const firstKey=_ecoRecCache.keys().next().value;_ecoRecCache.delete(firstKey);}
if(!ecoHashMap)buildEcoHashMap();
// Find matching opening lines that have a next move for the player
const candidates=[];
let searchSet=ECO_OPENINGS;
if(hist.length>=1&&ecoHashMap){
const h0=hist[0];const key=h0.from.row+','+h0.from.col+','+h0.to.row+','+h0.to.col;
const indexed=ecoHashMap.get(key);if(indexed)searchSet=indexed;
}
for(const o of searchSet){
const mv=o.moves;if(mv.length<=hist.length*4)continue;
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
if(piece&&piece.color===playerColor){
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

let _ecoComposing=false;let _ecoSearchFocused=false;let _ecoBlurTimer=0;let ecoSearchTimer=0;let ecoDisplayList=[];let ecoShowCount=30;function setEcoQuery(v){window.ecoSearchQuery=v;ecoShowCount=30;if(ecoSearchTimer)clearTimeout(ecoSearchTimer);if(_ecoComposing){ecoSearchTimer=setTimeout(_ecoUpdateResults,300)}else{ecoSearchTimer=setTimeout(_ecoUpdateResults,80)}}function _ecoUpdateResults(){_ensureEcoParsed();if(!showNewGameDialog)return;const listEl=document.querySelector('.op-list');if(!listEl)return;const el=document.getElementById('ecoSearch');if(el)window.ecoSearchQuery=el.value;const q=(window.ecoSearchQuery||'').trim().toUpperCase();let results=q?searchEco(q):ECO_OPENINGS;const ff=window.ecoFamilyFilter;if(ff)results=results.filter(o=>o.family===ff);ecoDisplayList=results.slice(0,ecoShowCount);let oh='<button class="op-btn'+(!dlgOpeningId?' act':'')+'" onclick="dlgOpeningId=null;window.ecoSearchQuery=\'\';window.ecoFamilyFilter=\'\';ecoShowCount=30;_ecoUpdateResults()"><div class="on">'+T('free_opening')+'</div><div class="os">'+T('from_start')+'</div></button>';for(const o of ecoDisplayList){const isOpen=o.moves&&o.moves.length>=4;oh+=`<button class="op-btn${dlgOpeningId===o.id+'|'+o.name?' act':''}" onclick="dlgOpeningId='${_escJs(o.id)}|${_escJs(o.name)}';ecoShowCount=30;_ecoUpdateResults()"><div class="on">${_esc(o.id)} ${_esc(o.name)}</div>${isOpen?'<div class="os">'+_esc(o.family)+'</div>':''}</button>`}listEl.innerHTML=oh;_ecoRestoreFocus()}function _ecoRestoreFocus(){if(!_ecoSearchFocused)return;const ae=document.activeElement;if(ae&&(ae.tagName==='BUTTON'||ae.tagName==='SELECT'||ae.tagName==='OPTION'))return;const el=document.getElementById('ecoSearch');if(el&&document.activeElement!==el){el.focus();try{const len=el.value.length;el.setSelectionRange(len,len)}catch(e){}}}function _ecoDoSearch(){if(ecoSearchTimer)clearTimeout(ecoSearchTimer);const el=document.getElementById('ecoSearch');if(el){window.ecoSearchQuery=el.value;_ecoComposing=false;if(_ecoBlurTimer){clearTimeout(_ecoBlurTimer);_ecoBlurTimer=0}}_ecoSearchFocused=true;_ecoUpdateResults()}


function posEmoji(ev){if(ev>600)return'🏆';if(ev>350)return'😄';if(ev>150)return'😊';if(ev>50)return'🙂';if(ev>-50)return'😐';if(ev>-150)return'😟';if(ev>-350)return'😰';if(ev>-600)return'😱';return'💀'}

// ---- Exports ----
export {PV,OPP_COLOR,SQ_LIGHT,SQ_DARK,SQ_SEL,LBL_LIGHT,LBL_DARK,LBL_STROKE_LIGHT,LBL_STROKE_DARK,SYM,PN,PN_EN,pieceName,_principlesHTML,KNIGHT_OFFSETS,DIR_ROOK,DIR_BISHOP,DIR_QUEEN,ELO_MATCH,getAI_LEVELS,CELL,REVIEW_CELL,zobrist,initBoard,attacked,initState,validateSetupPosition,cloneB,cloneS,sqAttackedFast,inCheck,pseudoMoves,legalMoves,hasLegalMoves,moveAlg,getCtrlMap,makeMvInPlace,unmakeMv,gameStatus,isDeadPosition,_applyMoveToBoard,generateFEN,uciToCoords,fenToState,_esc,posAlg,algPos,inB,pieceZobristIdx,computeHash,syncHash,recomputeCastlingRights,_refreshStateAfterSetup,_recalcCellSize,getEffectiveAILevel,posEmoji,posDesc,T,toggleLang,_lang,_i18n};
