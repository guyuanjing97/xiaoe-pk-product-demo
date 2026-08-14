(() => {
  'use strict';

  const Stage = Object.freeze({
    HOME: 'HOME', LIST: 'LIST', DETAIL: 'DETAIL', MATCHING: 'MATCHING',
    TEAM_WAITING: 'TEAM_WAITING', TEAM_READY: 'TEAM_READY', COUNTDOWN: 'COUNTDOWN',
    QUESTION: 'QUESTION', SUBMITTED_WAITING: 'SUBMITTED_WAITING',
    QUESTION_RESULT: 'QUESTION_RESULT', MATCH_RESULT: 'MATCH_RESULT',
    REVIEW_OVERVIEW: 'REVIEW_OVERVIEW', REVIEW: 'REVIEW'
  });
  const fallbackQuestions = [
    { id: 'q1', title: '企学院中，用于统一组织课程、考试和助学工具的能力是？', type: '单选题', options: ['考练中心', '培训计划', '直播中心', '数据中心'], correct: 0 },
    { id: 'q2', title: '创建知识PK时，题目内容应优先复用哪个现有资产？', type: '单选题', options: ['企学院现有题库/试卷', '重新录入临时题目', '活动海报', '学员标签'], correct: 0 },
    { id: 'q3', title: '为了保证团队PK公平，默认更适合采用哪种方式？', type: '单选题', options: ['双方同题同顺序', '双方随机不同题', '仅比较答题速度', '管理员人工判定'], correct: 0 },
    { id: 'q4', title: 'PK结果应进入活动数据统计。', type: '判断题', options: ['正确', '错误'], correct: 0 },
    { id: 'q5', title: '活动开始后，为保证公平应锁定哪些内容？', type: '多选题', options: ['题目内容', '题目顺序', '计分规则', '学员头像'], correct: [0, 1, 2] }
  ];
  const fallbackActivity = {
    id: 'pk-demo-fallback', name: '产品知识组队体验赛', description: '通过实时知识对战巩固产品与服务规范。',
    status: '进行中', mode: '组队PK', teamSize: 3,
    groupMatchMode: 'department_vs_department', participantDepartments: ['产品中心', '客户成功部'], aiFallback: true, questionCount: 5, seconds: 15, nextIntervalSeconds: 2,
    baseScore: 10, wrongScore: -2, timeBonus: true, bonusPerSecond: 1,
    sourceName: '新人产品知识试卷', learnerIds: ['u1', 'u2', 'u4', 'u7'], attempts: 5,
    winPoints: 10, joinPoints: 2, startAt: new Date(Date.now() - 86400000).toISOString(),
    endAt: new Date(Date.now() + 6 * 86400000).toISOString(), questionSnapshot: fallbackQuestions
  };
  const params = new URLSearchParams(location.search);
  const apiEnabled = false;
  const fast = params.get('fast') === '1';
  const hold = params.get('hold') === '1';
  const currentUser = { id: params.get('user') || 'u1', name: params.get('name') || '体验学员83f1', department: params.get('department') || '产品中心' };
  const app = document.getElementById('app');
  const avatarAssets = {
    blue: ['assets/pk-c-avatars/zhang-yi.png', 'assets/pk-c-avatars/wang-er.png', 'assets/pk-c-avatars/learner.png'],
    red: ['assets/pk-c-avatars/li-si.png', 'assets/pk-c-avatars/zhao-wu.png', 'assets/pk-c-avatars/chen-liu.png'],
    learner: 'assets/pk-c-avatars/learner.png', ai: 'assets/pk-c-avatars/ai-avatar.png', mascot: 'assets/pk-c-avatars/ai-mascot.png'
  };
  const visualAssets = {
    shield: 'assets/pk-c-visuals/pk-shield.png',
    empty: 'assets/pk-c-visuals/empty-activity.png',
    trophy: 'assets/pk-c-visuals/trophy.png'
  };
  const state = {
    stage: params.get('entry') === 'pk' ? Stage.LIST : Stage.HOME,
    activities: [], activity: null, activeTab: '全部', search: '', questions: [],
    questionIndex: 0, selected: null, timeLeft: 15, countdown: 3,
    lobby: null, match: null, currentResult: null, history: [], reviewIndex: 0, reviewTab: '全部题目',
    myScore: 0, opponentScore: 0, matchingMessage: '', matchError: '', exiting: false, shareData: null, timers: []
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const delay = ms => fast ? Math.min(ms, 500) : ms;
  const setTimer = (fn, ms) => { const id = setTimeout(fn, delay(ms)); state.timers.push(id); return id; };
  const setLoop = (fn, ms) => { const id = setInterval(fn, delay(ms)); state.timers.push(id); return id; };
  const clearTimers = () => { state.timers.forEach(id => { clearTimeout(id); clearInterval(id); }); state.timers = []; };
  const isMulti = q => q?.type === '多选题' || Array.isArray(q?.correct);
  const hasSelection = () => Array.isArray(state.selected) ? state.selected.length > 0 : state.selected !== null;
  const answerIndexes = value => Array.isArray(value) ? value : value === null || value === undefined ? [] : [Number(value)];
  const sameAnswer = (left, right) => {
    const a = answerIndexes(left).slice().sort((x, y) => x - y), b = answerIndexes(right).slice().sort((x, y) => x - y);
    return a.length === b.length && a.every((value, index) => value === b[index]);
  };
  async function api(path, options = {}) {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）`);
    return data;
  }
  function derivedStatus(activity) {
    if (activity.manualEndedAt) return '已结束';
    if (activity.manualStartedAt) return '进行中';
    const now = Date.now(), start = new Date(activity.startAt).getTime(), end = new Date(activity.endAt).getTime();
    if (Number.isFinite(end) && now >= end) return '已结束';
    if (Number.isFinite(start) && now < start) return '未开始';
    return activity.status || '进行中';
  }
  function normalizeQuestion(question, index) {
    const fallback = fallbackQuestions[index % fallbackQuestions.length];
    return {
      id: question?.id || fallback.id, title: question?.title || question?.stem || fallback.title,
      type: question?.type || fallback.type, options: question?.options?.length ? question.options : fallback.options,
      correct: question?.correct ?? fallback.correct
    };
  }
  function normalizeActivity(activity) {
    const normalized = {
      ...fallbackActivity, ...activity, status: derivedStatus(activity),
      teamSize: Number(activity.teamSize || 3),
      questionCount: Number(activity.questionCount ?? 5), seconds: Number(activity.seconds || 15),
      nextIntervalSeconds: Math.min(10, Math.max(1, Number(activity.nextIntervalSeconds || 2))),
      baseScore: Number(activity.baseScore || 10), wrongScore: Number(activity.wrongScore ?? 0),
      bonusPerSecond: Number(activity.bonusPerSecond || 1), attempts: Number(activity.attempts || 1),
      winPoints: Number(activity.winPoints || 0), joinPoints: Number(activity.joinPoints || 0)
    };
    normalized.questionSnapshot = (activity.questionSnapshot?.length ? activity.questionSnapshot : fallbackQuestions)
      .slice(0, normalized.questionCount).map(normalizeQuestion);
    while (normalized.questionSnapshot.length < normalized.questionCount) {
      normalized.questionSnapshot.push(normalizeQuestion(null, normalized.questionSnapshot.length));
    }
    return normalized;
  }
  function formatDateTime(value) {
    if (!value) return '未设置';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ');
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replaceAll('/', '-');
  }
  function remainingText(activity) {
    const seconds = Math.max(0, Math.floor((new Date(activity.endAt).getTime() - Date.now()) / 1000));
    const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
    return days > 0 ? `${days}天${hours}小时` : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function eligibility(activity) {
    return !activity.learnerIds?.length || activity.learnerIds.includes(currentUser.id);
  }
  function visibleInLearnerSide(activity) {
    if (['已下架', '暂不上架'].includes(activity.shelfStatus)) return false;
    if (activity.shelfStatus === '定时上架' && activity.shelfAt) return Date.now() >= new Date(activity.shelfAt).getTime();
    return true;
  }
  const dataFingerprint = value => JSON.stringify(value);
  function updateRemainingLabels() {
    document.querySelectorAll('[data-remaining-id]').forEach(target => {
      const activity = state.activities.find(item => item.id === target.dataset.remainingId);
      if (activity) target.textContent = remainingText(activity);
    });
    const detail = document.querySelector('[data-detail-remaining]');
    if (detail && state.activity) detail.textContent = remainingText(state.activity);
  }
  async function loadActivities({ preserve = true, forceRender = false } = {}) {
    const previousFingerprint = dataFingerprint(state.activities);
    let rows = [];
    if (apiEnabled) {
      try { rows = (await api('/api/activities')).activities || []; }
      catch (error) { console.info('活动接口不可用，使用本地兜底：', error.message); }
    }
    if (!rows.length) {
      try { const local = JSON.parse(localStorage.getItem('xiaoe-pk-demo-v3') || 'null'); if (local) rows = [local]; } catch {}
    }
    const nextActivities = (rows.length ? rows : [fallbackActivity]).map(normalizeActivity).filter(visibleInLearnerSide);
    const changed = previousFingerprint !== dataFingerprint(nextActivities);
    state.activities = nextActivities;
    const requested = params.get('activity');
    const currentId = preserve ? state.activity?.id : null;
    if (requested || currentId) state.activity = state.activities.find(item => item.id === (requested || currentId)) || null;
    if (requested && state.activity) state.stage = Stage.DETAIL;
    if (state.activity) setActivity(state.activity);
    const shouldRender = forceRender || changed || !app.firstElementChild;
    if (shouldRender) { clearTimers(); render(); }
    else updateRemainingLabels();
    return shouldRender;
  }
  function setActivity(activity) {
    state.activity = normalizeActivity(activity);
    state.questions = state.activity.questionSnapshot;
    state.timeLeft = state.activity.seconds;
  }

  function header(title, back = true, share = false) {
    const canExit = [Stage.COUNTDOWN, Stage.QUESTION, Stage.SUBMITTED_WAITING, Stage.QUESTION_RESULT].includes(state.stage);
    return `<header class="topbar"><div class="phone-status"><b>9:41</b><span class="phone-signals"><i class="cellular"></i><i class="wifi"></i><i class="battery"></i></span></div><div class="nav-row">${back ? '<button class="icon-btn back" data-back aria-label="返回"></button>' : '<span></span>'}<h1>${escapeHtml(title)}</h1><div class="nav-actions">${share ? '<button class="icon-btn share" aria-label="分享"></button>' : ''}${canExit ? '<button class="exit-link" data-exit-pk>退出</button>' : '<button class="icon-btn more" aria-label="更多">•••</button>'}</div></div></header>`;
  }
  const footer = content => `<footer class="bottom-action">${content}</footer>`;
  function renderHome() {
    const tools = [['▣', '打卡'], ['▤', '作业'], ['▧', '考试'], ['♙', '活动'], ['♧', '圈子'], ['◇', '练习'], ['▥', '错题本'], ['♢', '题目收藏'], ['▣', '刷题本']];
    return `<section class="learner-home" data-stage="HOME"><div class="profile"><div class="profile-avatar">○</div><div><b>${escapeHtml(currentUser.name)} ›</b><p>企学院-非集成-5342</p></div><div class="profile-actions"><span>⚙</span><span>▢</span></div></div><div class="home-stats card"><div><b>0</b><span>我的收藏</span></div><div><b>31</b><span>我的任务</span></div></div><div class="learning-center card"><span class="tool-icon">▣</span><b>学习中心</b><span>累计学习 <strong style="color:#20b94b">9</strong> 分钟</span><i>›</i></div><div class="tool-panel card"><h2>学习工具</h2><div class="tool-grid">${tools.map(([icon, label]) => `<button class="tool-entry"><span class="tool-icon">${icon}</span>${label}</button>`).join('')}<button class="tool-entry pk" data-pk-entry><span class="new-tag">NEW</span><span class="tool-icon">⚔</span>PK赛</button></div></div><div class="home-menu card"><div>♙　我的成就 <i>›</i></div><div>♧　我的奖品 <i>›</i></div><div>⚙　设置 <i>›</i></div></div><nav class="home-nav"><button><b>⌂</b>首页</button><button><b>▢</b>课程</button><button class="active"><b>♙</b>我的</button></nav></section>`;
  }
  function activityCard(activity, index) {
    const status = derivedStatus(activity), mode = activity.mode === '组队PK' ? `${activity.teamSize}人/队` : '1v1PK';
    return `<article class="activity-card card" style="animation-delay:${index * 45}ms" data-activity="${escapeHtml(activity.id)}"><div class="pk-cover"><img src="${activity.cover || visualAssets.shield}" alt=""></div><div class="activity-main"><div class="activity-name"><span class="status ${status === '已结束' ? 'red' : ''}">${status}</span><b>${escapeHtml(activity.name)}</b></div><div class="activity-meta">${mode} · 共${activity.questionCount}道题 · ${activity.seconds}秒/题</div><div class="countdown-text">${status === '进行中' ? `<span class="clock-mark"></span><span>剩余</span><b data-remaining-id="${escapeHtml(activity.id)}">${remainingText(activity)}</b><span>结束</span>` : `<span>${status === '未开始' ? formatDateTime(activity.startAt) + ' 开始' : formatDateTime(activity.endAt) + ' 结束'}</span>`}</div></div><span class="activity-arrow">›</span></article>`;
  }
  function filteredActivities() {
    return state.activities.filter(item => (state.activeTab === '全部' || derivedStatus(item) === state.activeTab) && (!state.search || item.name.includes(state.search)));
  }
  function renderActivityRows() {
    const rows = filteredActivities();
    return rows.length ? `${rows.map(activityCard).join('')}<div class="mode-promo"><div><b>组队PK，高团队荣誉</b><span>AI陪练 · 实时对战 · 团队协作</span></div><img src="${avatarAssets.mascot}" alt=""></div><div class="empty-state"><img src="${visualAssets.empty}" alt=""><span>没有更多活动了</span></div>` : `<div class="empty-state"><img src="${visualAssets.empty}" alt=""><span>该分类暂无PK赛</span></div>`;
  }
  function renderList() {
    const tabs = ['全部', '进行中', '未开始', '已结束'];
    return `<section class="stage no-footer list-stage" data-stage="LIST">${header('PK赛', false)}<label class="search"><input id="activitySearch" value="${escapeHtml(state.search)}" placeholder="搜索活动名称" aria-label="搜索活动名称"></label><nav class="tabs">${tabs.map(tab => `<button class="${state.activeTab === tab ? 'active' : ''}" data-tab="${tab}">${tab}</button>`).join('')}<i class="tab-indicator" style="transform:translateX(${tabs.indexOf(state.activeTab) * 100}%)"></i></nav><div class="activity-list">${renderActivityRows()}</div><nav class="pk-bottom-nav"><button data-home><i>⌂</i>首页</button><button><i>▣</i>学习</button><button class="active"><i>PK</i>PK赛</button><button><i>♙</i>我的</button></nav></section>`;
  }
  function ruleRows(a) {
    const rows = [
      ['list', '题目数量', `共 ${a.questionCount} 道题`],
      ['clock', '每题答题时间', `每道题限时 ${a.seconds} 秒`],
      ['interval', '题间停留时间', `本题结果展示 ${a.nextIntervalSeconds} 秒后自动进入下一题`],
      ['score', '计分规则', `答对得 ${a.baseScore} 分；答错或未作答${a.wrongScore === 0 ? '不得分' : `扣 ${Math.abs(a.wrongScore)} 分`}${a.timeBonus ? `；双方都答对时，更快一方按用时差加分` : ''}`],
      ['limit', '挑战次数', `每人每天最多挑战 ${a.attempts} 次`]
    ];
    if (a.mode === '组队PK') {
      rows.splice(2, 0, ['ai', 'AI补位', a.aiFallback ? `真人不足时由 AI 陪练补位` : `真人不足时提示匹配失败`]);
    } else rows.splice(2, 0, ['ai', 'AI补位', a.aiFallback ? '没有真人对手时由 AI 陪练对战' : '没有真人对手时提示匹配失败']);
    return rows;
  }
  function renderDetail() {
    const a = state.activity, status = derivedStatus(a), allowed = eligibility(a), mode = a.mode === '组队PK' ? `${a.teamSize}人/队` : '1v1PK';
    const configured = a.questionCount > 0;
    const disabled = status !== '进行中' || !allowed || !configured;
    const action = !configured ? '活动尚未配置题目' : !allowed ? '不在本场参赛范围' : status === '未开始' ? '活动未开始' : status === '已结束' ? '活动已结束' : a.mode === '组队PK' ? '查看我的队伍' : '开始匹配';
    return `<section class="stage detail-stage" data-stage="DETAIL">${header('活动详情', true, true)}<div class="detail-summary card"><div class="pk-cover"><img src="${a.cover || visualAssets.shield}" alt=""></div><div><div class="detail-name"><b>${escapeHtml(a.name)}</b><span class="status ${status === '已结束' ? 'red' : ''}">${status}</span></div><h2>${mode} · 共${a.questionCount}道题 · ${a.seconds}秒/题</h2><p>${status === '进行中' ? `剩余 <strong data-detail-remaining>${remainingText(a)}</strong> 结束` : `${formatDateTime(a.startAt)} 至 ${formatDateTime(a.endAt)}`}</p></div></div><h3 class="section-title">活动规则</h3><div class="rule-panel card">${ruleRows(a).map(([icon, title, text]) => `<div class="rule-line"><span class="rule-icon ${icon}"></span><div><b>${title}</b><p>${escapeHtml(text)}</p></div></div>`).join('')}</div><h3 class="section-title">活动时间</h3><div class="time-box card">${formatDateTime(a.startAt)} 至 ${formatDateTime(a.endAt)}</div>${!allowed ? '<div class="eligibility-note">当前账号不在本场参赛范围，请联系管理员。</div>' : ''}${footer(`<span class="customer-service">联系客服</span><button class="btn primary" data-start ${disabled ? 'disabled' : ''}>${action}</button>`)}</section>`;
  }
  function renderMatching() {
    const opponent = state.match?.opponent;
    return `<section class="stage duel-matching-stage" data-stage="MATCHING">${header('匹配中')}<div class="matching-copy"><b>${opponent ? '匹配成功，即将开始' : '正在为你匹配实力相近的对手'}</b><p>预计等待 <strong>${opponent ? '00:00' : '00:10'}</strong></p></div><div class="duel-orbit"><span class="orbit-ring r1"></span><span class="orbit-ring r2"></span><span class="orbit-ring r3"></span><div class="orbit-center"><img src="${avatarAssets.mascot}" alt="AI匹配"></div><div class="orbit-player me"><img src="${avatarAssets.learner}" alt="我"><b>我</b></div><div class="orbit-player opponent"><img src="${opponent?.type === 'ai' ? avatarAssets.ai : avatarAssets.red[0]}" alt="对手"><b>${escapeHtml(opponent?.name || '匹配中')}</b></div><i class="orbit-dot d1"></i><i class="orbit-dot d2"></i><i class="orbit-dot d3"></i></div><div class="matching-status card"><p class="match-message">${escapeHtml(state.matchingMessage || '正在寻找本场可匹配的在线学员')}</p>${state.matchError ? `<p class="match-failure">${escapeHtml(state.matchError)}</p><button class="btn primary" data-retry>重新匹配</button>` : '<div class="wait-dots"><i></i><i></i><i></i></div>'}</div><div class="matching-rules card"><b>比赛规则</b><div><span><i>◷</i>每题${state.activity.seconds}秒</span><span><i>☆</i>答对得${state.activity.baseScore}分</span><span><i>⊖</i>答错${state.activity.wrongScore ? `扣${Math.abs(state.activity.wrongScore)}分` : '不得分'}</span><span><i>ϟ</i>${state.activity.timeBonus ? '双方答对更快加分' : '按基础分计分'}</span></div></div>${footer('<button class="btn" data-cancel-match>取消匹配</button>')}</section>`;
  }
  function memberSeat(item, index, side) {
    if (!item) return '<div class="seat waiting"><div class="avatar">＋</div><span>等待加入</span></div>';
    const source = item.type === 'ai' ? avatarAssets.ai : avatarAssets[side][index % avatarAssets[side].length];
    return `<div class="seat ${item.type === 'ai' ? 'ai' : ''}"><div class="avatar"><img src="${source}" alt=""></div><span>${escapeHtml(item.name)}</span>${item.type === 'ai' ? '<small>AI陪练</small>' : ''}</div>`;
  }
  function fillMembers(items, size) { const rows = (items || []).slice(0, size); while (rows.length < size) rows.push(null); return rows; }
  function teamCard(label, items, size, department = '') {
    const red = label.startsWith('红队');
    const side = red ? 'red' : 'blue';
    const score = state.stage === Stage.TEAM_READY ? items.filter(Boolean).length : 0;
    return `<div class="team-card card ${red ? 'red-team' : ''}"><div class="team-title"><span class="team-label">${label}</span><span class="team-department">${escapeHtml(department)}</span><b class="team-score">${score} 分</b></div><div class="seats">${items.map((item, index) => memberSeat(item, index, side)).join('')}</div></div>`;
  }
  function lobbyTeams() {
    const a = state.activity, size = a.teamSize;
    if (state.lobby?.teams) return { blue: fillMembers(state.lobby.teams.blue, size), red: fillMembers(state.lobby.teams.red, size), blueDepartment: state.lobby.teamDepartments?.blue || state.lobby.teams.blue[0]?.department || '', redDepartment: state.lobby.teamDepartments?.red || state.lobby.teams.red[0]?.department || '' };
    const members = state.lobby?.members || [{ id: currentUser.id, name: currentUser.name, department: currentUser.department, type: 'real' }], blue = members.filter(item=>item.department===currentUser.department), red = members.filter(item=>item.department!==currentUser.department);
    return { blue: fillMembers(blue, size), red: fillMembers(red, size), blueDepartment: currentUser.department, redDepartment: state.activity.participantDepartments?.find(name=>name!==currentUser.department) || '其他参赛部门' };
  }
  function renderTeamWaiting() {
    const a = state.activity, teams = lobbyTeams();
    const waitingBlue = teams.blue.map(member => member?.type === 'ai' ? null : member);
    const waitingRed = teams.red.map(member => member?.type === 'ai' ? null : member);
    return `<section class="stage team-stage" data-stage="TEAM_WAITING">${header('组队中（等待中）')}<div class="lobby-head"><h2>距离队伍就绪 <strong>00:45</strong></h2></div>${teamCard('蓝队（我方）', waitingBlue, a.teamSize, teams.blueDepartment)}${teamCard('红队（对方）', waitingRed, a.teamSize, teams.redDepartment)}<div class="team-ai-note card"><img src="${avatarAssets.ai}" alt="AI陪练"><span>${a.aiFallback ? '真人不足时由 AI 陪练补位' : '人数不足时本场组队失败'}</span></div><p class="invite-copy">邀请队友一起参赛吧～</p>${footer('<span class="customer-service headset">联系客服</span><button class="btn primary" data-invite>邀请队友</button>')}</section>`;
  }
  function renderTeamReady() {
    const a = state.activity, teams = lobbyTeams();
    return `<section class="stage team-stage ready-stage" data-stage="TEAM_READY">${header('队伍已就绪')}<div class="lobby-head"><h2>距离比赛开始 <strong>00:20</strong></h2></div>${teamCard('蓝队（我方）', teams.blue, a.teamSize, teams.blueDepartment)}${teamCard('红队（对方）', teams.red, a.teamSize, teams.redDepartment)}<div class="team-ready-notes"><p class="blue-note">双方队伍已就绪，比赛即将开始</p><p class="red-note">双方队伍已锁定，比赛期间不可更换队员</p></div>${footer('<span class="customer-service headset">联系客服</span><button class="btn" disabled>队伍已锁定</button>')}</section>`;
  }
  function scoreBoard() {
    const left = state.activity.mode === '组队PK' ? '蓝队' : '我方', right = state.activity.mode === '组队PK' ? '红队' : '对方';
    const teamMode = state.activity.mode === '组队PK';
    const blueFaces = teamMode ? avatarAssets.blue.slice(0, state.activity.teamSize).map(src => `<img src="${src}" alt="">`).join('') : `<img src="${avatarAssets.learner}" alt="我">`;
    const redFaces = teamMode ? avatarAssets.red.slice(0, state.activity.teamSize).map(src => `<img src="${src}" alt="">`).join('') : `<img src="${avatarAssets.red[0]}" alt="对手">`;
    return `<div class="scoreboard ${teamMode ? 'team-board' : 'duel-board'}"><div class="score-team"><span class="team-pill">${left}${teamMode ? '（我方）' : ''}</span><div class="battle-faces">${blueFaces}</div><b>${state.myScore}</b><small>${teamMode ? `${state.activity.teamSize}/${state.activity.teamSize}` : '得分'}</small></div><div class="versus">VS</div><div class="score-team red-side"><b>${state.opponentScore}</b><div class="battle-faces">${redFaces}</div><span class="team-pill">${right}${teamMode ? '（对方）' : ''}</span><small>${teamMode ? `${state.activity.teamSize}/${state.activity.teamSize}` : '得分'}</small></div></div>`;
  }
  function renderCountdown() {
    const rules = state.activity.mode === '组队PK'
      ? [['队伍', `${state.activity.teamSize}人/队`], ['题量', `共${state.activity.questionCount}题`], ['时间', `每题${state.activity.seconds}秒`], ['得分', `答对+${state.activity.baseScore}分`]]
      : [['答题', `每题${state.activity.seconds}秒`], ['得分', `答对+${state.activity.baseScore}分`], ['错题', state.activity.wrongScore ? `答错${state.activity.wrongScore}分` : '答错0分'], ['加分', state.activity.timeBonus ? '双方答对更快加分' : '无速度加分']];
    return `<section class="stage countdown-stage no-footer battle-stage" data-stage="COUNTDOWN">${header(state.activity.mode === '组队PK' ? '对战倒计时' : '1v1 PK赛', false)}${scoreBoard()}<p class="countdown-copy">比赛即将开始</p><div class="count-ring" style="--progress:${state.countdown / 3 * 100}%"><div class="count-number">${state.countdown}<small>秒后开始</small></div></div><div class="countdown-rules"><b>比赛规则</b><div>${rules.map(([k,v])=>`<span><i>${k}</i>${v}</span>`).join('')}</div></div><div class="progress-dots"><i class="active"></i><i class="${state.countdown <= 2 ? 'active' : ''}"></i><i class="${state.countdown <= 1 ? 'active' : ''}"></i></div></section>`;
  }
  function optionButton(question, text, index, { disabled = false, correct = false } = {}) {
    const selected = answerIndexes(state.selected).includes(index);
    return `<button class="option ${selected ? 'selected' : ''} ${correct ? 'correct-option' : ''}" data-option="${index}" ${disabled ? 'disabled' : ''}><span class="option-key">${String.fromCharCode(65 + index)}</span><span>${escapeHtml(text)}</span></button>`;
  }
  function renderQuestion() {
    const q = state.questions[state.questionIndex];
    return `<section class="stage battle-stage" data-stage="QUESTION">${header(state.activity.mode === '组队PK' ? '答题' : '1v1 PK赛', false)}${scoreBoard()}<div class="question-head"><span class="question-index">第 ${state.questionIndex + 1} 题 / 共 ${state.questions.length} 题</span><button class="rule-link">规则</button></div><div class="question-type-row"><span>${isMulti(q) ? '多选题' : q.type || '单选题'}</span><div class="question-timer" id="questionTimer" style="--progress:100%"><span id="timeValue">${state.timeLeft}s</span></div></div><h2 class="question-title">${escapeHtml(q.title)}</h2><div class="options">${q.options.map((text, index) => optionButton(q, text, index)).join('')}</div>${state.activity.mode === '组队PK' ? '<p class="team-answer-note">本题以本队最快提交成员的答案作为本队答案</p>' : ''}${footer(`<button class="btn primary" data-submit ${hasSelection() ? '' : 'disabled'}>提交</button>`)}</section>`;
  }
  function renderSubmitted() {
    const q = state.questions[state.questionIndex];
    return `<section class="stage no-footer submitted-stage battle-stage" data-stage="SUBMITTED_WAITING">${header('提交等待', false)}${scoreBoard()}<div class="question-head"><span class="question-index">第 ${state.questionIndex + 1} 题 / 共 ${state.questions.length} 题</span><button class="rule-link">规则</button></div><div class="waiting-panel"><div><img class="waiting-mascot" src="${avatarAssets.mascot}" alt=""><b>${state.activity.mode === '组队PK' ? '等待双方队伍完成本题' : '等待对方提交答案'}</b><p>${state.activity.mode === '组队PK' ? '双方全部完成后统一展示本题结果' : '双方完成后统一展示本题结果'}</p><div class="answer-progress"><span class="done">我方已提交</span><span>${state.activity.mode === '组队PK' ? '对方队伍作答中' : '对手作答中'}</span><span>统一展示</span></div><div class="wait-dots"><i></i><i></i><i></i></div></div></div><div class="submitted-question"><span>${q.type || '单选题'}</span><p>${escapeHtml(q.title)}</p><b>${escapeHtml(answerText(q,state.selected))}</b></div></section>`;
  }
  function answerText(question, value) {
    const indexes = answerIndexes(value);
    return indexes.length ? indexes.map(index => `${String.fromCharCode(65 + index)} ${question.options[index] ?? ''}`).join('、') : '未作答';
  }
  function renderQuestionResult() {
    const q = state.questions[state.questionIndex], result = state.currentResult;
    const isLast = state.questionIndex >= state.questions.length - 1;
    const correctIndexes = answerIndexes(q.correct), myIndexes = answerIndexes(result.mySelected), opponentIndexes = answerIndexes(result.opponentSelected);
    const resultOptions = q.options.map((text,index)=>{const correct=correctIndexes.includes(index),mine=myIndexes.includes(index),opponent=opponentIndexes.includes(index);return `<div class="result-option ${correct?'correct':''} ${mine&&!correct?'wrong':''}"><b>${String.fromCharCode(65+index)}</b><span>${escapeHtml(text)}</span>${correct?'<i>✓</i>':mine?'<i>×</i>':''}</div>`}).join('');
    return `<section class="stage question-result-stage battle-stage" data-stage="QUESTION_RESULT">${header('答题结果', false)}${scoreBoard()}<div class="question-head"><span class="question-index">第 ${state.questionIndex + 1} 题 / 共 ${state.questions.length} 题</span><span class="result-badge">${q.type || '单选题'}</span></div><h2 class="question-title">${escapeHtml(q.title)}</h2><div class="result-options">${resultOptions}</div><div class="answer-compare card"><div class="answer-side mine"><span class="answer-label">我方答案</span><div class="answer-value">${escapeHtml(answerText(q, result.mySelected))}</div><span class="answer-status ${result.myCorrect ? '' : 'wrong'}">${result.myCorrect ? '答对' : '答错'}　${result.myDelta > 0 ? `+${result.myDelta} 分` : `${result.myDelta} 分`}</span></div><div class="answer-side opponent"><span class="answer-label">对方答案</span><div class="answer-value">${escapeHtml(answerText(q, result.opponentSelected))}</div><span class="answer-status ${result.opponentCorrect ? '' : 'wrong'}">${result.opponentCorrect ? '答对' : '答错'}　${result.opponentDelta > 0 ? `+${result.opponentDelta} 分` : `${result.opponentDelta} 分`}</span></div></div><div class="result-insight"><b>${result.myCorrect ? '回答正确！' : '本题答错'}</b><span>${result.myCorrect ? `获得 ${result.myDelta} 分` : `正确答案：${escapeHtml(answerText(q,q.correct))}`}</span></div>${footer(`<button class="btn primary" data-next>${isLast ? `查看对局结果（${state.activity.nextIntervalSeconds}s）` : `下一题（${state.activity.nextIntervalSeconds}s）`}</button>`)}</section>`;
  }
  function matchSummary() {
    const myCorrect = state.history.filter(item => item.myCorrect).length, opponentCorrect = state.history.filter(item => item.opponentCorrect).length;
    const outcome = state.myScore === state.opponentScore ? '平局' : state.myScore > state.opponentScore ? (state.activity.mode === '组队PK' ? '蓝队胜利' : '挑战胜利') : (state.activity.mode === '组队PK' ? '红队胜利' : '继续加油');
    const points = state.myScore > state.opponentScore ? state.activity.winPoints : state.activity.joinPoints;
    return { myCorrect, opponentCorrect, outcome, points };
  }
  function renderMatchResult() {
    const summary = matchSummary(), left = state.activity.mode === '组队PK' ? '蓝队' : '我方', right = state.activity.mode === '组队PK' ? '红队' : '对方';
    return `<section class="stage match-result" data-stage="MATCH_RESULT">${header('对局结果', false)}<div class="confetti">${Array.from({ length: 12 }, (_, i) => `<i style="left:${6 + i * 8}%;animation-delay:${(i % 4) * .08}s"></i>`).join('')}</div><img class="trophy-image" src="${visualAssets.trophy}" alt=""><h2>${summary.outcome}</h2><div class="final-score"><span class="team-result-label blue">${left}</span><b id="blueFinal">${state.myScore}</b><strong>:</strong><b id="redFinal">${state.opponentScore}</b><span class="team-result-label red">${right}</span></div><div class="result-data card"><div class="result-row"><span>正确题数</span><span>${summary.myCorrect}题</span><span>${summary.opponentCorrect}题</span></div><div class="result-row"><span>获得积分</span><span>+${state.myScore}</span><span>+${state.opponentScore}</span></div></div><div class="result-award"><span>🏆</span><p>本场比赛你表现出色，继续挑战吧！</p></div>${footer('<div class="result-actions"><button class="btn primary" data-again>再次挑战</button><button class="btn" data-review>查看答题回顾</button></div>')}</section>`;
  }
  function renderReviewOverview() {
    const summary = matchSummary(), onlyWrong = state.reviewTab === '仅看错题';
    const rows = state.history.map((result,index)=>({result,index,q:state.questions[index]})).filter(item=>!onlyWrong||!item.result.myCorrect);
    return `<section class="stage review-overview-stage" data-stage="REVIEW_OVERVIEW">${header('查看答题回顾')}<div class="review-score-head">${scoreBoard()}<div class="review-summary"><span>答对 <b>${summary.myCorrect}</b> 题</span><span>答错 <b>${state.history.length-summary.myCorrect}</b> 题</span></div></div><nav class="review-tabs"><button class="${state.reviewTab==='全部题目'?'active':''}" data-review-tab="全部题目">全部题目</button><button class="${state.reviewTab==='仅看错题'?'active':''}" data-review-tab="仅看错题">仅看错题</button></nav><div class="review-list">${rows.length?rows.map(({result,index,q})=>`<button class="review-card ${result.myCorrect?'correct':'wrong'}" data-review-item="${index}"><span class="review-state">${result.myCorrect?'✓':'×'}</span><div><b>第${index+1}题　${escapeHtml(q.title)}</b><p>我的答案：${escapeHtml(answerText(q,result.mySelected))}</p><small>对方答案：${escapeHtml(answerText(q,result.opponentSelected))}</small></div><em>${result.myElapsed ?? '-'}s</em></button>`).join(''):'<div class="review-empty">没有错题，全部回答正确</div>'}</div>${footer('<button class="btn primary" data-review-done>返回对局结果</button>')}</section>`;
  }
  function renderReview() {
    const q = state.questions[state.reviewIndex], result = state.history[state.reviewIndex], last = state.reviewIndex === state.history.length - 1, first = state.reviewIndex === 0;
    return `<section class="stage specific-review-stage" data-stage="REVIEW">${header('答题回顾')}<div class="review-duel-score">${scoreBoard()}</div><div class="review-question-nav">${state.history.map((_,index)=>`<button class="${index===state.reviewIndex?'active':''}" data-review-jump="${index}">${index+1}</button>`).join('')}</div><div class="review-meta"><span>第 ${state.reviewIndex + 1} 题 / 共 ${state.history.length} 题</span><span class="status">${q.type || '单选题'}</span></div><h2 class="question-title">${escapeHtml(q.title)}</h2><div class="options review-options">${q.options.map((text, index) => optionButton(q, text, index, { disabled: true, correct: answerIndexes(q.correct).includes(index) })).join('')}</div><div class="review-detail card"><div class="review-line correct"><span>正确答案</span><b>${escapeHtml(answerText(q, q.correct))}</b></div><div class="review-line"><span>我方答案</span><b>${escapeHtml(answerText(q, result.mySelected))}　${result.myCorrect?'正确':'错误'}　${result.myElapsed ?? '-'}s</b></div><div class="review-line opponent"><span>对方答案</span><b>${escapeHtml(answerText(q, result.opponentSelected))}　${result.opponentCorrect?'正确':'错误'}　${result.opponentElapsed ?? '-'}s</b></div></div><div class="review-tip">💡 熟悉企学院的核心能力，有助于更高效地完成培训任务。</div>${footer(`<div class="button-row">${first?'<button class="btn" data-review-overview>全部题目</button>':'<button class="btn" data-prev>上一题</button>'}${last?'<button class="btn primary" data-review-overview>全部题目</button>':'<button class="btn primary" data-review-next>下一题</button>'}</div>`)}</section>`;
  }
  function inviteModal() {
    if (!state.shareData) return '';
    return `<div class="c-modal" data-share-layer><div class="c-dialog"><button class="dialog-close" data-close-share aria-label="关闭">×</button><h2>邀请队友</h2><p>邀请本部门同事加入本场PK赛</p><img src="${escapeHtml(state.shareData.qrCodeUrl)}" alt="PK赛邀请二维码"><div class="share-link-row"><input value="${escapeHtml(state.shareData.shareUrl)}" readonly><button data-copy-invite>复制</button></div><small>${escapeHtml(state.shareData.accessHint || '')}</small></div></div>`;
  }
  const renderers = { HOME: renderHome, LIST: renderList, DETAIL: renderDetail, MATCHING: renderMatching, TEAM_WAITING: renderTeamWaiting, TEAM_READY: renderTeamReady, COUNTDOWN: renderCountdown, QUESTION: renderQuestion, SUBMITTED_WAITING: renderSubmitted, QUESTION_RESULT: renderQuestionResult, MATCH_RESULT: renderMatchResult, REVIEW_OVERVIEW: renderReviewOverview, REVIEW: renderReview };
  function render() {
    app.innerHTML = renderers[state.stage]() + inviteModal();
    bind();
    afterRender();
  }
  function setStage(stage, push = true) {
    clearTimers(); state.stage = stage;
    if (push) history.pushState({ stage }, '', location.href);
    render();
  }
  function back() {
    const previous = { LIST: Stage.HOME, DETAIL: Stage.LIST, MATCHING: Stage.DETAIL, TEAM_WAITING: Stage.DETAIL, TEAM_READY: Stage.DETAIL, COUNTDOWN: Stage.DETAIL, QUESTION: Stage.DETAIL, SUBMITTED_WAITING: Stage.QUESTION, QUESTION_RESULT: Stage.QUESTION, MATCH_RESULT: Stage.DETAIL, REVIEW_OVERVIEW: Stage.MATCH_RESULT, REVIEW: Stage.REVIEW_OVERVIEW };
    setStage(previous[state.stage] || Stage.HOME, false);
  }
  function bindActivityCards() {
    document.querySelectorAll('[data-activity]').forEach(card => card.onclick = () => {
      const activity = state.activities.find(item => item.id === card.dataset.activity);
      if (activity) { setActivity(activity); setStage(Stage.DETAIL); }
    });
  }
  function selectOption(index) {
    const q = state.questions[state.questionIndex];
    if (isMulti(q)) {
      const selected = new Set(answerIndexes(state.selected));
      selected.has(index) ? selected.delete(index) : selected.add(index);
      state.selected = [...selected].sort((a, b) => a - b);
    } else state.selected = index;
    document.querySelectorAll('[data-option]').forEach(button => button.classList.toggle('selected', answerIndexes(state.selected).includes(Number(button.dataset.option))));
    const submit = document.querySelector('[data-submit]'); if (submit) submit.disabled = !hasSelection();
  }
  function bind() {
    document.querySelector('[data-back]')?.addEventListener('click', back);
    document.querySelector('[data-home]')?.addEventListener('click', () => setStage(Stage.HOME));
    document.querySelector('[data-pk-entry]')?.addEventListener('click', () => { setStage(Stage.LIST); loadActivities(); });
    document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { state.activeTab = button.dataset.tab; render(); });
    document.getElementById('activitySearch')?.addEventListener('input', event => { state.search = event.target.value; const list = document.querySelector('.activity-list'); if (list) { list.innerHTML = renderActivityRows(); bindActivityCards(); } });
    bindActivityCards();
    document.querySelector('[data-start]')?.addEventListener('click', startMatchFlow);
    document.querySelector('[data-retry]')?.addEventListener('click', startDuelMatch);
    document.querySelector('[data-cancel-match]')?.addEventListener('click', () => { state.match = null; state.matchError = ''; setStage(Stage.DETAIL); });
    document.querySelector('[data-leave]')?.addEventListener('click', requestExit);
    document.querySelector('[data-exit-pk]')?.addEventListener('click', requestExit);
    document.querySelector('[data-invite]')?.addEventListener('click', openInvite);
    document.querySelector('[data-close-share]')?.addEventListener('click', closeInvite);
    document.querySelector('[data-share-layer]')?.addEventListener('click', event => { if (event.target === event.currentTarget) closeInvite(); });
    document.querySelector('[data-copy-invite]')?.addEventListener('click', copyInvite);
    document.querySelectorAll('[data-option]').forEach(button => button.onclick = () => selectOption(Number(button.dataset.option)));
    document.querySelector('[data-submit]')?.addEventListener('click', () => submitAnswer(false));
    document.querySelector('[data-next]')?.addEventListener('click', nextQuestion);
    document.querySelector('[data-again]')?.addEventListener('click', resetMatch);
    document.querySelector('[data-review]')?.addEventListener('click', () => { state.reviewTab = '全部题目'; setStage(Stage.REVIEW_OVERVIEW); });
    document.querySelectorAll('[data-review-tab]').forEach(button => button.onclick = () => { state.reviewTab = button.dataset.reviewTab; render(); });
    document.querySelectorAll('[data-review-item]').forEach(button => button.onclick = () => { state.reviewIndex = Number(button.dataset.reviewItem); setStage(Stage.REVIEW); });
    document.querySelectorAll('[data-review-jump]').forEach(button => button.onclick = () => { state.reviewIndex = Number(button.dataset.reviewJump); render(); });
    document.querySelectorAll('[data-review-overview]').forEach(button => button.onclick = () => setStage(Stage.REVIEW_OVERVIEW));
    document.querySelector('[data-review-done]')?.addEventListener('click', () => setStage(Stage.MATCH_RESULT));
    document.querySelector('[data-prev]')?.addEventListener('click', () => { if (state.reviewIndex > 0) { state.reviewIndex--; render(); } });
    document.querySelector('[data-review-next]')?.addEventListener('click', () => { if (state.reviewIndex < state.history.length - 1) { state.reviewIndex++; render(); } });
  }
  function afterRender() {
    if (hold) return;
    if (state.stage === Stage.LIST || state.stage === Stage.DETAIL) startStatusRefresh();
    if (state.stage === Stage.TEAM_WAITING) pollLobby();
    if (state.stage === Stage.TEAM_READY) setTimer(beginCountdown, 1200);
    if (state.stage === Stage.COUNTDOWN) tickCountdown();
    if (state.stage === Stage.QUESTION) tickQuestion();
    if (state.stage === Stage.QUESTION_RESULT) scheduleNext();
  }
  function startStatusRefresh() {
    setTimer(async () => {
      const refreshStage = state.stage;
      let rendered = false;
      if (refreshStage === Stage.LIST) rendered = await loadActivities();
      else if (refreshStage === Stage.DETAIL && apiEnabled && state.activity?.id) {
        try {
          const data = await api(`/api/activities/${state.activity.id}`);
          const next = normalizeActivity(data.activity);
          if (dataFingerprint(next) !== dataFingerprint(state.activity)) {
            clearTimers(); setActivity(next); render(); rendered = true;
          } else updateRemainingLabels();
        } catch {}
      }
      if (!rendered && state.stage === refreshStage && (state.stage === Stage.LIST || state.stage === Stage.DETAIL)) startStatusRefresh();
    }, 5000);
  }
  function startMatchFlow() {
    if (derivedStatus(state.activity) !== '进行中' || !eligibility(state.activity)) return;
    state.activity.mode === '组队PK' ? startTeamLobby() : startDuelMatch();
  }
  async function startDuelMatch() {
    state.match = null; state.matchError = ''; state.matchingMessage = '正在从本场在线参赛学员中随机匹配';
    setStage(Stage.MATCHING);
    try {
      if (!apiEnabled || state.activity.id === fallbackActivity.id) {
        await new Promise(resolve => setTimeout(resolve, delay(800)));
        if (!state.activity.aiFallback) throw new Error('当前没有可匹配的真人对手，请稍后重试');
        state.match = { id: 'local-duel', mode: '1v1PK', opponent: { id: 'ai', name: 'AI陪练·小鹅', type: 'ai' } };
      } else {
        const data = await api('/api/matches', { method: 'POST', body: JSON.stringify({ activityId: state.activity.id, userId: currentUser.id, userName: currentUser.name, department: currentUser.department }) });
        if (data.status === 'match_failed') throw new Error(data.reason);
        state.match = data.match;
      }
      state.matchingMessage = state.match.opponent?.type === 'ai' ? '当前无真人对手，已由AI陪练补位' : '对手匹配成功';
      render(); setTimer(beginCountdown, 900);
    } catch (error) { state.matchError = error.message; state.matchingMessage = '匹配未成功'; render(); }
  }
  async function startTeamLobby() {
    state.lobby = null; setStage(Stage.TEAM_WAITING);
    if (!apiEnabled || state.activity.id === fallbackActivity.id) {
      state.lobby = { id: 'local-lobby', status: 'waiting', members: [{ id: currentUser.id, name: currentUser.name, department: currentUser.department, type: 'real' }] };
      render();
      setTimer(() => {
        const size = state.activity.teamSize, opponentDepartment=state.activity.participantDepartments?.find(name=>name!==currentUser.department)||'其他参赛部门',makeAi = (side, index, department) => ({ id: `ai-${side}-${index}`, name: `AI陪练${side}${index}`, department, type: 'ai' });
        state.lobby = { ...state.lobby, status: 'ready', teamDepartments:{blue:currentUser.department,red:opponentDepartment},teams: { blue: [{ id: currentUser.id, name: currentUser.name, department:currentUser.department,type: 'real' }, ...Array.from({ length: size - 1 }, (_, i) => makeAi('蓝', i + 1,currentUser.department))], red: Array.from({ length: size }, (_, i) => makeAi('红', i + 1,opponentDepartment)) } };
        state.match = { id: 'local-team', mode: '组队PK', teams: state.lobby.teams }; setStage(Stage.TEAM_READY);
      }, 15000);
      return;
    }
    try {
      const data = await api('/api/team-lobbies', { method: 'POST', body: JSON.stringify({ activityId: state.activity.id, userId: currentUser.id, userName: currentUser.name, department: currentUser.department }) });
      state.lobby = data.lobby; render();
    } catch (error) { state.matchError = error.message; alert(error.message); setStage(Stage.DETAIL); }
  }
  async function pollLobby() {
    if (!state.lobby || state.lobby.id === 'local-lobby') return;
    const poll = async () => {
      try {
        const data = await api(`/api/team-lobbies/${state.lobby.id}?userId=${encodeURIComponent(currentUser.id)}`);
        const nextLobby = data.lobby;
        if (nextLobby.status === 'ready') {
          state.lobby = nextLobby;
          const entered = await api(`/api/team-lobbies/${state.lobby.id}/enter`, { method: 'POST', body: JSON.stringify({ userId: currentUser.id }) }); state.match = entered.match; setStage(Stage.TEAM_READY); return;
        }
        if (nextLobby.status === 'failed') { alert(nextLobby.reason || '组队失败'); setStage(Stage.DETAIL); return; }
        const before = JSON.stringify({ members: state.lobby.members, teams: state.lobby.teams, status: state.lobby.status });
        const after = JSON.stringify({ members: nextLobby.members, teams: nextLobby.teams, status: nextLobby.status });
        state.lobby = nextLobby;
        if (before !== after) updateLobbyView();
      } catch (error) { console.info('组队房间刷新失败：', error.message); }
    };
    setLoop(poll, 1000);
  }
  async function leaveLobby() {
    clearTimers();
    if (apiEnabled && state.lobby?.id && state.lobby.id !== 'local-lobby' && state.lobby.status === 'waiting') {
      try { await api(`/api/team-lobbies/${state.lobby.id}/leave`, { method: 'POST', body: JSON.stringify({ userId: currentUser.id }) }); } catch {}
    }
    state.lobby = null; setStage(Stage.DETAIL);
  }
  function updateLobbyView() {
    if (state.stage !== Stage.TEAM_WAITING) return;
    const teams = lobbyTeams();
    const cards = document.querySelectorAll('.team-card');
    if (cards[0]) cards[0].outerHTML = teamCard('蓝队', teams.blue, state.activity.teamSize, teams.blueDepartment);
    if (cards[1]) cards[1].outerHTML = teamCard('红队', teams.red, state.activity.teamSize, teams.redDepartment);
  }
  async function requestExit() {
    const inProgress = [Stage.COUNTDOWN, Stage.QUESTION, Stage.SUBMITTED_WAITING, Stage.QUESTION_RESULT].includes(state.stage);
    const message = inProgress ? '退出后本次对局将终止，当前成绩不会计入结果。确认退出吗？' : '退出后将离开当前匹配或组队队列。确认退出吗？';
    if (!confirm(message)) return;
    state.exiting = true;
    clearTimers();
    try {
      if (apiEnabled && state.lobby?.id && state.lobby.id !== 'local-lobby' && state.lobby.status === 'waiting') {
        await api(`/api/team-lobbies/${state.lobby.id}/leave`, { method: 'POST', body: JSON.stringify({ userId: currentUser.id }) });
      } else if (apiEnabled && state.match?.id && !String(state.match.id).startsWith('local-')) {
        await api(`/api/matches/${state.match.id}/exit`, { method: 'POST', body: JSON.stringify({ userId: currentUser.id }) });
      }
    } catch (error) { console.info('退出状态同步失败：', error.message); }
    state.match = null; state.lobby = null; state.currentResult = null; state.exiting = false; setStage(Stage.DETAIL);
  }
  async function openInvite() {
    try {
      const fallbackUrl = `${location.origin}${location.pathname}?entry=pk&activity=${encodeURIComponent(state.activity.id)}`;
      state.shareData = apiEnabled && state.activity.id !== fallbackActivity.id
        ? await api(`/api/activities/${state.activity.id}/share`)
        : { shareUrl: fallbackUrl, qrCodeUrl: `https://quickchart.io/qr?size=320&margin=3&text=${encodeURIComponent(fallbackUrl)}`, accessHint: '队友打开链接后可进入本场PK赛。' };
      app.insertAdjacentHTML('beforeend', inviteModal());
      document.querySelector('[data-close-share]')?.addEventListener('click', closeInvite);
      document.querySelector('[data-share-layer]')?.addEventListener('click', event => { if (event.target === event.currentTarget) closeInvite(); });
      document.querySelector('[data-copy-invite]')?.addEventListener('click', copyInvite);
    } catch (error) { alert(error.message); }
  }
  function closeInvite() { state.shareData = null; document.querySelector('[data-share-layer]')?.remove(); }
  async function copyInvite(event) {
    try { await navigator.clipboard.writeText(state.shareData.shareUrl); event.currentTarget.textContent = '已复制'; }
    catch { alert('复制失败，请长按链接复制。'); }
  }
  function beginCountdown() { state.countdown = 3; setStage(Stage.COUNTDOWN); }
  function tickCountdown() {
    if (state.countdown > 1) setTimer(() => { state.countdown--; render(); }, 1000);
    else setTimer(() => { state.questionIndex = 0; state.selected = isMulti(state.questions[0]) ? [] : null; state.timeLeft = state.activity.seconds; setStage(Stage.QUESTION); }, 1000);
  }
  function tickQuestion() {
    const total = state.activity.seconds, started = Date.now();
    setLoop(() => {
      state.timeLeft = Math.max(0, Math.ceil((total * 1000 - (Date.now() - started)) / 1000));
      const value = document.getElementById('timeValue'), ring = document.getElementById('questionTimer');
      if (value) value.textContent = `${state.timeLeft}s`; if (ring) ring.style.setProperty('--progress', `${state.timeLeft / total * 100}%`);
      if (state.timeLeft <= 0) submitAnswer(true);
    }, 250);
  }
  function localResult(question, selected, elapsed) {
    const myCorrect = sameAnswer(selected, question.correct), opponentSelected = question.options.length > 1 ? (answerIndexes(question.correct)[0] + 1) % question.options.length : 0, opponentCorrect = sameAnswer(opponentSelected, question.correct);
    let myDelta = myCorrect ? state.activity.baseScore : state.activity.wrongScore, opponentDelta = opponentCorrect ? state.activity.baseScore : state.activity.wrongScore;
    if (state.activity.timeBonus && myCorrect && opponentCorrect) myDelta += Math.max(0, state.activity.seconds - elapsed - 2) * state.activity.bonusPerSecond;
    return { mySelected: selected, opponentSelected, myCorrect, opponentCorrect, myDelta, opponentDelta, myElapsed: elapsed, opponentElapsed: Math.min(state.activity.seconds, elapsed + 2), myScore: state.myScore + myDelta, opponentScore: state.opponentScore + opponentDelta };
  }
  async function submitAnswer(timeout) {
    if (!timeout && !hasSelection()) return;
    clearTimers(); const question = state.questions[state.questionIndex], selected = hasSelection() ? state.selected : null, elapsed = state.activity.seconds - state.timeLeft;
    state.currentResult = null; setStage(Stage.SUBMITTED_WAITING);
    try {
      let result;
      if (apiEnabled && state.match?.id && !String(state.match.id).startsWith('local-')) {
        const queued = await api(`/api/matches/${state.match.id}/answer`, { method: 'POST', body: JSON.stringify({ questionIndex: state.questionIndex, selected, elapsed }) });
        if (queued.status === 'revealed') result = queued.result;
        while (!result) {
          await new Promise(resolve => setTimeout(resolve, delay(350)));
          const revealed = await api(`/api/matches/${state.match.id}/questions/${state.questionIndex}/result`);
          if (revealed.status === 'revealed') result = revealed.result;
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, delay(state.activity.mode === '组队PK' ? 1200 : 900)));
        result = localResult(question, selected, elapsed);
      }
      state.currentResult = result; state.myScore = Number(result.myScore); state.opponentScore = Number(result.opponentScore); state.history[state.questionIndex] = result; setStage(Stage.QUESTION_RESULT);
    } catch (error) { alert(error.message); state.selected = selected; setStage(Stage.QUESTION); }
  }
  function scheduleNext() {
    let remaining = Number(state.activity.nextIntervalSeconds || 2);
    setLoop(() => { remaining--; const target = document.getElementById('nextSeconds'); if (target) target.textContent = Math.max(remaining, 0); if (remaining <= 0) nextQuestion(); }, 1000);
  }
  function nextQuestion() {
    clearTimers();
    if (state.questionIndex >= state.questions.length - 1) { setStage(Stage.MATCH_RESULT); return; }
    state.questionIndex++; state.selected = isMulti(state.questions[state.questionIndex]) ? [] : null; state.timeLeft = state.activity.seconds; setStage(Stage.QUESTION);
  }
  function resetMatch() {
    state.questionIndex = 0; state.selected = null; state.history = []; state.currentResult = null; state.myScore = 0; state.opponentScore = 0; state.match = null; state.lobby = null; startMatchFlow();
  }
  async function onConfigUpdated() {
    clearTimers();
    const rendered = await loadActivities();
    if (!rendered && (state.stage === Stage.LIST || state.stage === Stage.DETAIL)) startStatusRefresh();
  }
  window.addEventListener('message', event => { if (event.data?.type === 'PK_CONFIG_UPDATED') onConfigUpdated(); });
  window.addEventListener('storage', event => { if (event.key === 'xiaoe-pk-demo-v3') onConfigUpdated(); });
  try { const channel = new BroadcastChannel('xiaoe-pk-demo'); channel.onmessage = onConfigUpdated; } catch {}
  window.addEventListener('popstate', event => { state.stage = event.state?.stage || Stage.HOME; render(); });
  window.__PK_APP__ = { Stage, state, loadActivities, setStage };
  loadActivities({ preserve: false });
})();
