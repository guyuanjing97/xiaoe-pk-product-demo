(() => {
  const KEY='xiaoe-pk-demo-v3';
  const now=new Date(),isoLocal=d=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,16)};
  const startDefault=isoLocal(new Date(now.getTime()+24*60*60*1000));
  const endDefault=isoLocal(new Date(now.getTime()+8*24*60*60*1000));
  const covers=[
    {id:'cover-1',name:'蓝色PK主题',url:'assets/pk-c-visuals/pk-shield.png'},
    {id:'cover-2',name:'荣誉挑战主题',url:'assets/pk-c-visuals/trophy.png'},
    {id:'cover-3',name:'知识训练主题',url:'assets/pk-c-visuals/empty-activity.png'}
  ];
  const questions=[
    {id:'q1',title:'小鹅通企学院的核心定位是？',type:'单选题',difficulty:'简单',options:['企业培训工具','企业学习平台','企业营销平台','企业管理系统'],correct:1},
    {id:'q2',title:'PK赛可以复用企学院现有哪类资产？',type:'多选题',difficulty:'简单',options:['题库题目','试卷','课程评论','直播回放'],correct:[0,1]},
    {id:'q3',title:'组队PK中，每题以本队最快提交者的答案为准。',type:'判断题',difficulty:'简单',options:['正确','错误'],correct:0},
    {id:'q4',title:'双方都答对时，如何计算速度加分？',type:'单选题',difficulty:'适中',options:['按剩余时间','按双方用时差','固定加5分','不加分'],correct:1},
    {id:'q5',title:'PK数据分析应包含哪些指标？',type:'多选题',difficulty:'适中',options:['参与人数','胜负场次','题目正确率','学员积分'],correct:[0,1,2,3]},
    {id:'q6',title:'活动超过结束时间后，学员端展示为已结束。',type:'判断题',difficulty:'简单',options:['正确','错误'],correct:0}
  ];
  const papers=[
    {id:'p1',name:'新人产品知识试卷',count:5,total:50,random:'关闭',questionIds:['q1','q2','q3','q4','q5']},
    {id:'p2',name:'企学院功能认知卷',count:4,total:40,random:'关闭',questionIds:['q1','q3','q4','q6']},
    {id:'p3',name:'培训运营综合卷',count:6,total:60,random:'开启',questionIds:['q1','q2','q3','q4','q5','q6']}
  ];
  const learners=[
    {id:'u1',name:'张一',account:'zhangyi',department:'产品中心',matches:22,wins:17,accuracy:'83.6%',score:386,last:'2026-08-13 16:20'},
    {id:'u2',name:'王二',account:'wanger',department:'产品中心',matches:21,wins:18,accuracy:'83.8%',score:372,last:'2026-08-13 15:48'},
    {id:'u3',name:'李四',account:'lisi',department:'客户成功部',matches:20,wins:14,accuracy:'81.0%',score:351,last:'2026-08-13 15:12'},
    {id:'u4',name:'赵五',account:'zhaowu',department:'客户成功部',matches:19,wins:15,accuracy:'80.0%',score:338,last:'2026-08-13 14:36'},
    {id:'u5',name:'陈六',account:'chenliu',department:'销售中心',matches:16,wins:10,accuracy:'76.5%',score:286,last:'2026-08-12 18:05'}
  ];
  const defaultActivity=()=>({
    id:'pk-'+Date.now(),name:'',cover:'',description:'',mode:'1v1PK',teamSize:3,aiFallback:false,
    questionCount:0,seconds:15,nextIntervalSeconds:2,baseScore:10,wrongScore:-2,timeBonus:true,bonusPerSecond:1,
    attempts:5,winPoints:10,joinPoints:2,startAt:startDefault,endAt:endDefault,sourceType:'',sourceId:'',sourceName:'',sourceIds:[],questionSnapshot:[],
    shelfStatus:'立即上架',visibility:'全部学员',learnerIds:learners.map(x=>x.id),participantDepartments:['产品中心','客户成功部','销售中心'],
    status:'未开始',manager:'管理员',createdAt:new Date().toLocaleString('zh-CN',{hour12:false}).replaceAll('/','-'),updatedAt:'',setupComplete:false
  });
  const demoRows=[
    {...defaultActivity(),id:'demo-new',name:'新员工产品知识PK赛',cover:covers[0].url,mode:'1v1PK',questionCount:5,sourceName:'新人产品知识试卷',questionSnapshot:questions.slice(0,5),status:'未开始',shelfStatus:'已上架',participants:86,createdAt:'2026-08-08 14:10:00'},
    {...defaultActivity(),id:'demo-active',name:'产品知识部门挑战赛',cover:covers[1].url,mode:'组队PK',questionCount:5,sourceName:'企学院功能认知卷',questionSnapshot:questions.slice(0,5),status:'进行中',shelfStatus:'已上架',participants:120,createdAt:'2026-07-10 16:30:00'},
    {...defaultActivity(),id:'demo-ended',name:'信息安全挑战赛',cover:covers[2].url,mode:'1v1PK',questionCount:4,sourceName:'培训运营综合卷',questionSnapshot:questions.slice(0,4),status:'已结束',shelfStatus:'已下架',participants:72,createdAt:'2026-07-01 09:20:00'}
  ];
  const state={view:'list',detailTab:'questions',current:null,filters:{name:'',status:'全部',manager:''},moreId:null,dataTab:'score',selectedCover:'',pickerType:'questions',picked:new Set(),userSearch:'',userDepartment:'全部'};
  const app=document.querySelector('#app'),breadcrumb=document.querySelector('#breadcrumb'),modalRoot=document.querySelector('#modalRoot'),toastEl=document.querySelector('#toast');
  const escapeHtml=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getSaved=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
  const saveActivity=a=>{a.updatedAt=new Date().toLocaleString('zh-CN',{hour12:false}).replaceAll('/','-');localStorage.setItem(KEY,JSON.stringify(a));try{new BroadcastChannel('xiaoe-pk-demo').postMessage(a)}catch{};window.parent?.postMessage({type:'PK_CONFIG_UPDATED',config:a},'*')};
  const getRows=()=>{const saved=getSaved();return saved?[saved,...demoRows.filter(x=>x.id!==saved.id)]:demoRows};
  const toast=text=>{toastEl.textContent=text;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1800)};
  const setBreadcrumb=text=>breadcrumb.textContent=text;
  const statusDot=s=>s==='进行中'?'green':s==='未开始'?'blue':'';
  const shelfDot=s=>s==='已上架'||s==='立即上架'?'green':'orange';

  function render(){modalRoot.innerHTML='';if(state.view==='list')renderList();else if(state.view==='create')renderCreate();else renderDetail()}
  function renderList(){
    setBreadcrumb('PK赛');
    const rows=getRows().filter(x=>(!state.filters.name||x.name.includes(state.filters.name))&&(state.filters.status==='全部'||x.status===state.filters.status)&&(!state.filters.manager||(x.manager||'管理员').includes(state.filters.manager)));
    app.innerHTML=`<section class="page page-pad"><div class="toolbar"><button class="btn primary" data-create>新建PK赛</button><button class="btn" data-bank>题库</button><button class="btn text">PK赛使用教程</button><span class="spacer"></span></div>
      <div class="filter-panel"><label class="field-inline"><span>PK赛名称</span><input id="filterName" placeholder="请输入名称" value="${escapeHtml(state.filters.name)}"></label><label class="field-inline small"><span>活动状态</span><select id="filterStatus">${['全部','未开始','进行中','已结束'].map(x=>`<option ${x===state.filters.status?'selected':''}>${x}</option>`).join('')}</select></label><label class="field-inline"><span>管理老师</span><input id="filterManager" placeholder="请输入姓名" value="${escapeHtml(state.filters.manager)}"></label><button class="btn primary" data-filter>筛选</button><button class="btn text" data-reset>重置筛选条件</button></div>
      <table class="data-table"><thead><tr><th>PK赛名称</th><th>PK类型</th><th>题目数</th><th>参与人数</th><th>创建时间</th><th>上架状态</th><th>活动状态</th><th>操作</th></tr></thead><tbody>${rows.map(rowHtml).join('')||'<tr><td colspan="8" style="text-align:center;height:220px;color:#9aa1aa">暂无符合条件的PK赛</td></tr>'}</tbody></table><div class="pagination"><span>共${rows.length}条，每页10条</span><button class="active">1</button></div></section>`;
    app.querySelector('[data-create]').onclick=()=>{state.current=defaultActivity();state.selectedCover='';state.view='create';render()};
    app.querySelector('[data-bank]').onclick=()=>toast('题库沿用企学院现有题库，本Demo在题目设置中演示引用');
    app.querySelector('[data-filter]').onclick=()=>{state.filters={name:document.querySelector('#filterName').value.trim(),status:document.querySelector('#filterStatus').value,manager:document.querySelector('#filterManager').value.trim()};render()};
    app.querySelector('[data-reset]').onclick=()=>{state.filters={name:'',status:'全部',manager:''};render()};
    bindListActions();
  }
  function rowHtml(item){
    const primary=item.status==='未开始'?'管理':'查看';
    return `<tr><td><div class="name-cell"><img class="cover-thumb" src="${item.cover||covers[0].url}" alt=""><div><button class="link" data-manage="${item.id}"><b>${escapeHtml(item.name)}</b></button><div class="subline">管理老师：${escapeHtml(item.manager||'管理员')}</div></div></div></td><td>${item.mode}</td><td>${item.questionCount||0}</td><td>${item.participants??item.learnerIds?.length??0}</td><td>${escapeHtml(item.createdAt||'--')}</td><td><span class="dot ${shelfDot(item.shelfStatus)}"></span>${item.shelfStatus==='立即上架'?'已上架':item.shelfStatus}</td><td><span class="dot ${statusDot(item.status)}"></span>${item.status}</td><td><div class="row-actions"><button class="btn text" data-manage="${item.id}">${primary}</button><button class="btn text" data-share="${item.id}">分享</button><button class="btn text" data-data="${item.id}" ${item.status==='未开始'?'disabled':''}>数据</button><span class="more-wrap"><button class="btn text" data-more="${item.id}">更多⌄</button>${state.moreId===item.id?`<span class="more-menu"><button data-copy="${item.id}">复制</button><button data-shelf="${item.id}">${item.shelfStatus==='已下架'?'上架':'下架'}</button>${item.status==='进行中'?'<button data-end="'+item.id+'">结束</button>':'<button data-delete="'+item.id+'">删除</button>'}</span>`:''}</span></div></td></tr>`
  }
  function bindListActions(){
    app.querySelectorAll('[data-manage]').forEach(b=>b.onclick=()=>openDetail(b.dataset.manage,'questions'));
    app.querySelectorAll('[data-data]').forEach(b=>b.onclick=()=>{if(!b.disabled)openDetail(b.dataset.data,'data')});
    app.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>openShare(findActivity(b.dataset.share)));
    app.querySelectorAll('[data-more]').forEach(b=>b.onclick=e=>{e.stopPropagation();state.moreId=state.moreId===b.dataset.more?null:b.dataset.more;renderList()});
    app.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{const item=findActivity(b.dataset.copy);state.current={...item,id:'pk-'+Date.now(),name:item.name+'（副本）',status:'未开始',shelfStatus:'暂不上架',createdAt:new Date().toLocaleString('zh-CN',{hour12:false}).replaceAll('/','-')};state.view='create';render()});
    app.querySelectorAll('[data-shelf]').forEach(b=>b.onclick=()=>{const item=findActivity(b.dataset.shelf);item.shelfStatus=item.shelfStatus==='已下架'?'已上架':'已下架';saveActivity(item);state.moreId=null;render()});
    app.querySelectorAll('[data-end]').forEach(b=>b.onclick=()=>{const item=findActivity(b.dataset.end);item.status='已结束';saveActivity(item);state.moreId=null;render()});
    app.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const item=findActivity(b.dataset.delete);if(getSaved()?.id===item.id)localStorage.removeItem(KEY);state.moreId=null;toast('PK赛已删除');render()});
  }
  function findActivity(id){return getRows().find(x=>x.id===id)||getRows()[0]}

  function renderCreate(){
    const a=state.current;setBreadcrumb('PK赛  >  新建PK赛');
    app.innerHTML=`<section class="page"><div class="page-pad"><section class="section"><h2 class="section-title">基本信息</h2>${basicInfoForm(a,true)}</section>
      <section class="section"><h2 class="section-title">PK专属设置</h2>${pkQuickSettings(a)}</section>
      <section class="section"><h2 class="section-title">通用控制项</h2>${publishSettings(a)}</section></div>
      <div class="form-footer"><button class="btn" data-cancel>取消</button><button class="btn primary" data-create-save>保存并配置题目</button></div></section>`;
    bindEditableFields(a);bindCover();
    app.querySelector('[data-cancel]').onclick=()=>{state.view='list';render()};
    app.querySelector('[data-create-save]').onclick=()=>{
      clearErrors();const name=document.querySelector('#name').value.trim(),cover=state.selectedCover||a.cover;
      if(!name){showError('#name','请输入PK赛名称');return}
      if(!cover){document.querySelector('.cover-box').classList.add('error');document.querySelector('#coverError').textContent='请选择PK赛封面';return}
      collectEditable(a);a.name=name;a.cover=cover;a.setupComplete=false;a.status='未开始';saveActivity(a);toast('PK赛已创建，请继续添加题目');state.view='detail';state.detailTab='questions';state.current=a;setTimeout(render,300)
    };
  }
  function basicInfoForm(a,creating=false){
    return `<div class="form-row"><label class="form-label required">名称</label><div><input class="input" id="name" maxlength="45" placeholder="请输入PK赛名称，不超过45个字" value="${escapeHtml(a.name)}"><small class="error-text" data-error-for="name"></small></div></div>
      <div class="form-row"><label class="form-label required">封面</label><div><div class="cover-box" data-cover>${a.cover?`<img src="${a.cover}" alt="PK赛封面">`:'<div class="cover-empty"><b>＋</b>点击选择封面</div>'}</div><small class="help">建议比例16:9，支持jpg、png格式，大小不超过5MB</small><small class="error-text" id="coverError"></small></div></div>
      <div class="form-row"><label class="form-label">详情</label><div class="rich-editor"><div class="rich-tools"><span>⊕ 插入</span><span>↶</span><span>↷</span><span>正文⌄</span><b>B</b><i>I</i><u>U</u><span>☷</span><span>☰</span></div><div class="rich-area" id="description" contenteditable="true" data-placeholder="请输入PK赛详情">${escapeHtml(a.description||'')}</div><div class="rich-tip">友情提示：粘贴第三方内容，若排版不符合预期，需调整样式</div></div></div>${creating?'<div class="form-row"><span></span><div class="help">创建后将直接进入题目设置，可从题库添加单题或引用试卷。</div></div>':''}`
  }
  function pkQuickSettings(a){
    return `<div class="form-row"><label class="form-label">PK类型</label><div class="radio-row"><label><input type="radio" name="mode" value="1v1PK" ${a.mode!=='组队PK'?'checked':''}>1v1PK</label><label><input type="radio" name="mode" value="组队PK" ${a.mode==='组队PK'?'checked':''}>组队PK</label></div></div>
      <div class="form-row ${a.mode==='组队PK'?'':'hidden'}" id="teamSizeRow"><label class="form-label">每队人数</label><div class="unit-field"><input class="input" id="teamSize" type="number" min="2" max="10" value="${a.teamSize||3}"><span>人/队</span></div></div>
      <div class="form-row"><label class="form-label">活动时间</label><div class="two-fields"><input class="input" id="startAt" type="datetime-local" value="${a.startAt||startDefault}"><span>至</span><input class="input" id="endAt" type="datetime-local" value="${a.endAt||endDefault}"></div></div>
      <div class="form-row"><label class="form-label">答题设置</label><div class="two-fields"><span>每题答题时间</span><div class="unit-field"><input class="input" id="seconds" type="number" min="5" max="120" value="${a.seconds||15}"><span>秒</span></div><span>题间停留时间</span><div class="unit-field"><input class="input" id="nextIntervalSeconds" type="number" min="1" max="10" value="${a.nextIntervalSeconds||2}"><span>秒</span></div></div></div>
      <div class="form-row"><label class="form-label">计分规则</label><div class="two-fields"><span>答对</span><div class="unit-field"><input class="input" id="baseScore" type="number" min="1" value="${a.baseScore||10}"><span>分</span></div><span>答错或未作答</span><div class="unit-field"><input class="input" id="wrongScore" type="number" max="0" value="${a.wrongScore??-2}"><span>分</span></div></div></div>
      <div class="form-row"><label class="form-label">速度加分</label><div><label class="toggle"><input type="checkbox" id="timeBonus" ${a.timeBonus!==false?'checked':''}><span>双方都答对时，更快的一方按双方答题用时差加分</span></label><div class="unit-field" style="margin-top:10px"><span>每快1秒加</span><input class="input" id="bonusPerSecond" type="number" min="1" value="${a.bonusPerSecond||1}"><span>分</span></div></div></div>
      <div class="form-row"><label class="form-label">AI陪练补位</label><label class="toggle"><input type="checkbox" id="aiFallback" ${a.aiFallback?'checked':''}><span>未匹配到真人时由AI陪练补位</span></label></div>
      <div class="form-row"><label class="form-label">挑战次数</label><div class="unit-field"><span>每人每天</span><input class="input" id="attempts" type="number" min="1" value="${a.attempts||5}"><span>次</span></div></div>
      <div class="form-row"><label class="form-label">活动积分</label><div class="two-fields"><span>完成参与得</span><div class="unit-field"><input class="input" id="joinPoints" type="number" min="0" value="${a.joinPoints||2}"><span>分</span></div><span>获胜额外得</span><div class="unit-field"><input class="input" id="winPoints" type="number" min="0" value="${a.winPoints||10}"><span>分</span></div></div></div>`
  }
  function publishSettings(a){
    const shelf=a.shelfStatus==='已上架'?'立即上架':a.shelfStatus||'立即上架';
    return `<div class="form-row"><label class="form-label">上架设置</label><div><div class="radio-row">${['立即上架','定时上架','暂不上架'].map(x=>`<label><input type="radio" name="shelfStatus" value="${x}" ${shelf===x?'checked':''}>${x}</label>`).join('')}</div><div class="sub-panel hidden" id="schedulePanel"><div class="unit-field"><span>上架时间</span><input class="input" type="datetime-local" id="shelfAt" value="${a.shelfAt||startDefault}"></div></div></div></div>
      <div class="form-row"><label class="form-label">可见范围</label><div><div class="radio-row"><label><input type="radio" name="visibility" value="全部学员" ${a.visibility!=='部分学员'?'checked':''}>全部学员</label><label><input type="radio" name="visibility" value="部分学员" ${a.visibility==='部分学员'?'checked':''}>部分学员</label></div><div class="sub-panel ${a.visibility==='部分学员'?'':'hidden'}" id="learnerScopePanel"><button class="btn" data-select-learners>＋ 选择学员</button><span class="help" style="margin-left:12px">已选择 ${a.learnerIds?.length||0} 人</span></div></div></div>`
  }
  function bindEditableFields(a){
    document.querySelector('#name')?.addEventListener('input',e=>{if(e.target.value.trim()){e.target.classList.remove('error');e.target.parentElement.querySelector('.error-text').textContent=''}});
    document.querySelectorAll('input[name="mode"]').forEach(x=>x.onchange=()=>document.querySelector('#teamSizeRow')?.classList.toggle('hidden',x.value!=='组队PK'));
    document.querySelectorAll('input[name="shelfStatus"]').forEach(x=>x.onchange=()=>document.querySelector('#schedulePanel')?.classList.toggle('hidden',x.value!=='定时上架'));
    document.querySelectorAll('input[name="visibility"]').forEach(x=>x.onchange=()=>document.querySelector('#learnerScopePanel')?.classList.toggle('hidden',x.value!=='部分学员'));
    document.querySelector('[data-select-learners]')?.addEventListener('click',()=>openLearnerPicker(a));
  }
  function collectEditable(a){
    const val=id=>document.querySelector(id)?.value;
    a.name=val('#name')?.trim()||a.name;a.description=document.querySelector('#description')?.textContent.trim()||a.description;a.mode=document.querySelector('input[name="mode"]:checked')?.value||a.mode;
    a.startAt=val('#startAt')||a.startAt;a.endAt=val('#endAt')||a.endAt;a.seconds=Number(val('#seconds')||a.seconds);a.nextIntervalSeconds=Number(val('#nextIntervalSeconds')||a.nextIntervalSeconds);a.baseScore=Number(val('#baseScore')||a.baseScore);a.wrongScore=Number(val('#wrongScore')??a.wrongScore);a.timeBonus=document.querySelector('#timeBonus')?.checked??a.timeBonus;
    a.teamSize=Number(val('#teamSize')||a.teamSize);a.bonusPerSecond=Number(val('#bonusPerSecond')||a.bonusPerSecond);a.aiFallback=document.querySelector('#aiFallback')?.checked??a.aiFallback;a.attempts=Number(val('#attempts')||a.attempts);a.joinPoints=Number(val('#joinPoints')||a.joinPoints);a.winPoints=Number(val('#winPoints')||a.winPoints);
    a.shelfStatus=document.querySelector('input[name="shelfStatus"]:checked')?.value||a.shelfStatus;a.shelfAt=val('#shelfAt')||a.shelfAt;a.visibility=document.querySelector('input[name="visibility"]:checked')?.value||a.visibility;
  }
  function clearErrors(){document.querySelectorAll('.error').forEach(x=>x.classList.remove('error'));document.querySelectorAll('.error-text').forEach(x=>x.textContent='')}
  function showError(selector,text){const el=document.querySelector(selector);el.classList.add('error');el.parentElement.querySelector('.error-text').textContent=text;el.scrollIntoView({behavior:'smooth',block:'center'});el.focus()}

  function openDetail(id,tab='questions'){
    state.current={...findActivity(id)};state.selectedCover='';state.view='detail';state.detailTab=tab;state.picked=new Set(state.current.sourceIds||[]);render()
  }
  function renderDetail(){
    const a=state.current;setBreadcrumb(`PK赛  >  ${a.name}  >  详情`);
    app.innerHTML=`<section class="detail-head"><img src="${a.cover||covers[0].url}" alt=""><div><h1>${escapeHtml(a.name)}</h1><div class="detail-meta"><span>题目数：${a.questionCount||0}</span><span>参与人数：${a.participants??a.learnerIds?.length??0}</span><span><i class="dot ${shelfDot(a.shelfStatus)}"></i>${a.shelfStatus==='立即上架'?'已上架':a.shelfStatus}</span><span><i class="dot ${statusDot(a.status)}"></i>${a.status}</span></div></div><div class="detail-actions"><button class="btn text" data-share-detail>分享</button><button class="btn text" data-back-list>返回列表</button></div></section>
      <section class="detail-layout"><nav class="detail-nav">${[['basic','基本信息'],['questions','题目设置'],['pk','PK设置'],['publish','上架设置'],['users','用户列表'],['data','数据分析']].map(([id,label])=>`<button data-tab="${id}" class="${state.detailTab===id?'active':''}">${label}</button>`).join('')}</nav><div class="detail-content">${detailPanel(a)}</div></section>`;
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.detailTab=b.dataset.tab;renderDetail()});
    document.querySelector('[data-back-list]').onclick=()=>{state.view='list';render()};document.querySelector('[data-share-detail]').onclick=()=>openShare(a);
    bindDetailPanel(a);
  }
  function detailPanel(a){
    const editable=a.status==='未开始',notice=editable?'':`<div class="notice">${a.status}的PK赛仅支持查看，不能修改活动配置。</div>`;
    if(state.detailTab==='basic')return `<div class="panel-head"><h2>基本信息</h2></div>${notice}<div class="${editable?'':'read-only'}">${basicInfoForm(a)}</div>${editable?'<div class="form-footer"><button class="btn primary" data-save-detail>保存</button></div>':''}`;
    if(state.detailTab==='questions')return `${notice}<div class="${editable?'':'read-only'}">${questionPanel(a,editable)}</div>`;
    if(state.detailTab==='pk')return `<div class="panel-head"><h2>PK设置</h2></div>${notice}<div class="${editable?'':'read-only'}">${pkQuickSettings(a)}</div>${editable?'<div class="form-footer"><button class="btn primary" data-save-detail>保存</button></div>':''}`;
    if(state.detailTab==='publish')return `<div class="panel-head"><h2>上架设置</h2></div>${notice}<div class="${editable?'':'read-only'}">${publishSettings(a)}</div>${editable?'<div class="form-footer"><button class="btn primary" data-save-detail>保存</button></div>':''}`;
    if(state.detailTab==='users')return usersPanel(a);
    return dataPanel(a)
  }
  function questionPanel(a,editable=true){
    const selected=a.questionSnapshot||[];
    return `<div class="panel-head"><h2>题目设置</h2><span class="spacer"></span>${selected.length&&editable?'<button class="btn" data-add-source>继续添加</button>':''}</div>${selected.length?`<div class="question-summary"><div class="summary-box"><b>${selected.length}</b>道题目</div><div class="summary-box"><b>${escapeHtml(a.sourceName||'混合选题')}</b><span>题目来源</span></div></div><table class="data-table"><thead><tr><th>序号</th><th>题目</th><th>题型</th><th>难度</th>${editable?'<th>操作</th>':''}</tr></thead><tbody>${selected.map((q,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(q.title)}</td><td>${q.type}</td><td>${q.difficulty||'简单'}</td>${editable?`<td><button class="btn text" data-remove-q="${q.id}">移除</button></td>`:''}</tr>`).join('')}</tbody></table>`:`<div class="choose-source"><button class="source-card" data-source="questions">＋ 从题库中添加题目</button><button class="source-card" data-source="papers">＋ 从试卷库中选择试卷</button></div><div class="empty-state"><div><div class="empty-icon">▤</div><p>暂未添加题目</p><span>添加题目后才可开始PK赛</span></div></div>`}`
  }
  function usersPanel(a){
    const dept=state.userDepartment,term=state.userSearch.toLowerCase(),rows=learners.filter(x=>(dept==='全部'||x.department===dept)&&(!term||x.name.includes(term)||x.account.includes(term)));
    return `<div class="panel-head"><h2>用户列表</h2><span class="spacer"></span><button class="btn" data-export-users>导出</button></div><div class="filter-strip"><select id="userKey"><option>姓名/账号</option></select><input id="userSearch" placeholder="请输入姓名或账号" value="${escapeHtml(state.userSearch)}"><select id="userDepartment"><option>全部</option>${['产品中心','客户成功部','销售中心'].map(x=>`<option ${x===dept?'selected':''}>${x}</option>`).join('')}</select><button class="btn primary" data-filter-users>筛选</button><button class="btn text" data-reset-users>重置筛选条件</button></div><div class="toolbar"><button class="btn primary" data-add-users>添加学员</button><button class="btn">贴标签⌄</button><button class="btn">联系用户⌄</button><span class="spacer"></span><span>共${rows.length}条</span></div><table class="data-table"><thead><tr><th>用户</th><th>账号</th><th>部门</th><th>参赛次数</th><th>胜场</th><th>正确率</th><th>累计积分</th><th>最后参赛时间</th><th>操作</th></tr></thead><tbody>${rows.map(x=>`<tr><td><span class="avatar"></span>${x.name}</td><td>${x.account}</td><td>${x.department}</td><td>${x.matches}</td><td>${x.wins}</td><td>${x.accuracy}</td><td>${x.score}</td><td>${x.last}</td><td><button class="btn text">查看对局</button></td></tr>`).join('')}</tbody></table>`
  }
  function dataPanel(a){
    const hasData=a.status!=='未开始';
    const metrics=hasData?[[86,'实际参赛人数'],[248,'已完成对局'],['78.6%','平均正确率'],[3420,'已发放积分']]:[[0,'实际参赛人数'],[0,'已完成对局'],['0%','平均正确率'],[0,'已发放积分']];
    const scoreRows=hasData?learners.slice().sort((x,y)=>y.score-x.score):[];
    return `<div class="panel-head"><h2>PK赛概况</h2><span class="spacer"></span><button class="btn" data-export-data>导出</button></div><div class="metrics">${metrics.map(([v,k])=>`<div class="metric"><span>${k}</span><b>${v}</b></div>`).join('')}</div><div class="tabs">${[['score','个人总分榜'],['wins','胜场榜'],['team','团队榜'],['questions','题目分析']].map(([id,label])=>`<button class="${state.dataTab===id?'active':''}" data-data-tab="${id}">${label}</button>`).join('')}</div><div class="filter-strip"><select><option>全部部门</option><option>产品中心</option><option>客户成功部</option></select><input type="text" placeholder="请输入学员姓名"><button class="btn primary">筛选</button><button class="btn text">重置筛选条件</button></div>${dataTable(state.dataTab,scoreRows,hasData)}`
  }
  function dataTable(tab,rows,hasData){
    if(tab==='questions')return `<table class="data-table"><thead><tr><th>题目</th><th>作答次数</th><th>答对</th><th>答错/未作答</th><th>正确率</th><th>平均用时</th></tr></thead><tbody>${hasData?questions.slice(0,4).map((q,i)=>`<tr><td>${q.title}</td><td>${248-i*7}</td><td>${226-i*12}</td><td>${22+i*5}</td><td>${[91.1,82.2,76.8,64.0][i]}%</td><td>${[6.8,8.1,9.2,10.4][i]}秒</td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;height:220px;color:#9aa1aa">活动开始后展示题目分析</td></tr>'}</tbody></table>`;
    if(tab==='team')return `<table class="data-table"><thead><tr><th>排名</th><th>部门/团队</th><th>参与人数</th><th>完成对局</th><th>胜场</th><th>累计积分</th></tr></thead><tbody>${hasData?['产品中心','客户成功部','销售中心'].map((x,i)=>`<tr><td><span class="rank ${i===0?'top':''}">${i+1}</span></td><td>${x}</td><td>${[31,28,27][i]}</td><td>${[89,82,77][i]}</td><td>${[52,46,40][i]}</td><td>${[1280,1156,984][i]}</td></tr>`).join(''):'<tr><td colspan="6" style="text-align:center;height:220px;color:#9aa1aa">活动开始后生成团队榜</td></tr>'}</tbody></table>`;
    const sorted=tab==='wins'?rows.slice().sort((x,y)=>y.wins-x.wins):rows;
    return `<table class="data-table"><thead><tr><th>排名</th><th>用户</th><th>部门</th><th>参赛次数</th><th>胜场</th><th>正确率</th><th>累计积分</th><th>操作</th></tr></thead><tbody>${sorted.length?sorted.map((x,i)=>`<tr><td><span class="rank ${i===0?'top':''}">${i+1}</span></td><td><span class="avatar"></span>${x.name}</td><td>${x.department}</td><td>${x.matches}</td><td>${x.wins}</td><td>${x.accuracy}</td><td>${x.score}</td><td><button class="btn text">查看对局</button></td></tr>`).join(''):'<tr><td colspan="8" style="text-align:center;height:220px;color:#9aa1aa">活动开始后生成榜单</td></tr>'}</tbody></table>`
  }
  function bindDetailPanel(a){
    const editable=a.status==='未开始';
    if(state.detailTab==='basic'&&editable){bindCover();bindEditableFields(a);document.querySelector('[data-save-detail]').onclick=()=>{const name=document.querySelector('#name').value.trim();if(!name)return showError('#name','请输入PK赛名称');a.name=name;a.cover=state.selectedCover||a.cover;a.description=document.querySelector('#description').textContent.trim();saveActivity(a);toast('基本信息已保存');renderDetail()}}
    if(state.detailTab==='questions'&&editable){
      document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>openQuestionPicker(a,b.dataset.source));document.querySelector('[data-add-source]')?.addEventListener('click',()=>openQuestionPicker(a,'questions'));
      document.querySelectorAll('[data-remove-q]').forEach(b=>b.onclick=()=>{a.questionSnapshot=a.questionSnapshot.filter(q=>q.id!==b.dataset.removeQ);a.questionCount=a.questionSnapshot.length;a.sourceIds=a.questionSnapshot.map(q=>q.id);a.setupComplete=a.questionCount>0;saveActivity(a);renderDetail()})
    }
    if(state.detailTab==='pk'&&editable){bindEditableFields(a);document.querySelector('[data-save-detail]').onclick=()=>{collectEditable(a);saveActivity(a);toast('PK设置已保存');renderDetail()}}
    if(state.detailTab==='publish'&&editable){bindEditableFields(a);document.querySelector('[data-save-detail]').onclick=()=>{collectEditable(a);saveActivity(a);toast('上架设置已保存');renderDetail()}}
    if(state.detailTab==='users'){document.querySelector('[data-filter-users]').onclick=()=>{state.userSearch=document.querySelector('#userSearch').value.trim();state.userDepartment=document.querySelector('#userDepartment').value;renderDetail()};document.querySelector('[data-reset-users]').onclick=()=>{state.userSearch='';state.userDepartment='全部';renderDetail()};document.querySelector('[data-add-users]').onclick=()=>openLearnerPicker(a);document.querySelector('[data-export-users]').onclick=()=>toast('用户列表已导出')}
    if(state.detailTab==='data'){document.querySelectorAll('[data-data-tab]').forEach(b=>b.onclick=()=>{state.dataTab=b.dataset.dataTab;renderDetail()});document.querySelector('[data-export-data]').onclick=()=>toast('PK数据报表已导出')}
  }

  function bindCover(){document.querySelector('[data-cover]')?.addEventListener('click',()=>openCoverPicker())}
  function openCoverPicker(){
    let chosen=state.selectedCover||state.current.cover||'';
    modalRoot.innerHTML=`<div class="modal"><div class="dialog"><div class="dialog-head"><h3>选择图片</h3><button data-close>×</button></div><div class="dialog-body media-layout"><aside class="media-side"><div class="active">全部图片　3</div><div>默认分组　3</div><div>PK赛封面</div></aside><section class="media-main"><div class="media-tools"><button class="btn" data-upload>上传图片</button><input class="hidden" type="file" id="coverFile" accept="image/*"><span class="spacer"></span><input class="input" style="width:220px" placeholder="图片名称"></div><div class="media-grid">${covers.map(x=>`<button class="media-item ${chosen===x.url?'selected':''}" data-cover-choice="${x.url}"><img src="${x.url}" alt=""><span>${x.name}</span></button>`).join('')}</div></section></div><div class="dialog-foot"><button class="btn" data-close>取消</button><button class="btn primary" data-cover-confirm>确认</button></div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>modalRoot.innerHTML='');modalRoot.querySelectorAll('[data-cover-choice]').forEach(x=>x.onclick=()=>{chosen=x.dataset.coverChoice;modalRoot.querySelectorAll('.media-item').forEach(y=>y.classList.toggle('selected',y===x))});
    modalRoot.querySelector('[data-upload]').onclick=()=>modalRoot.querySelector('#coverFile').click();modalRoot.querySelector('#coverFile').onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{chosen=reader.result;state.selectedCover=chosen;modalRoot.querySelector('.media-grid').insertAdjacentHTML('afterbegin',`<button class="media-item selected" data-cover-choice="uploaded"><img src="${chosen}" alt=""><span>${escapeHtml(file.name)}</span></button>`)};reader.readAsDataURL(file)};
    modalRoot.querySelector('[data-cover-confirm]').onclick=()=>{if(!chosen)return toast('请选择一张封面');state.selectedCover=chosen;state.current.cover=chosen;modalRoot.innerHTML='';const box=document.querySelector('.cover-box');if(box){box.innerHTML=`<img src="${chosen}" alt="PK赛封面">`;box.classList.remove('error')}const error=document.querySelector('#coverError');if(error)error.textContent=''}
  }
  function openQuestionPicker(a,type){
    state.pickerType=type;state.picked=new Set(type==='questions'?(a.sourceIds||[]):a.sourceId?[a.sourceId]:[]);
    modalRoot.innerHTML=`<div class="modal"><div class="dialog"><div class="dialog-head"><h3>选择题目/试卷</h3><button data-close>×</button></div><div class="dialog-body"><div class="picker-tabs"><button class="${type==='questions'?'active':''}" data-picker-tab="questions">从题库中添加题目</button><button class="${type==='papers'?'active':''}" data-picker-tab="papers">从试卷库中选择试卷</button></div><div class="picker-layout"><aside class="picker-side"><div class="active">全部${type==='questions'?'题目':'试卷'}</div><div>默认分类</div><div>新员工培训</div><div>产品知识</div></aside><section class="picker-main" id="pickerContent"></section></div></div><div class="dialog-foot"><span style="margin-right:auto" id="pickedCount"></span><button class="btn" data-close>取消</button><button class="btn primary" data-picker-confirm>确认</button></div></div></div>`;
    const renderPicker=()=>{const list=state.pickerType==='questions'?questions:papers;modalRoot.querySelector('#pickerContent').innerHTML=`<div class="filter-strip"><input placeholder="请输入关键字"><button class="btn primary">搜索</button></div><table class="data-table"><thead><tr><th></th><th>${state.pickerType==='questions'?'题目':'试卷'}</th><th>${state.pickerType==='questions'?'题型':'随机试卷'}</th><th>${state.pickerType==='questions'?'难度':'题目'}</th>${state.pickerType==='papers'?'<th>总分</th>':''}</tr></thead><tbody>${list.map(x=>`<tr><td><input type="${state.pickerType==='questions'?'checkbox':'radio'}" name="pick" value="${x.id}" ${state.picked.has(x.id)?'checked':''}></td><td>${escapeHtml(x.title||x.name)}</td><td>${x.type||x.random}</td><td>${x.difficulty||x.count+'题'}</td>${state.pickerType==='papers'?`<td>${x.total}分</td>`:''}</tr>`).join('')}</tbody></table>`;modalRoot.querySelectorAll('input[name="pick"]').forEach(x=>x.onchange=()=>{if(state.pickerType==='papers')state.picked=new Set([x.value]);else x.checked?state.picked.add(x.value):state.picked.delete(x.value);modalRoot.querySelector('#pickedCount').textContent=`已选 ${state.picked.size} 项`});modalRoot.querySelector('#pickedCount').textContent=`已选 ${state.picked.size} 项`};
    renderPicker();modalRoot.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>modalRoot.innerHTML='');modalRoot.querySelectorAll('[data-picker-tab]').forEach(x=>x.onclick=()=>{state.pickerType=x.dataset.pickerTab;state.picked=new Set();modalRoot.querySelectorAll('[data-picker-tab]').forEach(y=>y.classList.toggle('active',y===x));renderPicker()});
    modalRoot.querySelector('[data-picker-confirm]').onclick=()=>{if(!state.picked.size)return toast('请至少选择一项');if(state.pickerType==='papers'){const p=papers.find(x=>state.picked.has(x.id));a.sourceType='paper';a.sourceId=p.id;a.sourceName=p.name;a.sourceIds=p.questionIds;a.questionSnapshot=p.questionIds.map(id=>questions.find(q=>q.id===id)).filter(Boolean)}else{a.sourceType='questions';a.sourceId='';a.sourceName='题库选题';a.sourceIds=[...state.picked];a.questionSnapshot=a.sourceIds.map(id=>questions.find(q=>q.id===id)).filter(Boolean)}a.questionCount=a.questionSnapshot.length;a.setupComplete=a.questionCount>0;saveActivity(a);modalRoot.innerHTML='';toast('题目设置已保存');renderDetail()}
  }
  function openLearnerPicker(a){
    const selected=new Set(a.learnerIds||[]);
    modalRoot.innerHTML=`<div class="modal"><div class="dialog"><div class="dialog-head"><h3>选择学员</h3><button data-close>×</button></div><div class="dialog-body"><div class="picker-tabs"><button class="active">按学员</button><button>按部门</button><button>按标签</button><button>批量导入</button></div><div class="filter-strip"><select><option>全部部门</option></select><input placeholder="请输入姓名、账号搜索"><button class="btn primary">筛选</button></div><table class="data-table"><thead><tr><th></th><th>学员</th><th>账号</th><th>所在部门</th></tr></thead><tbody>${learners.map(x=>`<tr><td><input type="checkbox" data-user="${x.id}" ${selected.has(x.id)?'checked':''}></td><td><span class="avatar"></span>${x.name}</td><td>${x.account}</td><td>${x.department}</td></tr>`).join('')}</tbody></table></div><div class="dialog-foot"><span style="margin-right:auto" id="learnerCount">已选 ${selected.size} 人</span><button class="btn" data-close>取消</button><button class="btn primary" data-user-confirm>确认</button></div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>modalRoot.innerHTML='');modalRoot.querySelectorAll('[data-user]').forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.user):selected.delete(x.dataset.user);modalRoot.querySelector('#learnerCount').textContent=`已选 ${selected.size} 人`});modalRoot.querySelector('[data-user-confirm]').onclick=()=>{a.learnerIds=[...selected];modalRoot.innerHTML='';toast('参赛学员已更新');if(state.view==='detail'){saveActivity(a);renderDetail()}}
  }
  function openShare(a){
    const base=location.href.split('/').slice(0,-1).join('/'),url=`${base}/c.html?entry=pk`;
    modalRoot.innerHTML=`<div class="modal"><div class="dialog small"><div class="dialog-head"><h3>分享PK赛</h3><button data-close>×</button></div><div class="dialog-body" style="text-align:center"><p>使用微信扫码，或复制下方链接分享给学员</p><img style="width:180px;height:180px" src="https://quickchart.io/qr?size=220&text=${encodeURIComponent(url)}" alt="分享二维码"><div class="two-fields" style="justify-content:center;margin-top:14px"><input class="input" id="shareUrl" readonly value="${url}"><button class="btn primary" data-copy-link>复制</button></div><p class="help">活动配置保存在访问者当前浏览器中，静态演示版不支持跨设备同步同一后台数据。</p></div><div class="dialog-foot"><button class="btn primary" data-close>关闭</button></div></div></div>`;
    modalRoot.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>modalRoot.innerHTML='');modalRoot.querySelector('[data-copy-link]').onclick=async()=>{await navigator.clipboard?.writeText(url);toast('链接已复制')}
  }
  render();
})();
