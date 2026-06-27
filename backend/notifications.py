# Notification routes — imported in app.py
NOTIFICATION_SQL = """
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
"""

def register_notification_routes(app, get_db, require_auth, require_admin, g, jsonify, request):

    @app.route('/api/admin/notifications', methods=['POST'])
    @require_admin
    def admin_send_notification():
        d = request.json or {}
        title   = d.get('title', '').strip()
        message = d.get('message', '').strip()
        user_id = d.get('user_id')
        if not message:
            return jsonify({'success': False, 'error': 'Message দিন'}), 400
        db = get_db()
        db.executescript(NOTIFICATION_SQL)
        if user_id:
            db.execute('INSERT INTO notifications (user_id, title, message) VALUES (?,?,?)',
                       (user_id, title, message))
        else:
            users = db.execute('SELECT id FROM users WHERE is_active=1').fetchall()
            for u in users:
                db.execute('INSERT INTO notifications (user_id, title, message) VALUES (?,?,?)',
                           (u['id'], title, message))
        db.commit()
        return jsonify({'success': True})

    @app.route('/api/notifications', methods=['GET'])
    @require_auth
    def get_notifications():
        db = get_db()
        db.executescript(NOTIFICATION_SQL)
        rows = db.execute(
            'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
            (g.user_id,)
        ).fetchall()
        unread = sum(1 for r in rows if not r['is_read'])
        return jsonify({'notifications': [dict(r) for r in rows], 'unread': unread})

    @app.route('/api/notifications/read-all', methods=['POST'])
    @require_auth
    def mark_all_read():
        db = get_db()
        db.execute('UPDATE notifications SET is_read=1 WHERE user_id=?', (g.user_id,))
        db.commit()
        return jsonify({'success': True})
