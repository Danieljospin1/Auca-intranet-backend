// notifications.routes.js
const express = require('express');
const router = express.Router();
const { Authenticate } = require('../../Authentication/authentication');
const connectionPromise = require('../../database & models/databaseConnection');

// Ensure tables exist and contain required columns
let tablesChecked = false;
async function ensureNotificationTables(conn) {
    if (tablesChecked) return;
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                Title VARCHAR(255) NOT NULL,
                Message TEXT,
                Type VARCHAR(50) DEFAULT 'post',
                PostId INT DEFAULT NULL,
                SenderId INT DEFAULT 0,
                IsCritical TINYINT(1) DEFAULT 0,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check for missing columns in notifications table
        try {
            const [notifCols] = await conn.query(`SHOW COLUMNS FROM notifications`);
            const colNames = notifCols.map(c => c.Field.toLowerCase());
            if (!colNames.includes('postid')) {
                await conn.query(`ALTER TABLE notifications ADD COLUMN PostId INT DEFAULT NULL`);
            }
            if (!colNames.includes('iscritical')) {
                await conn.query(`ALTER TABLE notifications ADD COLUMN IsCritical TINYINT(1) DEFAULT 0`);
            }
        } catch (colErr) {
            console.warn('Column check warning in notifications:', colErr.message);
        }

        await conn.query(`
            CREATE TABLE IF NOT EXISTS notificationtargets (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                NotificationId INT NOT NULL,
                AudienceType VARCHAR(100) NOT NULL,
                AudienceValue VARCHAR(100) DEFAULT NULL,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS notificationdelivery (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                NotificationId INT NOT NULL,
                ReceiverId INT NOT NULL,
                IsRead TINYINT(1) DEFAULT 0,
                ReadAt TIMESTAMP NULL DEFAULT NULL,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_notif (NotificationId, ReceiverId)
            )
        `);

        tablesChecked = true;
    } catch (err) {
        console.warn('ensureNotificationTables notice:', err.message);
    }
}

// POST /notifications - create new notification manually or by system
router.post('/', Authenticate, async (req, res) => {
    let { title, message, type, postId, isEmergency, isCritical, targets, receivers } = req.body;
    const userId = req.user.Id;
    const userRole = req.user.role;
    const senderId = userRole === 'staff' ? userId : 0;
    const critical = (isEmergency || isCritical) ? 1 : 0;

    if (!title && !message) {
        return res.status(400).json({ message: 'Title or message is required' });
    }

    const conn = await connectionPromise;
    await ensureNotificationTables(conn);

    try {
        const notifType = type || (postId ? 'post' : 'announcement');
        const [result] = await conn.query(
            `INSERT INTO notifications (Title, Message, Type, PostId, SenderId, IsCritical) VALUES (?, ?, ?, ?, ?, ?)`,
            [title || '', message || '', notifType, postId || null, senderId, critical]
        );

        const notificationId = result.insertId;
        const io = req.app.get('io');

        const notificationPayload = {
            id: notificationId,
            title: title || '',
            message: message || '',
            type: notifType,
            postId: postId || null,
            senderId,
            isEmergency: Boolean(critical),
            isRead: false,
            createdAt: new Date().toISOString()
        };

        // Handle personalized receivers
        if (receivers) {
            const receiverList = Array.isArray(receivers) ? receivers : [receivers];
            if (receiverList.length > 0) {
                const deliveryRows = receiverList.map(rId => [notificationId, rId, 0]);
                await conn.query(
                    `INSERT IGNORE INTO notificationdelivery (NotificationId, ReceiverId, IsRead) VALUES ?`,
                    [deliveryRows]
                );

                if (io) {
                    receiverList.forEach(rId => {
                        io.to(String(rId)).emit('newNotification', notificationPayload);
                    });
                }
            }
        }

        // Handle group targets
        if (targets) {
            const targetList = Array.isArray(targets) ? targets : [targets];
            if (targetList.length > 0) {
                const targetInserts = targetList.map(t => [
                    notificationId,
                    String(t.AudienceType || t.type || '').toLowerCase(),
                    String(t.AudienceValue || t.value || t.AudienceId || '').toLowerCase()
                ]);

                await conn.query(
                    `INSERT INTO notificationtargets (NotificationId, AudienceType, AudienceValue) VALUES ?`,
                    [targetInserts]
                );

                if (io) {
                    targetList.forEach(t => {
                        const room = (t.AudienceValue || t.value || t.AudienceType || t.type || '').toLowerCase();
                        if (room) {
                            io.to(room).emit('newNotification', notificationPayload);
                        }
                    });
                }
            }
        }

        res.status(201).json({ message: 'Notification created', notificationId });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ message: 'Error creating notification', error: error.message });
    }
});

