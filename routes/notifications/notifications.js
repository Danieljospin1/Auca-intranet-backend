// notifications.routes.js
const express = require('express');
const router = express.Router();
const { Authenticate } = require('../../Authentication/authentication');
const connectionPromise = require('../../database & models/databaseConnection');

// Helper to resolve userIds based on target group
async function resolveUserIds(target, conn) {
    const { AudienceType, AudienceId } = target;

    if (!AudienceId && AudienceType !== 'all') return [];

    try {
        switch (AudienceType) {
            case 'class': {
                const [rows] = await conn.query(`SELECT MemberId as UserId FROM roommembership WHERE ClassId = ?`, [AudienceId]);
                return rows.map(r => r.UserId);
            }
            case 'faculty': {
                const [rows] = await conn.query(`SELECT Id as UserId FROM students WHERE Faculty = ?`, [AudienceId]);
                return rows.map(r => r.UserId);
            }
            case 'department': {
                const [rows] = await conn.query(`SELECT Id as UserId FROM students WHERE Department = ?`, [AudienceId]);
                return rows.map(r => r.UserId);
            }
            case 'all': {
                const [rows] = await conn.query(`SELECT Id as UserId FROM students`);
                return rows.map(r => r.UserId);
            }
            default:
                return [];
        }
    } catch (err) {
        console.error('resolveUserIds error:', err);
        return [];
    }
}

// POST /notifications - create new notification
router.post('/', Authenticate, async (req, res) => {
    let { title, message, type, targets, receivers } = req.body;
    const userId = req.user.Id;
    const userRole = req.user.role;
    const senderId = userRole === 'staff' ? userId : 0; // System if not staff

    if (!message || !type || (!Array.isArray(targets) && !Array.isArray(receivers))) {
        return res.status(400).json({ message: 'Missing required fields or notification targets' });
    }

    // Normalize to arrays if only one item is sent
    if (!Array.isArray(receivers) && receivers) receivers = [receivers];
    if (!Array.isArray(targets) && targets) targets = [targets];

    const conn = await connectionPromise;

    try {
        const [result] = await conn.query(
            `INSERT INTO notifications (Title, Message, Type, SenderId) VALUES (?, ?, ?, ?)`,
            [title || '', message, type, senderId]
        );

        const notificationId = result.insertId;
        const deliveryInserts = [];
        const failureInserts = [];

        // Handle personalized receivers
        if (Array.isArray(receivers)) {
            for (const uid of receivers) {
                deliveryInserts.push([notificationId, uid]);
            }
        }

        // Handle group targets
        if (Array.isArray(targets) && targets.length > 0) {
            const targetInserts = targets.map(t => [notificationId, t.AudienceType, t.AudienceId || null]);

            if (targetInserts.length > 0) {
                await conn.query(
                    `INSERT INTO notification_targets (NotificationId, AudienceType, AudienceId) VALUES ?`,
                    [targetInserts]
                );
            }

            for (const target of targets) {
                const userIds = await resolveUserIds(target, conn);

                if (!userIds.length) {
                    failureInserts.push([notificationId, target.AudienceType, target.AudienceId, 'No recipients resolved']);
                } else {
                    for (const uid of userIds) {
                        deliveryInserts.push([notificationId, uid]);
                    }
                }
            }
        }

        if (deliveryInserts.length > 0) {
            await conn.query(`INSERT INTO notificationDelivery (NotificationId, ReceiverId) VALUES ?`, [deliveryInserts]);
        }

        if (failureInserts.length > 0) {
            await conn.query(
                `INSERT INTO notification_failures (NotificationId, AudienceType, AudienceId, Reason) VALUES ?`,
                [failureInserts]
            );
        }

        res.status(201).json({ message: 'Notification created', notificationId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating notification', error });
    }
});

// GET /notifications - get user notifications
router.get('/', Authenticate, async (req, res) => {
    const userId = req.user.Id; 
    const userFaculty=req.user.Faculty;
    const userRole=req.user.role;
    const conn = await connectionPromise;

    try {
        
        const [userClasses]=await conn.query(`select ClassId from roommembership where MemberId=?`,[userId]);
        const {ClassId}=userClasses[0];

        // Personalized notifications
        const [directRows] = await conn.query(
            `SELECT n.Id, n.Title, n.Message, n.Type, n.SenderId, n.IsCritical, n.CreatedAt, d.IsRead, d.ReadAt
             FROM notifications n
             JOIN notificationDelivery d ON n.Id = d.NotificationId
             WHERE d.ReceiverId = ?`,
            [userId]
        );

        // Group notifications
        const [groupRows] = await conn.query(
            `SELECT DISTINCT n.Id, n.Title, n.Message, n.Type, n.SenderId, n.IsCritical, n.CreatedAt
             FROM notifications n
             JOIN notificationtargets t ON n.Id = t.NotificationId
             WHERE
                (t.AudienceType = 'faculty' AND t.AudienceValue = ?)
                OR (t.AudienceType = 'department' AND t.AudienceValue = ?)
                OR (t.AudienceType = 'class' AND t.AudienceValue = ?)
                OR (t.AudienceType = 'all')`,
            [userFaculty, Department, ClassId]
        );

        const combined = [...directRows, ...groupRows];
        combined.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

        res.status(200).json(combined);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch notifications', error });
    }
});

module.exports = router;
