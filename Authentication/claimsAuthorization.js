/**
 * Claims Management Authorization
 *
 * Authorized users:
 *  1. AUCASA Communication: role === 'student' AND aucasaUserRole === 'information and communication'
 *  2. Communication Staff:  role === 'staff'   AND Department === 'communication' (case-insensitive, exact match)
 *
 * All other users (staff in other departments, regular students, other AUCASA ministries) are denied.
 */

/**
 * Pure helper — returns true if the decoded JWT user is allowed to manage claims.
 * Use this in middleware or inline checks.
 *
 * @param {object} user - req.user (decoded JWT payload)
 * @returns {boolean}
 */
function canAccessClaimsManagement(user) {
    // AUCASA Communication ministry
    const isAucasaCommunication =
        user?.role === 'student' &&
        user?.aucasaUserRole?.trim().toLowerCase() === 'information and communication';

    // Staff who belong specifically to the Communication department (exact match, case-insensitive)
    const isCommunicationStaff =
        user?.role === 'staff' &&
        user?.Department?.trim().toLowerCase() === 'communication';

    return isAucasaCommunication || isCommunicationStaff;
}

/**
 * Express middleware — applies canAccessClaimsManagement and returns 403 if denied.
 * Always use this AFTER the Authenticate middleware so that req.user is populated.
 *
 * Usage:
 *   router.get('/example', Authenticate, authorizeClaimsManagement, async (req, res) => { ... });
 */
function authorizeClaimsManagement(req, res, next) {
    if (!canAccessClaimsManagement(req.user)) {
        return res.status(403).json({
            message: 'Access denied. You do not have permission to manage claims.'
        });
    }
    next();
}

module.exports = { canAccessClaimsManagement, authorizeClaimsManagement };
