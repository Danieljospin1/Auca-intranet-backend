const express=require('express')
const router=express.Router()
const connectionPromise=require('../../../database & models/databaseConnection')
 router.post('/',async(req,res)=>{
    try{
        const postId=req.body.postId;
        const liked=connectionPromise.query(`insert into disliked(PostId) values(${postId})`).then(
            res.status(200).json({"message":"disliked..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 router.delete('/',async(req,res)=>{
    try{
        const dislikeId=req.body.dislikeId;
        const unliked=connectionPromise.query(`delete from disliked where DislikeId=${dislikeId}`).then(
            res.status(200).json({"message":"dislike removed..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 module.exports=router;