// GET /notifications - get notifications for current user
router.get('/', Authenticate, async (req, res) => {
    const userId = req.user.Id;
    const userRole = (req.user.role || '').toLowerCase();
    const userFaculty = (req.user.Faculty || '').toLowerCase();
    const userDepartment = (req.user.Department || '').toLowerCase();
    const userStudyLevel = (req.user.StudyLevel || '').toLowerCase();

    const conn = await connectionPromise;
    await ensureNotificationTables(conn);

    try {
        // Fetch active classes for the user
        let classIds = [];
        try {
            const [userClasses] = await conn.query(
                `SELECT ClassId FROM roommembership WHERE MemberId = ? AND IsActive = 1`,
                [userId]
            );
            if (Array.isArray(userClasses) && userClasses.length > 0) {
                classIds = userClasses.map(c => String(c.ClassId).toLowerCase());
            }
        } catch (e) {
            console.warn('Error fetching user classes for notifications:', e.message);
        }

        // Build target values to match against notificationtargets.AudienceValue or AudienceType
        const audienceMatches = ['all'];
        if (userRole === 'staff') {
            audienceMatches.push('staff');
            if (userDepartment) audienceMatches.push(userDepartment);
        } else {
            audienceMatches.push('students');
            if (userStudyLevel) audienceMatches.push(userStudyLevel);
            if (userFaculty) audienceMatches.push(userFaculty);
            if (userDepartment) audienceMatches.push(userDepartment);
            if (classIds.length > 0) {
                classIds.forEach(cId => audienceMatches.push(cId));
            }
        }

        const placeholders = audienceMatches.map(() => '?').join(',');

        const query = `
            SELECT 
                n.Id as id,
                n.Title as title,
                n.Message as message,
                n.Type as type,
                n.PostId as postId,
                n.SenderId as senderId,
                n.IsCritical as isCritical,
                n.CreatedAt as createdAt,
                COALESCE(d.IsRead, 0) AS isRead,
                d.ReadAt as readAt
            FROM notifications n
            LEFT JOIN notificationdelivery d 
                ON n.Id = d.NotificationId AND d.ReceiverId = ?
            WHERE 
                (d.ReceiverId = ? AND n.Id NOT IN (SELECT t.NotificationId FROM notificationtargets t))
                OR (
                    (n.SenderId != ? OR n.SenderId IS NULL OR n.SenderId = 0)
                    AND (
                        d.ReceiverId = ?
                        OR n.Id IN (
                            SELECT t.NotificationId FROM notificationtargets t
                            WHERE LOWER(COALESCE(t.AudienceType, '')) IN (${placeholders})
                               OR LOWER(COALESCE(t.AudienceValue, '')) IN (${placeholders})
                        )
                    )
                )
            ORDER BY n.CreatedAt DESC
            LIMIT 100
        `;

        const params = [userId, userId, userId, userId, ...audienceMatches, ...audienceMatches];
        const [rows] = await conn.query(query, params);

        const formatted = rows.map(r => ({
            id: String(r.id),
            title: r.title || '',
            message: r.message || '',
            type: r.type || 'post',
            postId: r.postId ? Number(r.postId) : null,
            senderId: r.senderId,
            isEmergency: Boolean(r.isCritical),
            isRead: Boolean(r.isRead),
            readAt: r.readAt,
            createdAt: r.createdAt
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
    }
});

// PATCH /notifications/:id/read - mark single notification as read
router.patch('/:id/read', Authenticate, async (req, res) => {
    const notificationId = req.params.id;
    const userId = req.user.Id;
    const conn = await connectionPromise;
    await ensureNotificationTables(conn);

    try {
        await conn.query(
            `INSERT INTO notificationdelivery (NotificationId, ReceiverId, IsRead, ReadAt)
             VALUES (?, ?, 1, NOW())
             ON DUPLICATE KEY UPDATE IsRead = 1, ReadAt = NOW()`,
            [notificationId, userId]
        );
        res.status(200).json({ message: 'Notification marked as read', id: notificationId });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        res.status(500).json({ message: 'Error marking notification as read', error: err.message });
    }
});

// PATCH /notifications/read-all - mark all notifications as read for current user
router.patch('/read-all', Authenticate, async (req, res) => {
    const userId = req.user.Id;
    const conn = await connectionPromise;
    await ensureNotificationTables(conn);

    try {
        // Find all visible notification IDs for this user
        const [notifs] = await conn.query(
            `SELECT DISTINCT n.Id FROM notifications n
             LEFT JOIN notificationtargets t ON n.Id = t.NotificationId
             LEFT JOIN notificationdelivery d ON n.Id = d.NotificationId
             WHERE (d.ReceiverId = ? AND n.Id NOT IN (SELECT nt.NotificationId FROM notificationtargets nt))
                OR ((n.SenderId != ? OR n.SenderId IS NULL OR n.SenderId = 0) AND (d.ReceiverId = ? OR t.Id IS NOT NULL))
             ORDER BY n.CreatedAt DESC LIMIT 100`,
            [userId, userId, userId]
        );

        if (Array.isArray(notifs) && notifs.length > 0) {
            const values = notifs.map(n => [n.Id, userId, 1]);
            await conn.query(
                `INSERT INTO notificationdelivery (NotificationId, ReceiverId, IsRead, ReadAt)
                 VALUES ?
                 ON DUPLICATE KEY UPDATE IsRead = 1, ReadAt = NOW()`,
                [values.map(v => [...v, new Date()])]
            );
        }

        res.status(200).json({ message: 'All notifications marked as read' });
    } catch (err) {
        console.error('Error marking all notifications as read:', err);
        res.status(500).json({ message: 'Error marking all notifications as read', error: err.message });
    }
});

module.exports = router;
