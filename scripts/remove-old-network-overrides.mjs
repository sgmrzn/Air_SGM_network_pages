import fs from 'node:fs';
import postcss from 'postcss';
const file='src/demo/demo.css';const root=postcss.parse(fs.readFileSync(file,'utf8'));
root.walkRules(rule=>{
 rule.selector=rule.selector.split(',').filter(selector=>!/\.demo-page-network(?=[\s>:.#])|^\s*\.network-wizard/.test(selector)).join(',');
 if(!rule.selector.trim())rule.remove();
});
root.walkAtRules(rule=>{if(rule.nodes&&!rule.nodes.length)rule.remove();});
fs.writeFileSync(file,root.toString());
