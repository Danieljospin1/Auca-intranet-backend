const express=require('express')
const router=express.Router()
const connectionPromise=require('../../../database & models/databaseConnection')
const auth=require('../../../Authentication/authentication')
 router.post('/',auth,async(req,res)=>{
    try{
        const postId=req.body.postId;
        const user=req.user.Id;
        const liked=connectionPromise.query(`insert into dislikes(PostId,DislikedById) values(${postId},${user})`).then(
            res.status(200).json({"message":"disliked..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 router.delete('/',async(req,res)=>{
    const user=req.user.Id;
    try{
        const dislikeId=req.body.dislikeId;
        const unliked=connectionPromise.query(`delete from dislikes where DislikedById=${user}`).then(
            res.status(200).json({"message":"dislike removed..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 module.exports=router;