const express=require('express')
const router=express.Router()
const auth=require('../../../Authentication/authentication')
const connectionPromise=require('../../../database & models/databaseConnection')
 router.post('/',auth,async(req,res)=>{
    try{
        const postId=req.body.postId;
        const userId=req.user.Id
        const liked=connectionPromise.query(`insert into likes(PostId) values(${postId})`).then(
            res.status(200).json({"message":"liked..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 router.delete('/',async(req,res)=>{
    try{
        const likeId=req.body.likeId;
        const unliked=connectionPromise.query(`delete from likes where likeId=${likeId}`).then(
            res.status(200).json({"message":"unliked..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 module.exports=router;