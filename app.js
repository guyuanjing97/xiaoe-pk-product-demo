(() => {
  'use strict';

  const Stage = Object.freeze({
    HOME: 'HOME', LIST: 'LIST', INTRO: 'INTRO', DETAIL: 'DETAIL', ROOMS: 'ROOMS', MATCHING: 'MATCHING',
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
    { id: 'q5', title: '对局开始后，为保证公平应锁定哪些内容？', type: '多选题', options: ['题目内容', '题目顺序', '计分规则', '学员头像'], correct: [0, 1, 2] }
  ];
  const fallbackActivity = {
    id: 'pk-demo-fallback', name: '产品知识组队体验赛', description: '通过实时知识对战巩固产品与服务规范。',
    status: '可参与', shelfStatus: '立即上架', timedUnpublish: false, storeDisplay: '显示', mode: '1v1PK', teamSize: 3,
    groupMatchMode: 'department_vs_department', participantDepartments: ['产品中心', '客户成功部'], aiFallback: true, questionCount: 5, seconds: 15, nextIntervalSeconds: 2,
    baseScore: 10, wrongScore: -2, timeBonus: true, bonusPerSecond: 1,
    sourceName: '新人产品知识试卷', learnerIds: ['u1', 'u2', 'u4', 'u7'], attempts: 5,
    winPoints: 10, joinPoints: 2, questionSnapshot: fallbackQuestions
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
    myScore: 0, opponentScore: 0, matchingMessage: '', matchError: '', exiting: false, shareData: null,
    rooms: [], modal: null, selectedOpponents: [], inviteRoomId: null,
    answerSync: null, reconnectRoom: null, timers: []
  };
  const learnerCandidates = [
    { id: 'u2', name: '王二', department: '产品中心', avatar: avatarAssets.blue[1] },
    { id: 'u4', name: '李四', department: '客户成功部', avatar: avatarAssets.red[0] },
    { id: 'u5', name: '赵五', department: '销售一部', avatar: avatarAssets.red[1] },
    { id: 'u6', name: '陈六', department: '交付中心', avatar: avatarAssets.red[2] }
  ];

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
  function shelfState(activity) {
    if (activity?.manualStoppedAt || activity?.shelfStatus === '已停用' || activity?.status === '已停用') return '已停用';
    if (activity?.shelfStatus === '已下架') return '已下架';
    if (activity?.shelfStatus === '暂不上架') return '未上架';
    const shelfAt = new Date(activity?.shelfAt).getTime();
    const unpublishAt = new Date(activity?.unpublishAt).getTime();
    if (activity?.shelfStatus === '定时上架' && Number.isFinite(shelfAt) && Date.now() < shelfAt) return '未上架';
    if (activity?.timedUnpublish && Number.isFinite(unpublishAt) && Date.now() >= unpublishAt) return '已下架';
    return '已上架';
  }
  function derivedStatus(activity) {
    return shelfState(activity) === '已上架' ? '可参与' : shelfState(activity);
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
    const merged = { ...fallbackActivity, ...activity };
    const normalized = {
      ...merged, status: derivedStatus(merged),
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
  function eligibility(activity) {
    return !activity.learnerIds?.length || activity.learnerIds.includes(currentUser.id);
  }
  function visibleInLearnerSide(activity) {
    return activity?.storeDisplay !== '隐藏' && shelfState(activity) === '已上架';
  }
  const dataFingerprint = value => JSON.stringify(value);
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
    const nextActivities = (rows.length ? rows : [fallbackActivity])
      .map(normalizeActivity)
      .filter(item => visibleInLearnerSide(item) && eligibility(item));
    const changed = previousFingerprint !== dataFingerprint(nextActivities);
    state.activities = nextActivities;
    const requested = params.get('activity');
    const currentId = preserve ? state.activity?.id : null;
    if (requested || currentId) state.activity = state.activities.find(item => item.id === (requested || currentId)) || null;
    if (requested && state.activity) state.stage = hasEnteredActivity(state.activity.id) ? Stage.DETAIL : Stage.INTRO;
    if (requested && !state.activity) state.stage = Stage.LIST;
    if (state.activity) setActivity(state.activity);
    const shouldRender = forceRender || changed || !app.firstElementChild;
    if (shouldRender) { clearTimers(); render(); }
    return shouldRender;
  }
  function setActivity(activity) {
    state.activity = normalizeActivity(activity);
    state.questions = state.activity.questionSnapshot;
    state.timeLeft = state.activity.seconds;
    loadRooms();
  }
  const enteredKey = activityId => `xiaoe-pk-entered:${activityId}:${currentUser.id}`;
  const roomKey = activityId => `xiaoe-pk-rooms:${activityId}`;
  const sessionKey = (activityId, roomId = '') => `xiaoe-pk-session:${activityId}:${currentUser.id}${roomId ? `:${roomId}` : ''}`;
  const hasEnteredActivity = activityId => localStorage.getItem(enteredKey(activityId)) === '1';
  function initialRooms(activityId) {
    return [
      { id: `${activityId}-invite`, owner: learnerCandidates[1], opponent: null, invitedIds: [currentUser.id], status: 'waiting', createdAt: Date.now() - 180000 },
      { id: `${activityId}-live`, owner: learnerCandidates[0], opponent: learnerCandidates[3], invitedIds: [], status: 'in_progress', connected: { u2: true, u6: true }, createdAt: Date.now() - 420000 }
    ];
  }
  function loadRooms() {
    if (!state.activity) return;
    try {
      const saved = JSON.parse(localStorage.getItem(roomKey(state.activity.id)) || 'null');
      state.rooms = Array.isArray(saved) ? saved : initialRooms(state.activity.id);
    } catch { state.rooms = initialRooms(state.activity.id); }
  }
  function saveRooms() {
    if (!state.activity) return;
    localStorage.setItem(roomKey(state.activity.id), JSON.stringify(state.rooms));
  }
  function activeOwnedRoom() {
    return state.rooms.find(room =>
      (room.owner?.id === currentUser.id || room.opponent?.id === currentUser.id) &&
      room.connected?.[currentUser.id] !== false &&
      ['waiting', 'in_progress'].includes(room.status)
    );
  }
  function persistSession(extra = {}) {
    if (!state.activity || !state.match) return;
    localStorage.setItem(sessionKey(state.activity.id, state.match.roomId), JSON.stringify({
      roomId: state.match.roomId, match: state.match, questionIndex: state.questionIndex,
      history: state.history, myScore: state.myScore, opponentScore: state.opponentScore,
      selected: state.selected, timeLeft: state.timeLeft, stage: state.stage,
      answerSync: state.answerSync, savedAt: Date.now(), ...extra
    }));
  }
  function loadSession(roomId = state.match?.roomId || state.reconnectRoom?.id) {
    try { return JSON.parse(localStorage.getItem(sessionKey(state.activity.id, roomId)) || 'null'); }
    catch { return null; }
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
    return `<article class="activity-card card" style="animation-delay:${index * 45}ms" data-activity="${escapeHtml(activity.id)}"><div class="pk-cover"><img src="${activity.cover || visualAssets.shield}" alt=""></div><div class="activity-main"><div class="activity-name"><span class="status">${status}</span><b>${escapeHtml(activity.name)}</b></div><div class="activity-meta">${mode} · 共${activity.questionCount}道题 · 每题${activity.seconds}秒</div><div class="countdown-text"><span class="clock-mark"></span><span>已向本场参赛学员开放</span></div></div><span class="activity-arrow">›</span></article>`;
  }
  function filteredActivities() {
    return state.activities.filter(item => (state.activeTab === '全部' || item.mode === state.activeTab) && (!state.search || item.name.includes(state.search)));
  }
  function renderActivityRows() {
    const rows = filteredActivities();
    return rows.length ? `${rows.map(activityCard).join('')}<div class="mode-promo"><div><b>1v1PK，实时知识对战</b><span>创建房间 · 邀请同事 · 独立答题</span><em>组队PK 后续开放</em></div><img src="${avatarAssets.mascot}" alt=""></div><div class="empty-state"><img src="${visualAssets.empty}" alt=""><span>没有更多活动了</span></div>` : `<div class="empty-state"><img src="${visualAssets.empty}" alt=""><span>该分类暂无PK赛</span></div>`;
  }
  function renderList() {
    const tabs = ['全部', '1v1PK', '组队PK'];
    return `<section class="stage no-footer list-stage" data-stage="LIST">${header('PK赛', false)}<label class="search"><input id="activitySearch" value="${escapeHtml(state.search)}" placeholder="搜索活动名称" aria-label="搜索活动名称"></label><nav class="tabs">${tabs.map(tab => `<button class="${state.activeTab === tab ? 'active' : ''}" data-tab="${tab}">${tab}</button>`).join('')}<i class="tab-indicator" style="transform:translateX(${tabs.indexOf(state.activeTab) * 100}%)"></i></nav><div class="activity-list">${renderActivityRows()}</div><nav class="pk-bottom-nav"><button data-home><i>⌂</i>首页</button><button><i>▣</i>学习</button><button class="active"><i>PK</i>PK赛</button><button><i>♙</i>我的</button></nav></section>`;
  }
  function renderIntro() {
    const a = state.activity, status = derivedStatus(a);
    const groupDisabled = a.mode === '组队PK';
    const allowed = eligibility(a), configured = a.questionSnapshot?.length > 0 && a.questionCount > 0;
    const disabled = groupDisabled || !allowed || !configured;
    const action = groupDisabled ? '组队PK 敬请期待' : !allowed ? '不在本场参赛范围' : !configured ? 'PK赛尚未配置题目' : '进入PK赛';
    return `<section class="stage intro-stage" data-stage="INTRO">${header('PK赛介绍')}<div class="intro-hero"><img src="${a.cover || visualAssets.shield}" alt=""><span class="status">${status}</span><div><small>1V1 知识对战</small><h2>${escapeHtml(a.name)}</h2><p>${escapeHtml(a.description || '与同事实时对战，在比拼中巩固知识。')}</p></div></div><div class="intro-stats card"><div><b>${a.questionCount}</b><span>对战题数</span></div><div><b>${a.seconds}s</b><span>每题答题时间</span></div><div><b>${a.attempts}</b><span>每日挑战次数</span></div></div><h3 class="section-title">PK赛说明</h3><div class="intro-rules card"><p><i>1</i>双方独立完成同一道题，一方先提交不会影响另一方作答。</p><p><i>2</i>双方都提交或答题时间结束后，统一展示本题结果。</p><p><i>3</i>答题正确且用时更短，可获得更高分数。</p></div>${!allowed ? '<div class="eligibility-note">当前账号不在本场参赛范围，请联系管理员。</div>' : ''}${groupDisabled ? '<div class="phase-note">组队PK将在后续版本开放，本期仅支持1v1PK。</div>' : ''}${footer(`<button class="btn primary" data-enter-activity ${disabled ? 'disabled' : ''}>${action}</button>`)}</section>`;
  }
  function roomPerson(person, fallback = '等待对手') {
    if (!person) return `<div class="room-person empty"><span>＋</span><b>${fallback}</b></div>`;
    const avatar = person.avatar || (person.id === currentUser.id ? avatarAssets.learner : avatarAssets.red[0]);
    return `<div class="room-person"><img src="${avatar}" alt=""><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.department || '')}</small></div>`;
  }
  function roomAction(room) {
    const mine = room.owner?.id === currentUser.id || room.opponent?.id === currentUser.id;
    const disconnected = mine && room.connected?.[currentUser.id] === false;
    if (disconnected) return '<button class="room-btn reconnect" data-reconnect-room>重新连接</button>';
    if (room.status === 'in_progress') return `<button class="room-btn" ${mine ? 'data-open-room' : 'disabled'}>${mine ? '返回对局' : '对局进行中'}</button>`;
    if (room.owner?.id === currentUser.id) return '<div class="room-actions"><button class="room-link" data-leave-room>退出房间</button><button class="room-btn invite" data-invite-opponents>邀请对手</button></div>';
    if (room.invitedIds?.includes(currentUser.id)) return '<button class="room-btn join" data-join-room>接受邀请</button>';
    return '<button class="room-btn join" data-join-room>立即加入</button>';
  }
  function roomCard(room) {
    const statusText = room.status === 'in_progress' ? '对局进行中' : room.owner?.id === currentUser.id ? '等待对手应战' : room.invitedIds?.includes(currentUser.id) ? '邀请你加入' : '可加入';
    return `<article class="duel-room card" data-room-id="${escapeHtml(room.id)}"><div class="room-head"><span class="room-status ${room.status}">${statusText}</span><time>${new Date(room.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}</time></div><div class="room-versus">${roomPerson(room.owner)}<strong>VS</strong>${roomPerson(room.opponent)}</div><div class="room-foot"><span>${room.status === 'in_progress' ? `第 ${Number(room.questionIndex || 0) + 1} 题进行中` : `${state.activity.questionCount}题 · 每题${state.activity.seconds}秒`}</span>${roomAction(room)}</div></article>`;
  }
  function renderRooms() {
    const own = activeOwnedRoom();
    const incoming = state.rooms.filter(room => room.status === 'waiting' && room.invitedIds?.includes(currentUser.id) && room.owner?.id !== currentUser.id).length;
    return `<section class="stage rooms-stage" data-stage="ROOMS">${header('1v1 对战大厅')}<div class="arena-banner"><div><small>KNOWLEDGE ARENA</small><h2>${escapeHtml(state.activity.name)}</h2><p>创建房间邀请同事，或接受邀请加入对局</p></div><img src="${visualAssets.shield}" alt=""></div><div class="mode-switch"><button class="active">1v1PK</button><button disabled>组队PK <small>后续开放</small></button></div>${incoming ? `<div class="invite-alert"><span>⚡</span><div><b>你收到 ${incoming} 个对战邀请</b><p>接受邀请即可进入对局</p></div></div>` : ''}<div class="room-toolbar"><div><b>对战房间</b><span>${state.rooms.length} 个房间</span></div><button class="create-room" data-create-room ${own ? 'disabled' : ''}>＋ 创建房间</button></div><div class="room-list">${state.rooms.length ? state.rooms.map(roomCard).join('') : '<div class="room-empty">暂无房间，创建一个房间邀请同事对战吧</div>'}</div>${own ? '<p class="owned-room-tip">同一时间只能参与一场未结束的对局。退出当前房间后，才可创建或加入其他房间。</p>' : ''}</section>`;
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
    const disabled = !allowed || !configured || a.mode === '组队PK';
    const action = !configured ? 'PK赛尚未配置题目' : !allowed ? '不在本场参赛范围' : a.mode === '组队PK' ? '组队PK 敬请期待' : '开始匹配';
    return `<section class="stage detail-stage" data-stage="DETAIL">${header('PK赛详情', true, true)}<div class="detail-summary card"><div class="pk-cover"><img src="${a.cover || visualAssets.shield}" alt=""></div><div><div class="detail-name"><b>${escapeHtml(a.name)}</b><span class="status">${status}</span></div><h2>${mode} · 共${a.questionCount}道题 · 每题答题时间${a.seconds}秒</h2><p>已向本场参赛学员开放，可随时发起对战</p></div></div><h3 class="section-title">PK赛规则</h3><div class="rule-panel card">${ruleRows(a).map(([icon, title, text]) => `<div class="rule-line"><span class="rule-icon ${icon}"></span><div><b>${title}</b><p>${escapeHtml(text)}</p></div></div>`).join('')}</div>${!allowed ? '<div class="eligibility-note">当前账号不在本场参赛范围，请联系管理员。</div>' : ''}${footer(`<span class="customer-service">联系客服</span><button class="btn primary" data-start ${disabled ? 'disabled' : ''}>${action}</button>`)}</section>`;
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
    const opponentDone = state.answerSync?.opponentSubmitted;
    const opponentOnline = state.answerSync?.opponentConnected !== false;
    const opponentCopy = opponentDone ? '对手已提交' : opponentOnline ? '对手作答中' : '对手已离线，等待本题结束';
    return `<section class="stage no-footer submitted-stage battle-stage" data-stage="SUBMITTED_WAITING">${header('提交等待', false)}${scoreBoard()}<div class="question-head"><span class="question-index">第 ${state.questionIndex + 1} 题 / 共 ${state.questions.length} 题</span><button class="rule-link">规则</button></div><div class="waiting-panel"><div><img class="waiting-mascot" src="${avatarAssets.mascot}" alt=""><b>${opponentDone ? '双方均已完成本题' : '等待对手完成本题'}</b><p>双方独立作答；双方都提交或答题时间结束后，统一展示结果</p><div class="answer-progress"><span class="done">我方已提交</span><span class="${opponentDone ? 'done opponent-done' : ''}">${opponentCopy}</span><span class="${opponentDone ? 'done reveal-ready' : ''}">统一展示</span></div><div class="wait-dots"><i></i><i></i><i></i></div></div></div><div class="submitted-question"><span>${q.type || '单选题'}</span><p>${escapeHtml(q.title)}</p><b>${escapeHtml(answerText(q,state.selected))}</b></div></section>`;
  }
  function answerText(question, value) {
    const indexes = answerIndexes(value);
    return indexes.length ? indexes.map(index => `${String.fromCharCode(65 + index)} ${question.options[index] ?? ''}`).join('、') : '未作答';
  }
  function renderQuestionResult() {
    const q = state.questions[state.questionIndex], result = state.currentResult;
    const isLast = state.questionIndex >= state.questions.length - 1;
    const myStatus = result.mySelected === null ? '未作答' : result.myCorrect ? '答对' : '答错';
    const opponentStatus = result.opponentSelected === null ? '未作答' : result.opponentCorrect ? '答对' : '答错';
    return `<section class="stage question-result-stage battle-stage" data-stage="QUESTION_RESULT">${header('答题结果', false)}${scoreBoard()}<div class="question-head"><span class="question-index">第 ${state.questionIndex + 1} 题 / 共 ${state.questions.length} 题</span><span class="result-badge">本题结果</span></div><h2 class="question-title">${escapeHtml(q.title)}</h2><div class="answer-compare card"><div class="answer-side mine"><span class="answer-label">我方答案</span><div class="answer-value">${escapeHtml(answerText(q, result.mySelected))}</div><span class="answer-status ${result.myCorrect ? '' : 'wrong'}">${myStatus}　${result.myDelta > 0 ? `+${result.myDelta} 分` : `${result.myDelta} 分`}</span><small>用时 ${result.myElapsed ?? '-'} 秒</small></div><div class="answer-side opponent"><span class="answer-label">对方答案</span><div class="answer-value">${escapeHtml(answerText(q, result.opponentSelected))}</div><span class="answer-status ${result.opponentCorrect ? '' : 'wrong'}">${opponentStatus}　${result.opponentDelta > 0 ? `+${result.opponentDelta} 分` : `${result.opponentDelta} 分`}</span><small>${result.opponentSelected === null ? '本题无作答记录' : `用时 ${result.opponentElapsed ?? '-'} 秒`}</small></div></div><p class="result-privacy-note">正确答案将在对局结束后的答题回顾中展示</p>${footer(`<button class="btn primary" data-next>${isLast ? `查看对局结果（${state.activity.nextIntervalSeconds}s）` : `下一题（${state.activity.nextIntervalSeconds}s）`}</button>`)}</section>`;
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
  function flowModal() {
    if (!state.modal) return '';
    if (state.modal === 'opponents') {
      return `<div class="c-modal"><div class="opponent-sheet"><div class="sheet-head"><button data-close-modal>×</button><h2>邀请对手</h2><span>可多选</span></div><label class="candidate-search">⌕ <input placeholder="搜索姓名或部门"></label><div class="candidate-list">${learnerCandidates.map(person => `<button class="candidate ${state.selectedOpponents.includes(person.id) ? 'selected' : ''}" data-candidate="${person.id}"><span class="check">${state.selectedOpponents.includes(person.id) ? '✓' : ''}</span><img src="${person.avatar}" alt=""><span><b>${person.name}</b><small>${person.department}</small></span></button>`).join('')}</div><div class="sheet-foot"><span>已选中 ${state.selectedOpponents.length} 人</span><button data-confirm-selection ${state.selectedOpponents.length ? '' : 'disabled'}>确定</button></div></div></div>`;
    }
    if (state.modal === 'confirm-invite') {
      return `<div class="c-modal"><div class="game-dialog"><span class="dialog-bolt">⚡</span><h2>发送对战邀请</h2><p>将向已选择的 ${state.selectedOpponents.length} 位学员发送PK邀请，对方可从本活动的对战大厅加入。</p><button class="btn primary" data-send-invite>确认发送</button></div></div>`;
    }
    if (state.modal === 'room-conflict') {
      return `<div class="c-modal"><div class="game-dialog"><span class="dialog-bolt warn">!</span><h2>已有进行中的房间</h2><p>请先退出自己创建或正在参与的房间，再加入其他对战。</p><button class="btn primary" data-close-modal>我知道了</button></div></div>`;
    }
    if (state.modal === 'reconnect') {
      return `<div class="c-modal"><div class="game-dialog"><span class="dialog-bolt reconnect">↻</span><h2>重新连接对局</h2><p>检测到你有一场尚未结束的PK，对局仍在继续。是否返回原对局？</p><div class="dialog-actions"><button class="btn" data-dismiss-reconnect>暂不连接</button><button class="btn primary" data-confirm-reconnect>重新连接</button></div></div></div>`;
    }
    return '';
  }
  const renderers = { HOME: renderHome, LIST: renderList, INTRO: renderIntro, DETAIL: renderDetail, ROOMS: renderRooms, MATCHING: renderMatching, TEAM_WAITING: renderTeamWaiting, TEAM_READY: renderTeamReady, COUNTDOWN: renderCountdown, QUESTION: renderQuestion, SUBMITTED_WAITING: renderSubmitted, QUESTION_RESULT: renderQuestionResult, MATCH_RESULT: renderMatchResult, REVIEW_OVERVIEW: renderReviewOverview, REVIEW: renderReview };
  function render() {
    app.innerHTML = renderers[state.stage]() + inviteModal() + flowModal();
    bind();
    afterRender();
  }
  function setStage(stage, push = true) {
    clearTimers(); state.stage = stage;
    if (push) history.pushState({ stage }, '', location.href);
    render();
  }
  function back() {
    const previous = { LIST: Stage.HOME, INTRO: Stage.LIST, DETAIL: Stage.LIST, ROOMS: Stage.DETAIL, MATCHING: Stage.ROOMS, TEAM_WAITING: Stage.DETAIL, TEAM_READY: Stage.DETAIL, COUNTDOWN: Stage.ROOMS, QUESTION: Stage.ROOMS, SUBMITTED_WAITING: Stage.QUESTION, QUESTION_RESULT: Stage.QUESTION, MATCH_RESULT: Stage.ROOMS, REVIEW_OVERVIEW: Stage.MATCH_RESULT, REVIEW: Stage.REVIEW_OVERVIEW };
    setStage(previous[state.stage] || Stage.HOME, false);
  }
  function bindActivityCards() {
    document.querySelectorAll('[data-activity]').forEach(card => card.onclick = () => {
      const activity = state.activities.find(item => item.id === card.dataset.activity);
      if (activity) { setActivity(activity); setStage(hasEnteredActivity(activity.id) ? Stage.DETAIL : Stage.INTRO); }
    });
  }
  function enterActivity() {
    localStorage.setItem(enteredKey(state.activity.id), '1');
    setStage(Stage.DETAIL);
  }
  function currentPerson() {
    return { id: currentUser.id, name: currentUser.name, department: currentUser.department, avatar: avatarAssets.learner };
  }
  function createRoomFlow() {
    if (activeOwnedRoom()) { state.modal = 'room-conflict'; render(); return; }
    state.inviteRoomId = null;
    state.selectedOpponents = [];
    state.modal = 'opponents'; render();
  }
  function inviteMore(room) {
    if (!room || room.owner?.id !== currentUser.id || room.status !== 'waiting') return;
    state.inviteRoomId = room.id;
    state.selectedOpponents = [...(room.invitedIds || [])];
    state.modal = 'opponents'; render();
  }
  function toggleCandidate(id) {
    state.selectedOpponents = state.selectedOpponents.includes(id)
      ? state.selectedOpponents.filter(item => item !== id)
      : [...state.selectedOpponents, id];
    render();
  }
  function confirmOpponentSelection() {
    if (!state.selectedOpponents.length) return;
    state.modal = 'confirm-invite'; render();
  }
  function sendRoomInvites() {
    const existing = state.inviteRoomId ? state.rooms.find(room => room.id === state.inviteRoomId) : null;
    if (existing) existing.invitedIds = [...new Set([...(existing.invitedIds || []), ...state.selectedOpponents])];
    else {
      const room = {
        id: `${state.activity.id}-${Date.now()}`, owner: currentPerson(), opponent: null,
        invitedIds: [...state.selectedOpponents], status: 'waiting', connected: { [currentUser.id]: true }, createdAt: Date.now()
      };
      state.rooms.unshift(room);
    }
    saveRooms(); state.modal = null; state.selectedOpponents = []; state.inviteRoomId = null;
    render();
  }
  function roomFromElement(element) {
    const card = element?.closest('[data-room-id]');
    return card ? state.rooms.find(item => item.id === card.dataset.roomId) : null;
  }
  function joinRoom(room) {
    if (!room) return;
    const owned = activeOwnedRoom();
    if (owned && owned.id !== room.id) { state.modal = 'room-conflict'; render(); return; }
    if (room.status === 'in_progress') {
      if (room.connected?.[currentUser.id] === false) { state.reconnectRoom = room; state.modal = 'reconnect'; render(); }
      else openExistingRoom(room);
      return;
    }
    room.opponent = currentPerson(); room.status = 'in_progress'; room.connected = { [room.owner.id]: true, [currentUser.id]: true }; room.questionIndex = 0;
    saveRooms();
    state.match = { id: `local-${room.id}`, roomId: room.id, mode: '1v1PK', opponent: room.owner };
    state.matchingMessage = `已接受 ${room.owner.name} 的邀请`;
    setStage(Stage.MATCHING);
    setTimer(beginCountdown, 1200);
  }
  function openExistingRoom(room) {
    const other = room.owner.id === currentUser.id ? room.opponent : room.owner;
    state.match = { id: `local-${room.id}`, roomId: room.id, mode: '1v1PK', opponent: other || learnerCandidates[1] };
    const saved = loadSession(room.id);
    if (saved?.roomId === room.id) {
      state.reconnectRoom = room; state.modal = 'reconnect'; render();
    } else startRoomMatch(room);
  }
  function confirmReconnect() {
    const saved = loadSession(state.reconnectRoom?.id);
    if (!saved) { state.modal = null; startRoomMatch(state.reconnectRoom); return; }
    state.match = saved.match; state.questionIndex = Number(saved.questionIndex || 0); state.history = saved.history || [];
    state.myScore = Number(saved.myScore || 0); state.opponentScore = Number(saved.opponentScore || 0);
    state.selected = saved.selected ?? null; state.timeLeft = Math.max(1, Number(saved.timeLeft || state.activity.seconds));
    state.answerSync = saved.answerSync || null;
    const room = state.rooms.find(item => item.id === saved.roomId);
    if (room) {
      const roomQuestionIndex = Math.min(Number(room.questionIndex || 0), state.questions.length - 1);
      while (state.questionIndex < roomQuestionIndex) {
        const missedIndex = state.questionIndex;
        const question = state.questions[missedIndex];
        const opponentSelected = question.correct;
        const myDelta = Number(state.activity.wrongScore || 0);
        const opponentDelta = Number(state.activity.baseScore || 0);
        state.myScore += myDelta;
        state.opponentScore += opponentDelta;
        state.history[missedIndex] = {
          mySelected: null,
          opponentSelected,
          myCorrect: false,
          opponentCorrect: true,
          myDelta,
          opponentDelta,
          myElapsed: null,
          opponentElapsed: Math.max(2, Number(state.activity.seconds || 15) - 4),
          myScore: state.myScore,
          opponentScore: state.opponentScore,
          disconnected: true
        };
        state.questionIndex++;
      }
      room.connected = { ...(room.connected || {}), [currentUser.id]: true };
      saveRooms();
    }
    state.selected = isMulti(state.questions[state.questionIndex]) ? [] : null;
    state.timeLeft = Number(state.activity.seconds || 15);
    state.answerSync = null;
    state.modal = null; state.reconnectRoom = null; setStage(Stage.QUESTION);
  }
  function startRoomMatch(room) {
    if (!room) return;
    const other = room.owner.id === currentUser.id ? room.opponent : room.owner;
    state.match = { id: `local-${room.id}`, roomId: room.id, mode: '1v1PK', opponent: other || learnerCandidates[1] };
    room.status = 'in_progress';
    room.opponent ||= other || learnerCandidates[1];
    room.connected = { ...(room.connected || {}), [room.owner.id]: true, [room.opponent.id]: true, [currentUser.id]: true };
    room.questionIndex = 0;
    saveRooms();
    state.questionIndex = 0; state.selected = null; state.history = []; state.currentResult = null;
    state.myScore = 0; state.opponentScore = 0; state.answerSync = null;
    persistSession();
    beginCountdown();
  }
  function currentRoom() {
    return state.match?.roomId ? state.rooms.find(room => room.id === state.match.roomId) : null;
  }
  function leaveWaitingRoom(room) {
    if (!room || room.owner?.id !== currentUser.id || room.status !== 'waiting') return;
    state.rooms = state.rooms.filter(item => item.id !== room.id); saveRooms(); render();
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
    document.querySelector('[data-enter-activity]')?.addEventListener('click', enterActivity);
    document.querySelector('[data-create-room]')?.addEventListener('click', createRoomFlow);
    document.querySelectorAll('[data-invite-opponents]').forEach(button => button.onclick = () => inviteMore(roomFromElement(button)));
    document.querySelectorAll('[data-candidate]').forEach(button => button.onclick = () => toggleCandidate(button.dataset.candidate));
    document.querySelector('[data-confirm-selection]')?.addEventListener('click', confirmOpponentSelection);
    document.querySelector('[data-send-invite]')?.addEventListener('click', sendRoomInvites);
    document.querySelectorAll('[data-close-modal]').forEach(button => button.onclick = () => { state.modal = null; state.inviteRoomId = null; render(); });
    document.querySelectorAll('[data-join-room]').forEach(button => button.onclick = () => joinRoom(roomFromElement(button)));
    document.querySelectorAll('[data-open-room]').forEach(button => button.onclick = () => openExistingRoom(roomFromElement(button)));
    document.querySelectorAll('[data-reconnect-room]').forEach(button => button.onclick = () => { state.reconnectRoom = roomFromElement(button); state.modal = 'reconnect'; render(); });
    document.querySelectorAll('[data-leave-room]').forEach(button => button.onclick = () => leaveWaitingRoom(roomFromElement(button)));
    document.querySelector('[data-confirm-reconnect]')?.addEventListener('click', confirmReconnect);
    document.querySelector('[data-dismiss-reconnect]')?.addEventListener('click', () => { state.modal = null; state.reconnectRoom = null; render(); });
    document.querySelector('[data-start]')?.addEventListener('click', startMatchFlow);
    document.querySelector('[data-retry]')?.addEventListener('click', startDuelMatch);
    document.querySelector('[data-cancel-match]')?.addEventListener('click', () => { state.match = null; state.matchError = ''; setStage(Stage.ROOMS); });
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
          if (!visibleInLearnerSide(next) || !eligibility(next)) {
            clearTimers(); state.activity = null; state.stage = Stage.LIST;
            await loadActivities({ preserve: false, forceRender: true }); rendered = true;
          } else if (dataFingerprint(next) !== dataFingerprint(state.activity)) {
            clearTimers(); setActivity(next); render(); rendered = true;
          }
        } catch {}
      }
      if (!rendered && state.stage === refreshStage && (state.stage === Stage.LIST || state.stage === Stage.DETAIL)) startStatusRefresh();
    }, 5000);
  }
  function startMatchFlow() {
    if (!state.activity || !visibleInLearnerSide(state.activity) || !eligibility(state.activity)) return;
    if (!(state.activity.questionSnapshot?.length || state.activity.questionCount > 0)) return;
    if (state.activity.mode === '组队PK') return;
    loadRooms(); setStage(Stage.ROOMS);
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
    const message = inProgress ? '退出后，对手仍可继续完成本场对局；你可以在对局结束前重新连接。确认退出吗？' : '确认离开当前页面吗？';
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
    const room = currentRoom();
    if (room && inProgress) {
      room.connected = { ...(room.connected || {}), [currentUser.id]: false };
      persistSession({ disconnected: true });
      const ownerOnline = room.connected?.[room.owner?.id] !== false;
      const opponentOnline = room.opponent ? room.connected?.[room.opponent.id] !== false : false;
      if (!ownerOnline && !opponentOnline) {
        state.rooms = state.rooms.filter(item => item.id !== room.id);
        localStorage.removeItem(sessionKey(state.activity.id, room.id));
      }
      saveRooms();
    }
    state.match = null; state.lobby = null; state.currentResult = null; state.exiting = false; setStage(Stage.ROOMS);
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
  function localResult(question, selected, elapsed, opponentConnected = true) {
    const myCorrect = sameAnswer(selected, question.correct);
    const opponentSelected = opponentConnected ? (state.questionIndex % 3 === 1 ? answerIndexes(question.correct)[0] : (answerIndexes(question.correct)[0] + 1) % question.options.length) : null;
    const opponentCorrect = opponentSelected !== null && sameAnswer(opponentSelected, question.correct);
    const opponentElapsed = opponentConnected ? Math.min(state.activity.seconds, Math.max(elapsed + (state.questionIndex % 2 ? -2 : 3), 2)) : state.activity.seconds;
    let myDelta = myCorrect ? state.activity.baseScore : state.activity.wrongScore, opponentDelta = opponentCorrect ? state.activity.baseScore : state.activity.wrongScore;
    if (state.activity.timeBonus && myCorrect && opponentCorrect) {
      const timeDiff = Math.abs(opponentElapsed - elapsed) * state.activity.bonusPerSecond;
      if (elapsed < opponentElapsed) myDelta += timeDiff;
      else if (opponentElapsed < elapsed) opponentDelta += timeDiff;
    }
    return { mySelected: selected, opponentSelected, myCorrect, opponentCorrect, myDelta, opponentDelta, myElapsed: elapsed, opponentElapsed, myScore: state.myScore + myDelta, opponentScore: state.opponentScore + opponentDelta };
  }
  async function submitAnswer(timeout) {
    if (!timeout && !hasSelection()) return;
    clearTimers(); const question = state.questions[state.questionIndex], selected = hasSelection() ? state.selected : null, elapsed = state.activity.seconds - state.timeLeft;
    const room = currentRoom();
    const opponentId = state.match?.opponent?.id;
    const opponentConnected = !room || !opponentId || room.connected?.[opponentId] !== false;
    state.answerSync = { mySubmitted: true, opponentSubmitted: false, opponentConnected };
    state.currentResult = null; setStage(Stage.SUBMITTED_WAITING); persistSession();
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
        const simulatedOpponentElapsed = opponentConnected ? Math.min(state.activity.seconds, Math.max(elapsed + (state.questionIndex % 2 ? -2 : 3), 2)) : state.activity.seconds;
        const waitSeconds = opponentConnected ? Math.max(1, simulatedOpponentElapsed - elapsed) : Math.max(1, state.activity.seconds - elapsed);
        await new Promise(resolve => setTimeout(resolve, delay(waitSeconds * 1000)));
        state.answerSync.opponentSubmitted = true; render();
        await new Promise(resolve => setTimeout(resolve, delay(450)));
        result = localResult(question, selected, elapsed, opponentConnected);
      }
      state.currentResult = result; state.myScore = Number(result.myScore); state.opponentScore = Number(result.opponentScore); state.history[state.questionIndex] = result;
      if (room) { room.questionIndex = state.questionIndex; saveRooms(); }
      persistSession(); setStage(Stage.QUESTION_RESULT);
    } catch (error) { alert(error.message); state.selected = selected; setStage(Stage.QUESTION); }
  }
  function scheduleNext() {
    let remaining = Number(state.activity.nextIntervalSeconds || 2);
    setLoop(() => { remaining--; const target = document.getElementById('nextSeconds'); if (target) target.textContent = Math.max(remaining, 0); if (remaining <= 0) nextQuestion(); }, 1000);
  }
  function nextQuestion() {
    clearTimers();
    if (state.questionIndex >= state.questions.length - 1) {
      const room = currentRoom();
      if (room) {
        room.status = 'completed';
        state.rooms = state.rooms.filter(item => item.id !== room.id);
        saveRooms();
      }
      localStorage.removeItem(sessionKey(state.activity.id, room?.id || state.match?.roomId));
      setStage(Stage.MATCH_RESULT); return;
    }
    state.questionIndex++; state.selected = isMulti(state.questions[state.questionIndex]) ? [] : null; state.timeLeft = state.activity.seconds; state.answerSync = null;
    const room = currentRoom(); if (room) { room.questionIndex = state.questionIndex; saveRooms(); }
    persistSession(); setStage(Stage.QUESTION);
  }
  function resetMatch() {
    state.questionIndex = 0; state.selected = null; state.history = []; state.currentResult = null; state.myScore = 0; state.opponentScore = 0; state.match = null; state.lobby = null; state.answerSync = null; startMatchFlow();
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
