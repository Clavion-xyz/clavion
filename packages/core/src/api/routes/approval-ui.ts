import type { FastifyInstance } from "fastify";
import type { PendingApprovalStore } from "../../approval/pending-approval-store.js";
import type { AuditTraceService } from "@clavion/audit";

export interface ApprovalUIRouteServices {
  pendingStore: PendingApprovalStore;
  auditTrace: AuditTraceService;
}

export function createApprovalUIRoutes(services: ApprovalUIRouteServices) {
  return async function approvalUIRoutes(app: FastifyInstance): Promise<void> {
    const { pendingStore, auditTrace } = services;

    // GET /v1/approvals/pending — list pending approval requests
    app.get("/v1/approvals/pending", {
      handler: async (_request, reply) => {
        const items = pendingStore.list().map((p) => ({
          ...p,
          expiresAt: p.createdAt + pendingStore.ttlMs,
        }));
        return reply.send({ pending: items });
      },
    });

    // POST /v1/approvals/:requestId/decide — submit approve/deny decision
    app.post<{
      Params: { requestId: string };
      Body: { approved: boolean };
    }>("/v1/approvals/:requestId/decide", {
      schema: {
        params: {
          type: "object",
          required: ["requestId"],
          properties: {
            requestId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["approved"],
          additionalProperties: false,
          properties: {
            approved: { type: "boolean" },
          },
        },
      },
      handler: async (request, reply) => {
        const { requestId } = request.params;
        const { approved } = request.body;

        const pending = pendingStore.get(requestId);
        const decided = pendingStore.decide(requestId, approved);

        if (!decided) {
          return reply.code(404).send({
            error: "not_found",
            message: "Approval request not found or expired.",
          });
        }

        if (pending) {
          auditTrace.log("web_approval_decided", {
            intentId: pending.summary.intentId,
            requestId,
            approved,
            action: pending.summary.action,
          });
        }

        return reply.send({ decided: true, requestId, approved });
      },
    });

    // GET /v1/approvals/history — recent audit events
    app.get<{
      Querystring: { limit?: string };
    }>("/v1/approvals/history", {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string", pattern: "^[0-9]+$" },
          },
        },
      },
      handler: async (request, reply) => {
        const limit = Math.min(
          Math.max(1, Number(request.query.limit ?? 20)),
          100,
        );
        const events = auditTrace.getRecentEvents(limit);
        return reply.send({ events });
      },
    });

    // GET /approval-ui — serve inline HTML page
    app.get("/approval-ui", {
      handler: async (_request, reply) => {
        return reply.type("text/html").send(APPROVAL_UI_HTML);
      },
    });
  };
}

