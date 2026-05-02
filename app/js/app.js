let ws = null;
let currentAgentId = null;
let currentTheme = "dark-orange";
let pendingMsgs = [];
let saveTimer = null;

function $ (id) { return document.getElementById(id); }

async function api(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

// ─── Message persistence ───
function queueMsg(role, content, meta) {
  if (!currentAgentId) return;
  pendingMsgs.push({ role, content, ...(meta || {}) });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushMsgs, 500);
}

async function flushMsgs() {
  if (!currentAgentId || !pendingMsgs.length) return;
  const batch = [...pendingMsgs];
  pendingMsgs = [];
  try {
    await api(`/agents/${currentAgentId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: batch }),
    });
  } catch (e) { console.error("保存消息失败:", e); }
}

async function loadAgentMessages(agentId) {
  try {
    const msgs = await api(`/agents/${agentId}/messages`);
    return Array.isArray(msgs) ? msgs : [];
  } catch {
    return [];
  }
}

function renderStoredMsgs(msgs) {
  const el = document.getElementById("messages");
  if (!el) return;
  el.innerHTML = "";
  for (const m of msgs) {
    if (m.is_tool) {
      const ok = m.tool_ok === 1 || m.tool_ok === true;
      const summary = m.content || "";
      const tag = m.tool_name === "tool_call" ? "tool" : "result";
      const html = m.tool_name === "tool_call"
        ? `<details style="cursor:pointer"><summary style="color:var(--accent);font-weight:600">🔧 ${m.content}</summary><pre style="font-size:11px;opacity:0.7;margin-top:6px;white-space:pre-wrap;word-break:break-all">${(m.tool_args||'')}</pre></details>`
        : `<details style="cursor:pointer" ${ok ? '' : 'open'}><summary style="color:${ok ? 'var(--accent)' : 'var(--danger)'};font-weight:600">📋 ${summary.slice(0,80)}${summary.length>80?'…':''}</summary><div style="font-size:11px;opacity:0.8;margin-top:6px;max-height:200px;overflow-y:auto">${summary}</div></details>`;
      sysCardInner(el, tag, html);
    } else {
      const div = document.createElement("div");
      div.className = "message " + m.role;
      div.innerHTML = `<div class="role">${m.role}</div><div class="content">${md(m.content)}</div>`;
      el.appendChild(div);
    }
  }
  el.scrollTop = el.scrollHeight;
}

function sysCardInner(el, role, html) {
  const div = document.createElement("div");
  div.className = "message system";
  div.innerHTML = `<div class="role">${role}</div><div class="content">${html}</div>`;
  el.appendChild(div);
}

function applyTheme(themeId) {
  currentTheme = themeId;
  api("/themes").then(themes => {
    const t = themes.find(x => x.id === themeId);
    if (!t) return;
    api("/themes/full").catch(() => {}).then(full => {
      if (full) {
        const vars = full.find(f => f.id === themeId);
        if (vars) Object.entries(vars.variables || {}).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
      }
    });
    localStorage.setItem("autofox-theme", themeId);
  });
}

function connectWS() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/chat/stream`);
  ws.onopen = () => console.log("WS connected");
  ws.onmessage = e => { try { handleFrame(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => setTimeout(connectWS, 2000);
}

function sendMsg(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) { alert("未连接"); return; }
  if (!currentAgentId) { alert("请先创建或选择一个 Agent"); return; }
  addBubble("user", msg);
  queueMsg("user", msg);
  addBubble("assistant", "", true);
  $("send-btn").disabled = true;
  ws.send(JSON.stringify({ type: "req", id: crypto.randomUUID(), method: "chat.send", params: { message: msg, session_id: null, agent_id: currentAgentId }}));
}

async function switchAgent(id, name) {
  if (currentAgentId) await flushMsgs();
  currentAgentId = id;
  const brand = document.getElementById("brand-name");
  if (brand) brand.textContent = name || "autofox";
  const msgs = await loadAgentMessages(id);
  renderStoredMsgs(msgs);
  loadAgents();
}

let assistantText = "";
let streamingEl = null;

function addBubble(role, content, streaming) {
  const div = document.createElement("div");
  div.className = "message " + role;
  div.innerHTML = `<div class="role">${role}</div><div class="content">${md(content)}</div>`;
  if (streaming) {
    div.classList.add("streaming");
    streamingEl = div;
    assistantText = "";
  }
  $("messages").appendChild(div);
  $("messages").scrollTop = $("messages").scrollHeight;
  return div;
}

function appendStream(text) {
  assistantText += text;
  if (streamingEl) {
    const contentEl = streamingEl.querySelector(".content");
    if (contentEl) contentEl.innerHTML = md(assistantText);
    $("messages").scrollTop = $("messages").scrollHeight;
  }
}

function finalize(data) {
  if (streamingEl) {
    streamingEl.classList.remove("streaming");
    // 从 DOM 回退获取文本，确保不丢失
    const text = assistantText || (streamingEl.querySelector(".content")?.textContent || "");
    if (text) {
      queueMsg("assistant", text);
    }
    streamingEl = null;
    assistantText = "";
  }
  flushMsgs();
  $("send-btn").disabled = false;
}

function sysCard(role, html) {
  const div = document.createElement("div");
  div.className = "message system";
  div.innerHTML = `<div class="role">${role}</div><div class="content">${html}</div>`;
  $("messages").appendChild(div);
  $("messages").scrollTop = $("messages").scrollHeight;
  return div;
}

function handleFrame(f) {
  const h = {
    text_delta: () => appendStream(f.data.text),
    session_created: () => {},
    tool_call: () => {
      const args = JSON.stringify(f.data.args, null, 2).slice(0, 300);
      sysCard("tool", `<details style="cursor:pointer"><summary style="color:var(--accent);font-weight:600">🔧 ${f.data.name}</summary><pre style="font-size:11px;opacity:0.7;margin-top:6px;white-space:pre-wrap;word-break:break-all">${args}</pre></details>`);
      queueMsg(f.data.name, args, { is_tool: true, tool_name: "tool_call", tool_args: args });
    },
    tool_result: () => {
      const summary = f.data.summary || "";
      const ok = f.data.ok;
      sysCard("result", `<details style="cursor:pointer" ${ok ? '' : 'open'}><summary style="color:${ok ? 'var(--accent)' : 'var(--danger)'};font-weight:600">📋 ${f.data.name}: ${summary.slice(0,80)}${summary.length>80?'…':''}</summary><div style="font-size:11px;opacity:0.8;margin-top:6px;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto">${summary}</div></details>`);
      queueMsg(summary, "", { is_tool: true, tool_name: f.data.name || "", tool_ok: ok });
    },
    vision: () => sysCard("vision", `${f.data.strategy}: ${(f.data.description||'').slice(0, 200)}`),
    compaction: () => sysCard("memory", `上下文压缩: ${f.data.originalCount} → ${f.data.compactedTo}`),
    skill_match: () => sysCard("skill", `匹配技能: <b>${f.data.name}</b> (${(f.data.score*100).toFixed(0)}%)`),
    skill_refined: () => sysCard("skill", `新技能: <b>${f.data.name}</b>`),
    done: () => finalize(f.data),
    error: () => sysCard("error", `<span style="color:var(--danger)">${f.data.message}</span>`),
  };
  if (h[f.event]) h[f.event]();
}

function md(t) {
  if (!t) return "";
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");
}

function showPanel(title, renderFn) {
  const p = $("right-panel");
  p.style.display = "flex"; p.style.flexDirection = "column"; p.style.width = "360px";
  p.style.overflowY = "auto"; p.style.borderLeft = "1px solid var(--border-color)";
  $("panel-header").innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between"><h2>${title}</h2><button id="panel-close-btn" style="width:28px;height:28px;background:var(--bg-tertiary);border:none;color:var(--text-secondary);font-size:18px;cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center">✕</button></div>`;
  $("panel-content").innerHTML = "";
  $("panel-close-btn").addEventListener("click", hidePanel);
  renderFn($("panel-content"));
}

function hidePanel() { $("right-panel").style.display = "none"; }

function showOverlay(html) {
  const el = document.getElementById("overlay-content") || document.getElementById("overlay");
  if (!el) return;
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.style.display = "flex";
  el.innerHTML = html;
}
function hideOverlay() {
  const el = document.getElementById("overlay");
  if (el) el.style.display = "none";
}

// ─── Agent list ───
async function loadAgents() {
  const agents = await api("/agents");
  const list = $("room-list");
  if (!agents.length) {
    list.innerHTML = `<div style="padding:16px;color:var(--text-secondary);font-size:13px">点击 + 创建 Agent</div>`;
    return;
  }
  list.innerHTML = agents.map(a => `
    <div class="room-item${a.id === currentAgentId ? ' active' : ''}" data-id="${a.id}" data-name="${a.name}">
      <div class="room-name">${a.name}</div>
      <div class="room-meta">${a.provider} · ${a.theme}</div>
    </div>
  `).join("");
  list.querySelectorAll(".room-item").forEach(el => {
    el.addEventListener("click", () => { switchAgent(el.dataset.id, el.dataset.name); });
    el.addEventListener("dblclick", () => openAgentSettings(el.dataset.id));
  });
}

// ─── Agent create (single form) ───
async function showCreateAgent() {
  showOverlay(`
    <div class="wizard-card">
      <h2>创建新助手</h2>
      <div style="margin-top:16px">
        <div style="display:block;margin-bottom:4px;font-size:13px;color:var(--text-secondary)">名字</div>
        <input id="ca-name" placeholder="给助手起个名字，如「代码助手」" style="width:100%;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);outline:none">
      </div>
      <div style="margin-top:12px">
        <div style="display:block;margin-bottom:4px;font-size:13px;color:var(--text-secondary)">人设（可选，稍后可在设置中完善）</div>
        <textarea id="ca-persona" rows="2" placeholder="描述它的专长和定位，如「资深 Python 后端开发者」" style="width:100%;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);resize:vertical;outline:none;font-family:var(--font-sans)"></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">
        <button id="ca-cancel" type="button" class="wiz-btn secondary">取消</button>
        <button id="ca-create" type="button" class="wiz-btn primary">✨ 创建</button>
      </div>
    </div>
  `);

  const cancelBtn = document.getElementById("ca-cancel");
  const createBtn = document.getElementById("ca-create");
  const nameInput = document.getElementById("ca-name");
  const personaInput = document.getElementById("ca-persona");

  if (!cancelBtn || !createBtn) return;

  cancelBtn.addEventListener("click", () => hideOverlay());
  createBtn.addEventListener("click", async () => {
    createBtn.disabled = true;
    createBtn.textContent = "创建中...";
    try {
      const name = (nameInput?.value || "").trim() || "新助手";
      const persona = (personaInput?.value || "").trim();
      const res = await api("/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, persona }) });
      hideOverlay();
      switchAgent(res.id, name);
    } catch (e) {
      console.error("创建 Agent 失败:", e);
      alert("创建失败: " + (e.message || "未知错误"));
      createBtn.disabled = false;
      createBtn.textContent = "✨ 创建";
    }
  });

  if (nameInput) nameInput.focus();
}

// ─── Agent settings ───
async function openAgentSettings(id) {
  const agent = await api(`/agents/${id}`);
  showPanel(`${agent.name} 设置`, async (container) => {
    container.innerHTML = `
      <div style="padding:12px 16px"><label>名字</label><input id="ags-name" value="${agent.name}" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px"></div>
      <div style="padding:12px 16px"><label>人设</label><textarea id="ags-persona" rows="3" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px;resize:vertical">${agent.persona||''}</textarea></div>
      <div style="padding:12px 16px"><label>规则</label><textarea id="ags-rules" rows="4" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px;resize:vertical">${agent.rules||''}</textarea></div>
      <div style="padding:12px 16px"><label>风格</label><textarea id="ags-style" rows="3" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px;resize:vertical">${agent.style||''}</textarea></div>
      ${await buildProviderSelect("ags-provider", agent.provider)}
      ${buildModelInput("ags-model", agent.model)}
      <div style="padding:12px 16px"><label>配色</label><select id="ags-theme" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px">
        <option value="dark-orange" ${agent.theme==='dark-orange'?'selected':''}>暗夜橙</option>
        <option value="dark-blue" ${agent.theme==='dark-blue'?'selected':''}>暗夜蓝</option>
        <option value="dark-green" ${agent.theme==='dark-green'?'selected':''}>暗夜绿</option>
        <option value="light-warm" ${agent.theme==='light-warm'?'selected':''}>暖光</option>
        <option value="midnight-purple" ${agent.theme==='midnight-purple'?'selected':''}>深夜紫</option>
      </select></div>
      <div style="padding:16px;display:flex;gap:8px">
        <button id="ags-save" style="flex:1;padding:10px;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer">保存</button>
        <button id="ags-delete" style="padding:10px 16px;background:var(--danger);color:white;border:none;border-radius:4px;cursor:pointer">删除</button>
      </div>
      <div id="ags-status" style="padding:0 16px 16px;font-size:12px;text-align:center"></div>
    `;
    const saveBtn = container.querySelector("#ags-save");
    const delBtn = container.querySelector("#ags-delete");
    const statusEl = container.querySelector("#ags-status");

    saveBtn?.addEventListener("click", async () => {
      const nameEl = container.querySelector("#ags-name");
      const personaEl = container.querySelector("#ags-persona");
      const rulesEl = container.querySelector("#ags-rules");
      const styleEl = container.querySelector("#ags-style");
      const providerEl = container.querySelector("#ags-provider");
      const modelEl = container.querySelector("#ags-model");
      const themeEl = container.querySelector("#ags-theme");
      if (!nameEl) return;
      const data = {
        name: (nameEl).value, persona: (personaEl).value, rules: (rulesEl).value,
        style: (styleEl).value, provider: (providerEl).value,
        model: (modelEl).value, theme: (themeEl).value,
      };
      await api(`/agents/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (statusEl) { statusEl.textContent = "✅ 已保存"; statusEl.style.color = "#51cf66"; }
      await loadAgents();
    });

    delBtn?.addEventListener("click", async () => {
      if (!confirm("确定删除此 Agent？")) return;
      delBtn.disabled = true;
      delBtn.textContent = "删除中...";
      try {
        await api(`/agents/${id}`, { method: "DELETE" });
        hidePanel();
        if (currentAgentId === id) {
          currentAgentId = null;
          renderStoredMsgs([]);
          const brand = document.getElementById("brand-name");
          if (brand) brand.textContent = "autofox";
        }
        await loadAgents();
      } catch (e) {
        console.error("删除失败:", e);
        alert("删除失败: " + (e.message || "未知错误"));
        delBtn.disabled = false;
        delBtn.textContent = "删除";
      }
    });
  });
}

async function buildProviderSelect(id, selected) {
  const providers = await api("/providers");
  return `<div style="padding:12px 16px"><label>模型提供商</label><select id="${id}" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px">${providers.map(p => `<option value="${p.id}" ${p.id===selected?'selected':''}>${p.name}</option>`).join('')}</select></div>`;
}

function buildModelInput(id, selected) {
  return `<div style="padding:12px 16px"><label>模型名称</label><input id="${id}" type="text" value="${selected||''}" placeholder="输入模型名称，如 deepseek-chat" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px"></div>`;
}

// ─── Theme selector ───
async function showThemePanel() {
  const themes = await api("/themes");
  showPanel("配色方案", container => {
    container.innerHTML = themes.map(t => `
      <div class="theme-card" data-id="${t.id}">
        <div class="theme-preview" style="background:${t.id.startsWith('light')?'#fef3c7':'#1a1b1e'}"></div>
        <div><b>${t.nameZh}</b><br><small>${t.name}</small></div>
        ${t.id === currentTheme ? '<span style="color:var(--accent)">✓ 当前</span>' : ''}
      </div>
    `).join('');
    container.querySelectorAll(".theme-card").forEach(el => el.addEventListener("click", () => { applyTheme(el.dataset.id); showThemePanel(); }));
  });
}

// ─── Global settings ───
async function showSettingsPanel() {
  showPanel("全局设置", async (container) => {
    const providerHtml = await buildProviderSelect("gs-provider", "deepseek");
    container.innerHTML = `
      <div style="padding:12px 16px"><label>API 密钥</label><input id="gs-api-key" type="password" placeholder="sk-..." style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px"></div>
      ${providerHtml}
      ${buildModelInput("gs-model", "deepseek-chat")}
      <div style="padding:12px 16px"><label>自定义接口地址（可选）</label><input id="gs-base-url" type="text" placeholder="https://api.example.com/v1" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px"></div>
      <div style="padding:12px 16px"><label>视觉模型提供商</label><select id="gs-vision-provider" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px"><option value="openai">OpenAI</option><option value="zhipu">智谱 GLM</option><option value="doubao">豆包</option><option value="custom">自定义兼容</option></select></div>
      <div style="padding:12px 16px"><label>视觉模型名称</label><input id="gs-vision-model" value="gpt-4o-mini" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;margin-top:4px"></div>
      <div style="padding:16px"><button id="gs-save" style="width:100%;padding:10px;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer">保存设置</button></div>
      <div id="gs-status" style="padding:0 16px 16px;font-size:12px;text-align:center"></div>
    `;
    api("/config").then(c => {
      setTimeout(() => {
        if ($("gs-provider")) $("gs-provider").value = c.model?.provider || "deepseek";
        if ($("gs-model")) $("gs-model").value = c.model?.model || "";
        if ($("gs-base-url")) $("gs-base-url").value = c.model?.base_url || "";
        if ($("gs-vision-provider")) $("gs-vision-provider").value = c.vision?.provider || "openai";
        if ($("gs-vision-model")) $("gs-vision-model").value = c.vision?.model || "gpt-4o-mini";
      }, 200);
    });
    $("gs-save").addEventListener("click", async () => {
      const data = { model: { provider: $("gs-provider").value, api_key: $("gs-api-key").value, model: $("gs-model").value, base_url: $("gs-base-url").value || undefined }, vision: { provider: $("gs-vision-provider").value, model: $("gs-vision-model").value } };
      const r = await api("/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      $("gs-status").textContent = r.ok ? "✅ 已保存，重启后生效" : "⚠ 保存失败"; $("gs-status").style.color = r.ok ? "#51cf66" : "var(--danger)";
    });
  });
}

// ─── Skill market ───
async function showSkillPanel() { showPanel("技能市场", loadSkillMarket); }

async function loadSkillMarket(container) {
  container.innerHTML = `<input id="skill-search-input" type="text" placeholder="搜索技能..." style="margin:12px;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px"><div id="skill-list-container"></div>`;
  $("skill-search-input").addEventListener("input", e => fetchSkills(e.target.value));
  fetchSkills("");
}

async function fetchSkills(q) {
  const ct = $("skill-list-container");
  ct.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">加载中...</div>';
  const url = q ? `/skills/marketplace?q=${encodeURIComponent(q)}` : "/skills/marketplace";
  try {
    const skills = await api(url);
    if (!Array.isArray(skills) || !skills.length) { ct.innerHTML = '<div style="padding:16px">无结果</div>'; return; }
    ct.innerHTML = skills.map(s => `<div class="skill-card"><h3>${s.name?.en||s.id}</h3><p>${s.description?.en||''}</p><div class="tags">${(s.tags?.en||[]).map(t=>'<span class="tag">'+t+'</span>').join('')}</div><div style="text-align:right;margin-top:8px"><button class="install-btn" data-id="${s.id}">安装</button></div></div>`).join('');
    ct.querySelectorAll(".install-btn").forEach(btn => btn.addEventListener("click", async () => {
      btn.textContent = "安装中..."; btn.disabled = true;
      try {
        const r = await api("/skills/marketplace/install", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({skillId:btn.dataset.id})});
        btn.textContent = r.ok ? "已安装" : "失败"; if (r.ok) btn.classList.add("installed"); else btn.disabled = false;
      } catch { btn.textContent = "安装"; btn.disabled = false; }
    }));
  } catch { ct.innerHTML = '<div style="padding:16px">加载失败</div>'; }
}

function initChat() {
  const input = $("user-input");
  $("send-btn").addEventListener("click", () => { const t = input.value.trim(); if (!t) return; input.value = ""; sendMsg(t); });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("send-btn").click(); } });
}

function initSidebar() {
  $("new-agent").addEventListener("click", showCreateAgent);
  $("nav-skills").addEventListener("click", showSkillPanel);
  $("nav-settings").addEventListener("click", showSettingsPanel);
  $("nav-themes").addEventListener("click", showThemePanel);
}

// ─── First-run setup wizard ───
async function checkFirstRun() {
  try {
    const status = await api("/setup/status");
    if (status.is_first_run) {
      showFirstRunWizard();
    }
  } catch {}
}

function showFirstRunWizard() {
  showOverlay(`
    <div class="wizard-card" style="max-width:520px">
      <h2>🦊 欢迎使用 autofox</h2>
      <p style="margin-top:8px;color:var(--text-secondary);font-size:14px">看起来你是第一次运行，我们先做几个简单的设置。</p>
      <div style="margin-top:20px">
        <div style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-secondary)">模型提供商</div>
        <select id="fu-provider" style="width:100%;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary)">
          <option value="deepseek">DeepSeek</option>
          <option value="zhipu">智谱 GLM</option>
          <option value="moonshot">月之暗面 Kimi</option>
          <option value="qwen">通义千问</option>
          <option value="doubao">豆包 (字节)</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>
      <div style="margin-top:12px">
        <div style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-secondary)">API 密钥</div>
        <input id="fu-apikey" type="password" placeholder="输入你的 API Key" style="width:100%;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);outline:none">
      </div>
      <div style="margin-top:12px">
        <div style="display:block;margin-bottom:6px;font-size:13px;color:var(--text-secondary)">模型名称</div>
        <input id="fu-model" type="text" value="deepseek-chat" style="width:100%;padding:8px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);outline:none">
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border-color)">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="fu-shortcut" checked style="accent-color:var(--accent)">
          <div>
            <div style="font-size:14px">创建桌面快捷方式</div>
            <div style="font-size:12px;color:var(--text-secondary)">方便下次快速启动</div>
          </div>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:10px">
          <input type="checkbox" id="fu-autostart" checked style="accent-color:var(--accent)">
          <div>
            <div style="font-size:14px">开机自启动 <span style="background:var(--accent);color:white;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px">推荐</span></div>
            <div style="font-size:12px;color:var(--text-secondary)">登录系统后自动启动 autofox</div>
          </div>
        </label>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">
        <button id="fu-skip" class="wiz-btn secondary">跳过</button>
        <button id="fu-finish" class="wiz-btn primary">✨ 完成设置</button>
      </div>
    </div>
  `);

  document.getElementById("fu-skip")?.addEventListener("click", hideOverlay);
  document.getElementById("fu-provider")?.addEventListener("change", function() {
    const defaults = { deepseek: "deepseek-chat", zhipu: "glm-4-plus", moonshot: "moonshot-v1-32k", qwen: "qwen-plus", doubao: "doubao-pro-32k", openai: "gpt-4o-mini" };
    const model = document.getElementById("fu-model");
    if (model) model.value = defaults[this.value] || "";
  });

  document.getElementById("fu-finish")?.addEventListener("click", async () => {
    const btn = document.getElementById("fu-finish");
    if (btn) { btn.disabled = true; btn.textContent = "保存中..."; }
    try {
      const data = {
        model: {
          provider: document.getElementById("fu-provider")?.value || "deepseek",
          api_key: document.getElementById("fu-apikey")?.value || "",
          model: document.getElementById("fu-model")?.value || "deepseek-chat",
        },
      };
      await api("/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

      const shortcut = document.getElementById("fu-shortcut")?.checked;
      const autostart = document.getElementById("fu-autostart")?.checked;
      await api("/setup/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desktop_shortcut: shortcut, auto_start: autostart }),
      });

      hideOverlay();
    } catch (e) {
      alert("设置保存失败: " + (e.message || "未知错误"));
      if (btn) { btn.disabled = false; btn.textContent = "✨ 完成设置"; }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("autofox-theme");
  if (saved) applyTheme(saved);
  initSidebar();
  initChat();
  connectWS();
  loadAgents();
  checkFirstRun();
});
