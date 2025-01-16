const express=require('express')
const router=express.Router()
const {Authenticate}=require('../../../Authentication/authentication')
const connectionPromise=require('../../../database & models/databaseConnection')

// the route for staff to be able to set live classes for their students

router.post('/',Authenticate,async(req,res)=>{
    const{classId,topic,platform,link,classTime}=req.body;
    const userId=req.user.Id;
    try{
        await connectionPromise.query(
            `INSERT INTO liveclasses (ClassId, LecturerId, Topic, Platform, Link,ClassTime) VALUES (?, ?, ?, ?, ?, ?)`,
            [classId, userId, topic, platform, link,classTime]
          );
          res.status(201).json('Live class had been created successfully...');
    }catch{(err)=>{
        res.status(500).json('Error creating live class...')
    }}
})
router.delete('/',Authenticate,async(req,res)=>{
    const{classId}=req.body.liveClassId;
    const userRole=req.user.role
    if(userRole=='staff'){
        try{
            await connectionPromise.query(`delete from liveclasses where Id=?`,[classId]);
            res.status(200).json({"response":'Live class had been deleted successfully...'})
        }
        catch{
            res.status(500).json({"error":'Error deleting live class...'})
        }
    }
    else{
        res.status(403).json({"error":'You are not authorized to delete live classes...'})
    }
})
//route to get live classes posted
router.get('/',Authenticate,async(req,res)=>{
    const userId=req.user.Id;
    const userRole=req.user.role;
    try{
        if(userRole=='staff'){
            const liveClasses=await connectionPromise.query(`select * from liveclasses where LecturerId=?`,[userId]);
            res.status(200).json(liveClasses[0]);
        }
        else if(userRole=='student'){
            const [classGroups]=await connectionPromise.query('select ClassId from  roommembership where MemberId=?',[userId])
            const groupIds=classGroups.map(id=>id.ClassId)
            const [courses]=await connectionPromise.query(`select * from liveclasses where ClassId IN (${groupIds})`)
            res.status(200).send(courses)
        
        }
    }catch{(err)=>{
        res.status(500).json('Error fetching live classes...')
    }}
})
module.exports=router;