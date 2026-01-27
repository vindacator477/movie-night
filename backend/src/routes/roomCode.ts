// Generate short room code like "M8X2"
// Format: Letter + 3 alphanumeric characters
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    if (i === 0) {
      // First character is always a letter
      code += chars.charAt(Math.floor(Math.random() * 26)); // A-Z
    } else {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return code;
}

// Check if room code is valid format
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z][A-Z0-9]{3}$/.test(code.toUpperCase());
}

// Check if room code is available in database
export async function isRoomCodeAvailable(code: string, db: any, excludeSessionId?: string): Promise<boolean> {
  let query = 'SELECT COUNT(*) as count FROM sessions WHERE room_code = $1';
  const params: string[] = [code.toUpperCase()];
  
  if (excludeSessionId) {
    query += ' AND id != $2';
    params.push(excludeSessionId);
  }
  
  const result = await db.query(query, params);
  return parseInt(result.rows[0].count) === 0;
}

// Get or generate unique room code
export async function getUniqueRoomCode(db: any): Promise<string> {
  const maxAttempts = 10;
  
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateRoomCode();
    if (await isRoomCodeAvailable(code, db)) {
      return code;
    }
  }
  
  // Fallback: use UUID last 4 chars with letter prefix
  const fallback = 'M' + crypto.randomUUID().replace(/-/g, '').slice(-3).toUpperCase();
  return fallback;
}
