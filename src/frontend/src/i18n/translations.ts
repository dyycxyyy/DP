/**
 * Bilingual translation dictionary for the 博弈终端 (Arena Terminal).
 *
 * `zh` is the default and the source of truth for key coverage; `en` must
 * mirror every key. Values may contain `{name}` placeholders that callers
 * interpolate through `t(key, { name: value })`.
 *
 * Keep keys flat and namespaced with dots (`header.round`, `bet.submit`) so a
 * missing key is obvious at the call site and greppable in one pass.
 */
export const translations = {
  zh: {
    // ---- App / shell ----
    "app.name": "博弈终端",
    "app.tagline": "实时开奖 · 众筹定号",
    "app.live": "实时",
    "app.offline": "离线",
    "app.round": "第 {round} 局",
    "app.roundShort": "第 {round} 局",
    "app.loading": "加载中…",

    // ---- Navigation ----
    "nav.arena": "对局",
    "nav.crowdfund": "众筹",
    "nav.ranking": "排行",
    "nav.exchange": "兑换",
    "nav.guide": "玩法",
    "nav.admin": "管理",
    "nav.history": "历史对局",
    "nav.primary": "主导航",

    // ---- Guide ----
    "guide.title": "玩法说明",
    "guide.defaultText":
      "开奖号码不是外部随机源，而是所有玩家行为的实时聚合结果：投注改变总奖池，众筹改变众筹总额，两者共同决定 7 位开奖号码。\n\n投注：每位选择 0-9 的数字，每注 1 Lucky，费用全部进入总奖池。复式投注可一次覆盖多个组合。\n\n众筹：为第 1-3 位分别众筹，某数字累计达到 100,000 Lucky 即锁定该位中奖数字；众筹费用不退，归入国库。\n\n开奖：第 1-3 位由众筹结果决定，第 4-5 位取总奖池末两位，第 6-7 位取众筹总额末两位。\n\n奖金：一至六等奖按 7/6/5/4/3/2 位匹配分别平分总奖池的 10%/8%/7%/6%/5%/4%，单注奖金按中奖注数平分并向下取整。\n\n每局约 10 分钟：前 5 分钟投注，前 8 分钟众筹，随后开奖与派奖并立即进入下一局。",

    // ---- Personal center ----
    "personalCenter.title": "个人中心",
    "personalCenter.subtitle": "钱包 · 个人面板 · 语言",
    "personalCenter.signedInAs": "已登录",
    "personalCenter.signOut": "退出登录",
    "personalCenter.signOutHint": "退出后需重新登录才能投注、众筹与兑换",
    "personalCenter.back": "返回对局",
    "personalCenter.language": "界面语言",
    "personalCenter.languageHint": "切换后全站文案立即更新，并记住你的选择",

    // ---- Language ----
    "lang.label": "语言",
    "lang.zh": "中",
    "lang.en": "EN",
    "lang.switchTo": "切换到{lang}",

    // ---- Auth ----
    "auth.login": "登录",
    "auth.loggingIn": "登录中…",
    "auth.signInToSubmit": "请先登录以提交",
    "auth.signInToBet": "请先登录以投注",
    "auth.signInToExchange": "请先登录以兑换",
    "auth.signInToDev": "请先登录以使用测试面板",
    "auth.signInToViewWallet": "请先登录以查看账户余额",
    "auth.signInAction": "登录",
    "auth.signInHint": "登录后即可投注、众筹与兑换",
    "auth.required": "此操作需要登录",

    // ---- Header / status strip ----
    "header.round": "局",
    "header.countdown": "阶段倒计时",
    "header.balance": "我的 Lucky",
    "header.phase": "阶段",

    // ---- Phases ----
    "phase.betting": "投注中",
    "phase.crowdfunding": "众筹中",
    "phase.drawing": "开奖中",
    "phase.payout": "派奖中",
    "phase.betting.short": "投注",
    "phase.crowdfunding.short": "众筹",
    "phase.drawing.short": "开奖",
    "phase.payout.short": "派奖",
    "phase.betting.desc": "选择 7 位号码下注，每注 1 Lucky 全部进入总奖池",
    "phase.crowdfunding.desc":
      "为第 1-3 位众筹，先达到 100,000 Lucky 的数字锁定中奖号码",
    "phase.drawing.desc": "正在依据公开数据生成第 1-7 位开奖号码",
    "phase.payout.desc": "正在结算各档奖金并派发至中奖账户",

    // ---- Draw panel ----
    "draw.title": "开奖号码",
    "draw.drawn": "已开奖",
    "draw.locking": "众筹锁定中",
    "draw.totalPool": "总奖池",
    "draw.crowdfundTotal": "众筹总额",
    "draw.winningNumber": "第 {round} 局开奖号码",
    "draw.position": "第 {position} 位",
    "draw.revealed": "开奖",
    "draw.locked": "锁定",
    "draw.pending": "待定",

    // ---- Bet form ----
    "bet.title": "投注",
    "bet.phaseClosed": "当前非投注阶段，投注已关闭",
    "bet.roundStopped": "本局已停止，暂不接受投注与众筹",
    "bet.ticketCount": "总注数",
    "bet.totalCost": "总费用",
    "bet.clear": "清空选择",
    "bet.fill": "每位全选",
    "bet.validation": "请为全部 7 位各选择至少 1 个数字",
    "bet.balanceError":
      "余额不足：需要 {required} Lucky，可用 {available} Lucky",
    "bet.cooldown": "冷却中，{seconds} 秒后可操作",
    "bet.submitting": "提交中…",
    "bet.submit": "提交投注 · {cost} Lucky",
    "bet.success": "已提交 {count} 注，扣除 {cost} Lucky",

    // ---- Crowdfund ----
    "crowdfund.title": "众筹面板 · 第 1-3 位",
    "crowdfund.description":
      "某数字累计达到 100,000 Lucky 即锁定该位中奖数字；锁定后仍可众筹，费用归国库但不改变结果。",
    "crowdfund.locked": "已锁定 {digit}",
    "crowdfund.leading": "领先 {digit}",
    "crowdfund.peak": "峰值 {amount}",
    "crowdfund.contribute": "众筹",
    "crowdfund.amountPlaceholder": "金额 1 ~ 100,000",
    "crowdfund.amountError": "单次金额需为 1 ~ 100,000 的整数",
    "crowdfund.balanceError": "余额不足：可用 {available} Lucky",
    "crowdfund.success": "已为第 {position} 位数字 {digit} 众筹 {amount} Lucky",
    "crowdfund.digitAria":
      "为第 {position} 位数字 {digit} 众筹，当前 {amount} Lucky",
    "crowdfund.sheetTitle": "众筹金额",
    "crowdfund.sheetTarget": "第 {position} 位 · 数字 {digit}",
    "crowdfund.sheetBalance": "可用余额 {available} Lucky",
    "crowdfund.sheetSubmit": "确认众筹",
    "crowdfund.sheetSubmitting": "提交中…",
    "crowdfund.sheetClose": "关闭",
    "crowdfund.selectPosition": "选择众筹位置",
    "crowdfund.positionTabAria": "选择第 {position} 位众筹",
    "crowdfund.digitPadHint": "点击数字为第 {position} 位众筹",

    // ---- Exchange ----
    "exchange.title": "代币兑换",
    "exchange.description":
      "全天候运行，不受局时间线与 3 秒冷却限制 · 固定汇率 1 ICP = 1000 Lucky",
    "exchange.icpToLucky": "ICP → Lucky",
    "exchange.luckyToIcp": "Lucky → ICP",
    "exchange.icpLabel": "兑换 ICP（0.1 ~ 10,000，0.1 的整倍数）",
    "exchange.luckyLabel": "兑换 Lucky（1000 的整倍数，上限 10,000,000）",
    "exchange.expected": "预计获得",
    "exchange.fee": "手续费 3%",
    "exchange.actual": "实际兑换",
    "exchange.icpError": "金额需为 0.1 ~ 10,000 ICP 且为 0.1 的整倍数",
    "exchange.icpPoolError": "兑换池 ICP 不足：可用 {available} ICP",
    "exchange.luckyError": "金额需为 1000 的整倍数且不超过 10,000,000",
    "exchange.luckyBalanceError": "余额不足：可用 {available} Lucky",
    "exchange.luckyPoolError": "兑换池 Lucky 不足：可用 {available} Lucky",
    "exchange.submitting": "兑换中…",
    "exchange.submitToLucky": "兑换为 Lucky",
    "exchange.submitToIcp": "兑换为 ICP",
    "exchange.poolTitle": "兑换池与国库",
    "exchange.poolLucky": "兑换池 Lucky",
    "exchange.poolIcp": "兑换池 ICP",
    "exchange.treasury": "国库余额",
    "exchange.successIcp": "已兑换 {icp} ICP → {lucky} Lucky",
    "exchange.successLucky":
      "已兑换 {lucky} Lucky → {icp} ICP（手续费 {fee} Lucky）",

    // ---- Wallet ----
    "wallet.title": "我的账户",
    "wallet.luckyBalance": "Lucky 余额",
    "wallet.identity": "行为身份",
    "wallet.rate": "固定汇率",
    "wallet.icpBalance": "ICP 余额",
    "wallet.icpFee": "账本手续费",
    "wallet.receiveTitle": "接收 ICP",
    "wallet.receiveHint": "向此地址转入 ICP，到账需等待账本确认。",
    "wallet.depositAddress": "充值地址",
    "wallet.copyAddress": "复制地址",
    "wallet.copied": "地址已复制",
    "wallet.copyFailed": "复制失败，请手动选择地址",
    "wallet.sendIcpTitle": "转出 ICP",
    "wallet.sendLuckyTitle": "Lucky 转账",
    "wallet.recipientLabel": "收款 principal",
    "wallet.recipientPlaceholder": "输入收款 principal",
    "wallet.icpAmountLabel": "金额（ICP）",
    "wallet.luckyAmountLabel": "金额（Lucky）",
    "wallet.icpAmountPlaceholder": "0.0",
    "wallet.luckyAmountPlaceholder": "0",
    "wallet.sendIcp": "转出 ICP",
    "wallet.sendLucky": "转出 Lucky",
    "wallet.sending": "提交中…",
    "wallet.recipientError": "收款地址无效，请输入合法的 principal",
    "wallet.selfTransferError": "不能转账给自己",
    "wallet.icpAmountError": "金额需大于 0 且不超过可用余额（含手续费）",
    "wallet.luckyAmountError": "金额需大于 0 且不超过可用余额",
    "wallet.icpFeeNote": "另需支付账本手续费 {fee} ICP",
    "wallet.icpSuccess": "已转出 {amount} ICP",
    "wallet.luckySuccess": "已转出 {amount} Lucky",
    "wallet.luckyLedgerSuccess":
      "已转出 {amount} Lucky · 账本区块 #{blockIndex}",
    "wallet.luckyLedgerError": "账本转账失败：{reason}",
    "wallet.luckyLedgerInsufficient": "账本余额不足：可用 {available} Lucky",
    "wallet.ledgerBalanceLabel": "账本余额",
    "wallet.transfersTitle": "最近转账",
    "wallet.transfersEmpty": "暂无转账记录",
    "wallet.transfersEmptyHint": "充值或转出后将在此显示记录",
    "wallet.directionIn": "转入",
    "wallet.directionOut": "转出",
    "wallet.statusPending": "确认中",
    "wallet.statusCompleted": "已完成",
    "wallet.statusFailed": "失败",

    // ---- Profile ----
    "profile.title": "个人面板",
    "profile.identityLabel": "行为身份标签",
    "profile.tab.bets": "投注记录 ({count})",
    "profile.tab.wins": "中奖记录 ({count})",
    "profile.betsEmpty": "暂无投注记录",
    "profile.winsEmpty": "暂无中奖记录",
    "profile.betMeta": "第 {round} 局 · {time}",
    "profile.winMeta": "第 {round} 局 · {tier} · {time}",
    "profile.tickets": "{count} 注",
    "profile.loadMore": "加载更多",

    // ---- Top bets ----
    "topbets.title": "投注次数前 10",
    "topbets.empty": "本局暂无投注",
    "topbets.emptyHint": "成为第一个下注的玩家，占据榜首",
    "topbets.tickets": "注",

    // ---- Draw basis ----
    "basis.title": "开奖依据公示",
    "basis.description":
      "第 1-3 位由众筹结果决定，第 4-5 位取总奖池末两位，第 6-7 位取众筹总额末两位。",
    "basis.crowdfundResult": "众筹结果",
    "basis.crowdfundLocked": "第 {position} 位众筹锁定数字 {digit}",
    "basis.crowdfundLeading": "第 {position} 位众筹领先数字 {digit}",
    "basis.poolLastTwo": "总奖池末两位",
    "basis.poolDetail": "总奖池 {pool} → 末两位 {lastTwo}",
    "basis.crowdfundLastTwo": "众筹总额末两位",
    "basis.crowdfundDetail": "众筹总额 {total} → 末两位 {lastTwo}",
    "basis.tiers": "各档派奖",
    "basis.tiersEmpty": "本局尚未开奖，派奖明细将在开奖后公示",
    "basis.tier": "奖项",
    "basis.winningTickets": "中奖注数",
    "basis.payoutPerTicket": "单注奖金",
    "basis.distributed": "实际派发",
    "basis.myWinnings": "我的本期中奖",
    "basis.myTier": "我的最高奖项",
    "basis.noWin": "未中奖",
    "basis.winningLine": "第 {round} 局开奖号码",

    // ---- History ----
    "history.title": "历史对局",
    "history.recent": "最近 20 期",
    "history.list": "对局列表",
    "history.empty": "暂无历史对局",
    "history.emptyHint": "完成第一局后将在此展示开奖号码与派奖数据",
    "history.round": "第 {round} 局",
    "history.totalPool": "总奖池",
    "history.crowdfundTotal": "众筹总额",
    "history.distributed": "派发总额",
    "history.selectHint": "选择一期对局查看详情",
    "history.back": "返回最新",

    // ---- Dev panel ----
    "dev.title": "管理员测试面板",
    "dev.description":
      "仅管理员可见。用于注入测试余额与快进对局周期，验证众筹阈值与完整开奖流程。",
    "dev.seedTitle": "注入测试余额",
    "dev.seedPlaceholder": "自定义 Lucky 数量",
    "dev.seed": "注入",
    "dev.seedSuccess": "已注入 {amount} Lucky 测试余额",
    "dev.elapsedTitle": "设置本局进度",
    "dev.elapsedBetting": "投注结束 · 5 分钟",
    "dev.elapsedCrowdfund": "众筹结束 · 8 分钟",
    "dev.elapsedFull": "整局结束 · 10 分钟",
    "dev.elapsedSuccess": "已将本局进度设为「{label}」",
    "dev.advance": "快进当前局至开奖",
    "dev.advancing": "快进中…",
    "dev.advanceSuccess": "已快进当前局，开奖结果将自动刷新",

    // ---- Admin console ----
    "admin.title": "超级管理员控制台",
    "admin.subtitle": "仅管理员角色可访问 · 操作不可撤销",
    "admin.noPermission":
      "当前账户没有管理员权限。管理员由平台分配 Admin 角色；首位管理员通过部署时的管理员令牌登录引导，之后管理员可提升或降级其他用户。",
    "admin.signInRequired":
      "请先登录管理员账户以访问管理控制台。首位管理员通过部署时的管理员令牌登录引导。",
    "admin.round.title": "对局控制",
    "admin.round.status": "本局状态",
    "admin.round.running": "本局进行中，正常接受投注与众筹",
    "admin.round.stopped": "本局已停止，不再接受投注与众筹",
    "admin.round.stop": "停止下一局",
    "admin.round.resume": "恢复本局",
    "admin.round.stopSuccess": "已停止本局，投注与众筹已关闭",
    "admin.round.resumeSuccess": "已恢复本局，投注与众筹重新开放",
    "admin.withdraw.title": "提取代币",
    "admin.withdraw.amountLabel": "提取数量",
    "admin.withdraw.amountPlaceholder": "输入数量",
    "admin.withdraw.recipientLabel": "收款 principal",
    "admin.withdraw.recipientPlaceholder": "输入收款 principal",
    "admin.withdraw.submit": "提取",
    "admin.withdraw.submitting": "提取中…",
    "admin.withdraw.success": "已提取 {amount} 到指定地址",
    "admin.pool.prizePool": "总奖池",
    "admin.pool.treasury": "国库",
    "admin.pool.exchangeLucky": "兑换池 Lucky",
    "admin.pool.exchangeIcp": "兑换池 ICP",
    "admin.reset.title": "重置游戏数据",
    "admin.reset.description":
      "将清空奖池、国库、兑换池、玩家余额与历史记录等全部游戏数据，操作不可恢复。",
    "admin.reset.action": "重置游戏数据",
    "admin.reset.confirm": "确认重置（不可恢复）",
    "admin.reset.cancel": "取消",
    "admin.reset.success": "游戏数据已重置",
    "admin.stats.title": "每日统计",
    "admin.stats.description":
      "按 UTC 日期统计每日投注总额、奖项支出总额与国库收入，无数据的日期显示为零。",
    "admin.stats.fromLabel": "起始日期",
    "admin.stats.toLabel": "结束日期",
    "admin.stats.apply": "查询",
    "admin.stats.rangeHint": "选择起止日期后查询该区间的每日数据",
    "admin.stats.rangeError": "起始日期不能晚于结束日期",
    "admin.stats.preset7": "近 7 天",
    "admin.stats.preset30": "近 30 天",
    "admin.stats.date": "日期",
    "admin.stats.totalBets": "投注总额",
    "admin.stats.totalPayouts": "奖项支出",
    "admin.stats.treasuryIncome": "国库收入",
    "admin.stats.empty": "该区间暂无统计数据",
    "admin.stats.emptyHint": "调整日期区间后重新查询",
    "admin.stats.loading": "统计加载中…",
    "admin.stats.error": "统计数据加载失败，请重试",
    "admin.stats.retry": "重试",
    "admin.stats.dayCount": "共 {count} 天",
    "admin.stats.zero": "0",

    // ---- Admin user management ----
    "admin.users.title": "用户管理",
    "admin.users.description":
      "列出所有已登录用户及其当前角色。可将普通用户提升为管理员，或将管理员降级为普通用户。",
    "admin.users.identity": "身份标识",
    "admin.users.role": "角色",
    "admin.users.actions": "操作",
    "admin.users.roleAdmin": "管理员",
    "admin.users.roleUser": "普通用户",
    "admin.users.roleGuest": "访客",
    "admin.users.you": "（我）",
    "admin.users.promote": "提升为管理员",
    "admin.users.demote": "降级为普通用户",
    "admin.users.promoting": "提升中…",
    "admin.users.demoting": "降级中…",
    "admin.users.promoteSuccess": "已将该用户提升为管理员",
    "admin.users.demoteSuccess": "已将该用户降级为普通用户",
    "admin.users.error": "角色变更失败，请重试",
    "admin.users.loading": "用户列表加载中…",
    "admin.users.empty": "暂无已登录用户",
    "admin.users.emptyHint": "用户首次登录后将自动出现在此列表",
    "admin.users.count": "共 {count} 位用户",
    "admin.users.retry": "重试",

    // ---- Admin token panel ----
    "admin.token.title": "Lucky 代币",
    "admin.token.description":
      "Lucky 是应用内账本代币。此处展示代币元数据与当前总量，并可由管理员铸造新代币。",
    "admin.token.name": "名称",
    "admin.token.symbol": "符号",
    "admin.token.decimals": "小数位",
    "admin.token.totalSupply": "当前总量",
    "admin.token.fee": "转账手续费",
    "admin.token.logoAlt": "{symbol} 代币图标",
    "admin.token.loading": "代币信息加载中…",
    "admin.token.error": "代币信息加载失败，请重试",
    "admin.token.retry": "重试",
    "admin.token.mintTitle": "铸造代币",
    "admin.token.mintHint":
      "向指定 principal 铸造 Lucky。可选填写 subaccount（64 位十六进制），留空则铸造到默认账户。",
    "admin.token.ownerLabel": "目标 principal",
    "admin.token.ownerPlaceholder": "输入目标 principal",
    "admin.token.subaccountLabel": "Subaccount（可选）",
    "admin.token.subaccountPlaceholder": "64 位十六进制，留空为默认账户",
    "admin.token.amountLabel": "铸造数量",
    "admin.token.amountPlaceholder": "输入 Lucky 数量",
    "admin.token.mint": "铸造",
    "admin.token.minting": "铸造中…",
    "admin.token.ownerError": "目标 principal 无效，请输入合法的 principal",
    "admin.token.subaccountError": "Subaccount 需为 64 位十六进制字符",
    "admin.token.amountError": "铸造数量需为大于 0 的整数",
    "admin.token.mintSuccess":
      "已铸造 {amount} Lucky · 区块 #{blockIndex} · 新总量 {totalSupply}",
    "admin.token.mintError": "铸造失败，请重试",
    "admin.token.ledgerTitle": "最近交易",
    "admin.token.ledgerDescription": "账本最近 {count} 条交易记录，最新在前。",
    "admin.token.ledgerEmpty": "暂无交易记录",
    "admin.token.ledgerEmptyHint": "铸造或转账后将在此显示记录",
    "admin.token.ledgerLoading": "交易记录加载中…",
    "admin.token.ledgerError": "交易记录加载失败，请重试",
    "admin.token.ledgerRetry": "重试",
    "admin.token.colIndex": "区块",
    "admin.token.colKind": "类型",
    "admin.token.colFrom": "来源",
    "admin.token.colTo": "去向",
    "admin.token.colAmount": "数量",
    "admin.token.colTime": "时间",
    "admin.token.kindMint": "铸造",
    "admin.token.kindTransfer": "转账",
    "admin.token.kindTransferFrom": "授权转账",
    "admin.token.kindApprove": "授权",
    "admin.token.systemAccount": "系统",

    // ---- Guide editing ----
    "guide.edit.action": "编辑玩法说明",
    "guide.edit.title": "编辑玩法说明",
    "guide.edit.hint": "支持多段文本与换行，保存后所有用户立即可见。",
    "guide.edit.placeholder": "输入玩法说明内容…",
    "guide.edit.save": "保存",
    "guide.edit.saving": "保存中…",
    "guide.edit.cancel": "取消",
    "guide.edit.success": "玩法说明已保存",
    "guide.edit.empty": "尚未设置玩法说明，当前显示默认内容。",
    "guide.edit.default": "默认玩法说明",

    // ---- Identity ----
    "identity.player": "普通玩家",
    "identity.player.desc": "常规参与者",
    "identity.manipulator": "操纵者",
    "identity.manipulator.desc": "大额众筹影响开奖",
    "identity.conspirator": "合谋者",
    "identity.conspirator.desc": "多账户协同下注",

    // ---- Tiers ----
    "tier.7": "七位全中",
    "tier.6": "六位",
    "tier.5": "五位",
    "tier.4": "四位",
    "tier.3": "三位",
    "tier.2": "二位",
    "tier.1": "一位",
    "tier.other": "{tier} 位",

    // ---- Errors ----
    "error.insufficientBalance":
      "余额不足：需要 {required} Lucky，当前可用 {available} Lucky",
    "error.invalidPosition": "无效的位置，仅支持第 1-3 位众筹",
    "error.poolInsufficient": "{token} 池余额不足，当前可用 {available}",
    "error.invalidBetNumber": "号码无效：请为 7 位各选择至少 1 个数字",
    "error.amountTooLarge": "金额超出上限，单次最多 {max}",
    "error.amountTooSmall": "金额低于下限，单次最少 {min}",
    "error.rateLimited": "操作过于频繁，请等待 {seconds} 秒",
    "error.phaseClosed": "当前处于{current}阶段，该操作需要{required}阶段",
    "error.invalidAmount": "金额必须为 {step} 的整数倍",
    "error.roundNotFound": "未找到第 {round} 局的开奖记录",
    "error.ledgerUnavailable": "账本暂时不可用，请稍后重试",
    "error.invalidRecipient": "收款地址无效，请输入合法的 principal",
    "error.notRegistered": "请先登录后再操作",
    "error.roundStopped": "本局已停止，暂不接受投注与众筹",
    "error.generic": "操作失败，请稍后重试",

    // ---- Footer ----
    "footer.rate": "固定汇率",
    "footer.schedule": "每局约 10 分钟 · 前 5 分钟投注 · 前 8 分钟众筹",
    "footer.builtWith": "© {year}. Built with love using caffeine.ai",

    // ---- Common ----
    "common.placeholder": "—",
    "common.lucky": "Lucky",
    "common.icp": "ICP",
    "common.seconds": "{seconds} 秒",
  },

  en: {
    // ---- App / shell ----
    "app.name": "Arena Terminal",
    "app.tagline": "Live draws · Crowdfunded digits",
    "app.live": "LIVE",
    "app.offline": "OFFLINE",
    "app.round": "Round {round}",
    "app.roundShort": "R{round}",
    "app.loading": "Loading…",

    // ---- Navigation ----
    "nav.arena": "Arena",
    "nav.crowdfund": "Crowdfund",
    "nav.ranking": "Ranking",
    "nav.exchange": "Exchange",
    "nav.guide": "Guide",
    "nav.admin": "Admin",
    "nav.history": "History",
    "nav.primary": "Primary navigation",

    // ---- Guide ----
    "guide.title": "How to Play",
    "guide.defaultText":
      "The winning number is not an external random source — it is the real-time aggregate of every player's actions: betting changes the total pool, crowdfunding changes the crowdfund total, and together they determine all 7 winning digits.\n\nBetting: pick a digit 0-9 for each position; every ticket costs 1 Lucky and all fees enter the total pool. A complex bet covers many combinations in one submission.\n\nCrowdfunding: fund positions 1-3 independently; a digit that accumulates 100,000 Lucky locks that position's winning digit. Crowdfunding fees are non-refundable and go to the treasury.\n\nDraw: digits 1-3 come from the crowdfunding result, digits 4-5 from the last two digits of the total pool, and digits 6-7 from the last two digits of the crowdfund total.\n\nPrizes: tiers 1-6 split 10%/8%/7%/6%/5%/4% of the total pool by 7/6/5/4/3/2 matched digits, and each ticket's prize is split by the number of winning tickets and rounded down.\n\nA round runs about 10 minutes: betting for the first 5, crowdfunding for the first 8, then the draw and payout, with the next round starting immediately.",

    // ---- Personal center ----
    "personalCenter.title": "Personal Center",
    "personalCenter.subtitle": "Wallet · Profile · Language",
    "personalCenter.signedInAs": "Signed in",
    "personalCenter.signOut": "Sign out",
    "personalCenter.signOutHint":
      "Sign in again to bet, crowdfund and exchange",
    "personalCenter.back": "Back to arena",
    "personalCenter.language": "Interface language",
    "personalCenter.languageHint":
      "Switching updates all copy instantly and remembers your choice",

    // ---- Language ----
    "lang.label": "Language",
    "lang.zh": "中",
    "lang.en": "EN",
    "lang.switchTo": "Switch to {lang}",

    // ---- Auth ----
    "auth.login": "Sign in",
    "auth.loggingIn": "Signing in…",
    "auth.signInToSubmit": "Sign in to submit",
    "auth.signInToBet": "Sign in to place a bet",
    "auth.signInToExchange": "Sign in to exchange",
    "auth.signInToDev": "Sign in to use the test panel",
    "auth.signInToViewWallet": "Sign in to view your balance",
    "auth.signInAction": "Sign in",
    "auth.signInHint": "Sign in to bet, crowdfund and exchange",
    "auth.required": "Sign in required",

    // ---- Header / status strip ----
    "header.round": "Round",
    "header.countdown": "Phase countdown",
    "header.balance": "My Lucky",
    "header.phase": "Phase",

    // ---- Phases ----
    "phase.betting": "Betting",
    "phase.crowdfunding": "Crowdfunding",
    "phase.drawing": "Drawing",
    "phase.payout": "Payout",
    "phase.betting.short": "Bet",
    "phase.crowdfunding.short": "Crowd",
    "phase.drawing.short": "Draw",
    "phase.payout.short": "Pay",
    "phase.betting.desc":
      "Pick 7 digits to bet; every 1 Lucky ticket feeds the total prize pool",
    "phase.crowdfunding.desc":
      "Crowdfund positions 1-3; the first digit to reach 100,000 Lucky locks the winning number",
    "phase.drawing.desc":
      "Generating winning digits 1-7 from the published public data",
    "phase.payout.desc": "Settling each prize tier and paying out winners",

    // ---- Draw panel ----
    "draw.title": "Winning Number",
    "draw.drawn": "Drawn",
    "draw.locking": "Locking via crowdfund",
    "draw.totalPool": "Total Pool",
    "draw.crowdfundTotal": "Crowdfund Total",
    "draw.winningNumber": "Round {round} winning number",
    "draw.position": "Pos {position}",
    "draw.revealed": "Drawn",
    "draw.locked": "Locked",
    "draw.pending": "Pending",

    // ---- Bet form ----
    "bet.title": "Bet",
    "bet.phaseClosed": "Betting is closed outside the betting phase",
    "bet.roundStopped":
      "This round is stopped and is not accepting bets or crowdfunding",
    "bet.ticketCount": "Tickets",
    "bet.totalCost": "Total Cost",
    "bet.clear": "Clear selection",
    "bet.fill": "Select all digits",
    "bet.validation": "Pick at least 1 digit for each of the 7 positions",
    "bet.balanceError":
      "Insufficient balance: need {required} Lucky, {available} available",
    "bet.cooldown": "Cooling down, ready in {seconds}s",
    "bet.submitting": "Submitting…",
    "bet.submit": "Submit bet · {cost} Lucky",
    "bet.success": "Submitted {count} tickets, charged {cost} Lucky",

    // ---- Crowdfund ----
    "crowdfund.title": "Crowdfund · Positions 1-3",
    "crowdfund.description":
      "A digit that accumulates 100,000 Lucky locks that position's winning digit; crowdfunding stays open afterwards, but the fee goes to the treasury without changing the result.",
    "crowdfund.locked": "Locked {digit}",
    "crowdfund.leading": "Leading {digit}",
    "crowdfund.peak": "Peak {amount}",
    "crowdfund.contribute": "Fund",
    "crowdfund.amountPlaceholder": "Amount 1 ~ 100,000",
    "crowdfund.amountError": "Amount must be an integer from 1 to 100,000",
    "crowdfund.balanceError":
      "Insufficient balance: {available} Lucky available",
    "crowdfund.success":
      "Crowdfunded {amount} Lucky to position {position} digit {digit}",
    "crowdfund.digitAria":
      "Crowdfund position {position} digit {digit}, currently {amount} Lucky",
    "crowdfund.sheetTitle": "Crowdfund Amount",
    "crowdfund.sheetTarget": "Position {position} · Digit {digit}",
    "crowdfund.sheetBalance": "{available} Lucky available",
    "crowdfund.sheetSubmit": "Confirm crowdfund",
    "crowdfund.sheetSubmitting": "Submitting…",
    "crowdfund.sheetClose": "Close",
    "crowdfund.selectPosition": "Select crowdfunding position",
    "crowdfund.positionTabAria": "Select crowdfunding position {position}",
    "crowdfund.digitPadHint": "Tap a digit to crowdfund position {position}",

    // ---- Exchange ----
    "exchange.title": "Token Exchange",
    "exchange.description":
      "Always open, outside the round timeline and the 3-second cooldown · Fixed rate 1 ICP = 1000 Lucky",
    "exchange.icpToLucky": "ICP → Lucky",
    "exchange.luckyToIcp": "Lucky → ICP",
    "exchange.icpLabel": "Exchange ICP (0.1 ~ 10,000, multiples of 0.1)",
    "exchange.luckyLabel": "Exchange Lucky (multiples of 1000, max 10,000,000)",
    "exchange.expected": "You receive",
    "exchange.fee": "Fee 3%",
    "exchange.actual": "Net exchanged",
    "exchange.icpError": "Amount must be 0.1 ~ 10,000 ICP in multiples of 0.1",
    "exchange.icpPoolError": "Exchange pool ICP insufficient: {available} ICP",
    "exchange.luckyError":
      "Amount must be a multiple of 1000 and at most 10,000,000",
    "exchange.luckyBalanceError":
      "Insufficient balance: {available} Lucky available",
    "exchange.luckyPoolError":
      "Exchange pool Lucky insufficient: {available} Lucky",
    "exchange.submitting": "Exchanging…",
    "exchange.submitToLucky": "Exchange to Lucky",
    "exchange.submitToIcp": "Exchange to ICP",
    "exchange.poolTitle": "Exchange Pool & Treasury",
    "exchange.poolLucky": "Pool Lucky",
    "exchange.poolIcp": "Pool ICP",
    "exchange.treasury": "Treasury",
    "exchange.successIcp": "Exchanged {icp} ICP → {lucky} Lucky",
    "exchange.successLucky":
      "Exchanged {lucky} Lucky → {icp} ICP (fee {fee} Lucky)",

    // ---- Wallet ----
    "wallet.title": "My Account",
    "wallet.luckyBalance": "Lucky Balance",
    "wallet.identity": "Behavior Identity",
    "wallet.rate": "Fixed rate",
    "wallet.icpBalance": "ICP Balance",
    "wallet.icpFee": "Ledger fee",
    "wallet.receiveTitle": "Receive ICP",
    "wallet.receiveHint":
      "Send ICP to this address; incoming transfers need ledger confirmation.",
    "wallet.depositAddress": "Deposit address",
    "wallet.copyAddress": "Copy address",
    "wallet.copied": "Address copied",
    "wallet.copyFailed": "Copy failed, please select the address manually",
    "wallet.sendIcpTitle": "Send ICP",
    "wallet.sendLuckyTitle": "Transfer Lucky",
    "wallet.recipientLabel": "Recipient principal",
    "wallet.recipientPlaceholder": "Enter recipient principal",
    "wallet.icpAmountLabel": "Amount (ICP)",
    "wallet.luckyAmountLabel": "Amount (Lucky)",
    "wallet.icpAmountPlaceholder": "0.0",
    "wallet.luckyAmountPlaceholder": "0",
    "wallet.sendIcp": "Send ICP",
    "wallet.sendLucky": "Send Lucky",
    "wallet.sending": "Submitting…",
    "wallet.recipientError": "Invalid recipient, enter a valid principal",
    "wallet.selfTransferError": "You cannot transfer to yourself",
    "wallet.icpAmountError":
      "Amount must be above 0 and within your balance (including the fee)",
    "wallet.luckyAmountError": "Amount must be above 0 and within your balance",
    "wallet.icpFeeNote": "Plus a ledger fee of {fee} ICP",
    "wallet.icpSuccess": "Sent {amount} ICP",
    "wallet.luckySuccess": "Sent {amount} Lucky",
    "wallet.luckyLedgerSuccess":
      "Sent {amount} Lucky · ledger block #{blockIndex}",
    "wallet.luckyLedgerError": "Ledger transfer failed: {reason}",
    "wallet.luckyLedgerInsufficient":
      "Insufficient ledger balance: {available} Lucky available",
    "wallet.ledgerBalanceLabel": "Ledger balance",
    "wallet.transfersTitle": "Recent Transfers",
    "wallet.transfersEmpty": "No transfers yet",
    "wallet.transfersEmptyHint":
      "Deposits and withdrawals will appear here once made",
    "wallet.directionIn": "In",
    "wallet.directionOut": "Out",
    "wallet.statusPending": "Pending",
    "wallet.statusCompleted": "Completed",
    "wallet.statusFailed": "Failed",

    // ---- Profile ----
    "profile.title": "Profile",
    "profile.identityLabel": "Behavior identity",
    "profile.tab.bets": "Bets ({count})",
    "profile.tab.wins": "Wins ({count})",
    "profile.betsEmpty": "No bets yet",
    "profile.winsEmpty": "No wins yet",
    "profile.betMeta": "Round {round} · {time}",
    "profile.winMeta": "Round {round} · {tier} · {time}",
    "profile.tickets": "{count} tickets",
    "profile.loadMore": "Load more",

    // ---- Top bets ----
    "topbets.title": "Top 10 Most Bet",
    "topbets.empty": "No bets this round",
    "topbets.emptyHint": "Be the first to bet and take the top spot",
    "topbets.tickets": "tickets",

    // ---- Draw basis ----
    "basis.title": "Draw Basis Disclosure",
    "basis.description":
      "Positions 1-3 come from crowdfunding, 4-5 from the last two digits of the total pool, 6-7 from the last two digits of the crowdfund total.",
    "basis.crowdfundResult": "Crowdfund",
    "basis.crowdfundLocked": "Position {position} locked digit {digit}",
    "basis.crowdfundLeading": "Position {position} leading digit {digit}",
    "basis.poolLastTwo": "Pool last two",
    "basis.poolDetail": "Total pool {pool} → last two {lastTwo}",
    "basis.crowdfundLastTwo": "Crowdfund last two",
    "basis.crowdfundDetail": "Crowdfund total {total} → last two {lastTwo}",
    "basis.tiers": "Prize Tiers",
    "basis.tiersEmpty":
      "This round has not drawn yet; tier payouts are published after the draw",
    "basis.tier": "Tier",
    "basis.winningTickets": "Winning tickets",
    "basis.payoutPerTicket": "Per ticket",
    "basis.distributed": "Distributed",
    "basis.myWinnings": "My winnings this round",
    "basis.myTier": "My best tier",
    "basis.noWin": "No win",
    "basis.winningLine": "Round {round} winning number",

    // ---- History ----
    "history.title": "Round History",
    "history.recent": "Last 20 rounds",
    "history.list": "Round list",
    "history.empty": "No round history yet",
    "history.emptyHint":
      "Winning numbers and payout data appear here after the first round completes",
    "history.round": "Round {round}",
    "history.totalPool": "Total Pool",
    "history.crowdfundTotal": "Crowdfund",
    "history.distributed": "Distributed",
    "history.selectHint": "Select a round to view details",
    "history.back": "Back to latest",

    // ---- Dev panel ----
    "dev.title": "Admin Test Panel",
    "dev.description":
      "Visible to admins only. Seeds test balances and fast-forwards the round cycle to verify the crowdfund threshold and the full draw flow.",
    "dev.seedTitle": "Seed test balance",
    "dev.seedPlaceholder": "Custom Lucky amount",
    "dev.seed": "Seed",
    "dev.seedSuccess": "Seeded {amount} Lucky test balance",
    "dev.elapsedTitle": "Set round progress",
    "dev.elapsedBetting": "Betting ends · 5 min",
    "dev.elapsedCrowdfund": "Crowdfund ends · 8 min",
    "dev.elapsedFull": "Round ends · 10 min",
    "dev.elapsedSuccess": "Round progress set to “{label}”",
    "dev.advance": "Fast-forward round to draw",
    "dev.advancing": "Fast-forwarding…",
    "dev.advanceSuccess":
      "Round fast-forwarded; the draw will refresh automatically",

    // ---- Admin console ----
    "admin.title": "Super Admin Console",
    "admin.subtitle": "Admin-role access only · actions are irreversible",
    "admin.noPermission":
      "This account has no admin permission. Admins are assigned the platform Admin role; the first admin is bootstrapped via the deployment admin-token login, after which admins can promote or demote other users.",
    "admin.signInRequired":
      "Sign in with an admin account to access the admin console. The first admin is bootstrapped via the deployment admin-token login.",
    "admin.round.title": "Round Control",
    "admin.round.status": "Round status",
    "admin.round.running":
      "This round is running and accepting bets and crowdfunding",
    "admin.round.stopped":
      "This round is stopped and no longer accepts bets or crowdfunding",
    "admin.round.stop": "Stop next round",
    "admin.round.resume": "Resume round",
    "admin.round.stopSuccess": "Round stopped; betting and crowdfunding closed",
    "admin.round.resumeSuccess":
      "Round resumed; betting and crowdfunding reopened",
    "admin.withdraw.title": "Withdraw Tokens",
    "admin.withdraw.amountLabel": "Amount",
    "admin.withdraw.amountPlaceholder": "Enter amount",
    "admin.withdraw.recipientLabel": "Recipient principal",
    "admin.withdraw.recipientPlaceholder": "Enter recipient principal",
    "admin.withdraw.submit": "Withdraw",
    "admin.withdraw.submitting": "Withdrawing…",
    "admin.withdraw.success": "Withdrew {amount} to the given address",
    "admin.pool.prizePool": "Prize Pool",
    "admin.pool.treasury": "Treasury",
    "admin.pool.exchangeLucky": "Exchange Pool Lucky",
    "admin.pool.exchangeIcp": "Exchange Pool ICP",
    "admin.reset.title": "Reset Game Data",
    "admin.reset.description":
      "Clears the prize pool, treasury, exchange pools, player balances and history — all game data. This cannot be undone.",
    "admin.reset.action": "Reset game data",
    "admin.reset.confirm": "Confirm reset (irreversible)",
    "admin.reset.cancel": "Cancel",
    "admin.reset.success": "Game data has been reset",
    "admin.stats.title": "Daily Statistics",
    "admin.stats.description":
      "Per-UTC-day totals for bets placed, prize payouts and treasury income; days with no activity show as zero.",
    "admin.stats.fromLabel": "From date",
    "admin.stats.toLabel": "To date",
    "admin.stats.apply": "Query",
    "admin.stats.rangeHint": "Pick a start and end date to query that range",
    "admin.stats.rangeError":
      "The start date cannot be later than the end date",
    "admin.stats.preset7": "Last 7 days",
    "admin.stats.preset30": "Last 30 days",
    "admin.stats.date": "Date",
    "admin.stats.totalBets": "Total Bets",
    "admin.stats.totalPayouts": "Payouts",
    "admin.stats.treasuryIncome": "Treasury Income",
    "admin.stats.empty": "No statistics for this range",
    "admin.stats.emptyHint": "Adjust the date range and query again",
    "admin.stats.loading": "Loading statistics…",
    "admin.stats.error": "Failed to load statistics, please retry",
    "admin.stats.retry": "Retry",
    "admin.stats.dayCount": "{count} days",
    "admin.stats.zero": "0",

    // ---- Admin user management ----
    "admin.users.title": "User Management",
    "admin.users.description":
      "Lists every signed-in user and their current role. Promote a regular user to admin, or demote an admin back to a regular user.",
    "admin.users.identity": "Identity",
    "admin.users.role": "Role",
    "admin.users.actions": "Actions",
    "admin.users.roleAdmin": "Admin",
    "admin.users.roleUser": "User",
    "admin.users.roleGuest": "Guest",
    "admin.users.you": "(me)",
    "admin.users.promote": "Promote to admin",
    "admin.users.demote": "Demote to user",
    "admin.users.promoting": "Promoting…",
    "admin.users.demoting": "Demoting…",
    "admin.users.promoteSuccess": "User promoted to admin",
    "admin.users.demoteSuccess": "User demoted to regular user",
    "admin.users.error": "Role change failed, please retry",
    "admin.users.loading": "Loading users…",
    "admin.users.empty": "No signed-in users yet",
    "admin.users.emptyHint":
      "Users appear here automatically after their first sign-in",
    "admin.users.count": "{count} users",
    "admin.users.retry": "Retry",

    // ---- Admin token panel ----
    "admin.token.title": "Lucky Token",
    "admin.token.description":
      "Lucky is the in-app ledger token. This panel shows its metadata and current total supply, and lets an admin mint new tokens.",
    "admin.token.name": "Name",
    "admin.token.symbol": "Symbol",
    "admin.token.decimals": "Decimals",
    "admin.token.totalSupply": "Total Supply",
    "admin.token.fee": "Transfer Fee",
    "admin.token.logoAlt": "{symbol} token logo",
    "admin.token.loading": "Loading token info…",
    "admin.token.error": "Failed to load token info, please retry",
    "admin.token.retry": "Retry",
    "admin.token.mintTitle": "Mint Tokens",
    "admin.token.mintHint":
      "Mint Lucky to a target principal. Optionally provide a subaccount (64 hex chars); leave it empty to mint to the default account.",
    "admin.token.ownerLabel": "Target principal",
    "admin.token.ownerPlaceholder": "Enter target principal",
    "admin.token.subaccountLabel": "Subaccount (optional)",
    "admin.token.subaccountPlaceholder": "64 hex chars, empty for default",
    "admin.token.amountLabel": "Mint amount",
    "admin.token.amountPlaceholder": "Enter Lucky amount",
    "admin.token.mint": "Mint",
    "admin.token.minting": "Minting…",
    "admin.token.ownerError":
      "Invalid target principal, enter a valid principal",
    "admin.token.subaccountError": "Subaccount must be 64 hex characters",
    "admin.token.amountError": "Mint amount must be an integer above 0",
    "admin.token.mintSuccess":
      "Minted {amount} Lucky · block #{blockIndex} · new supply {totalSupply}",
    "admin.token.mintError": "Mint failed, please retry",
    "admin.token.ledgerTitle": "Recent Transactions",
    "admin.token.ledgerDescription":
      "The {count} most recent ledger transactions, newest first.",
    "admin.token.ledgerEmpty": "No transactions yet",
    "admin.token.ledgerEmptyHint":
      "Mints and transfers will appear here once made",
    "admin.token.ledgerLoading": "Loading transactions…",
    "admin.token.ledgerError": "Failed to load transactions, please retry",
    "admin.token.ledgerRetry": "Retry",
    "admin.token.colIndex": "Block",
    "admin.token.colKind": "Type",
    "admin.token.colFrom": "From",
    "admin.token.colTo": "To",
    "admin.token.colAmount": "Amount",
    "admin.token.colTime": "Time",
    "admin.token.kindMint": "Mint",
    "admin.token.kindTransfer": "Transfer",
    "admin.token.kindTransferFrom": "Transfer from",
    "admin.token.kindApprove": "Approve",
    "admin.token.systemAccount": "System",

    // ---- Guide editing ----
    "guide.edit.action": "Edit guide",
    "guide.edit.title": "Edit Guide",
    "guide.edit.hint":
      "Supports multiple paragraphs and line breaks; saving makes it visible to everyone immediately.",
    "guide.edit.placeholder": "Enter the guide text…",
    "guide.edit.save": "Save",
    "guide.edit.saving": "Saving…",
    "guide.edit.cancel": "Cancel",
    "guide.edit.success": "Guide text saved",
    "guide.edit.empty":
      "No guide text has been set; the default content is shown.",
    "guide.edit.default": "Default guide",

    // ---- Identity ----
    "identity.player": "Regular Player",
    "identity.player.desc": "Standard participant",
    "identity.manipulator": "Manipulator",
    "identity.manipulator.desc": "Large crowdfund sways the draw",
    "identity.conspirator": "Conspirator",
    "identity.conspirator.desc": "Coordinated multi-account betting",

    // ---- Tiers ----
    "tier.7": "7-digit match",
    "tier.6": "6-digit",
    "tier.5": "5-digit",
    "tier.4": "4-digit",
    "tier.3": "3-digit",
    "tier.2": "2-digit",
    "tier.1": "1-digit",
    "tier.other": "{tier}-digit",

    // ---- Errors ----
    "error.insufficientBalance":
      "Insufficient balance: need {required} Lucky, {available} available",
    "error.invalidPosition": "Invalid position; only crowdfund positions 1-3",
    "error.poolInsufficient":
      "{token} pool insufficient: {available} available",
    "error.invalidBetNumber":
      "Invalid number: pick at least 1 digit for each of the 7 positions",
    "error.amountTooLarge": "Amount above the limit; max {max} per action",
    "error.amountTooSmall": "Amount below the minimum; min {min} per action",
    "error.rateLimited": "Too many actions; wait {seconds}s",
    "error.phaseClosed":
      "Currently in the {current} phase; this action requires the {required} phase",
    "error.invalidAmount": "Amount must be a multiple of {step}",
    "error.roundNotFound": "No draw record found for round {round}",
    "error.ledgerUnavailable":
      "The ledger is temporarily unavailable, try again later",
    "error.invalidRecipient": "Invalid recipient, enter a valid principal",
    "error.notRegistered": "Please sign in to continue",
    "error.roundStopped":
      "This round is stopped and is not accepting bets or crowdfunding",
    "error.generic": "Action failed, please try again later",

    // ---- Footer ----
    "footer.rate": "Fixed rate",
    "footer.schedule":
      "~10 min per round · betting for the first 5 min · crowdfunding for the first 8 min",
    "footer.builtWith": "© {year}. Built with love using caffeine.ai",

    // ---- Common ----
    "common.placeholder": "—",
    "common.lucky": "Lucky",
    "common.icp": "ICP",
    "common.seconds": "{seconds}s",
  },
} as const;

