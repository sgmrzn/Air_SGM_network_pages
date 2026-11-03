import {lazy,Suspense,useEffect,useState} from 'react';
import {BookOpen,FlaskConical,Database,Factory,FileText,Network,RadioTower,SatelliteDish} from 'lucide-react';
import {networkRunHash,networkRunIdFromHash,networkArchiveHash,networkArchiveFromHash,type NetworkArchiveTab} from './shared/networkRunNavigation';
import './modules.css';
import './demo/demo.css';
const SourcesPage=lazy(()=>import('./pages/SourcesPage').then(m=>({default:m.SourcesPage})));
const NetworkInputsPage=lazy(()=>import('./pages/NetworkInputsPage').then(m=>({default:m.NetworkInputsPage})));
const HelpPage=lazy(()=>import('./demo/Help').then(m=>({default:m.HelpPage})));
const StationsPage=lazy(()=>import('./pages/StationsPage').then(m=>({default:m.StationsPage})));
const NetworkDesignPage=lazy(()=>import('./pages/NetworkDesignPage').then(m=>({default:m.NetworkDesignPage})));
const NetworkReportsPage=lazy(()=>import('./pages/NetworkReportsPage').then(m=>({default:m.NetworkReportsPage})));
const NetworkSavedRunView=lazy(()=>import('./pages/NetworkSavedRunView').then(m=>({default:m.NetworkSavedRunView})));
const NetworkVerificationPage=lazy(()=>import('./pages/NetworkVerificationPage').then(m=>({default:m.NetworkVerificationPage})));
const sections=[
 {key:'network',title:'Сеть мониторинга',icon:Network,eyebrow:'МОДУЛЬ 1 · ПРОЕКТИРОВАНИЕ'},
 {key:'networkVerification',title:'Проверка алгоритма',icon:FlaskConical,eyebrow:'СЕТЬ МОНИТОРИНГА · ИССЛЕДОВАНИЕ'},
 {key:'networkReports',title:'Отчёты сети',icon:FileText,eyebrow:'МОДУЛЬ 1 · ОТЧЁТНОСТЬ'},
 {key:'networkInputs',title:'Исходные данные сети',icon:Database,eyebrow:'ИСХОДНЫЕ ДАННЫЕ'},
 {key:'stations',title:'Существующие посты',icon:RadioTower,eyebrow:'ДАННЫЕ И РЕЕСТРЫ'},
 {key:'sources',title:'Источники выбросов',icon:Factory,eyebrow:'ИСТОЧНИКИ'},
 {key:'help',title:'Справка',icon:BookOpen,eyebrow:'СПРАВКА МОДУЛЯ'},
];
const currentPage=()=>{const key=location.hash.slice(1).split('?')[0];return sections.some(s=>s.key===key)?key:'network'};
export default function App(){
 const [page,setPage]=useState(currentPage),[runId,setRunId]=useState(()=>networkRunIdFromHash(location.hash));
 const [archive,setArchive]=useState(()=>networkArchiveFromHash(location.hash));
 useEffect(()=>{const sync=()=>{setPage(currentPage());setArchive(networkArchiveFromHash(location.hash));if(location.hash.startsWith('#network?')||location.hash==='#network')setRunId(networkRunIdFromHash(location.hash));};window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};},[]);
 const navigate=(key:string)=>{setPage(key);if(key==='networkReports')setArchive(null);location.hash=key==='network'&&runId?networkRunHash(runId):'#'+key;};
 const openRun=(id:string)=>{setRunId(id);setPage('network');setArchive(null);location.hash=networkRunHash(id);};
 const openRegistry=(id?:string|null,tab:NetworkArchiveTab='result')=>{setPage('networkReports');setArchive(id?{runId:id,tab}:null);location.hash=id?networkArchiveHash(id,tab):'#networkReports';};
 const title=sections.find(s=>s.key===page)!;
 return <div className="app-layout"><aside className="sidebar"><div className="brand"><div className="brand__icon"><SatelliteDish/></div><div><strong>Air SGM</strong><span>Рязанская область</span></div></div><nav className="nav" aria-label="Разделы системы"><span className="nav__section">СЕТЬ МОНИТОРИНГА</span>{sections.map(s=><button key={s.key} className={`nav__item${page===s.key?' nav__item--active':''}`} onClick={()=>navigate(s.key)}><s.icon aria-hidden="true"/>{s.title}</button>)}</nav></aside>
 <main className={`main-shell demo-page-${page}${page==='network'||(page==='networkReports'&&archive)?' main-shell--network-design':''}`}><header className="page-header"><div><span>{title.eyebrow}</span><h1>{title.title}</h1></div></header><div className="content app-content--modules"><div className="demo-notice">Демонстрация · готовые расчёты на сохранённом снимке данных. Реестры и проектирование ограничены Рязанской областью; проверка алгоритма содержит отдельную исследовательскую серию. Отчёты доступны для просмотра.</div><Suspense fallback={<div className="map-state">Загрузка раздела…</div>}>
 {page==='network'&&<NetworkDesignPage preferredRunId={runId} onRunSelected={id=>{setRunId(id);history.replaceState(null,'',id?networkRunHash(id):'#network');}} onOpenRegistry={openRegistry}/>}
 {page==='networkVerification'&&<NetworkVerificationPage/>}
 {page==='networkReports'&&(archive?<NetworkSavedRunView key={archive.runId} runId={archive.runId} tab={archive.tab} reports={[]} reportsLoading={false} reportListError={false} onTabChange={tab=>openRegistry(archive.runId,tab)} onBack={()=>openRegistry()} onOpenRun={openRun} onReportSaved={()=>{}}/>:<NetworkReportsPage onOpenRun={run=>openRun(run.id)}/>)}
 {page==='networkInputs'&&<NetworkInputsPage/>}{page==='stations'&&<StationsPage/>}{page==='sources'&&<SourcesPage/>}{page==='help'&&<HelpPage/>}
 </Suspense></div></main></div>;
}
