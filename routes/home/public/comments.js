const express=require('express')
const router=express.Router()
const connectionPromise=require('../../../database & models/databaseConnection')
const auth=require('../../../Authentication/authentication')

router.post('/',auth,async(req,res)=>{
    const {postId,comment}=req.body;
    const userId=req.user.studentId
    try{
        const userComment=connectionPromise.query(`insert into comments (PostedById,Comment) values(${userId},'${comment}')`).then(
            res.status(200).json({"message":"comment posted successfully..."})
        )
    }
    catch{(err)=>{
        res.status(500).json({"message":err})
    }}
    
})
module.exports=router;