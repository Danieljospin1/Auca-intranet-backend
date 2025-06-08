const express = require('express')
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection')
const {Authenticate} = require('../../../Authentication/authentication')

router.post('/', Authenticate, async (req, res) => {
    const postId = req.body.Id;
    const reactionType = req.body.ReactionType;
    const userId = req.user.Id;
    const userRole = req.user.role;

    try {
        const [checkPastReaction] = await connectionPromise.query(`select * from POSTREACTIONS where PostId=${postId} AND PostedById=${userId}`)
        if (checkPastReaction[0]) {
            await connectionPromise.query(`update POSTREACTIONS set ReactionType='${reactionType}' where PostId=${postId} AND PostedById=${userId}`).then(
                res.send('reaction updated successfully!!!')
            )
        }
        else {
            await connectionPromise.query(`insert into POSTREACTIONS(PostId,PostedById,UserRole,ReactionType) values(${postId},${userId},'${userRole}','${reactionType}')`).then(
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
    const postId = req.body.Id;
    const userId = req.user.Id;

    try {
        await connectionPromise.query(`delete from POSTREACTIONS where PostId=${postId} AND PostedById=${userId}`).then(
            res.send('reaction has been removed')
        )
    } catch {
        (err) => {
            console.log(err)
        }
    }

})
module.exports = router;