import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../calendar-rules.js';
import '../package-billing.js';
import { buildCancellationCatalog } from '../supabase/functions/_shared/cancellation-catalog.ts';
const rules=globalThis.CalendarRules, billing=globalThis.PackageBilling;
const source=fs.readFileSync(new URL('../script.js',import.meta.url),'utf8');
function fn(name) {
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,name);
  return source.slice(start,source.indexOf('\n}',start)+2);
}
function element() {
  return {children:[],dataset:{},listeners:{},className:'',textContent:'',value:'',hidden:false,
    append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},
    replaceChildren(...items){this.children=items;},addEventListener(name,cb){this.listeners[name]=cb;},
    classList:{add(){},remove(){},toggle(){}},focus(){},reset(){},closest(){return this;},querySelector(){return null;},
    set innerHTML(value){this.children=[];this._html=value;},get innerHTML(){return this._html||'';}};
}
const student={id:'s1',name:'Mariane',plan:'Cadastro único',billingType:'fixed',billingDays:[],value:'R$ 999,00',payment:'Pendente',email:'mariane@example.com',authUserId:'same-login'};
function packages() { return [
  {id:'beach',studentId:'s1',studentName:'Mariane',name:'Pacote Beach Tênis',modality:'Beach Tênis',billingType:'fixed',value:'R$ 155,00',startDate:'01/02/2026',endDate:'28/02/2026',total:8,days:'terça, quinta',time:'08:00',createdAt:1},
  {id:'muscle',studentId:'s1',studentName:'Mariane',name:'Pacote Musculação',modality:'Musculação',billingType:'per_class',classValue:'R$ 40,00',value:'R$ 320,00',startDate:'01/02/2026',endDate:'28/02/2026',total:8,days:'terça, quinta',time:'09:00',createdAt:2},
];}
function app({packs=packages(),events=[],checkins=[],history=[],students=[structuredClone(student)],extra={}}={}) {
  let nextId=0;const c=vm.createContext({CalendarRules:rules,PackageBilling:billing,Date,Intl,console,structuredClone,
    loadClassPackages:()=>packs,loadAgendaEvents:()=>events,loadCheckins:()=>checkins,loadFinancialHistory:()=>history,loadStudents:()=>students,
    loadBillingSettings:()=>({countHolidays:true}),normalizeBillingDays:(d)=>d||[],normalizeBillingType:(v)=>v==='per_class'?'per_class':'fixed',
    normalizeBillingItems:(items)=>items||[],normalizeListData:(items)=>items||[],normalizeTimeText:(t)=>t,
    normalizeWeeklySchedule:(schedule)=>schedule||{},onlyDigits:(v)=>String(v||'').replace(/\D/g,''),
    getBillingStatusForStudent:(s)=>s.payment==='Em dia'?'Pago':'Pendente',getBillingDueDate:()=>null,getStudentCompletedLessonsForMonth:()=>0,
    getStudentIdByName:()=> 's1',getStudentByName:(name)=>students.find((s)=>s.name===name),
    saveFinancialHistory:(records)=>{history.splice(0,history.length,...records);},saveAgendaEvents:(items)=>{events.splice(0,events.length,...items);},
    saveStudents:(items)=>{students.splice(0,students.length,...items);},saveCheckins:(items)=>{checkins.splice(0,checkins.length,...items);},
    createId:()=> 'new-'+(++nextId),currentUserType:'admin',currentSupabaseUser:{id:'owner'},personalAdminEmail:'owner',
    formatToday:()=> '07/10/2026',currentMonthKey:()=>rules.today().slice(0,7),isPresentialStudent:()=>true,
    upsertAutomaticMonthlyPackageForStudent:()=>assert.fail('Payment must not recreate an independent package'),
    renderStudents(){},renderBillingList(){},renderHomeDashboard(){},renderStudentPackagePanel(){},showMessage(){},
    document:{createElement:element},selectedPackageByStudent:new Map(),...extra});
  const names=['getDateKey','parseBrazilianDate','getDefaultBillingMonthKey','getMonthBounds','getMonthLabel','getWeekdayName','getGlobalHolidayKeys','isGlobalHoliday',
    'countBillingLessonsForMonth','countBillingLessonsBetweenDates','parseCurrencyValue','formatCurrencyNumber','parsePackageDays','generatePackageSchedule',
    'isConsumedLesson','getLessonRecord','getPackageCheckins','getCompletedLessons','getPackageStatus','getActivePackages','getActivePackage','getSelectedStudentPackage',
    'getLegacyStudentBillingProjection','getStudentBillingProjection','markStudentBillingAsPaid','updateFinancialHistoryFromProjections',
    'formatPackageBillingLine','createAutomaticBillingMessage','normalizeClassPackages','syncAutomaticPackageAgendaEvents','appendBillingLines','createStudentBillingPanel',
    'createPackageSummaryCard','fillPackageForm','startPackageRenewal','reconcilePackageAgendaEvents'];
  names.forEach((name)=>vm.runInContext(fn(name),c));
  return {c,packs,events,checkins,history,students,project:(month='2026-02')=>c.getStudentBillingProjection(students[0],month)};
}
const holiday={id:'holiday-2026-02-03',type:'global-holiday',holidayActive:true,dateKey:'2026-02-03',time:'00:00'};
const text=(value)=>value.replace(/\u00a0/g,' ');

