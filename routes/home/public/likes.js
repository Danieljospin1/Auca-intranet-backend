const express=require('express')
const router=express.Router()
const connectionPromise=require('../../../database & models/databaseConnection')
 router.post('/',async(req,res)=>{
    try{
        const postId=req.body.postId;
        const liked=connectionPromise.query(`insert into liked(PostId) values(${postId})`).then(
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
        const unliked=connectionPromise.query(`delete from liked where likeId=${likeId}`).then(
            res.status(200).json({"message":"unliked..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 module.exports=router;