/** The set of supported interface languages. */
export type Language = keyof typeof translations;

/** Every valid translation key, derived from the Chinese source dictionary. */
export type TranslationKey = keyof (typeof translations)["zh"];

/** Values accepted for `{placeholder}` interpolation. */
export type TranslationVars = Record<string, string | number>;

/** A translator bound to a language, as returned by `useTranslation().t`. */
export type Translator = (
  key: TranslationKey,
  vars?: TranslationVars,
) => string;

export const LANGUAGES: Language[] = ["zh", "en"];

export const DEFAULT_LANGUAGE: Language = "zh";

/** localStorage key holding the persisted language preference. */
export const LANGUAGE_STORAGE_KEY = "arena.language";

/** BCP-47 tag applied to `<html lang>` for each interface language. */
export const LANGUAGE_TAGS: Record<Language, string> = {
  zh: "zh-CN",
  en: "en",
};

/** Narrow an arbitrary string to a supported Language, or null. */
export function toLanguage(value: string | null | undefined): Language | null {
  if (value === "zh" || value === "en") return value;
  return null;
}

/**
 * Resolve a translation key for a language, interpolating `{name}` vars.
 * Falls back to the Chinese source string, then to the raw key, so a missing
 * translation never renders as blank.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  vars?: TranslationVars,
): string {
  const template =
    translations[language][key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