test('um aluno, dois pacotes: regras distintas, feriado e total discriminado',()=>{
  const a=app({events:[holiday]});const p=a.project();
  assert.equal(p.lines.length,2);assert.equal(p.lines[0].totalValue,155);
  assert.equal(p.lines[1].predictedLessons,7);assert.equal(p.lines[1].totalValue,280);
  assert.equal(p.totalValue,435);assert.equal(p.outstandingValue,435);
  const message=text(a.c.createAutomaticBillingMessage(p));
  assert.match(message,/Pacote Beach Tênis — R\$ 155,00/);
  assert.match(message,/Pacote Musculação — 7 aulas × R\$ 40,00 = R\$ 280,00/);
  assert.match(message,/Total: R\$ 435,00/);assert.ok(!message.includes('\\n'));
  assert.equal(a.students.length,1);assert.equal(a.students[0].authUserId,'same-login');
});
test('dois meses fechados: mensagem usa valores próprios, sem valor do cadastro',()=>{
  const packs=packages();packs[1].billingType='fixed';
  const a=app({packs,events:[holiday]});const p=a.project();
  assert.equal(p.totalValue,475);assert.equal(p.lines[1].totalValue,320);
  const message=text(a.c.createAutomaticBillingMessage(p));
  assert.match(message,/Total: R\$ 475,00/);assert.match(message,/Pacote Musculação — R\$ 320,00/);
});
test('cobrança inclui somente o mês que intersecta a validade de cada pacote',()=>{
  const a=app();assert.equal(a.project('2026-01').lines.length,0);assert.equal(a.project('2026-03').totalValue,0);
  a.packs[0].startDate='20/01/2026';a.packs[0].endDate='10/02/2026';
  a.packs[1].startDate='10/02/2026';a.packs[1].endDate='19/02/2026';
  assert.equal(a.project('2026-01').totalValue,155);
  const feb=a.project();assert.equal(feb.lines[0].totalValue,155);assert.equal(feb.lines[1].predictedLessons,4);
  assert.equal(feb.totalValue,315);
});
test('pagamento por pacote é idempotente, mantém o outro pendente e não cria cadastros',()=>{
  const a=app({events:[holiday]});
  assert.equal(a.c.markStudentBillingAsPaid('s1','2026-02','beach'),true);
  assert.equal(a.project().paidValue,155);assert.equal(a.project().outstandingValue,280);
  const before=JSON.stringify(a.history);
  assert.equal(a.c.markStudentBillingAsPaid('s1','2026-02','beach'),false);
  assert.equal(JSON.stringify(a.history),before);
  assert.match(text(a.c.createAutomaticBillingMessage(a.project())),/Total a pagar: R\$ 280,00/);
  assert.equal(a.c.markStudentBillingAsPaid('s1','2026-02'),true);
  assert.equal(a.project().outstandingValue,0);assert.equal(a.history.length,1);assert.equal(a.packs.length,2);
  a.packs.push({...packages()[0],id:'new-beach',name:'Novo Beach',value:'R$ 100,00',createdAt:3});
  assert.equal(a.project().outstandingValue,100);
});
test('status geral Em dia não quita pacote novo nem meses futuros',()=>{
  const a=app({students:[{...student,payment:'Em dia'}]});
  assert.equal(a.project().paidValue,0);assert.equal(a.project().outstandingValue,475);
  a.c.markStudentBillingAsPaid('s1','2026-02');
  a.packs.forEach((pack)=>pack.endDate='31/03/2026');
  assert.ok(a.project('2026-03').outstandingValue>0);assert.equal(a.project('2026-03').paidValue,0);
});
test('pagamento anterior é preservado ao marcar e remover feriado',()=>{
  const a=app();a.c.markStudentBillingAsPaid('s1','2026-02');
  const payments=JSON.stringify(a.history[0].paymentAllocations);
  a.events.push(holiday);const p=a.project();
  assert.equal(p.totalValue,435);assert.equal(p.paidValue,475);assert.equal(p.outstandingValue,0);assert.equal(p.creditValue,40);
  a.c.updateFinancialHistoryFromProjections([p],'2026-02');
  a.events[0]={...holiday,holidayActive:false};
  assert.equal(a.project().totalValue,475);assert.equal(a.project().outstandingValue,0);
  assert.equal(JSON.stringify(a.history[0].paymentAllocations),payments);
});
test('recibo mensal antigo preserva valores pagos, sem recontar a cobrança',()=>{
  const a=app({history:[{id:'s1-2026-02',studentId:'s1',monthKey:'2026-02',paidValue:475,status:'Pago'}]});
  assert.equal(a.project().outstandingValue,0);
  a.c.updateFinancialHistoryFromProjections([a.project()],'2026-02');
  a.packs.push({...packages()[0],id:'added',value:'R$ 80,00'});
  assert.equal(a.project().paidValue,475);assert.equal(a.project().outstandingValue,80);
});
test('transformar pacote antigo em independente mantém a quitação do mesmo ID',()=>{
  const a=app({history:[{id:'s1-2026-02',studentId:'s1',monthKey:'2026-02',paidValue:155,
    paymentAllocations:[{id:'legacy-base',paidValue:155}],chargeLines:[{id:'legacy-base',packageId:'beach'}]}]});
  const p=a.project();assert.equal(p.lines[0].paidValue,155);assert.equal(p.outstandingValue,320);
});
test('pagamentos de abas diferentes são mesclados por ID sem somar repetições',()=>{
  const online={id:'s1-2026-02',paymentAllocations:[{id:'beach',paidValue:155}],paidValue:155};
  const local={id:'s1-2026-02',paymentAllocations:[{id:'muscle',paidValue:280}],paidValue:280};
  const merged=billing.mergeFinancialRecords(online,local);
  assert.equal(merged.paidValue,435);assert.equal(merged.paymentAllocations.length,2);
  const repeated=billing.mergeFinancialRecords(merged,local);
  assert.equal(repeated.paidValue,435);assert.equal(repeated.paymentAllocations.length,2);
  const c=vm.createContext({PackageBilling:billing,structuredClone,Date});vm.runInContext(fn('rebaseAppStateChanges'),c);
  const rebased=c.rebaseAppStateChanges({id:online.id,paidValue:0},local,online,'/financialHistory/s1-2026-02');
  assert.equal(rebased.paidValue,435);
});

