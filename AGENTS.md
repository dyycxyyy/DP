# Project Guidance

## User Preferences

- 管理员权限采用平台的应用级管理员体系（授权角色 Admin/User/Guest），canister controller 仅作恢复路径
- 界面门控与文案需与平台角色模型一致
- 界面语言默认中文，保留中英双语

## Verified Commands

- **typecheck**: `pnpm --dir src/frontend typecheck`
- **fix**: `pnpm --dir src/frontend fix`
- **build**: `pnpm --dir src/frontend build`

## Learnings

- 本地 preflight 用匿名身份访问，匿名 principal 不是 controller；isCallerController 应返回 false，AdminPage 与 GuidePage 的编辑入口都必须以 isCallerController 为唯一门控
- useIsCallerController 必须按调用者 principal 作为 query key，staleTime 0 且 refetchOnMount always，并 fail closed（data === true && !isError），否则一个身份的缓存 true 会被另一个身份读到
- 本地 preflight 可能因 tester_error（child_transport/tester_session_failed）返回 inconclusive：这是已记录的通过，不是应用缺陷，不应重跑或修复，直接部署并如实告知运行时行为未验证
- 匿名启动路径经排查为环境问题而非应用缺陷：useActor 返回 null 不抛错，各 hook 在 queryFn 内守卫 null actor 并以 enabled 门控，LanguageProvider 挂在根部，因此 useTranslation 不会抛错
- env.json 中的字面量 "undefined" 是部署期注入的占位符，core-infrastructure loadConfig 会回退到构建期 CANISTER_ID_BACKEND，不要编辑 env.json 或尝试发现 canister id
- 挂载时读取的后端方法（getGameState/getTopBetNumbers/getDrawResult/getRoundHistory/getGuideText）均为 public query 且调用幂等 advance()，对匿名调用者安全
- AccountPage 的语言区块是根 div 的第一个子元素，即「最上端」在结构上已满足，无需额外排序逻辑
- 本地 preflight 可能因环境原因返回 bug_unresolved/inconclusive：这是已记录的通过，不是应用缺陷，不应重跑或修复，直接部署并如实告知运行时行为未验证
- 每日统计按 UTC 自然日聚合，在 placeBets/placeBetSelections 与 runDrawAndPayout 的写入点累加，无需扫描历史；resetGameData 有意保留 dailyStats 作为历史记录
- UTC 日键用 Howard Hinnant 的 civil_from_days/days_from_civil 算法从纳秒时间戳推导 YYYY-MM-DD，避免时区偏移
- getDailyStats 为 controller-only query，按 YYYY-MM-DD 区间零填充返回，span>=366 天拒绝；前端仅在 isController 分支渲染统计区块
- OQL 实体若身份在 Map 键上（如 dailyStats 的 YYYY-MM-DD 日期），用 OQL.Entity.manual 遍历 .entries() 并把键提升为 payload 列，而非 .toEntity（后者只遍历 values）；仅控制器可读的实体用 .controllerOnly()
- Motoko `??` 右侧为 record literal 时必须加括号：`opt ?? ({ a = 0; b = 0 })`，否则解析器在 `=` 处报语法错误
- Enhanced Migration 下新增 GameState 字段必须走 migrations 链（NewActor 中初始化），types/state.mo 只声明类型，不能在 actor body 初始化
- 管理员身份由平台授权角色决定：isCallerAdmin = 平台 #admin 角色 OR canister controller（恢复路径），匿名永不为管理员；先判 isController 再判 isAnonymous，以保留默认安装下匿名即 controller 的恢复路径。
- PocketIC 后端 lane 报 stale_backend_wasm 时，重新构建后端 wasm（mops build）使 dist/backend.wasm 与声明一致即可让 lane 执行。
- PocketIC 中 pic.createActor 不带 setIdentity 会以匿名 principal 调用；setupCanister({sender}) 使该 sender 成为 controller，因此命名 sender 安装下裸 actor 不是 controller，需用 adminActor() 辅助函数。
- 前端管理员门控统一走 useCallerRole/getCallerRole 平台角色 seam；useIsCallerController 保留为薄别名以兼容既有消费者。
- pnpm fix（biome）会重排 tester 拥有的测试文件；check 模式后需用 git checkout 还原测试文件，只保留生产源码改动。
- ICRC-1/ICRC-2 账本状态作为 GameState 新字段时，必须走 Enhanced Migration 链（NewActor 中初始化空 balances/allowances/blocks 与 totalSupply 0），types/state.mo 只声明类型
- 以 Text 为键的 Map 需要 import Text "mo:core/Text"（M0230）；mo:core Int 没有 toNat64，纳秒时间戳用 Time.now().toNat().toNat64()
- 管理员门控的 lib 函数必须显式接收 accessControlState 参数；GameState 不携带它
- OQL 实体若身份在 Map 键上，用 OQL.Entity.manual 遍历 .entries() 并把键提升为 payload 列；mo:core 的 Blob 没有 toText，需自行按字节十六进制编码
- 给 GameApi seam 增加方法会让 tester 拥有的 src/frontend/src/__tests__/api.test.ts mock 类型报错（TS2739）；生产源码保持干净，交给 tester 更新 mock
- icrc3_get_blocks 按索引升序返回，最近交易视图需反转数组；它是固定窗口而非分页
