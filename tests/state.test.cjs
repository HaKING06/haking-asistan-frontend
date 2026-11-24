const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function run(code) {
  const data = new Map();
  const context = vm.createContext({ localStorage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  }});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/state.js'), 'utf8') + '\n' + code, context);
}

test('repeated draft saves preserve chronological conversation order', () => {
  run(`
    AppState.email = 'test@example.com';
    AppState.history = [
      {role:'user',content:'bir hesap makinesi'},
      {role:'assistant',content:'Hangi agent?'},
      {role:'user',content:'Codex; modeli sen öner'}
    ];
    const expected = JSON.stringify(AppState.history);
    for(let count=0;count<4;count++) saveChatHistory(AppState.email);
    if(JSON.stringify(AppState.history)!==expected) throw Error('History reordered in memory');
    const restored=loadChatHistory(AppState.email).history;
    if(restored[0].content!=='bir hesap makinesi'||restored[2].content!=='Codex; modeli sen öner') throw Error('History reordered on reload');
  `);
});

test('task memory and session survive reload without mixing another task', () => {
  run(`
    AppState.email='test@example.com';
    AppState.promptSessionId='calculator-session';
    AppState.promptReady=true;
    AppState.promptBrief={goal:'hesap makinesi',agent:'Codex',model:'GPT-6.2 Sol'};
    AppState.history=[{role:'user',content:'eski oyun',mode:'prompt',promptSession:'game-session'},
      {role:'user',content:'hesap makinesi',mode:'prompt',promptSession:'calculator-session'}];
    saveChatHistory(AppState.email);
    const loaded=loadChatHistory(AppState.email);
    if(loaded.promptBrief.agent!=='Codex'||!loaded.promptReady) throw Error('Decisions lost');
    const active=loaded.history.filter(item=>item.promptSession===loaded.promptSessionId);
    if(active.length!==1||active[0].content!=='hesap makinesi') throw Error('Tasks mixed');
  `);
});

test('logout discards in-memory task decisions', () => {
  assert.doesNotThrow(() => run(`
    AppState.promptBrief={goal:'private task'};
    AppState.promptSessionId='session';
    clearSession();
    if(AppState.promptBrief!==null||AppState.promptSessionId!==null) throw Error('Task decisions retained');
  `));
});