test('mesclar promoção de pacote antigo e uso de saldo pago não duplica o recibo',()=>{
  const old={id:'s1-2026-02',paidValue:155,paymentAllocations:[{id:'legacy-base',paidValue:155}],chargeLines:[{id:'legacy-base',packageId:'beach'}]};
  const migrated={id:old.id,paidValue:155,paymentAllocations:[{id:'beach',paidValue:155}],chargeLines:[{id:'beach',packageId:'beach'}]};
  const merged=billing.mergeFinancialRecords(old,migrated);
  assert.equal(merged.paidValue,155);assert.equal(merged.paymentAllocations.length,1);
  const before={id:'credit',paidValue:500,unallocatedPaidValue:25,paymentAllocations:[{id:'base',paidValue:475}]};
  const after={id:'credit',paidValue:500,unallocatedPaidValue:15,paymentAllocations:[{id:'base',paidValue:475},{id:'new',paidValue:10}]};
  const result=billing.mergeFinancialRecords(before,after);
  assert.equal(result.paidValue,500);assert.equal(result.unallocatedPaidValue,15);
});
test('saldo e presenças permanecem vinculados ao pacote correto',()=>{
  const a=app({checkins:[{id:'c1',studentId:'s1',packageId:'muscle',dateKey:'2026-02-05',status:'realizado'}]});
  assert.equal(a.c.getPackageStatus(a.packs[0]).completed,0);assert.equal(a.c.getPackageStatus(a.packs[1]).completed,1);
  const p=a.project();assert.equal(p.lines[0].completedLessons,0);assert.equal(p.lines[1].completedLessons,1);
});
test('dois ativos simultâneos e seleção do aluno usam IDs independentes',()=>{
  const month=rules.today().slice(0,7),end=new Date(`${month}-01T12:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1,0);
  const packs=packages().map((pack)=>({...pack,startDate:month+'-01',endDate:end.toISOString().slice(0,10)}));
  const a=app({packs});assert.equal(a.c.getActivePackages('Mariane').length,2);
  a.c.selectedPackageByStudent.set('Mariane','beach');assert.equal(a.c.getSelectedStudentPackage('Mariane').id,'beach');
  a.c.selectedPackageByStudent.set('Mariane','muscle');assert.equal(a.c.getSelectedStudentPackage('Mariane').id,'muscle');
});
test('agenda automática não reatribui aula existente de outro pacote no mesmo horário',()=>{
  const pack=packages()[1],a=app({events:[{id:'original',studentId:'s1',studentName:'Mariane',packageId:'beach',dateKey:'2026-02-03',time:'09:00',source:'manual',status:'confirmada'}]});
  a.c.syncAutomaticPackageAgendaEvents(a.students[0],pack);
  assert.equal(a.events.find((event)=>event.id==='original').packageId,'beach');
  assert.ok(a.events.some((event)=>event.packageId==='muscle'&&event.dateKey==='2026-02-03'));
});
test('renovação prepara somente o pacote escolhido e preserva os originais',()=>{
  const fields={};['packageForm','packageStudent','packageViewStudent','packageStudentSearch','packageName','packageModality','packageBillingType','packageClassValue','packageTotal','packageFrequency','packageValue','packageStart','packageEnd','packageMakeupLimit','packageDays','packageTime','packageNotes'].forEach((key)=>fields[key]=element());
  const a=app({extra:{...fields,editingPackageId:null,packageFormTemplate:null,updatePackageBillingFields(){}}});
  const original=JSON.stringify(a.packs);a.c.startPackageRenewal(a.packs[1]);
  assert.equal(a.c.packageName.value,'Pacote Musculação');assert.equal(a.c.packageBillingType.value,'per_class');assert.equal(a.c.packageClassValue.value,'R$ 40,00');
  assert.equal(a.c.editingPackageId,null);assert.equal(a.c.packageStart.value,'');assert.equal(a.c.packageFormTemplate.renewedFrom,'muscle');
  assert.equal(JSON.stringify(a.packs),original);
});
test('persistência aceita campos próprios e não inventa datas de pacote antigo',()=>{
  const a=app();const normalized=a.c.normalizeClassPackages([...a.packs,{id:'legacy',studentId:'s1',studentName:'Mariane',name:'Antigo',total:4}]);
  assert.equal(normalized[0].billingType,'fixed');assert.equal(normalized[1].classValue,'R$ 40,00');assert.equal(normalized[1].modality,'Musculação');
  assert.equal(normalized[2].billingType,'');assert.equal(normalized[2].startDate,'');assert.equal(normalized[2].endDate,'');assert.equal(normalized[2].id,'legacy');
});
test('financeiro do administrador e aluno mostra os mesmos pacotes, valores e total',()=>{
  const a=app({events:[holiday]});const p=a.project();
  for(const admin of [true,false]) {
    const container=element();a.c.appendBillingLines(container,p,admin);
    const list=container.children[0];assert.equal(list.children.length,3);
    assert.match(text(list.children[0].children[0].textContent),/Beach Tênis.*155,00/);
    assert.match(text(list.children[1].children[0].textContent),/7 aulas.*280,00/);
    assert.match(text(list.children[2].textContent),/Total: R\$ 435,00/);
    if(admin)assert.equal(list.children[1].children[2].dataset.billingLine,'muscle');
  }
});

test('cadastro real do formulário: editar e renovar um pacote não altera o outro',async()=>{
  const packs=packages(),fields={};
  ['packageForm','packageStudent','packageViewStudent','packageStudentSearch','packageName','packageModality','packageBillingType','packageClassValue','packageTotal','packageFrequency','packageValue','packageStart','packageEnd','packageMakeupLimit','packageDays','packageTime','packageNotes'].forEach((key)=>fields[key]=element());
  const a=app({packs,extra:{...fields,editingPackageId:null,packageFormTemplate:null,updatePackageBillingFields(){},
    saveClassPackages:(records)=>packs.splice(0,packs.length,...records),upsertPackageModelFromForm(){},fillManualCheckinPackageSelect(){},fillMakeupPackageSelect(){},
    renderPackageAdminList(){},renderMakeupCreditList(){},selectedAdminProfileStudent:'',supabaseSyncPromise:Promise.resolve()}});
  const begin=source.indexOf('packageForm?.addEventListener("submit", async (event) => {');
  const end=source.indexOf('\nbillingSettingsForm?.addEventListener',begin);
  vm.runInContext(source.slice(begin,end),a.c);
  const muscle=JSON.stringify(packs[1]);a.c.fillPackageForm(packs[0]);a.c.packageValue.value='R$ 200,00';
  await a.c.packageForm.listeners.submit({preventDefault(){}});
  assert.equal(packs[0].value,'R$ 200,00');assert.equal(JSON.stringify(packs[1]),muscle);
  const originals=JSON.stringify(packs);a.c.startPackageRenewal(packs[1]);a.c.packageStart.value='01/03/2026';a.c.packageEnd.value='31/03/2026';
  await a.c.packageForm.listeners.submit({preventDefault(){}});
  assert.equal(packs.length,3);assert.equal(JSON.stringify(packs.slice(0,2)),originals);
  assert.equal(packs[2].renewedFrom,'muscle');assert.notEqual(packs[2].id,'muscle');assert.equal(packs[2].billingType,'per_class');
  assert.equal(a.project('2026-03').lines.length,1);assert.equal(a.project('2026-03').totalValue,320);
});

test('pacote por aula flexível usa somente aulas vinculadas dentro do período',()=>{
  const pack={...packages()[1],days:'',time:'',startDate:'10/02/2026',endDate:'20/02/2026'};
  const events=[
    {id:'early',type:'package',packageId:'muscle',dateKey:'2026-02-09',time:'09:00'},
    {id:'valid',type:'package',packageId:'muscle',dateKey:'2026-02-12',time:'09:00'},
    {id:'late',type:'package',packageId:'muscle',dateKey:'2026-02-21',time:'09:00'},
    {id:'other',type:'package',packageId:'beach',dateKey:'2026-02-13',time:'09:00'},
    {id:'makeup',type:'makeup',packageId:'muscle',dateKey:'2026-02-14',time:'09:00'}];
  const a=app({packs:[pack],events});assert.equal(a.project().predictedLessons,1);assert.equal(a.project().totalValue,40);
});

test('agenda materializada muda somente para o pacote editado e preserva o vínculo Google',()=>{
  const day=rules.today(),pack={...packages()[1],startDate:day,endDate:day,days:'domingo, segunda, terça, quarta, quinta, sexta, sábado',time:'10:00'};
  const a=app({packs:[pack],events:[{id:'g-muscle',google_event_id:'g1',packageId:'muscle',source:'package',dateKey:day,time:'09:00',status:'confirmada'},
    {id:'g-beach',google_event_id:'g2',packageId:'beach',source:'package',dateKey:day,time:'08:00',status:'confirmada'}]});
  a.c.reconcilePackageAgendaEvents(pack);
  assert.equal(a.events[0].time,'10:00');assert.equal(a.events[0].google_event_id,'g1');assert.equal(a.events[0].id,'g-muscle');
  assert.equal(a.events[1].time,'08:00');assert.equal(a.events[1].google_event_id,'g2');
});

test('catálogo de cancelamento autoriza dois pacotes no mesmo login sem misturar aulas',()=>{
  const authUserId='22222222-2222-4222-8222-222222222222';
  const catalog=buildCancellationCatalog({students:[{id:'s1',name:'Mariane',authUserId}],packages:packages(),events:[],checkins:[]});
  assert.equal(catalog.students.length,1);assert.equal(catalog.packages.length,2);
  assert.equal(catalog.packages[0].lessons.length,8);assert.equal(catalog.packages[1].lessons.length,8);
  assert.notEqual(catalog.packages[0].lessons[0].eventId,catalog.packages[1].lessons[0].eventId);
});

test('tela do aluno permite escolher qualquer um dos dois pacotes ativos',()=>{
  const month=rules.today().slice(0,7),end=new Date(`${month}-01T12:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1,0);
  const packs=packages().map((pack)=>({...pack,startDate:month+'-01',endDate:end.toISOString().slice(0,10)}));
  const panel=element();const a=app({packs,extra:{studentPackagePanel:panel,workoutViewStudent:{value:'Mariane'},
    processAutomaticPastLessons(){},getStudentMakeupCredits:()=>[],createStudentAgendaNavCard:element,renderStudentCheckinStatus(){}}});
  vm.runInContext(fn('renderStudentPackagePanel'),a.c);a.c.renderStudentPackagePanel();
  const select=panel.children.find((item)=>item.textContent==='Pacote para aulas e check-in').children[0];
  assert.equal(select.children.length,2);assert.ok(select.children.some((option)=>option.value==='beach'));assert.ok(select.children.some((option)=>option.value==='muscle'));
  select.value='beach';select.listeners.change();
  assert.equal(a.c.getSelectedStudentPackage('Mariane').id,'beach');
  assert.equal(panel.children[0].children[0].textContent,'Financeiro dos meus pacotes');
});