const APPROVAL_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ISCL Approval Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f0f1a;
    color: #e0e0e0;
    min-height: 100vh;
    padding: 0;
  }
  .header {
    background: #1a1a2e;
    border-bottom: 1px solid #2a2a4a;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header h1 { font-size: 18px; font-weight: 600; color: #fff; }
  .header .mode { font-size: 12px; color: #888; background: #2a2a4a; padding: 4px 10px; border-radius: 4px; }
  .container { max-width: 800px; margin: 0 auto; padding: 24px; }
  .section { margin-bottom: 32px; }
  .section-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 12px;
  }
  .empty { color: #555; font-style: italic; padding: 16px; text-align: center; }
  .card {
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 8px;
  }
  .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
  .card-action { font-size: 15px; font-weight: 600; color: #fff; }
  .card-expiry { font-size: 12px; color: #888; white-space: nowrap; }
  .card-expiry.urgent { color: #e17055; }
  .card-outcome { font-size: 13px; color: #b0b0b0; margin-bottom: 10px; }
  .card-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #888; margin-bottom: 10px; }
  .risk-badge { display: inline-flex; align-items: center; gap: 4px; }
  .risk-bar { width: 60px; height: 6px; background: #2a2a4a; border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle; }
  .risk-fill { height: 100%; border-radius: 3px; }
  .risk-low { background: #00b894; }
  .risk-med { background: #fdcb6e; }
  .risk-high { background: #e17055; }
  .diffs { font-size: 13px; margin-bottom: 10px; }
  .diffs .diff-line { font-family: "SF Mono", "Fira Code", "Consolas", monospace; font-size: 12px; padding: 2px 0; }
  .diff-neg { color: #e17055; }
  .diff-pos { color: #00b894; }
  .warnings { margin-bottom: 10px; }
  .warning-item { font-size: 12px; color: #fdcb6e; padding: 2px 0; }
  .addr { font-family: "SF Mono", "Fira Code", "Consolas", monospace; font-size: 12px; color: #aaa; }
  .buttons { display: flex; gap: 8px; }
  .btn {
    padding: 8px 24px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn:hover { opacity: 0.85; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-approve { background: #00b894; color: #fff; }
  .btn-deny { background: #e17055; color: #fff; }
  .history-row {
    display: flex;
    gap: 12px;
    padding: 6px 12px;
    font-size: 12px;
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
    border-bottom: 1px solid #1a1a2e;
  }
  .history-row:nth-child(odd) { background: #14142a; }
  .history-time { color: #888; min-width: 70px; }
  .history-event { color: #b0b0b0; min-width: 160px; }
  .history-intent { color: #666; }
  .event-approve { color: #00b894; }
  .event-deny { color: #e17055; }
  .event-build { color: #74b9ff; }
  .history-container { background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 8px; overflow: hidden; }
</style>
</head>
<body>
<div class="header">
  <h1>ISCL Approval Dashboard</h1>
  <span class="mode">Web Approval Mode</span>
</div>
<div class="container">
  <div class="section">
    <div class="section-title">Pending Approvals</div>
    <div id="pending"><div class="empty">No pending approvals</div></div>
  </div>
  <div class="section">
    <div class="section-title">Recent Transactions</div>
    <div id="history" class="history-container"><div class="empty">No events yet</div></div>
  </div>
</div>
<script>
(function() {
  const pendingEl = document.getElementById('pending');
  const historyEl = document.getElementById('history');
  let deciding = new Set();

  function truncAddr(addr) {
    if (!addr || addr.length < 12) return addr || '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function riskClass(score) {
    if (score <= 30) return 'risk-low';
    if (score <= 60) return 'risk-med';
    return 'risk-high';
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Expired';
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function eventClass(event) {
    if (event.includes('granted') || event.includes('broadcast')) return 'event-approve';
    if (event.includes('denied') || event.includes('rejected') || event.includes('failed')) return 'event-deny';
    if (event.includes('built') || event.includes('preflight')) return 'event-build';
    return '';
  }

  function renderPending(items) {
    if (!items || items.length === 0) {
      pendingEl.innerHTML = '<div class="empty">No pending approvals</div>';
      return;
    }
    var now = Date.now();
    pendingEl.innerHTML = items.map(function(item) {
      var s = item.summary;
      var remaining = item.expiresAt - now;
      var urgent = remaining < 60000;
      var disabled = deciding.has(item.requestId);
      var html = '<div class="card" data-request="' + item.requestId + '">';
      html += '<div class="card-header">';
      html += '<span class="card-action">' + escHtml(s.action) + '</span>';
      html += '<span class="card-expiry' + (urgent ? ' urgent' : '') + '">' + formatCountdown(remaining) + '</span>';
      html += '</div>';
      html += '<div class="card-outcome">' + escHtml(s.expectedOutcome) + '</div>';
      if (s.recipient) html += '<div class="card-outcome">To: <span class="addr">' + escHtml(s.recipient) + '</span></div>';
      if (s.spender) html += '<div class="card-outcome">Spender: <span class="addr">' + escHtml(s.spender) + '</span></div>';
      html += '<div class="card-meta">';
      html += '<span class="risk-badge">Risk: ' + s.riskScore + '/100 ';
      html += '<span class="risk-bar"><span class="risk-fill ' + riskClass(s.riskScore) + '" style="width:' + s.riskScore + '%"></span></span></span>';
      html += '<span>Gas: ' + escHtml(s.gasEstimateEth) + '</span>';
      html += '</div>';
      if (s.balanceDiffs && s.balanceDiffs.length > 0) {
        html += '<div class="diffs">';
        s.balanceDiffs.forEach(function(d) {
          var cls = d.delta.startsWith('-') ? 'diff-neg' : 'diff-pos';
          var prefix = d.delta.startsWith('-') || d.delta.startsWith('+') ? '' : '+';
          var usd = d.usdValue ? ' (~$' + d.usdValue + ')' : '';
          html += '<div class="diff-line ' + cls + '">' + prefix + escHtml(d.delta) + ' ' + escHtml(d.asset) + usd + '</div>';
        });
        html += '</div>';
      }
      if (s.warnings && s.warnings.length > 0) {
        html += '<div class="warnings">';
        s.warnings.forEach(function(w) { html += '<div class="warning-item">&#9888; ' + escHtml(w) + '</div>'; });
        html += '</div>';
      }
      html += '<div class="buttons">';
      html += '<button class="btn btn-approve"' + (disabled ? ' disabled' : '') + ' onclick="decide(\\''+item.requestId+'\\',true)">Approve</button>';
      html += '<button class="btn btn-deny"' + (disabled ? ' disabled' : '') + ' onclick="decide(\\''+item.requestId+'\\',false)">Deny</button>';
      html += '</div></div>';
      return html;
    }).join('');
  }

  function renderHistory(events) {
    if (!events || events.length === 0) {
      historyEl.innerHTML = '<div class="empty">No events yet</div>';
      return;
    }
    historyEl.innerHTML = events.map(function(e) {
      var d = new Date(e.timestamp);
      var time = d.toLocaleTimeString();
      var cls = eventClass(e.event);
      return '<div class="history-row">' +
        '<span class="history-time">' + time + '</span>' +
        '<span class="history-event ' + cls + '">' + escHtml(e.event) + '</span>' +
        '<span class="history-intent">' + truncAddr(e.intentId) + '</span>' +
        '</div>';
    }).join('');
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.decide = async function(requestId, approved) {
    deciding.add(requestId);
    renderPending(window._lastPending || []);
    try {
      var res = await fetch('/v1/approvals/' + requestId + '/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: approved })
      });
      if (!res.ok) {
        var err = await res.json();
        alert(err.message || 'Decision failed');
      }
    } catch(e) {
      alert('Network error: ' + e.message);
    } finally {
      deciding.delete(requestId);
    }
  };

  async function pollPending() {
    try {
      var res = await fetch('/v1/approvals/pending');
      var data = await res.json();
      window._lastPending = data.pending;
      renderPending(data.pending);
    } catch(e) { /* ignore */ }
  }

  async function pollHistory() {
    try {
      var res = await fetch('/v1/approvals/history?limit=20');
      var data = await res.json();
      renderHistory(data.events);
    } catch(e) { /* ignore */ }
  }

  pollPending();
  pollHistory();
  setInterval(pollPending, 1000);
  setInterval(pollHistory, 5000);
})();
</script>
</body>
</html>`;
