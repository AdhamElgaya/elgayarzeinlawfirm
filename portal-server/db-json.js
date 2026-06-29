import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const storePath = process.env.DATABASE_PATH || path.join(dataDir, "portal.json");

const tables = ["users", "sessions", "invitations", "clients", "cases", "tasks", "audit_logs", "push_subscriptions"];

function emptyDb() {
  return Object.fromEntries(tables.map((t) => [t, []]));
}

function load() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    const initial = emptyDb();
    fs.writeFileSync(storePath, JSON.stringify(initial, null, 2));
    return initial;
  }
  const data = JSON.parse(fs.readFileSync(storePath, "utf8"));
  migrateUsers(data);
  if (!data.clients) {
    data.clients = [];
    save(data);
  }
  migrateCases(data);
  migrateCaseFields(data);
  migrateTasks(data);
  if (!data.push_subscriptions) {
    data.push_subscriptions = [];
    save(data);
  }
  return data;
}

function migrateTasks(data) {
  let changed = false;
  for (const row of data.tasks || []) {
    if (!Array.isArray(row.attachments)) {
      row.attachments = [];
      changed = true;
    }
    if (row.reminder_sent_at === undefined) {
      row.reminder_sent_at = null;
      changed = true;
    }
  }
  if (changed) save(data);
}

function migrateCaseFields(data) {
  let changed = false;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isoRe = /^\d{4}-\d{2}-\d{2}T/;

  for (const row of data.cases || []) {
    if (
      uuidRe.test(String(row.status || "")) &&
      isoRe.test(String(row.assigned_to || "")) &&
      uuidRe.test(String(row.opened_at || ""))
    ) {
      const fixed = {
        status: "active",
        assigned_to: row.status,
        opened_at: row.assigned_to,
        created_by: row.opened_at,
      };
      Object.assign(row, fixed);
      changed = true;
    }
  }

  if (changed) save(data);
}

function migrateCases(data) {
  let changed = false;
  for (const row of data.cases || []) {
    if (row.notes === undefined) {
      row.notes = "";
      changed = true;
    }
    if (row.attachments === undefined) {
      row.attachments = [];
      changed = true;
    }
  }
  if (changed) save(data);
}

function migrateUsers(data) {
  let changed = false;
  for (const user of data.users || []) {
    if (!user.username && user.email) {
      const local = String(user.email).split("@")[0] || "user";
      user.username = local.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      delete user.email;
      changed = true;
    }
  }
  if (changed) save(data);
}

