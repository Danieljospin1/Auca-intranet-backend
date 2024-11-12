const express=require('express')
const router=express.Router()
const connectionPromise=require('../../../database & models/databaseConnection')
 router.post('/',async(req,res)=>{
    try{
        const postId=req.body.postId;
        const neutral=connectionPromise.query(`insert into neutral(PostId) values(${postId})`).then(
            res.status(200).json({"message":"neutralised..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 router.delete('/',async(req,res)=>{
    try{
        const neutralId=req.body.neutralId;
        const unliked=connectionPromise.query(`delete from neutral where Id=${neutralId}`).then(
            res.status(200).json({"message":"unneutralised..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
 })
 module.exports=router;