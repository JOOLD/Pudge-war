import { Pool } from 'pg';

interface AnalyticsEvent {
  type: string;       // "join" | "kill" | "share_click" | "game_start" | "game_end" | "session_end"
  sessionId: string;
  ref?: string;       // referral source (sessionId of sharer)
  payload?: Record<string, any>;  // additional data (nickname, team, duration, etc.)
}

let pool: Pool | null = null;

export async function initAnalytics(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[analytics] No DATABASE_URL set, analytics disabled');
    return;
  }

  try {
    pool = new Pool({ connectionString: databaseUrl });

    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        session_id VARCHAR(100) NOT NULL,
        ref VARCHAR(100),
        payload JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('[analytics] Connected to PostgreSQL');
  } catch (err) {
    console.error('[analytics] Failed to connect:', err);
    pool = null;
  }
}

// FIRE-AND-FORGET: never throws, never blocks gameplay
export function logEvent(event: AnalyticsEvent): void {
  if (!pool) return;

  pool.query(
    'INSERT INTO events (type, session_id, ref, payload) VALUES ($1, $2, $3, $4)',
    [event.type, event.sessionId, event.ref || null, JSON.stringify(event.payload || {})]
  ).catch(err => {
    console.error('[analytics] Failed to log event:', err.message);
  });
}

export function getPool(): Pool | null {
  return pool;
}
