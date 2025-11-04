const express = require('express')
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection')
const {Authenticate} = require('../../../Authentication/authentication')

router.post('/', Authenticate, async (req, res) => {
    const postId = req.body.postId;
    const reactionType = req.body.reactionType;
    const userId = req.user.Id;
    const userRole = req.user.role;

    try {
        const [checkPastReaction] = await connectionPromise.query(`select * from postreactions where PostId=? AND PostedById=?`,[postId,userId]);
        if (checkPastReaction.length > 0) {
            await connectionPromise.query(`update postreactions set ReactionType=? where PostId=? AND PostedById=?`,[reactionType,postId,userId]).then(
                res.send('reaction updated successfully!!!')
            )
        }
        else {
            await connectionPromise.query(`insert into postreactions(PostId,PostedById,UserRole,ReactionType) values(${postId},${userId},'${userRole}','${reactionType}')`).then(
                res.send('reaction posted!!!')
            )
        }
    }
    catch {
        (err) => {
            console.log(err)
        }
    }
})

router.delete('/', Authenticate, async (req, res) => {
    const postId = req.body.postId;
    const userId = req.user.Id;

    try {
        await connectionPromise.query(`delete from postreactions where PostId=? AND PostedById=?`,[postId,userId]).then(
            res.send('reaction has been removed')
        )
    } catch {
        (err) => {
            console.log(err)
        }
    }

})
router.patch('/', async (req, res) => {
    const postIds = req.body.postIds;
    try {
        if (!postIds || postIds.length === 0) {
            return res.status(400).json({ error: 'No post IDs provided' });
        }

        // Use parameterized query to prevent SQL injection
        const placeholders = postIds.map(() => '?').join(',');
        
        const [reactions] = await connectionPromise.query(
            `SELECT 
                PostId,
                JSON_ARRAYAGG(ReactionType) as ReactionTypes,
                COUNT(*) as count
            FROM postreactions 
            WHERE PostId IN (${placeholders})
            GROUP BY PostId`,
            postIds
        );

        // Format the response
        const formattedReactions = reactions.map(reaction => ({
            PostId: reaction.PostId,
            ReactionTypes: reaction.ReactionTypes || [],
            count: reaction.count
        }));

        res.status(200).json(formattedReactions);
    }
    catch (err) {
        console.error('Error fetching reactions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
module.exports = router;