function save(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

class Statement {
  constructor(sql, db) {
    this.sql = sql.trim();
    this.db = db;
  }

  get(...params) {
    return Promise.resolve(runQuery(this.db, this.sql, params, false)[0]);
  }

  all(...params) {
    return Promise.resolve(runQuery(this.db, this.sql, params, false));
  }

  run(...params) {
    return Promise.resolve(runQuery(this.db, this.sql, params, true));
  }
}

const db = {
  data: load(),
  prepare(sql) {
    return new Statement(sql, this);
  },
  transaction(fn) {
    return () => {
      const snapshot = JSON.stringify(this.data);
      try {
        fn();
        save(this.data);
      } catch (error) {
        this.data = JSON.parse(snapshot);
        throw error;
      }
    };
  },
  exec() {
    save(this.data);
  },
  async ping() {},
};

function runQuery(dbRef, sql, params, mutate) {
  const lower = sql.toLowerCase();

  if (lower.startsWith("insert into users")) {
    const now = new Date().toISOString();
    let row;

    if (params.length === 6 && lower.includes("password_hash")) {
      row = {
        id: params[0],
        username: params[1],
        name: params[2],
        role: params[3],
        status: "active",
        password_hash: params[4],
        created_at: now,
        activated_at: params[5],
      };
    } else if (params.length === 4 && lower.includes("'admin'")) {
      row = {
        id: params[0],
        username: params[1],
        name: params[2],
        role: "admin",
        status: "active",
        password_hash: params[3],
        created_at: now,
        activated_at: now,
      };
    } else {
      throw new Error(`Unsupported users insert: ${params.length} params`);
    }

    if (mutate) {
      dbRef.data.users.push(row);
      save(dbRef.data);
    }
    return [row];
  }

  if (lower.startsWith("insert into sessions")) {
    const row = {
      id: params[0],
      user_id: params[1],
      expires_at: params[2],
      created_at: new Date().toISOString(),
    };
    if (mutate) {
      dbRef.data.sessions.push(row);
      save(dbRef.data);
    }
    return [row];
  }

  if (lower.startsWith("insert into invitations")) {
    const row = {
      id: params[0],
      user_id: params[1],
      token_hash: params[2],
      expires_at: params[3],
      used_at: null,
      created_at: new Date().toISOString(),
    };
    if (mutate) {
      dbRef.data.invitations.push(row);
      save(dbRef.data);
    }
    return [row];
  }

  if (lower.startsWith("insert into audit_logs")) {
    const row = {
      id: params[0],
      user_id: params[1],
      action: params[2],
      entity_type: params[3],
      entity_id: params[4],
      metadata: params[5],
      ip: params[6],
      created_at: new Date().toISOString(),
    };
    if (mutate) {
      dbRef.data.audit_logs.push(row);
      save(dbRef.data);
    }
    return [row];
  }

  if (lower.startsWith("insert into clients")) {
    const now = new Date().toISOString();
    const row = {
      id: params[0],
      name: params[1],
      phone: params[2] || null,
      created_by: params[3],
      deleted_at: null,
      created_at: now,
    };
    if (mutate) {
      if (!dbRef.data.clients) dbRef.data.clients = [];
      dbRef.data.clients.push(row);
      save(dbRef.data);
    }
    return [row];
  }

  if (lower.startsWith("insert into cases")) {
    const now = new Date().toISOString();
    const hasLiteralStatus = params.length === 6;
    const row = {
      id: params[0],
      title: params[1],
      client_id: params[2] || null,
      client_ref: null,
      notes: "",
      attachments: [],
      status: hasLiteralStatus ? "active" : params[3] || "active",
      assigned_to: hasLiteralStatus ? params[3] : params[4],
      opened_at: hasLiteralStatus ? params[4] : params[5],
      finished_at: null,
      archived_at: null,
      created_by: hasLiteralStatus ? params[5] : params[6],
      deleted_at: null,
      created_at: now,
    };
    if (mutate) {
      dbRef.data.cases.push(row);
      save(dbRef.data);
    }
    return [row];
  }

  if (lower.startsWith("insert into tasks")) {
    const now = new Date().toISOString();
    const hasAssignedAt = lower.includes("assigned_at");
    const row = {
      id: params[0],
      case_id: params[1],
      title: params[2],
      assigned_to: params[3],
      status: "open",
      due_at: params[4] || null,
      reminder_sent_at: null,
      created_by: params[5],
      attachments: hasAssignedAt ? params[6] ?? [] : params[6] ?? [],
      assigned_at: hasAssignedAt ? params[7] || now : now,
      deleted_at: null,
      created_at: now,
    };
    if (mutate) {
      dbRef.data.tasks.push(row);
      save(dbRef.data);
    }
    return [row];
  }

  if (lower.startsWith("delete from tasks where case_id = ?")) {
    if (mutate) {
      dbRef.data.tasks = dbRef.data.tasks.filter((t) => t.case_id !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from tasks where assigned_to = ? or created_by = ?")) {
    if (mutate) {
      dbRef.data.tasks = dbRef.data.tasks.filter(
        (t) => t.assigned_to !== params[0] && t.created_by !== params[1]
      );
      save(dbRef.data);
    }
    return [];
  }

  if (lower === "delete from tasks") {
    if (mutate) {
      dbRef.data.tasks = [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from cases where id = ?")) {
    if (mutate) {
      dbRef.data.cases = dbRef.data.cases.filter((c) => c.id !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from cases where assigned_to = ? or created_by = ?")) {
    if (mutate) {
      dbRef.data.cases = dbRef.data.cases.filter(
        (c) => c.assigned_to !== params[0] && c.created_by !== params[1]
      );
      save(dbRef.data);
    }
    return [];
  }

  if (lower === "delete from cases") {
    if (mutate) {
      dbRef.data.cases = [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from clients where created_by = ?")) {
    if (mutate) {
      dbRef.data.clients = dbRef.data.clients.filter((c) => c.created_by !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower === "delete from clients") {
    if (mutate) {
      dbRef.data.clients = [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from audit_logs where user_id = ?")) {
    if (mutate) {
      dbRef.data.audit_logs = dbRef.data.audit_logs.filter((log) => log.user_id !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower === "delete from audit_logs") {
    if (mutate) {
      dbRef.data.audit_logs = [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("insert into push_subscriptions")) {
    const row = {
      id: params[0],
      user_id: params[1],
      endpoint: params[2],
      subscription: params[3],
      created_at: new Date().toISOString(),
    };
    if (mutate) {
      if (!dbRef.data.push_subscriptions) dbRef.data.push_subscriptions = [];
      dbRef.data.push_subscriptions.push(row);
      save(dbRef.data);
    }
    return [row];
  }

  if (lower.startsWith("update push_subscriptions set user_id")) {
    const row = (dbRef.data.push_subscriptions || []).find((s) => s.endpoint === params[2]);
    if (row && mutate) {
      row.user_id = params[0];
      row.subscription = params[1];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from push_subscriptions where user_id = ? and endpoint = ?")) {
    if (mutate) {
      dbRef.data.push_subscriptions = (dbRef.data.push_subscriptions || []).filter(
        (s) => !(s.user_id === params[0] && s.endpoint === params[1])
      );
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from push_subscriptions where id = ?")) {
    if (mutate) {
      dbRef.data.push_subscriptions = (dbRef.data.push_subscriptions || []).filter((s) => s.id !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from push_subscriptions where user_id = ?")) {
    if (mutate) {
      dbRef.data.push_subscriptions = (dbRef.data.push_subscriptions || []).filter((s) => s.user_id !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower === "delete from push_subscriptions") {
    if (mutate) {
      dbRef.data.push_subscriptions = [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("select id from push_subscriptions where endpoint = ?")) {
    return (dbRef.data.push_subscriptions || [])
      .filter((s) => s.endpoint === params[0])
      .map((s) => ({ id: s.id }));
  }

  if (lower.startsWith("select id, endpoint, subscription from push_subscriptions where user_id = ?")) {
    return (dbRef.data.push_subscriptions || []).filter((s) => s.user_id === params[0]);
  }

  if (lower.startsWith("update sessions set expires_at")) {
    const row = dbRef.data.sessions.find((s) => s.id === params[1]);
    if (row && mutate) {
      row.expires_at = params[0];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from sessions where id = ?")) {
    if (mutate) {
      dbRef.data.sessions = dbRef.data.sessions.filter((s) => s.id !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from sessions where user_id = ?")) {
    if (mutate) {
      dbRef.data.sessions = dbRef.data.sessions.filter((s) => s.user_id !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from invitations where user_id = ?")) {
    if (mutate) {
      dbRef.data.invitations = dbRef.data.invitations.filter((i) => i.user_id !== params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower === "delete from invitations") {
    if (mutate) {
      dbRef.data.invitations = [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower === "delete from sessions") {
    if (mutate) {
      dbRef.data.sessions = [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from users where id != ?")) {
    if (mutate) {
      dbRef.data.users = dbRef.data.users.filter((u) => u.id === params[0]);
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("delete from users where id = ?")) {
    if (mutate) {
      const before = dbRef.data.users.length;
      dbRef.data.users = dbRef.data.users.filter((u) => u.id !== params[0]);
      if (dbRef.data.users.length < before) save(dbRef.data);
    }
    return [];
  }

  if (lower.includes("select count(*) as count from users") && lower.includes("role = 'admin'")) {
    const count = dbRef.data.users.filter((u) => u.role === "admin" && u.status === "active").length;
    return [{ count }];
  }

  if (lower.includes("select count(*) as count from users")) {
    return [{ count: dbRef.data.users.length }];
  }

  if (lower.includes("from users where role = 'admin'") && lower.includes("status = 'active'")) {
    const user = dbRef.data.users.find((u) => u.role === "admin" && u.status === "active");
    return user ? [user] : [];
  }

  if (lower.includes("from users where username = ?")) {
    const user = dbRef.data.users.find((u) => u.username === params[0]);
    return user ? [user] : [];
  }

  if (lower.includes("select id from users where username = ?")) {
    const user = dbRef.data.users.find((u) => u.username === params[0]);
    return user ? [{ id: user.id }] : [];
  }

  if (lower.includes("from users where id = ?")) {
    return dbRef.data.users.filter((u) => u.id === params[0]);
  }

  if (lower.includes("join users u on u.id = s.user_id") && lower.includes("where s.id = ?")) {
    const session = dbRef.data.sessions.find((s) => s.id === params[0]);
    if (!session) return [];
    const user = dbRef.data.users.find((u) => u.id === session.user_id);
    if (!user) return [];
    return [
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    ];
  }

  if (lower.includes("select expires_at from sessions where id = ?")) {
    const session = dbRef.data.sessions.find((s) => s.id === params[0]);
    return session ? [{ expires_at: session.expires_at }] : [];
  }

  if (lower.includes("from invitations i") && lower.includes("token_hash = ?")) {
    const invite = dbRef.data.invitations.find((i) => i.token_hash === params[0]);
    if (!invite) return [];
    const user = dbRef.data.users.find((u) => u.id === invite.user_id);
    if (!user) return [];
    return [
      {
        id: invite.id,
        user_id: invite.user_id,
        expires_at: invite.expires_at,
        used_at: invite.used_at,
        username: user.username,
        name: user.name,
        status: user.status,
      },
    ];
  }

  if (lower.startsWith("update users set name = ?, username = ?, password_hash = ?")) {
    const user = dbRef.data.users.find((u) => u.id === params[3]);
    if (user && mutate) {
      user.name = params[0];
      user.username = params[1];
      user.password_hash = params[2];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update users set name = ?, username = ?")) {
    const user = dbRef.data.users.find((u) => u.id === params[2]);
    if (user && mutate) {
      user.name = params[0];
      user.username = params[1];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update users set password_hash")) {
    const user = dbRef.data.users.find((u) => u.id === params[2]);
    if (user && mutate) {
      user.password_hash = params[0];
      user.status = "active";
      user.activated_at = params[1];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update invitations set used_at")) {
    const invite = dbRef.data.invitations.find((i) => i.id === params[1]);
    if (invite && mutate) {
      invite.used_at = params[0];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.includes("from users") && lower.includes("order by created_at desc")) {
    return [...dbRef.data.users].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  if (lower.includes("from audit_logs")) {
    return dbRef.data.audit_logs
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 100)
      .map((log) => {
        const user = dbRef.data.users.find((u) => u.id === log.user_id);
        return {
          ...log,
          user_name: user?.name || null,
          user_username: user?.username || null,
        };
      });
  }

  if (lower.includes("from clients where id = ?")) {
    const client = (dbRef.data.clients || []).find((c) => c.id === params[0] && !c.deleted_at);
    return client ? [client] : [];
  }

  if (lower.includes("from clients") && lower.includes("order by")) {
    return [...(dbRef.data.clients || [])]
      .filter((c) => !c.deleted_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  if (lower.startsWith("update cases set title")) {
    const row = dbRef.data.cases.find((c) => c.id === params[7] && !c.deleted_at);
    if (row && mutate) {
      row.title = params[0];
      row.client_id = params[1] || null;
      row.assigned_to = params[2];
      row.status = params[3];
      row.finished_at = params[4] || null;
      row.notes = params[5] ?? "";
      row.attachments = params[6] ?? [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update cases set notes")) {
    const row = dbRef.data.cases.find((c) => c.id === params[2] && !c.deleted_at);
    if (row && mutate) {
      row.notes = params[0] ?? "";
      row.attachments = params[1] ?? [];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update tasks set title")) {
    const row = dbRef.data.tasks.find((t) => t.id === params[5] && !t.deleted_at);
    if (row && mutate) {
      row.title = params[0];
      row.assigned_to = params[1];
      row.due_at = params[2];
      row.attachments = params[3] ?? [];
      row.reminder_sent_at = null;
      row.assigned_at = params[4] || row.assigned_at || row.created_at;
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update tasks set reminder_sent_at")) {
    const row = dbRef.data.tasks.find((t) => t.id === params[1]);
    if (row && mutate) {
      row.reminder_sent_at = params[0];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update tasks set status")) {
    const row = dbRef.data.tasks.find((t) => t.id === params[1] && !t.deleted_at);
    if (row && mutate) {
      row.status = params[0];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update tasks set deleted_at") && lower.includes("where case_id")) {
    if (mutate) {
      for (const task of dbRef.data.tasks) {
        if (task.case_id === params[1] && !task.deleted_at) {
          task.deleted_at = params[0];
        }
      }
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update tasks set deleted_at")) {
    const row = dbRef.data.tasks.find((t) => t.id === params[1] && !t.deleted_at);
    if (row && mutate) {
      row.deleted_at = params[0];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update cases set status = ?")) {
    const row = dbRef.data.cases.find((c) => c.id === params[2] && !c.deleted_at);
    if (row && mutate) {
      row.status = params[0];
      row.archived_at = params[1];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update cases set deleted_at")) {
    const row = dbRef.data.cases.find((c) => c.id === params[1] && !c.deleted_at);
    if (row && mutate) {
      row.deleted_at = params[0];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.startsWith("update clients set deleted_at")) {
    const client = (dbRef.data.clients || []).find((c) => c.id === params[1] && !c.deleted_at);
    if (client && mutate) {
      client.deleted_at = params[0];
      save(dbRef.data);
    }
    return [];
  }

  if (lower.includes("from cases where client_id = ?")) {
    return dbRef.data.cases
      .filter((c) => c.client_id === params[0] && !c.deleted_at)
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  }

  if (lower.includes("select id from cases where assigned_to = ? or created_by = ?")) {
    return dbRef.data.cases
      .filter((c) => c.assigned_to === params[0] || c.created_by === params[1])
      .map((c) => ({ id: c.id }));
  }

  if (lower.includes("from cases where id = ?")) {
    const row = dbRef.data.cases.find((c) => c.id === params[0] && !c.deleted_at);
    return row ? [row] : [];
  }

  if (lower.includes("from tasks where case_id = ?")) {
    return dbRef.data.tasks
      .filter((t) => t.case_id === params[0] && !t.deleted_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  if (lower.includes("from tasks where id = ?")) {
    const row = dbRef.data.tasks.find((t) => t.id === params[0] && !t.deleted_at);
    return row ? [row] : [];
  }

  if (lower.includes("from cases where deleted_at is null") && lower.includes("attachments")) {
    return dbRef.data.cases
      .filter((c) => !c.deleted_at)
      .map((c) => ({
        id: c.id,
        title: c.title,
        attachments: Array.isArray(c.attachments) ? c.attachments : [],
      }));
  }

  if (lower.includes("from tasks where deleted_at is null") && lower.includes("attachments")) {
    return dbRef.data.tasks
      .filter((t) => !t.deleted_at)
      .map((t) => {
        const row = {
          id: t.id,
          attachments: Array.isArray(t.attachments) ? t.attachments : [],
        };
        if (lower.includes("case_id")) row.case_id = t.case_id;
        return row;
      });
  }

  if (lower.includes("from cases") && lower.includes("status = 'archived'")) {
    const isAdmin = params[1] === 1;
    const userId = params[0];
    return dbRef.data.cases
      .filter(
        (c) =>
          !c.deleted_at &&
          c.status === "archived" &&
          (isAdmin || c.assigned_to === userId)
      )
      .map((c) => {
        const client =
          c.client_id &&
          (dbRef.data.clients || []).find((cl) => cl.id === c.client_id && !cl.deleted_at);
        return {
          ...c,
          client_name: client?.name || c.client_ref || null,
        };
      })
      .sort((a, b) => (b.archived_at || "").localeCompare(a.archived_at || ""));
  }

  if (lower.includes("from cases")) {
    const isAdmin = params[1] === 1;
    const userId = params[0];
    return dbRef.data.cases
      .filter(
        (c) =>
          !c.deleted_at &&
          c.status !== "archived" &&
          (isAdmin || c.assigned_to === userId)
      )
      .map((c) => {
        const client =
          c.client_id &&
          (dbRef.data.clients || []).find((cl) => cl.id === c.client_id && !cl.deleted_at);
        return {
          ...c,
          client_name: client?.name || c.client_ref || null,
        };
      })
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at));
  }

  if (lower.includes("reminder_sent_at is null") && lower.includes("from tasks t")) {
    return dbRef.data.tasks
      .filter((t) => {
        if (t.deleted_at || t.status !== "open") return false;
        if (!t.due_at || t.reminder_sent_at || !t.assigned_to) return false;
        const caseRow = dbRef.data.cases.find((c) => c.id === t.case_id);
        return caseRow && !caseRow.deleted_at;
      })
      .map((t) => ({
        id: t.id,
        title: t.title,
        due_at: t.due_at,
        assigned_to: t.assigned_to,
        case_title: dbRef.data.cases.find((c) => c.id === t.case_id)?.title || "",
      }));
  }

  if (lower.includes("from tasks t")) {
    const isAdmin = params[1] === 1;
    const userId = params[0];
    return dbRef.data.tasks
      .filter((t) => {
        if (t.deleted_at) return false;
        const caseRow = dbRef.data.cases.find((c) => c.id === t.case_id);
        if (!caseRow || caseRow.deleted_at || caseRow.status === "archived") return false;
        return isAdmin || t.assigned_to === userId;
      })
      .map((t) => ({
        ...t,
        case_title: dbRef.data.cases.find((c) => c.id === t.case_id)?.title || "",
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  if (lower.includes("count(*) as count from cases") && lower.includes("archived")) {
    const isAdmin = params[1] === 1;
    const userId = params[0];
    const count = dbRef.data.cases.filter(
      (c) =>
        c.status === "archived" &&
        !c.deleted_at &&
        (isAdmin || c.assigned_to === userId)
    ).length;
    return [{ count }];
  }

  throw new Error(`Unsupported query: ${sql}`);
}

db.exec();
export default db;
