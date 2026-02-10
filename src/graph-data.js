/**
 * Graph data for visualization: accounts and edges (relations + connected_accounts).
 */
import db from "./db.js";

/**
 * List accounts with optional search and platform filter.
 * @param {{ q?: string, platform?: string }} opts
 */
export function getAccounts(opts = {}) {
  let sql = "SELECT id, username, platform, profile_url FROM accounts WHERE 1=1";
  const params = [];
  if (opts.q && opts.q.trim()) {
    sql += " AND (username LIKE ? OR platform LIKE ?)";
    const term = `%${opts.q.trim()}%`;
    params.push(term, term);
  }
  if (opts.platform && opts.platform.trim()) {
    sql += " AND platform = ?";
    params.push(opts.platform.trim());
  }
  sql += " ORDER BY platform, username";
  return db.prepare(sql).all(...params);
}

/**
 * Nodes and edges for the graph: selected accounts + their connections.
 * @param {number[]} accountIds - focus account IDs
 * @param {{ platform?: string, linkType?: string }} filters - optional filters for edges
 */
export function getGraphData(accountIds, filters = {}) {
  if (!accountIds || accountIds.length === 0) {
    return { nodes: [], edges: [] };
  }
  const placeholders = accountIds.map(() => "?").join(",");

  // All node IDs: selected + any account connected via relations or connected_accounts
  const nodeIdsStmt = db.prepare(`
    SELECT id FROM accounts WHERE id IN (${placeholders})
    UNION
    SELECT source_account_id AS id FROM relations WHERE destination_account_id IN (${placeholders})
    UNION
    SELECT destination_account_id AS id FROM relations WHERE source_account_id IN (${placeholders})
    UNION
    SELECT account_id_1 AS id FROM connected_accounts WHERE account_id_2 IN (${placeholders})
    UNION
    SELECT account_id_2 AS id FROM connected_accounts WHERE account_id_1 IN (${placeholders})
  `);
  const nodeIds = [...new Set(nodeIdsStmt.all(...accountIds, ...accountIds, ...accountIds, ...accountIds).map((r) => r.id))];
  if (nodeIds.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodePlaceholders = nodeIds.map(() => "?").join(",");
  let nodes = db.prepare(
    `SELECT id, username, platform, profile_url FROM accounts WHERE id IN (${nodePlaceholders})`
  ).all(...nodeIds);
  if (filters.platform && filters.platform.trim()) {
    const platform = filters.platform.trim();
    nodes = nodes.filter((n) => n.platform === platform);
  }
  const nodeIdSet = new Set(nodes.map((n) => n.id));

  // Edges: relations (only between included nodes)
  let relationEdges = db.prepare(`
    SELECT source_account_id AS fromId, destination_account_id AS toId, 'relation' AS type
    FROM relations
    WHERE source_account_id IN (${nodePlaceholders}) AND destination_account_id IN (${nodePlaceholders})
  `).all(...nodeIds, ...nodeIds);
  if (filters.linkType && filters.linkType !== "relation") relationEdges = [];
  relationEdges = relationEdges.filter((e) => nodeIdSet.has(e.fromId) && nodeIdSet.has(e.toId));

  // Edges: connected_accounts
  let connectedEdges = db.prepare(`
    SELECT account_id_1 AS fromId, account_id_2 AS toId, COALESCE(NULLIF(link_type,''), 'same_person') AS type
    FROM connected_accounts
    WHERE account_id_1 IN (${nodePlaceholders}) AND account_id_2 IN (${nodePlaceholders})
  `).all(...nodeIds, ...nodeIds);
  if (filters.linkType) {
    if (filters.linkType === "relation") connectedEdges = [];
    else connectedEdges = connectedEdges.filter((e) => e.type === filters.linkType);
  }
  connectedEdges = connectedEdges.filter((e) => nodeIdSet.has(e.fromId) && nodeIdSet.has(e.toId));

  const edges = [
    ...relationEdges.map((e) => ({ from: e.fromId, to: e.toId, type: e.type })),
    ...connectedEdges.map((e) => ({ from: e.fromId, to: e.toId, type: e.type })),
  ];

  return { nodes, edges };
}
