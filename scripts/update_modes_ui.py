from pathlib import Path
p=Path(__file__).resolve().parents[1]
f=p/'src/demo/api.ts'; s=f.read_text(encoding='utf8')
s=s.replace("size_bytes:x.report_size_bytes || 0,demo_mode:","size_bytes:x.report_size_bytes || 0,generated_report:x.generated_report,demo_placement:x.placement_mode || 'population_coverage',demo_meteo:x.meteo_profile || 'annual',demo_mode:")
old="return asJson(await demoData(`cities/${cityId}/${p.endsWith('readiness') ? 'readiness' : 'population-preview'}.json`));"
new="""const data = structuredClone(await demoData(`cities/${cityId}/${p.endsWith('readiness') ? 'readiness' : 'population-preview'}.json`));
    if (p.endsWith('readiness') && data.ready_for_population_only_new_network && !data.layers.stations?.stationary_count) {
      data.ready_for_population_only_expansion = true;
      data.demo_empty_baseline = true;
    }
    return asJson(data);"""
assert old in s;s=s.replace(old,new);f.write_text(s,encoding='utf8')
f=p/'src/pages/NetworkReportsPage.tsx';s=f.read_text(encoding='utf8')
s=s.replace('<span>{visibleReports.length} отчётов</span>', '<label>Цель сети<select value={placement} onChange={e=>setPlacement(e.target.value)}><option value="">Все цели</option>{placementOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Период ветра<select value={meteo} onChange={e=>setMeteo(e.target.value)}><option value="">Все периоды</option>{meteoOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><span>{visibleReports.length} отчётов</span>')
s=s.replace('{item.recommended_positions ?? "—"} позиций · {item.scenario_count ?? "—"} сценариев</td>','{item.recommended_positions ?? "—"} позиций · {item.scenario_count ?? "—"} сценариев<small>{placementLabel(item.demo_placement)}</small><small>{meteoLabel(item.demo_meteo)}</small></td>')
s=s.replace('{formatSize(item.size_bytes)}','{item.size_bytes ? formatSize(item.size_bytes) : "При скачивании"}')
old='<div className="network-reports__actions"><a '
new='<div className="network-reports__actions">{item.generated_report ? <><button className="button button--ghost" disabled={preparing === item.id} onClick={() => void report(item.id,false)}><ExternalLink aria-hidden="true"/>Открыть</button><button className="button button--primary" disabled={preparing === item.id} onClick={() => void report(item.id,true)}><Download aria-hidden="true"/>{preparing === item.id ? "Готовим…" : "Скачать"}</button></> : <><a '
assert old in s;s=s.replace(old,new).replace('> Скачать</a></div>','> Скачать</a></>}</div>');f.write_text(s,encoding='utf8')
f=p/'src/demo/Catalog.tsx';s=f.read_text(encoding='utf8').replace("'Добавляемых постов' : 'Постов в новой сети'","'Добавить постов' : 'Число постов'");f.write_text(s,encoding='utf8')
f=p/'scripts/prepare_reports.mjs';s=f.read_text(encoding='utf8').replace("+'\\nexport { networkScreeningReportHtml };\\n'","+'\\n'");f.write_text(s,encoding='utf8')
